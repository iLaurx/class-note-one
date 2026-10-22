import assert from 'node:assert/strict';
import { spawn, execFile } from 'node:child_process';
import { mkdtemp, mkdir, writeFile, readdir } from 'node:fs/promises';
import { promisify } from 'node:util';
import path from 'node:path';
import net from 'node:net';
import { chromium, expect } from '@playwright/test';
import {
  configure,
  navigate,
  attachAudit,
  snapshot,
  createTask,
} from '../helpers/audit-browser.ts';

const exec = promisify(execFile);
const output = path.resolve('test-results/native-audit');
await mkdir(output, { recursive: true });
const profile = await mkdtemp(path.join(output, 'profile-'));
const executable = path.resolve('src-tauri/target/release/classnote.exe');
const results = [];
async function poll(operation) {
  const until = Date.now() + 25000;
  while (Date.now() < until) {
    try {
      const result = await operation();
      if (result) return result;
    } catch {
      /* startup */
    }
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
  throw new Error('No se pudo iniciar la aplicación en el perfil temporal.');
}
async function launch() {
  const server = net.createServer();
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  await new Promise((resolve) => server.close(resolve));
  const child = spawn(executable, [], {
    windowsHide: true,
    stdio: 'ignore',
    env: {
      ...process.env,
      WEBVIEW2_USER_DATA_FOLDER: profile,
      WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS: `--remote-debugging-port=${port} --remote-debugging-address=127.0.0.1`,
    },
  });
  await poll(async () => (await fetch(`http://127.0.0.1:${port}/json/version`)).ok);
  const browser = await chromium.connectOverCDP(`http://127.0.0.1:${port}`);
  const context = browser.contexts()[0];
  const page = await poll(() =>
    context.pages().find((p) => p.url().startsWith('http://tauri.localhost')),
  );
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  const closeRequest = () =>
    exec(
      'powershell.exe',
      [
        '-NoProfile',
        '-NonInteractive',
        '-Command',
        `(Get-Process -Id ${child.pid}).CloseMainWindow()`,
      ],
      { windowsHide: true },
    );
  return { child, browser, context, page, closeRequest };
}

let session;
try {
  session = await launch();
  const { page, context, child, closeRequest } = session;
  assert.ok((await readdir(profile)).length > 0, 'WebView2 debe usar el perfil temporal.');
  await attachAudit(page);
  assert.equal(
    await page.evaluate(async () => {
      const { db } = globalThis.window.classNoteAudit;
      return (
        await Promise.all(
          db.tables.filter((table) => table.name !== 'appSettings').map((table) => table.count()),
        )
      ).every((count) => count === 0);
    }),
    true,
    'La base temporal debe estar vacía antes de escribir datos sintéticos.',
  );
  await configure(page, 1);
  await context.setOffline(true);
  await page.getByLabel('Nombre o nombres').fill('Borrador nativo');
  const rejectedClose = page.waitForEvent('dialog');
  page.once('dialog', (d) => d.dismiss());
  await closeRequest();
  await rejectedClose;
  await expect(page.getByLabel('Nombre o nombres')).toHaveValue('Borrador nativo');
  assert.equal(child.exitCode, null);
  results.push('Cancelar cierre nativo conserva el alta y la ventana.');
  page.once('dialog', (d) => d.dismiss());
  await page.getByRole('navigation').getByRole('link', { name: 'Inicio', exact: true }).click();
  await expect(page.getByLabel('Nombre o nombres')).toHaveValue('Borrador nativo');
  page.once('dialog', (d) => d.accept());
  await page.getByRole('button', { name: 'Cancelar formulario' }).click();
  await page.getByRole('button', { name: 'Ver ficha de Prueba, Alumno 0' }).click();
  await page.getByRole('button', { name: 'Editar ficha', exact: true }).click();
  await page.getByLabel('Nombre o nombres').fill('Edición nativa');
  const rejectedEditClose = page.waitForEvent('dialog');
  page.once('dialog', (d) => d.dismiss());
  await closeRequest();
  await rejectedEditClose;
  await expect(page.getByLabel('Nombre o nombres')).toHaveValue('Edición nativa');
  let unexpectedDialogs = 0;
  const unexpected = async (d) => {
    unexpectedDialogs++;
    await d.dismiss();
  };
  page.on('dialog', unexpected);
  await page.getByRole('button', { name: 'Guardar alumno', exact: true }).click();
  await expect(page.getByLabel('Nombre o nombres')).toHaveValue('');
  await navigate(page, 'Inicio');
  assert.equal(unexpectedDialogs, 0);
  page.off('dialog', unexpected);
  results.push('Cancelar cierre conserva edición; guardar permite navegar sin avisos.');
  await createTask(page);
  const regression = await page.evaluate(async () => {
    const { r, db, backup } = globalThis.window.classNoteAudit;
    const g = (await db.groups.toArray())[0],
      y = (await db.schoolYears.toArray())[0];
    const e = (await db.enrollments.toArray())[0],
      a = (await db.assignments.toArray())[0];
    const c = { schoolYearId: y.id, groupId: g.id, enrollmentId: e.id };
    await r.createSubmission(c, { assignmentId: a.id, status: 'submitted' });
    await r.createReadingLog(c, { date: '2026-10-19', title: 'Historia', minutes: 12 });
    await r.createStudentNote(c, { date: '2026-10-19', category: 'academic', body: 'Historia' });
    let rejected = 0;
    const before = JSON.stringify(await Promise.all(db.tables.map((t) => t.toArray())));
    for (const operation of [
      () => r.updateSchoolYear(y.id, { ...y, startDate: '2026-10-20' }),
      () => r.updateEnrollment(c, { status: 'inactive', leftAt: '2026-10-18' }),
    ]) {
      try {
        await operation();
      } catch {
        rejected++;
      }
    }
    const atomic = before === JSON.stringify(await Promise.all(db.tables.map((t) => t.toArray())));
    await r.updateSchoolYear(y.id, { ...y, startDate: '2026-10-19', endDate: '2026-10-25' });
    await r.updateEnrollment(c, { status: 'inactive', leftAt: '2026-10-19' });
    const source = await backup.export();
    const preview = await backup.preview(source);
    const saved = JSON.stringify(await Promise.all(db.tables.map((t) => t.toArray())));
    await backup.restore(source, true, async () => true);
    return {
      rejected,
      atomic,
      restored: saved === JSON.stringify(await Promise.all(db.tables.map((t) => t.toArray()))),
      counts: preview.counts,
      source,
    };
  });
  assert.equal(regression.rejected, 2);
  assert.equal(regression.atomic, true);
  assert.equal(regression.restored, true);
  for (const table of ['assignments', 'submissions', 'readingLogs', 'studentNotes'])
    assert.equal(regression.counts[table], 1);
  await writeFile(path.join(output, 'synthetic-backup.json'), regression.source);
  results.push(
    'Dos regresiones de fechas rechazadas sin escrituras parciales; cambios válidos y respaldo/restauración exactos.',
  );
  // Native WebView2 hosts the real task editor. A second repository connection simulates the other session.
  await navigate(page, 'Tareas');
  await page.getByRole('button', { name: 'Editar tarea Tarea de prueba' }).click();
  await page.getByLabel('Título', { exact: true }).fill('Borrador de tarea nativo');
  await page.evaluate(async () => {
    const { r, db } = globalThis.window.classNoteAudit;
    const a = (await db.assignments.toArray())[0];
    const g = (await db.groups.toArray())[0];
    await r.updateAssignment(
      { schoolYearId: g.schoolYearId, groupId: g.id },
      a.id,
      { ...a, description: 'Otra sesión' },
      a,
    );
  });
  await page.getByRole('button', { name: 'Guardar tarea' }).click();
  await expect(page.getByRole('alert')).toContainText('otra ventana');
  await expect(page.getByLabel('Título', { exact: true })).toHaveValue('Borrador de tarea nativo');
  results.push('Conflicto de tarea en WebView2 conserva el borrador y la versión ajena.');
  page.once('dialog', (d) => d.accept());
  await page.getByRole('button', { name: 'Cancelar tarea' }).click();
  const persisted = await snapshot(page);
  await page.screenshot({ path: path.join(output, 'windows.png') });
  await closeRequest();
  await poll(() => child.exitCode !== null);
  await session.browser.close();
  session = await launch();
  await attachAudit(session.page);
  assert.deepEqual(await snapshot(session.page), persisted);
  results.push('Cerrar y abrir Windows conserva exactamente las diez tablas.');
  await navigate(session.page, 'Alumnos');
  await session.page.getByLabel('Nombre o nombres').fill('Descartar al cerrar');
  const acceptedClose = session.page.waitForEvent('dialog');
  session.page.once('dialog', (d) => d.accept());
  await session.closeRequest();
  await acceptedClose;
  await poll(() => session.child.exitCode !== null);
  results.push('Aceptar descarte cierra la ventana nativa.');
  await session.browser.close();
  session = undefined;
  await writeFile(
    path.join(output, 'result.json'),
    JSON.stringify({ profile, checks: results.length, results }, null, 2),
  );
  console.log(JSON.stringify({ checks: results.length, results, profile }, null, 2));
} finally {
  if (session) {
    await session.page
      .evaluate(() => {
        globalThis.window.confirm = () => true;
      })
      .catch(() => {});
    await session.closeRequest().catch(() => {});
    await session.browser.close().catch(() => {});
  }
}
