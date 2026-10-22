import { expect, test } from '@playwright/test';
import {
  configure,
  navigate,
  createTask,
  attachAudit,
  snapshot,
  failWrite,
  noOverflow,
} from '../helpers/audit-browser';
for (const width of [1100, 768, 360])
  test(`CN007 tareas, estados, comentarios, corrección y filtros offline a ${width}px`, async ({
    page,
    context,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await configure(page, 4);
    await createTask(page);
    await context.setOffline(true);
    await page.getByRole('button', { name: 'Ver entregas de Tarea de prueba' }).click();
    const groups = page.getByRole('group', { name: /Estado de/ });
    await expect(groups).toHaveCount(4);
    for (const [i, label] of ['Entregada', 'Pendiente', 'Incompleta', 'No entregada'].entries()) {
      await groups.nth(i).getByRole('button', { name: label, exact: true }).click();
      await page
        .getByLabel(/Comentario de/)
        .nth(i)
        .fill('Comentario ' + i);
    }
    await page.getByText('Buscar y filtrar alumnos', { exact: true }).click();
    await page.getByLabel('Filtrar entregas por estado').selectOption('not_submitted');
    await expect(page.getByRole('button', { name: /Guardar entregas/ })).toContainText('(4)');
    await page.getByRole('button', { name: /Guardar entregas/ }).click();
    await expect(page.getByText('Entregas guardadas: 4.', { exact: true })).toBeVisible();
    await page.getByLabel('Filtrar entregas por estado').selectOption('');
    await groups.first().getByRole('button', { name: 'Incompleta', exact: true }).click();
    page.once('dialog', (d) => d.dismiss());
    await page.getByRole('button', { name: /Guardar entregas/ }).click();
    await expect(page.getByRole('button', { name: /Guardar entregas/ })).toBeEnabled();
    page.once('dialog', (d) => d.accept());
    await page.getByRole('button', { name: /Guardar entregas/ }).click();
    await expect(page.getByRole('button', { name: /Guardar entregas/ })).toBeDisabled();
    await noOverflow(page);
    await context.setOffline(false);
    await page.reload();
    await page.getByRole('button', { name: 'Ver entregas de Tarea de prueba' }).click();
    await expect(page.getByLabel(/Comentario de/).nth(3)).toHaveValue('Comentario 3');
    await expect(
      groups.first().getByRole('button', { name: 'Incompleta', exact: true }),
    ).toHaveAttribute('aria-pressed', 'true');
  });
test('CN007 protege formulario, reemplazo, navegación y entregas', async ({ page }) => {
  await configure(page, 1);
  await navigate(page, 'Tareas');
  await page.getByRole('button', { name: 'Crear tarea', exact: true }).click();
  await page.getByLabel('Título', { exact: true }).fill('Borrador');
  for (const action of [
    () => page.getByRole('button', { name: 'Crear tarea', exact: true }).click(),
    () => page.getByRole('button', { name: 'Volver al listado' }).click(),
    () => page.getByRole('navigation').getByRole('link', { name: 'Inicio', exact: true }).click(),
  ]) {
    page.once('dialog', (d) => d.dismiss());
    await action();
    await expect(page.getByLabel('Título', { exact: true })).toHaveValue('Borrador');
  }
  page.once('dialog', (d) => d.accept());
  await page.getByRole('button', { name: 'Cancelar tarea' }).click();
  await createTask(page);
  await page.getByRole('button', { name: 'Ver entregas de Tarea de prueba' }).click();
  await page.getByLabel(/Comentario de/).fill('Entrega pendiente');
  page.once('dialog', (d) => d.dismiss());
  await page.getByRole('button', { name: 'Volver al listado' }).click();
  await expect(page.getByLabel(/Comentario de/)).toHaveValue('Entrega pendiente');
});
test('CN007 fallo de escritura conserva borrador y reintento no duplica', async ({ page }) => {
  await configure(page, 1);
  await navigate(page, 'Tareas');
  const before = await snapshot(page);
  await page.getByRole('button', { name: 'Crear tarea', exact: true }).click();
  await page.getByLabel('Título', { exact: true }).fill('Reintento');
  await failWrite(page, 'assignments', 'add');
  await page.getByRole('button', { name: 'Guardar tarea' }).click();
  await expect(page.getByRole('alert')).toBeVisible();
  expect(await snapshot(page)).toEqual(before);
  await expect(page.getByLabel('Título', { exact: true })).toHaveValue('Reintento');
  await page.getByRole('button', { name: 'Guardar tarea' }).dblclick({ force: true });
  await expect(page.getByRole('form')).toHaveCount(0);
  expect(await page.evaluate(() => window.classNoteAudit.db.assignments.count())).toBe(1);
});
test('CN007 dos ediciones conservan borrador en conflicto y recuperación explícita', async ({
  page,
  context,
}) => {
  await configure(page, 1);
  await createTask(page);
  await page.getByRole('button', { name: 'Editar tarea Tarea de prueba' }).click();
  await page.getByLabel('Título', { exact: true }).fill('Mi borrador');
  const second = await context.newPage();
  await second.goto('/#/tareas');
  await second.getByRole('button', { name: 'Editar tarea Tarea de prueba' }).click();
  await second.getByLabel('Descripción (opcional)').fill('Guardado desde otra ventana');
  await second.getByRole('button', { name: 'Guardar tarea' }).click();
  await expect(second.getByRole('form')).toHaveCount(0);
  const before = await snapshot(page);
  await page.getByRole('button', { name: 'Guardar tarea' }).click();
  await expect(page.getByRole('alert')).toContainText('otra ventana');
  await expect(page.getByLabel('Título', { exact: true })).toHaveValue('Mi borrador');
  expect(await snapshot(page)).toEqual(before);
  page.once('dialog', (d) => d.dismiss());
  await page.getByRole('button', { name: 'Cancelar tarea' }).click();
  await expect(page.getByLabel('Título', { exact: true })).toHaveValue('Mi borrador');
  page.once('dialog', (d) => d.accept());
  await page.getByRole('button', { name: 'Cancelar tarea' }).click();
  await page.getByRole('button', { name: 'Editar tarea Tarea de prueba' }).click();
  await expect(page.getByLabel('Descripción (opcional)')).toHaveValue(
    'Guardado desde otra ventana',
  );
  await page.getByLabel('Título', { exact: true }).fill('Mi borrador');
  await page.getByRole('button', { name: 'Guardar tarea' }).click();
  await expect(page.getByRole('button', { name: 'Editar tarea Mi borrador' })).toBeVisible();
  await second.close();
});
test('CN007 sin contexto, fecha inválida y lectura recuperable', async ({ page }) => {
  await page.goto('/#/tareas');
  await expect(
    page.getByText('Configura tu grupo en Configuración para gestionar tareas.'),
  ).toBeVisible();
  await configure(page);
  await navigate(page, 'Tareas');
  await page.getByRole('button', { name: 'Crear tarea', exact: true }).click();
  await page.getByLabel('Título', { exact: true }).fill('Fecha');
  await page.getByLabel('Fecha de asignación').fill('2026-07-31');
  await page.getByRole('button', { name: 'Guardar tarea' }).click();
  await expect(page.getByRole('form')).toHaveCount(1);
  expect(await page.evaluate(() => window.classNoteAudit.db.assignments.count())).toBe(0);
  await page.getByLabel('Fecha de asignación').fill('2026-08-01');
  await page.getByRole('button', { name: 'Guardar tarea' }).click();
  await expect(page.getByRole('form')).toHaveCount(0);
  await navigate(page, 'Inicio');
  await expect(page.getByRole('link', { name: 'Alumnos del grupo', exact: true })).toBeVisible();
  await page.evaluate(() => {
    const get = IDBIndex.prototype.getAll;
    IDBIndex.prototype.getAll = function (...args) {
      if (this.objectStore.name === 'assignments') {
        IDBIndex.prototype.getAll = get;
        throw new DOMException('Sintético', 'UnknownError');
      }
      return get.apply(this, args);
    };
  });
  await navigate(page, 'Tareas');
  await expect(page.getByRole('alert')).toBeVisible();
  await page.getByRole('button', { name: 'Reintentar listado' }).click();
  await expect(page.getByRole('button', { name: 'Editar tarea Fecha' })).toBeVisible();
});
test('CN007 búsquedas y fechas conservan selección explícita y conteos', async ({ page }) => {
  await configure(page, 1);
  await createTask(page, 'Una');
  await createTask(page, 'Otra');
  await page.getByText('Buscar y filtrar', { exact: true }).click();
  await page.getByLabel('Buscar tareas por título').fill('UNA');
  await expect(page.locator('.assignment-list-row')).toHaveCount(1);
  await page.getByLabel('Asignación desde').fill('2026-10-20');
  await expect(page.getByText('Sin coincidencias de tareas.')).toBeVisible();
  await page.getByLabel('Asignación desde').fill('2026-10-19');
  await page.getByRole('button', { name: 'Ver entregas de Una' }).click();
  await expect(page.getByRole('definition')).toHaveText(['1', '0', '0', '0', '1', '1']);
});
test('CN007 edición conserva entregas y bloquea fecha incompatible e incidencias antiguas', async ({
  page,
}) => {
  await configure(page, 1);
  await createTask(page);
  await page.evaluate(async () => {
    const { r, db } = window.classNoteAudit;
    const a = (await db.assignments.toArray())[0]!;
    const g = (await db.groups.toArray())[0]!;
    const e = (await db.enrollments.toArray())[0]!;
    const c = { schoolYearId: g.schoolYearId, groupId: g.id, enrollmentId: e.id };
    await r.createSubmission(c, { assignmentId: a.id, status: 'submitted', comment: 'Conservar' });
    await r.updateEnrollment(c, { status: 'inactive', leftAt: '2026-10-19' });
  });
  await page.getByRole('button', { name: 'Editar tarea Tarea de prueba' }).click();
  await page.getByLabel('Fecha de asignación').fill('2026-10-20');
  const before = await snapshot(page);
  await page.getByRole('button', { name: 'Guardar tarea' }).click();
  await expect(page.getByRole('alert')).toContainText('población');
  expect(await snapshot(page)).toEqual(before);
  await page.getByLabel('Fecha de asignación').fill('2026-10-19');
  await page.getByLabel('Título', { exact: true }).fill('Corregida');
  await page.getByRole('button', { name: 'Guardar tarea' }).click();
  await page.getByRole('button', { name: 'Ver entregas de Corregida' }).click();
  await expect(page.getByLabel(/Comentario de/)).toHaveValue('Conservar');
  await navigate(page, 'Inicio');
  await page.evaluate(async () => {
    const { db } = window.classNoteAudit;
    const e = (await db.enrollments.toArray())[0]!;
    await db.enrollments.update(e.id, { leftAt: '2026-10-18' });
  });
  await navigate(page, 'Tareas');
  await page.getByRole('button', { name: 'Ver entregas de Corregida' }).click();
  await expect(page.getByRole('region', { name: 'Incidencias de entregas' })).toContainText(
    'Conservar',
  );
  await expect(page.getByRole('group', { name: /Estado de/ })).toHaveCount(0);
  await attachAudit(page);
});

test('CN007 entrega guardada con consulta posterior fallida solo reintenta lectura', async ({
  page,
}) => {
  await configure(page, 1);
  await createTask(page);
  await page.getByRole('button', { name: 'Ver entregas de Tarea de prueba' }).click();
  await page.getByRole('button', { name: 'Entregada', exact: true }).click();
  await page.getByLabel(/Comentario de/).fill('Comentario confirmado');
  await page.evaluate(() => {
    const add = IDBObjectStore.prototype.add;
    IDBObjectStore.prototype.add = function (...args) {
      if (this.name === 'submissions') {
        IDBObjectStore.prototype.add = add;
        this.transaction.addEventListener('complete', () => {
          const get = IDBObjectStore.prototype.get;
          IDBObjectStore.prototype.get = function (...args) {
            if (this.name === 'assignments') {
              IDBObjectStore.prototype.get = get;
              throw new DOMException('Consulta posterior sintética', 'UnknownError');
            }
            return get.apply(this, args);
          };
        });
      }
      return add.apply(this, args);
    };
  });
  await page.getByRole('button', { name: /Guardar entregas/ }).click();
  await expect(page.getByRole('alert')).toContainText('guardaron');
  await expect(page.getByRole('button', { name: /Guardar entregas/ })).toHaveCount(0);
  expect(await page.evaluate(() => window.classNoteAudit.db.submissions.count())).toBe(1);
  await page.getByRole('button', { name: 'Reintentar lectura' }).click();
  await expect(page.getByLabel(/Comentario de/)).toHaveValue('Comentario confirmado');
  await expect(page.getByRole('button', { name: /Guardar entregas/ })).toBeDisabled();
});
