import { expect, test, type Page } from '@playwright/test';

async function navigate(page: Page, label: string) {
  const nav = page.getByRole('navigation');
  if (['Lectura en casa', 'Observaciones', 'Reportes', 'Configuración'].includes(label)) {
    const menu = nav.locator('details');
    if (!(await menu.getAttribute('open')) && (await menu.getAttribute('open')) !== '')
      await menu.locator('summary').click();
  }
  await nav.getByRole('link', { name: label, exact: true }).click();
}
async function configure(page: Page) {
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

for (const width of [1280, 768, 360]) {
  test(`cuaderno: siete alumnos, asistencia y tareas a ${width}px`, async ({ page, context }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.setViewportSize({ width, height: 960 });
    await configure(page);
    await expect(page.getByRole('button', { name: /Ver ficha de/ })).toHaveCount(7);
    const directory = page.getByRole('region', { name: 'Alumnos del grupo', exact: true });
    const registration = page.getByRole('complementary', { name: 'Registro de alumnos' });
    await expect(directory.locator('.student-card')).toHaveCount(7);
    await expect(registration.getByRole('form', { name: 'Nuevo alumno' })).toBeVisible();
    if (width > 760) {
      const cardsBox = await directory.boundingBox();
      const formBox = await registration.boundingBox();
      expect(formBox!.x).toBeGreaterThan(cardsBox!.x + cardsBox!.width);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.screenshot({ path: `test-results/redesign-students-${width}.png`, fullPage: true });
    await page.getByRole('button', { name: 'Ver ficha de Prueba, Gabriela' }).click();
    await page.getByRole('button', { name: 'Editar ficha', exact: true }).click();
    await registration.getByLabel('Nombre o nombres').fill('Gaby');
    await registration.getByRole('button', { name: 'Guardar alumno' }).click();
    await expect(page.getByRole('button', { name: 'Ver ficha de Prueba, Gaby' })).toBeVisible();
    await expect(registration.getByRole('form', { name: 'Nuevo alumno' })).toBeVisible();
    await page.getByRole('button', { name: 'Cerrar detalle' }).click();
    await expect(page.getByLabel('Buscar alumno')).not.toBeVisible();
    await navigate(page, 'Inicio');
    await expect(page.getByRole('link', { name: 'Alumnos del grupo', exact: true })).toContainText(
      '7',
    );
    await page.screenshot({ path: `test-results/redesign-home-${width}.png`, fullPage: true });
    await context.setOffline(true);
    await page.getByRole('link', { name: 'Pasar lista' }).click();
    await expect(page.getByRole('group', { name: /Estado de/ })).toHaveCount(7);
    await page.getByRole('button', { name: 'Marcar todos presentes', exact: true }).click();
    const first = page.getByRole('group', { name: /Estado de/ }).first();
    await first.getByRole('button', { name: 'Falta', exact: true }).click();
    await page.locator('.row-note').first().locator('summary').click();
    await page
      .getByLabel(/Nota de/)
      .first()
      .fill('Avisó su familia');
    await page.getByRole('button', { name: 'Guardar asistencia', exact: true }).click();
    await expect(page.getByText('Asistencia guardada. 0 sin registrar.')).toBeVisible();
    await expect(first.getByRole('button', { name: 'Falta', exact: true })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await page.screenshot({
      path: `test-results/redesign-attendance-${width}.png`,
      fullPage: true,
    });
    await navigate(page, 'Inicio');
    await expect(page.getByRole('link', { name: 'Asistencia de hoy' })).toContainText('6');
    await navigate(page, 'Tareas');
    await page.getByRole('button', { name: 'Crear tarea', exact: true }).click();
    await page.getByLabel('Título', { exact: true }).fill('Sumas del cuaderno');
    await page.getByRole('button', { name: 'Guardar tarea', exact: true }).click();
    await page.getByRole('button', { name: 'Ver entregas de Sumas del cuaderno' }).click();
    await expect(page.getByRole('region', { name: 'Entregas de la tarea' })).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Ver entregas de Sumas del cuaderno' }),
    ).toHaveCount(0);
    const delivery = page.getByRole('group', { name: /Estado de/ }).first();
    await expect(delivery.getByRole('button')).toHaveCount(4);
    for (const label of ['Incompleta', 'No entregada', 'Pendiente', 'Entregada']) {
      await delivery.getByRole('button', { name: label, exact: true }).click();
      await expect(delivery.getByRole('button', { name: label, exact: true })).toHaveAttribute(
        'aria-pressed',
        'true',
      );
      await expect(delivery.locator('[aria-pressed="true"]')).toHaveCount(1);
    }
    await page.screenshot({
      path: `test-results/redesign-deliveries-${width}.png`,
      fullPage: true,
    });
    await page.getByRole('button', { name: /Guardar entregas/ }).click();
    await expect(page.getByText(/Entregas guardadas/)).toBeVisible();
    await page.getByRole('button', { name: 'Volver al listado' }).click();
    for (const [title, date] of [
      ['Lectura del cuento', '2026-10-20'],
      ['Dibujar mi familia', '2026-10-19'],
    ] as const) {
      await page.getByRole('button', { name: 'Crear tarea', exact: true }).click();
      await page.getByLabel('Título', { exact: true }).fill(title);
      await page.getByLabel('Fecha de asignación').fill(date);
      await page.getByRole('button', { name: 'Guardar tarea', exact: true }).click();
      await expect(page.getByRole('form')).toHaveCount(0);
    }
    const tuesday = page.getByRole('region', { name: 'martes', exact: true });
    const monday = page.getByRole('region', { name: 'lunes', exact: true });
    await expect(tuesday.locator('.assignment-card')).toHaveCount(2);
    await expect(tuesday).toContainText('20 de octubre de 2026');
    await expect(monday.locator('.assignment-card')).toHaveCount(1);
    await expect(page.locator('.assignment-day').first()).toContainText('martes');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.getByText('Buscar y filtrar', { exact: true }).click();
    await page.getByLabel('Buscar tareas por título').fill('Dibujar');
    await expect(page.locator('.assignment-day')).toHaveCount(1);
    await expect(monday).toBeVisible();
    await page.getByLabel('Buscar tareas por título').fill('');
    await page.getByText('Buscar y filtrar', { exact: true }).click();
    await page.screenshot({ path: `test-results/redesign-tasks-${width}.png`, fullPage: true });
    await context.setOffline(false);
    await page.reload();
    await page.getByRole('button', { name: 'Ver entregas de Sumas del cuaderno' }).click();
    await expect(
      page
        .getByRole('group', { name: /Estado de/ })
        .first()
        .getByRole('button', { name: 'Entregada', exact: true }),
    ).toHaveAttribute('aria-pressed', 'true');
    await navigate(page, 'Asistencia');
    await expect(
      page
        .getByRole('group', { name: /Estado de/ })
        .first()
        .getByRole('button', { name: 'Falta', exact: true }),
    ).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByLabel(/Nota de/).first()).toHaveValue('Avisó su familia');
    for (const label of ['Lectura en casa', 'Observaciones', 'Reportes', 'Configuración']) {
      await navigate(page, label);
      await expect(page.getByRole('heading', { level: 1 })).toHaveText(label);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      );
      await page.screenshot({
        path: `test-results/redesign-${label.split(' ')[0]}-${width}.png`,
        fullPage: true,
      });
    }
    expect(errors).toEqual([]);
  });
}

