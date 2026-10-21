import { expect, test, type Page } from '@playwright/test';

async function navigate(page: Page, label: string) {
  const nav = page.getByRole('navigation');
  if (['Lectura en casa', 'Observaciones', 'Reportes', 'Configuración'].includes(label)) {
    const menu = nav.locator('details');
    if ((await menu.count()) && (await menu.getAttribute('open')) === null)
      await menu.locator('summary').click();
  }
  await nav.getByRole('link', { name: label, exact: true }).click();
}
async function configure(page: Page, startDate = '2026-08-01') {
  await page.clock.setFixedTime(new Date(2026, 9, 20, 12));
  await page.goto('/');
  await page.getByRole('link', { name: 'Configurar mi grupo' }).first().click();
  await page.getByRole('button', { name: 'Crear ciclo escolar', exact: true }).click();
  await page.getByLabel('Etiqueta', { exact: true }).fill('2026–2027');
  await page.getByLabel('Fecha de inicio').fill(startDate);
  await page.getByLabel('Fecha de fin').fill('2027-07-31');
  await page.getByRole('button', { name: 'Guardar ciclo', exact: true }).click();
  await expect(page.getByRole('form')).toHaveCount(0);
  await page.getByRole('button', { name: 'Crear grupo', exact: true }).click();
  await page.getByRole('combobox', { name: 'Grado', exact: true }).selectOption('2');
  await page.getByLabel('Nombre', { exact: true }).fill('A');
  await page.getByRole('button', { name: 'Guardar grupo', exact: true }).click();
  await expect(page.getByRole('form')).toHaveCount(0);
  await navigate(page, 'Alumnos');
  for (const name of ['Ana', 'Bruno', 'Carla', 'Diego', 'Elena', 'Felipe', 'Gabriela']) {
    await expect(page.getByRole('form').locator('input[type="date"]')).toHaveCount(0);
    await page.getByLabel('Nombre o nombres').fill(name);
    await page.getByLabel('Apellido o apellidos').fill('Prueba');
    await page.getByRole('button', { name: 'Guardar alumno', exact: true }).click();
    await expect(page.getByLabel('Nombre o nombres')).toHaveValue('');
    await expect(page.getByRole('button', { name: `Ver ficha de Prueba, ${name}` })).toBeVisible();
  }
}

