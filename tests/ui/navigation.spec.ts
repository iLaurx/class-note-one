import { expect, test } from '@playwright/test';
import { navigate, noOverflow, attachAudit, snapshot } from '../helpers/audit-browser';
const sections = ['Inicio', 'Alumnos', 'Asistencia', 'Tareas', 'Reportes', 'Configuración'];
for (const width of [1100, 768, 360])
  test(`seis secciones visibles, rutas ocultas y accesibilidad a ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 760 });
    await page.goto('/');
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    for (const label of sections) {
      await navigate(page, label);
      await expect(
        page.getByRole('navigation').getByRole('link', { name: label, exact: true }),
      ).toHaveAttribute('aria-current', 'page');
      await noOverflow(page);
    }
    for (const hash of ['lectura', 'observaciones']) {
      await page.goto('/#/' + hash);
      await expect(page.getByRole('heading', { level: 1 })).toHaveText('Sección no encontrada');
      await expect(page.getByRole('form')).toHaveCount(0);
    }
    await expect(
      page.getByRole('navigation').getByRole('link', { name: /Lectura|Observaciones/ }),
    ).toHaveCount(0);
    expect(errors).toEqual([]);
  });
test('accesos, historial, recarga y sección desconocida', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'Configurar mi grupo', exact: true }).click();
  await navigate(page, 'Alumnos');
  await navigate(page, 'Tareas');
  await page.goBack();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Alumnos');
  await page.goForward();
  await page.reload();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Tareas');
  await page.goto('/#/no-existe');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Sección no encontrada');
  await page.getByRole('link', { name: 'Volver a Inicio' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Mi día');
});
test('teclado y salto al contenido', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Mi día');
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: 'Saltar al contenido' })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('main')).toBeFocused();
  await page.getByRole('navigation').getByRole('link', { name: 'Tareas', exact: true }).focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { level: 1 })).toBeFocused();
});
test('base temporal vacía, recursos locales y navegación offline sin escrituras de dominio', async ({
  page,
  context,
}) => {
  const external: string[] = [];
  page.on('request', (r) => {
    if (!r.url().startsWith('http://127.0.0.1:')) external.push(r.url());
  });
  await page.goto('/');
  await attachAudit(page);
  const before = await snapshot(page);
  expect(before.slice(0, 9).every((rows) => rows.length === 0)).toBe(true);
  await context.setOffline(true);
  for (const label of sections) await navigate(page, label);
  expect(await snapshot(page)).toEqual(before);
  expect(external).toEqual([]);
});
test('apertura fallida accesible y reintento sin borrar almacenamiento', async ({ page }) => {
  await page.addInitScript(() => {
    const open = IDBFactory.prototype.open;
    let fail = true;
    IDBFactory.prototype.open = function (...args) {
      if (fail) {
        fail = false;
        throw new DOMException('Fallo privado', 'SecurityError');
      }
      return open.apply(this, args);
    };
  });
  await page.goto('/');
  await expect(page.getByRole('alert')).toBeVisible();
  await expect(page.getByRole('alert')).not.toContainText('Fallo privado');
  await page.getByRole('button', { name: 'Reintentar', exact: true }).click();
  await expect(page.getByRole('alert')).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Configurar mi grupo', exact: true })).toBeVisible();
});
