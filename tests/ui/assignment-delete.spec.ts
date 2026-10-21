import { expect, test } from '@playwright/test';

for (const width of [1100, 360]) {
  test(`tareas: abrir filas desde Inicio y Tareas, registrar y eliminar a ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.clock.setFixedTime(new Date(2026, 9, 20, 12));
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
    await page.getByRole('navigation').getByRole('link', { name: 'Alumnos', exact: true }).click();
    await page.getByLabel('Nombre o nombres').fill('Ana');
    await page.getByLabel('Apellido o apellidos').fill('Prueba');
    await page.getByRole('button', { name: 'Guardar alumno', exact: true }).click();
    await expect(page.getByLabel('Nombre o nombres')).toHaveValue('');
    await page.getByRole('navigation').getByRole('link', { name: 'Tareas', exact: true }).click();
    for (const title of ['Para borrar', 'Para conservar']) {
      await page.getByRole('button', { name: 'Crear tarea', exact: true }).click();
      await page.getByLabel('Título', { exact: true }).fill(title);
      await page.getByRole('button', { name: 'Guardar tarea', exact: true }).click();
      await expect(page.getByRole('form')).toHaveCount(0);
    }
    const detail = page.getByRole('region', { name: 'Entregas de la tarea', exact: true });
    const row = page.locator('.assignment-list-row').filter({ hasText: 'Para conservar' });
    // Click the padding of the row, away from its title and action buttons.
    await row.click({ position: { x: 5, y: 30 } });
    await expect(
      detail.getByRole('heading', { name: 'Para conservar', exact: true }),
    ).toBeVisible();
    await detail.getByRole('button', { name: 'Entregada', exact: true }).click();
    await detail.getByRole('button', { name: /^Guardar entregas/ }).click();
    await expect(detail.getByRole('button', { name: /^Guardar entregas/ })).toBeDisabled();
    await page.getByRole('button', { name: 'Volver al listado', exact: true }).click();
    await page.getByRole('button', { name: 'Editar tarea Para conservar', exact: true }).click();
    await expect(page.getByLabel('Título', { exact: true })).toHaveValue('Para conservar');
    await expect(detail).toHaveCount(0);
    await page.getByRole('button', { name: 'Cancelar tarea', exact: true }).click();
    await page.getByRole('button', { name: 'Ver entregas de Para borrar', exact: true }).click();
    await expect(detail.getByRole('heading', { name: 'Para borrar', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Volver al listado', exact: true }).click();
    await page.getByRole('button', { name: 'Abrir entregas de Para borrar', exact: true }).focus();
    await page.keyboard.press('Enter');
    await expect(detail.getByRole('heading', { name: 'Para borrar', exact: true })).toBeVisible();
    await page.getByRole('navigation').getByRole('link', { name: 'Inicio', exact: true }).click();
    const agendaRow = page.locator('.assignment-list li').filter({ hasText: 'Para conservar' });
    await agendaRow.click({ position: { x: 5, y: 30 } });
    await expect(
      detail.getByRole('heading', { name: 'Para conservar', exact: true }),
    ).toBeVisible();
    await expect(detail.getByRole('button', { name: 'Entregada', exact: true })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await page.reload();
    await expect(
      detail.getByRole('heading', { name: 'Para conservar', exact: true }),
    ).toBeVisible();
    await page.goBack();
    await expect(
      page.getByRole('heading', { name: 'Tareas recientes y próximas', exact: true }),
    ).toBeVisible();
    await page.getByRole('link', { name: 'Abrir entregas de Para borrar', exact: true }).focus();
    await page.keyboard.press('Enter');
    await expect(detail.getByRole('heading', { name: 'Para borrar', exact: true })).toBeVisible();
    await page.getByRole('navigation').getByRole('link', { name: 'Tareas', exact: true }).click();
    await expect(detail).toHaveCount(0);
    const remove = page.getByRole('button', { name: 'Eliminar tarea Para borrar', exact: true });
    page.once('dialog', async (dialog) => {
      expect(dialog.message()).toContain('todas sus entregas y comentarios');
      await dialog.dismiss();
    });
    await remove.click();
    await expect(remove).toBeVisible();
    page.once('dialog', (dialog) => dialog.accept());
    await remove.click();
    await expect(
      page.getByText('La tarea y sus entregas se eliminaron.', { exact: true }),
    ).toBeVisible();
    await expect(remove).toHaveCount(0);
    await expect(
      page.getByRole('button', { name: 'Eliminar tarea Para conservar', exact: true }),
    ).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.screenshot({ path: `test-results/assignment-delete-${width}.png`, fullPage: true });
    await page.reload();
    await expect(
      page.getByRole('button', { name: 'Eliminar tarea Para conservar', exact: true }),
    ).toBeVisible();
    await expect(remove).toHaveCount(0);
  });
}
