import { expect, test } from '@playwright/test';
import {
  configure,
  navigate,
  attachAudit,
  snapshot,
  failWrite,
  noOverflow,
} from '../helpers/audit-browser';
for (const width of [1100, 768, 360])
  test(`CN006 captura parcial, notas, corrección y persistencia offline a ${width}px`, async ({
    page,
    context,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await configure(page, 4);
    await navigate(page, 'Asistencia');
    await context.setOffline(true);
    const groups = page.getByRole('group', { name: /Estado de/ });
    await expect(groups).toHaveCount(4);
    await groups.first().getByRole('button', { name: 'Falta', exact: true }).click();
    await page.locator('.row-note summary').first().click();
    await page
      .getByLabel(/Nota de/)
      .first()
      .fill('Nota de prueba');
    await page.getByRole('button', { name: 'Guardar asistencia' }).click();
    await expect(page.getByText('Asistencia guardada. 3 sin registrar.')).toBeVisible();
    page.once('dialog', (d) => d.accept());
    await page.getByRole('button', { name: 'Marcar todos presentes' }).click();
    page.once('dialog', (d) => d.dismiss());
    await page.getByRole('button', { name: 'Guardar asistencia' }).click();
    await expect(
      groups.first().getByRole('button', { name: 'Presente', exact: true }),
    ).toHaveAttribute('aria-pressed', 'true');
    page.once('dialog', (d) => d.accept());
    await page.getByRole('button', { name: 'Guardar asistencia' }).click();
    await expect(page.getByText('Asistencia guardada. 0 sin registrar.')).toBeVisible();
    await noOverflow(page);
    await context.setOffline(false);
    await page.reload();
    await expect(
      groups.first().getByRole('button', { name: 'Presente', exact: true }),
    ).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByLabel(/Nota de/).first()).toHaveValue('Nota de prueba');
  });