test('protege el borrador al navegar desde los botones de asistencia', async ({ page }) => {
  await configure(page);
  await navigate(page, 'Asistencia');
  const present = page
    .getByRole('group', { name: /Estado de/ })
    .first()
    .getByRole('button', { name: 'Presente', exact: true });
  await present.click();
  page.once('dialog', (dialog) => dialog.dismiss());
  await navigate(page, 'Tareas');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Asistencia');
  await expect(present).toHaveAttribute('aria-pressed', 'true');
  page.once('dialog', (dialog) => dialog.accept());
  await navigate(page, 'Tareas');
  await navigate(page, 'Asistencia');
  await expect(present).toHaveAttribute('aria-pressed', 'false');
});

test('menú con teclado, foco y navegación directa sin datos inventados', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Mi día');
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: 'Saltar al contenido' })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('main')).toBeFocused();
  await page.getByRole('navigation').locator('summary').focus();
  await page.keyboard.press('Enter');
  await page.getByRole('navigation').getByRole('link', { name: 'Reportes' }).focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Reportes');
  await expect(page.getByRole('heading', { level: 1 })).toBeFocused();
  await page.goto('/#/lectura');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Lectura en casa');
  await expect(page.getByRole('button', { name: 'Registrar lectura', exact: true })).toHaveCount(0);
});

