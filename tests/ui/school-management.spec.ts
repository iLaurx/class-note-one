import { expect, test } from '@playwright/test';
import {
  configure,
  navigate,
  noOverflow,
  snapshot,
  failWrite,
  attachAudit,
} from '../helpers/audit-browser';
for (const width of [1100, 768, 360])
  test(`CN004 ciclo y grupo únicos, archivo y persistencia a ${width}px`, async ({
    page,
    context,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await configure(page, 1);
    await navigate(page, 'Configuración');
    await context.setOffline(true);
    await expect(page.getByRole('button', { name: 'Crear grupo', exact: true })).toHaveCount(0);
    await page.getByRole('button', { name: 'Archivar grupo', exact: true }).click();
    await page.getByRole('button', { name: 'Cancelar archivo' }).click();
    await page.getByRole('button', { name: 'Archivar grupo', exact: true }).click();
    await page.getByRole('button', { name: 'Confirmar archivo' }).click();
    await page.getByLabel('Mostrar archivados').check();
    await page.getByRole('button', { name: 'Reactivar grupo', exact: true }).click();
    await page.getByRole('button', { name: 'Editar grupo', exact: true }).click();
    await page.getByLabel('Nombre', { exact: true }).fill('B');
    await page.getByRole('button', { name: 'Guardar grupo' }).click();
    await noOverflow(page);
    await context.setOffline(false);
    await page.reload();
    await attachAudit(page);
    expect(await page.evaluate(() => window.classNoteAudit.db.students.count())).toBe(1);
    await expect(page.getByRole('main').getByText('2.º B', { exact: true })).toBeVisible();
  });
test('CN004 fallo de escritura conserva ciclo y permite reintento', async ({ page }) => {
  await configure(page);
  await navigate(page, 'Configuración');
  const before = await snapshot(page);
  await page.getByRole('button', { name: 'Editar ciclo', exact: true }).click();
  await page.getByLabel('Etiqueta', { exact: true }).fill('Corregido');
  await failWrite(page, 'schoolYears');
  await page.getByRole('button', { name: 'Guardar ciclo' }).click();
  await expect(page.getByRole('alert')).toBeVisible();
  await expect(page.getByLabel('Etiqueta', { exact: true })).toHaveValue('Corregido');
  expect(await snapshot(page)).toEqual(before);
  await page.getByRole('button', { name: 'Guardar ciclo' }).click();
  await expect(page.getByRole('form')).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Corregido', exact: true })).toBeVisible();
});
test('CN004 reducción de ciclo con tarea del 19 al día 20 no escribe parcialmente', async ({
  page,
}) => {
  await configure(page);
  await page.evaluate(async () => {
    const { r, db } = window.classNoteAudit;
    const g = (await db.groups.toArray())[0]!;
    await r.createAssignment(
      { schoolYearId: g.schoolYearId, groupId: g.id },
      { title: 'Del 19', assignedDate: '2026-10-19' },
    );
  });
  await navigate(page, 'Configuración');
  const before = await snapshot(page);
  await page.getByRole('button', { name: 'Editar ciclo', exact: true }).click();
  await page.getByLabel('Fecha de inicio').fill('2026-10-20');
  await page.getByRole('button', { name: 'Guardar ciclo' }).click();
  await expect(page.getByRole('alert')).toContainText('tareas');
  expect(await snapshot(page)).toEqual(before);
  await expect(page.getByLabel('Fecha de inicio')).toHaveValue('2026-10-20');
  await page.getByLabel('Fecha de inicio').fill('2026-10-19');
  await page.getByRole('button', { name: 'Guardar ciclo' }).click();
  await expect(page.getByRole('form')).toHaveCount(0);
});
test('CN004 error de contexto recuperable sin borrar registros', async ({ page }) => {
  await configure(page, 1);
  const before = await snapshot(page);
  await page.addInitScript(() => {
    const get = IDBObjectStore.prototype.get;
    IDBObjectStore.prototype.get = function (...args) {
      if (this.name === 'appSettings') {
        IDBObjectStore.prototype.get = get;
        throw new DOMException('Sintético', 'UnknownError');
      }
      return get.apply(this, args);
    };
  });
  await page.reload();
  await expect(page.getByRole('alert')).toBeVisible();
  await page.getByRole('button', { name: 'Reintentar', exact: true }).click();
  await attachAudit(page);
  await expect(page.getByRole('alert')).toHaveCount(0);
  expect(await snapshot(page)).toEqual(before);
});