for (const width of [1440, 1100, 768, 390, 360]) {
  test(`agenda de papel: pantallas y flujos a ${width}px`, async ({ page, context }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.setViewportSize({ width, height: 960 });
    await configure(page);
    await expect(page.locator('.student-card')).toHaveCount(7);
    await page.getByRole('button', { name: 'Ver ficha de Prueba, Ana' }).click();
    await page.getByRole('button', { name: 'Editar ficha', exact: true }).click();
    await page.getByLabel('Nombre o nombres').fill('Anita');
    await page.getByRole('button', { name: 'Guardar alumno', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Ver ficha de Prueba, Anita' })).toBeVisible();
    await page.getByRole('button', { name: 'Cerrar detalle' }).click();

    await navigate(page, 'Inicio');
    await expect(page.getByRole('link', { name: 'Alumnos del grupo', exact: true })).toContainText(
      '7',
    );
    await page.screenshot({ path: `test-results/notebook-home-${width}.png`, fullPage: true });
    if (width > 700) {
      await expect(page.locator('.sidebar-mascot')).toBeVisible();
      expect(
        await page.locator('.sidebar-mascot').evaluate((el: HTMLImageElement) => el.naturalWidth),
      ).toBeGreaterThan(0);
    }

    await context.setOffline(true);
    await page.getByRole('link', { name: 'Pasar lista' }).click();
    await page.getByRole('button', { name: 'Marcar todos presentes', exact: true }).click();
    await page.getByRole('button', { name: 'Guardar asistencia', exact: true }).click();
    await expect(page.getByText('Asistencia guardada. 0 sin registrar.')).toBeVisible();
    await navigate(page, 'Tareas');
    await page.getByRole('button', { name: 'Crear tarea', exact: true }).click();
    await page.getByLabel('Título', { exact: true }).fill('Actividad de prueba visual');
    await page.screenshot({ path: `test-results/notebook-form-${width}.png`, fullPage: true });
    await page.getByRole('button', { name: 'Guardar tarea', exact: true }).click();
    await page.getByRole('button', { name: 'Ver entregas de Actividad de prueba visual' }).click();
    await expect(page.getByRole('group', { name: /Estado de/ })).toHaveCount(7);
    await page
      .getByRole('group', { name: /Estado de/ })
      .first()
      .getByRole('button', { name: 'Entregada', exact: true })
      .click();
    await page.getByRole('button', { name: /Guardar entregas/ }).click();
    await expect(page.getByText(/Entregas guardadas/)).toBeVisible();
    await page.getByRole('button', { name: 'Volver al listado' }).click();

    // Include the secondary modules through their shared navigation menu.
    for (const [hash, title] of [
      ['inicio', 'Mi día'],
      ['asistencia', 'Asistencia'],
      ['tareas', 'Tareas'],
      ['alumnos', 'Alumnos'],
      ['reportes', 'Reportes'],
      ['configuracion', 'Configuración'],
    ] as const) {
      await navigate(page, title === 'Mi día' ? 'Inicio' : title);
      await expect(page.getByRole('heading', { level: 1 })).toHaveText(title);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      );
      await page.screenshot({ path: `test-results/notebook-${hash}-${width}.png`, fullPage: true });
    }
    await page.getByText('Respaldos y recuperación', { exact: true }).click();
    await expect(
      page.getByRole('button', { name: 'Guardar respaldo completo', exact: true }),
    ).toBeVisible();
    await page.screenshot({ path: `test-results/notebook-backup-${width}.png`, fullPage: true });
    await context.setOffline(false);
    await page.reload();
    await navigate(page, 'Asistencia');
    await expect(
      page
        .getByRole('group', { name: /Estado de/ })
        .first()
        .getByRole('button', { name: 'Presente', exact: true }),
    ).toHaveAttribute('aria-pressed', 'true');
    expect(errors).toEqual([]);
  });
}

test('estados vacíos, foco y recuperación conservan la navegación', async ({ page }) => {
  await page.goto('/');
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: 'Saltar al contenido' })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('main')).toBeFocused();
  for (const label of ['Asistencia', 'Tareas', 'Alumnos', 'Reportes', 'Configuración']) {
    await navigate(page, label);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(label);
    await expect(page.getByRole('heading', { level: 1 })).toBeFocused();
  }
  await page.goto('/#/no-existe');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Sección no encontrada');
  await page.getByRole('link', { name: 'Volver a Inicio' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Mi día');
});

test('inicio cabe en la ventana y permite desplazarse con una agenda larga', async ({ page }) => {
  await configure(page);
  await navigate(page, 'Inicio');
  const fits = () => page.evaluate(() => document.documentElement.scrollHeight <= innerHeight + 1);
  for (const viewport of [
    { width: 1722, height: 980 },
    { width: 1366, height: 720 },
    { width: 1100, height: 600 },
    { width: 768, height: 700 },
  ]) {
    await page.setViewportSize(viewport);
    await expect
      .poll(fits, {
        message: JSON.stringify({
          viewport,
          layout: await page
            .locator(
              '.main-content, .sidebar, .page-header, .welcome-banner, .stats-grid, .agenda-panel',
            )
            .evaluateAll((els) =>
              els.map((el) => ({
                name: el.className,
                height: el.getBoundingClientRect().height,
                top: el.getBoundingClientRect().top,
              })),
            ),
        }),
      })
      .toBe(true);
  }
  await page.setViewportSize({ width: 1366, height: 600 });
  await page.screenshot({ path: 'test-results/home-compact-empty.png', fullPage: true });
  for (let i = 1; i <= 5; i++) {
    await navigate(page, 'Tareas');
    await page.getByRole('button', { name: 'Crear tarea', exact: true }).click();
    await page.getByLabel('Título', { exact: true }).fill(`Actividad del día ${i}`);
    await page.getByRole('button', { name: 'Guardar tarea', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Crear tarea', exact: true })).toBeVisible();
    if (i === 1) {
      await navigate(page, 'Inicio');
      await expect(
        page.getByRole('link', { name: 'Abrir entregas de Actividad del día 1', exact: true }),
      ).toBeVisible();
      await expect.poll(fits).toBe(true);
    }
  }
  await navigate(page, 'Inicio');
  const last = page.getByRole('link', {
    name: 'Abrir entregas de Actividad del día 5',
    exact: true,
  });
  await expect(last).toBeAttached();
  await expect.poll(fits).toBe(false);
  await last.scrollIntoViewIfNeeded();
  await expect(last).toBeInViewport();
  await page.screenshot({ path: 'test-results/home-compact-agenda.png', fullPage: true });
});