test('lectura y observación: registrar, filtrar y recuperar al abrir', async ({ page }) => {
  await configure(page);
  await navigate(page, 'Lectura en casa');
  await page.getByRole('button', { name: 'Registrar lectura', exact: true }).click();
  await expect(page.getByLabel('Fecha de lectura')).toHaveValue('2026-10-20');
  await page
    .getByRole('combobox', { name: 'Alumno', exact: true })
    .selectOption({ label: 'Prueba, Ana' });
  await page.getByLabel('Título o texto leído').fill('El cuento del día');
  await page.getByLabel('Minutos', { exact: true }).fill('12');
  await page.getByRole('button', { name: 'Guardar lectura', exact: true }).click();
  await expect(page.getByText('Total del grupo: 12 minutos · 1 registros')).toBeVisible();
  await page.getByText('Ver lecturas por alumno', { exact: true }).click();
  await page
    .getByRole('combobox', { name: 'Alumno', exact: true })
    .selectOption({ label: 'Prueba, Ana' });
  await expect(page.getByText('El cuento del día', { exact: true })).toBeVisible();
  await navigate(page, 'Observaciones');
  await page.getByRole('button', { name: 'Registrar observación', exact: true }).click();
  await expect(page.getByLabel('Fecha de observación')).toHaveValue('2026-10-20');
  await page
    .getByRole('combobox', { name: 'Alumno', exact: true })
    .selectOption({ label: 'Prueba, Ana' });
  await page.getByLabel('Texto de la observación').fill('Participó en la lectura de hoy.');
  await page.getByRole('button', { name: 'Guardar observación', exact: true }).click();
  await expect(page.getByText('Participó en la lectura de hoy.', { exact: true })).toBeVisible();
  await page.getByText('Buscar y filtrar', { exact: true }).click();
  await page.getByLabel('Buscar por nombre o texto').fill('no coincide');
  await expect(page.getByText('Participó en la lectura de hoy.', { exact: true })).toHaveCount(0);
  await page.getByLabel('Buscar por nombre o texto').fill('lectura');
  await expect(page.getByText('Participó en la lectura de hoy.', { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByText('Participó en la lectura de hoy.', { exact: true })).toBeVisible();
});

test('permite recuperar un error de almacenamiento desde cualquier sección', async ({ page }) => {
  await page.addInitScript(() => {
    const open = IDBFactory.prototype.open;
    let fail = true;
    window.addEventListener('test-recover-storage', () => {
      fail = false;
    });
    IDBFactory.prototype.open = function (...args: Parameters<IDBFactory['open']>) {
      if (args[0] === 'classnote' && fail) {
        throw new DOMException('Fallo de prueba', 'UnknownError');
      }
      return open.apply(this, args);
    };
  });
  await page.goto('/#/alumnos');
  await expect(page.getByRole('heading', { name: 'No se pudieron abrir tus datos' })).toBeVisible();
  await page.evaluate(() => window.dispatchEvent(new Event('test-recover-storage')));
  await page.getByRole('button', { name: 'Reintentar', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Alumnos del grupo' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'No se pudieron abrir tus datos' })).toHaveCount(
    0,
  );
});

test('fechas de hoy editables aunque el ciclo todavía no empiece; edición conserva el registro', async ({
  page,
}) => {
  await page.clock.setFixedTime(new Date(2026, 9, 21, 0, 15));
  await page.goto('/');
  await page.getByRole('link', { name: 'Configurar mi grupo' }).first().click();
  await page.getByRole('button', { name: 'Crear ciclo escolar', exact: true }).click();
  await expect(page.getByLabel('Fecha de inicio')).toHaveValue('2026-10-21');
  await page.getByLabel('Etiqueta', { exact: true }).fill('Ciclo futuro');
  await page.getByLabel('Fecha de inicio').fill('2026-10-26');
  await page.getByRole('button', { name: 'Guardar ciclo', exact: true }).click();
  await expect(page.getByRole('form')).toHaveCount(0);
  await page.getByRole('button', { name: 'Crear grupo', exact: true }).click();
  await page.getByLabel('Nombre', { exact: true }).fill('Segundo');
  await page.getByRole('button', { name: 'Guardar grupo', exact: true }).click();
  await expect(page.getByRole('form')).toHaveCount(0);
  await navigate(page, 'Asistencia');
  await expect(page.getByLabel('Fecha de asistencia')).toHaveValue('2026-10-21');
  await expect(page.getByText('Elige una fecha válida desde 2026-10-26.')).toBeVisible();
  await page.getByLabel('Fecha de asistencia').fill('2026-10-27');
  await expect(page.getByText('Sin alumnos en esta fecha', { exact: true })).toBeVisible();
  await navigate(page, 'Tareas');
  await page.getByRole('button', { name: 'Crear tarea', exact: true }).click();
  await expect(page.getByLabel('Fecha de asignación')).toHaveValue('2026-10-21');
  await page.getByLabel('Título', { exact: true }).fill('Mi fecha elegida');
  await page.getByLabel('Fecha de asignación').fill('2026-10-27');
  await page.getByRole('button', { name: 'Guardar tarea', exact: true }).click();
  await page.getByRole('button', { name: 'Editar tarea Mi fecha elegida' }).click();
  await expect(page.getByLabel('Fecha de asignación')).toHaveValue('2026-10-27');
  await page.getByRole('button', { name: 'Guardar tarea', exact: true }).click();
  await navigate(page, 'Reportes');
  await expect(page.getByLabel('Desde', { exact: true })).toHaveValue('2026-10-21');
  await expect(page.getByLabel('Hasta', { exact: true })).toHaveValue('2026-10-21');
  await page.getByLabel('Desde', { exact: true }).fill('2026-10-27');
  await page.getByLabel('Hasta', { exact: true }).fill('2026-10-28');
  await expect(page.getByLabel('Desde', { exact: true })).toHaveValue('2026-10-27');
});

test('inicio cuenta todo el grupo aunque haya ingresos futuros', async ({ page }) => {
  await configure(page);
  await page.evaluate(async () => {
    const request = indexedDB.open('classnote');
    const db = await new Promise<IDBDatabase>((resolve) => {
      request.onsuccess = () => resolve(request.result);
    });
    const tx = db.transaction('enrollments', 'readwrite');
    const store = tx.objectStore('enrollments');
    const rows = store.getAll();
    rows.onsuccess = () => {
      rows.result.slice(0, 4).forEach((row) => store.put({ ...row, joinedAt: '2026-10-26' }));
    };
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  });
  await navigate(page, 'Inicio');
  await expect(page.getByRole('link', { name: 'Alumnos del grupo', exact: true })).toContainText(
    '7',
  );
  await expect(page.getByRole('link', { name: 'Asistencia de hoy' })).toContainText(
    '3 alumnos para esta fecha',
  );
  await navigate(page, 'Alumnos');
  await expect(page.locator('.student-card')).toHaveCount(7);
});
