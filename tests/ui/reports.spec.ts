import { expect, test, type Page } from '@playwright/test';
import path from 'node:path';
import ExcelJS from 'exceljs';

async function prepare(page: Page, students = true) {
  await page.clock.setFixedTime(new Date(2026, 9, 21, 12));
  await page.route(`http://127.0.0.1:${process.env.CN_UI_PORT ?? 1421}/assets/**`, (route) =>
    route.fulfill({
      path: path.join(
        process.cwd(),
        'dist/assets',
        path.basename(new URL(route.request().url()).pathname),
      ),
    }),
  );
  await page.goto('/');
  await page.getByRole('link', { name: 'Configurar mi grupo' }).first().click();
  await page.getByRole('button', { name: 'Crear ciclo escolar', exact: true }).click();
  await page.getByLabel('Etiqueta', { exact: true }).fill('2026–2027');
  await page.getByLabel('Fecha de inicio').fill('2026-08-01');
  await page.getByLabel('Fecha de fin').fill('2027-07-31');
  await page.getByRole('button', { name: 'Guardar ciclo', exact: true }).click();
  await expect(page.getByRole('form')).toHaveCount(0);
  await page.getByRole('button', { name: 'Crear grupo', exact: true }).click();
  await page.getByRole('combobox', { name: 'Grado', exact: true }).selectOption('2');
  await page.getByLabel('Nombre', { exact: true }).fill('A');
  await page.getByRole('button', { name: 'Guardar grupo', exact: true }).click();
  await expect(page.getByRole('form')).toHaveCount(0);
  if (students) {
    await page.getByRole('navigation').getByRole('link', { name: 'Alumnos', exact: true }).click();
    for (const name of ['Ana', 'Bruno', 'Carla', 'Diego', 'Elena', 'Felipe', 'Gabriela']) {
      await page.getByLabel('Nombre o nombres').fill(name);
      await page.getByLabel('Apellido o apellidos').fill('Prueba');
      await page.getByRole('button', { name: 'Guardar alumno', exact: true }).click();
      await expect(page.getByLabel('Nombre o nombres')).toHaveValue('');
    }
    // Seed only this isolated test browser's records to cover preview/export coherence.
    await page.evaluate(async () => {
      const req = indexedDB.open('classnote');
      const db = await new Promise<IDBDatabase>((resolve) => {
        req.onsuccess = () => resolve(req.result);
      });
      const tx = db.transaction(
        ['students', 'enrollments', 'attendance', 'assignments', 'submissions', 'readingLogs'],
        'readwrite',
      );
      const students = tx.objectStore('students').getAll();
      const enrollments = tx.objectStore('enrollments').getAll();
      enrollments.onsuccess = () => {
        const names = new Map(students.result.map((s) => [s.id, s.firstName as string]));
        const members = enrollments.result.sort((a, b) =>
          names.get(a.studentId)!.localeCompare(names.get(b.studentId)!, 'es'),
        );
        const stamp = { createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
        const assignmentId = crypto.randomUUID();
        tx.objectStore('assignments').put({
          ...stamp,
          id: assignmentId,
          groupId: members[0].groupId,
          title: 'Sumas de dos cifras',
          assignedDate: '2026-10-21',
        });
        members.forEach((m, i) => {
          tx.objectStore('attendance').put({
            ...stamp,
            id: crypto.randomUUID(),
            enrollmentId: m.id,
            date: '2026-10-21',
            status: i === 1 ? 'absent' : 'present',
          });
          if (i < 4)
            tx.objectStore('submissions').put({
              ...stamp,
              id: crypto.randomUUID(),
              assignmentId,
              enrollmentId: m.id,
              status: 'submitted',
            });
          if (i < 2)
            tx.objectStore('readingLogs').put({
              ...stamp,
              id: crypto.randomUUID(),
              enrollmentId: m.id,
              date: '2026-10-21',
              title: 'Un cuento',
              minutes: 10,
            });
        });
      };
      await new Promise<void>((resolve, reject) => {
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
      db.close();
    });
  }
  await page.getByRole('navigation').getByRole('link', { name: 'Reportes', exact: true }).click();
  await expect(
    page.getByRole('table', { name: 'Resumen de los datos seleccionados' }),
  ).toBeVisible();
}
async function mockSave(page: Page, mode: 'save' | 'cancel' | 'error' | 'slow') {
  await page.evaluate((mode) => {
    const state = { calls: 0, bytes: [] as number[] };
    Object.assign(window, {
      reportCheck: state,
      isTauri: true,
      __TAURI_INTERNALS__: {
        invoke: async (command: string, args: { bytes: number[] }) => {
          if (command !== 'save_group_report') throw new Error('Comando inesperado');
          state.calls++;
          state.bytes = args.bytes;
          if (mode === 'slow') await new Promise((resolve) => setTimeout(resolve, 1000));
          if (mode === 'error') throw new Error('No se pudo guardar el reporte. Reintenta.');
          return mode !== 'cancel';
        },
      },
    });
  }, mode);
}
async function exportedBook(page: Page) {
  const bytes = await page.evaluate(
    () => (window as unknown as { reportCheck: { bytes: number[] } }).reportCheck.bytes,
  );
  const book = new ExcelJS.Workbook();
  await book.xlsx.load(Buffer.from(bytes) as unknown as ExcelJS.Buffer);
  return book;
}
for (const width of [1280, 768, 360]) {
  test(`reportes: siete alumnos, periodos, selección y Excel offline a ${width}px`, async ({
    page,
    context,
  }) => {
    await page.setViewportSize({ width, height: 1000 });
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await prepare(page);
    await context.setOffline(true);
    await mockSave(page, 'save');
    await expect(page.getByText(/lecturas|observaciones/i)).toHaveCount(0);
    await expect(
      page.getByText('19/10/2026 al 25/10/2026', { exact: false }).first(),
    ).toBeVisible();
    const preview = page.getByRole('complementary', { name: 'Vista previa del reporte' });
    await expect(preview.getByRole('row')).toHaveCount(8);
    await expect(preview.getByRole('row').filter({ hasText: 'Prueba, Ana' })).toContainText('100%');
    await expect(preview.getByRole('row').filter({ hasText: 'Prueba, Bruno' })).toContainText('0%');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.screenshot({ path: `test-results/reports/semanal-${width}.png`, fullPage: true });
    await page.getByRole('button', { name: 'Mensual', exact: true }).click();
    await expect(page.getByLabel('Mes del reporte')).toHaveValue('2026-10');
    await expect(
      page.getByText('01/10/2026 al 31/10/2026', { exact: false }).first(),
    ).toBeVisible();
    await page.getByRole('button', { name: 'Todo el ciclo', exact: true }).click();
    await expect(
      page.getByText('01/08/2026 al 31/07/2027', { exact: false }).first(),
    ).toBeVisible();
    await page.getByRole('button', { name: 'Fechas libres', exact: true }).click();
    await page.getByLabel('Desde', { exact: true }).fill('2026-10-22');
    await page.getByLabel('Hasta', { exact: true }).fill('2026-10-21');
    await expect(page.getByRole('alert')).toContainText('posterior');
    await expect(page.getByRole('button', { name: 'Descargar Excel' })).toBeDisabled();
    await page.getByLabel('Desde', { exact: true }).fill('2026-10-21');
    await expect(page.getByRole('checkbox', { name: /Lectura/ })).toHaveCount(0);
    await page.getByRole('checkbox', { name: 'Actividades y tareas', exact: false }).uncheck();
    await page.getByRole('checkbox', { name: 'Detalle por día y actividad' }).uncheck();
    await page.locator('.report-student-picker summary').click();
    await page.getByRole('checkbox', { name: 'Todo el grupo', exact: true }).uncheck();
    await expect(page.getByRole('alert')).toContainText('alumno');
    await page.getByRole('checkbox', { name: 'Prueba, Ana', exact: true }).check();
    await expect(preview.getByRole('row')).toHaveCount(2);
    const download = page.getByRole('button', { name: 'Descargar Excel' });
    await download.focus();
    await page.keyboard.press('Enter');
    await expect(
      page.getByRole('status').filter({ hasText: 'Reporte Excel guardado.' }),
    ).toBeVisible();
    const book = await exportedBook(page);
    expect(book.worksheets.map((s) => s.name)).toEqual(['Resumen', 'Asistencia']);
    expect(JSON.stringify(book.model)).toContain('Prueba, Ana');
    expect(JSON.stringify(book.model)).not.toMatch(/Prueba, Bruno|Semana del|Lecturas|Entregadas/);
    expect(errors).toEqual([]);
  });
}

test('cancelar, fallo nativo, fallo de lectura, reintento y doble envío', async ({ page }) => {
  await prepare(page, false);
  const download = page.getByRole('button', { name: 'Descargar Excel' });
  await mockSave(page, 'cancel');
  await download.click();
  await expect(
    page.getByText('Exportación cancelada. No se escribió ningún archivo.'),
  ).toBeVisible();
  await mockSave(page, 'error');
  await download.click();
  await expect(page.getByRole('alert')).toContainText('No se pudo guardar');
  await page.evaluate(() => {
    const original = IDBDatabase.prototype.transaction;
    IDBDatabase.prototype.transaction = function (...args: Parameters<IDBDatabase['transaction']>) {
      if (args[1] === 'readonly') {
        IDBDatabase.prototype.transaction = original;
        throw new Error('Fallo sintético');
      }
      return original.apply(this, args);
    };
  });
  await download.click();
  await expect(page.getByRole('alert')).toBeVisible();
  await expect(page.getByText('Reporte Excel guardado.')).toHaveCount(0);
  await mockSave(page, 'slow');
  await download.dblclick({ force: true });
  await expect(page.getByText('Reporte Excel guardado.')).toBeVisible();
  expect(
    await page.evaluate(
      () => (window as unknown as { reportCheck: { calls: number } }).reportCheck.calls,
    ),
  ).toBe(1);
});

test('contenido obligatorio, cambio de periodo y reporte vacío', async ({ page }) => {
  await prepare(page, false);
  for (const name of ['Asistencia', 'Actividades y tareas'])
    await page.getByRole('checkbox', { name, exact: false }).uncheck();
  await expect(page.getByRole('button', { name: 'Descargar Excel' })).toBeDisabled();
  await expect(page.getByRole('alert')).toContainText('contenido');
  await page.getByRole('checkbox', { name: 'Lista de alumnos', exact: false }).check();
  await expect(page.getByRole('button', { name: 'Descargar Excel' })).toBeEnabled();
  await expect(page.getByText('No hay alumnos en esta selección.')).toBeVisible();
  await page.getByRole('button', { name: 'Mensual', exact: true }).click();
  await page.getByLabel('Mes del reporte').fill('2026-09');
  await expect(page.getByText('01/09/2026 al 30/09/2026', { exact: false }).first()).toBeVisible();
  await mockSave(page, 'save');
  await page.getByRole('button', { name: 'Descargar Excel' }).click();
  await expect(page.getByText('Reporte Excel guardado.')).toBeVisible();
  expect((await exportedBook(page)).worksheets.map((s) => s.name)).toEqual(['Resumen', 'Alumnos']);
});