test('CN006 protege fecha, navegación e historial sin perder borrador', async ({ page }) => {
  await configure(page, 1);
  await navigate(page, 'Asistencia');
  await page.getByRole('button', { name: 'Falta', exact: true }).click();
  for (const action of [
    () => page.goBack(),
    () => page.getByLabel('Fecha de asistencia').fill('2026-10-19'),
    () => page.getByRole('navigation').getByRole('link', { name: 'Tareas', exact: true }).click(),
  ]) {
    page.once('dialog', (d) => d.dismiss());
    await action();
    await expect(page.getByRole('button', { name: 'Falta', exact: true })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await expect(page.getByLabel('Fecha de asistencia')).toHaveValue('2026-10-21');
  }
  page.once('dialog', (d) => d.accept());
  await navigate(page, 'Tareas');
  expect(await page.evaluate(() => window.classNoteAudit.db.attendance.count())).toBe(0);
});
test('CN006 marcar todos no escribe y cancelar corrección conserva registros', async ({ page }) => {
  await configure(page, 2);
  await navigate(page, 'Asistencia');
  const before = await snapshot(page);
  await page.getByRole('button', { name: 'Marcar todos presentes' }).click();
  expect(await snapshot(page)).toEqual(before);
  await page.getByRole('button', { name: 'Guardar asistencia' }).click();
  await expect(page.getByText('Asistencia guardada. 0 sin registrar.')).toBeVisible();
  const saved = await snapshot(page);
  await page.getByRole('button', { name: 'Falta', exact: true }).first().click();
  page.once('dialog', (d) => d.dismiss());
  await page.getByRole('button', { name: 'Guardar asistencia' }).click();
  expect(await snapshot(page)).toEqual(saved);
});
test('CN006 fallo de escritura conserva borrador y reintento atómico', async ({ page }) => {
  await configure(page, 2);
  await navigate(page, 'Asistencia');
  await page.getByRole('button', { name: 'Marcar todos presentes' }).click();
  const before = await snapshot(page);
  await failWrite(page, 'attendance', 'add');
  await page.getByRole('button', { name: 'Guardar asistencia' }).click();
  await expect(page.getByRole('alert')).toBeVisible();
  expect(await snapshot(page)).toEqual(before);
  await expect(page.getByRole('button', { name: 'Presente', exact: true }).first()).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await page.getByRole('button', { name: 'Guardar asistencia' }).click();
  await expect(page.getByText('Asistencia guardada. 0 sin registrar.')).toBeVisible();
  expect(await page.evaluate(() => window.classNoteAudit.db.attendance.count())).toBe(2);
});
test('CN006 lectura fallida recuperable, fecha inválida y cambios rápidos', async ({ page }) => {
  await configure(page, 1);
  await page.evaluate(() => {
    const get = IDBObjectStore.prototype.get;
    IDBObjectStore.prototype.get = function (...args) {
      if (this.name === 'groups') {
        IDBObjectStore.prototype.get = get;
        throw new DOMException('Sintético', 'UnknownError');
      }
      return get.apply(this, args);
    };
  });
  await navigate(page, 'Asistencia');
  await expect(page.getByRole('alert')).toBeVisible();
  await page.getByRole('button', { name: 'Reintentar lectura' }).click();
  await expect(page.getByRole('group', { name: /Estado de/ })).toHaveCount(1);
  await page.getByLabel('Fecha de asistencia').fill('2026-07-31');
  await expect(page.getByText(/Elige una fecha válida/)).toBeVisible();
  for (const date of ['2026-10-19', '2026-10-20', '2026-10-21'])
    await page.getByLabel('Fecha de asistencia').fill(date);
  await expect(page.getByRole('group', { name: /Estado de/ })).toHaveCount(1);
  await expect(page.getByRole('button', { name: 'Guardar asistencia' })).toBeDisabled();
});
test('CN006 dos ventanas: conflicto conserva borrador y revisar requiere descarte', async ({
  page,
  context,
}) => {
  await configure(page, 1);
  await navigate(page, 'Asistencia');
  await page.getByRole('button', { name: 'Falta', exact: true }).click();
  const other = await context.newPage();
  await other.goto('/#/asistencia');
  await other.getByRole('button', { name: 'Presente', exact: true }).click();
  await other.getByRole('button', { name: 'Guardar asistencia' }).click();
  await expect(other.getByText('Asistencia guardada. 0 sin registrar.')).toBeVisible();
  await page.getByRole('button', { name: 'Guardar asistencia' }).click();
  await expect(page.getByRole('alert')).toContainText('otra ventana');
  await expect(page.getByRole('button', { name: 'Falta', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  page.once('dialog', (d) => d.dismiss());
  await page.getByRole('button', { name: 'Revisar día guardado' }).click();
  await expect(page.getByRole('button', { name: 'Falta', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  page.once('dialog', (d) => d.accept());
  await page.getByRole('button', { name: 'Revisar día guardado' }).click();
  await expect(page.getByRole('button', { name: 'Presente', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await other.close();
});
test('CN006 sin contexto y fecha fuera del ciclo requieren elección explícita', async ({
  page,
}) => {
  await page.goto('/#/asistencia');
  await expect(
    page.getByText('Configura tu grupo en Configuración para registrar asistencia.'),
  ).toBeVisible();
  await configure(page, 1);
  await page.evaluate(async () => {
    const { r, db } = window.classNoteAudit;
    const y = (await db.schoolYears.toArray())[0]!;
    await r.updateSchoolYear(y.id, { ...y, startDate: '2026-10-26' });
  });
  await page.reload();
  await attachAudit(page);
  await navigate(page, 'Asistencia');
  await expect(page.getByLabel('Fecha de asistencia')).toHaveValue('2026-10-21');
  await expect(page.getByText(/Elige una fecha válida/)).toBeVisible();
  await page.getByLabel('Fecha de asistencia').fill('2026-10-26');
  await expect(page.getByRole('group', { name: /Estado de/ })).toHaveCount(1);
});
