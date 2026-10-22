import { build } from 'vite';
import { expect, type Page } from '@playwright/test';

let probe: Promise<string> | undefined;
export async function attachAudit(page: Page) {
  probe ??= build({
    configFile: false,
    logLevel: 'error',
    build: {
      write: false,
      lib: { entry: 'tests/native/auditProbe.ts', name: 'AuditProbe', formats: ['iife'] },
    },
  }).then((result) => {
    const bundle = Array.isArray(result) ? result[0] : result;
    if (!bundle || !('output' in bundle)) throw new Error('No se pudo preparar la prueba.');
    return bundle.output.find((item) => item.type === 'chunk')!.code;
  });
  await page.evaluate(await probe);
}
export async function navigate(page: Page, name: string) {
  await page.getByRole('navigation').getByRole('link', { name, exact: true }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    name === 'Inicio' ? 'Mi día' : name,
  );
}
export async function configure(page: Page, count = 0) {
  await page.clock.setFixedTime(new Date(2026, 9, 21, 12));
  await page.goto(page.url().startsWith('http://tauri.localhost') ? 'http://tauri.localhost' : '/');
  await navigate(page, 'Configuración');
  await page.getByRole('button', { name: 'Crear ciclo escolar', exact: true }).click();
  await page.getByLabel('Etiqueta', { exact: true }).fill('Ciclo de prueba');
  await page.getByLabel('Fecha de inicio').fill('2026-08-01');
  await page.getByLabel('Fecha de fin').fill('2027-07-31');
  await page.getByRole('button', { name: 'Guardar ciclo', exact: true }).click();
  await page.getByRole('button', { name: 'Crear grupo', exact: true }).click();
  await page.getByRole('combobox', { name: 'Grado', exact: true }).selectOption('2');
  await page.getByLabel('Nombre', { exact: true }).fill('A');
  await page.getByRole('button', { name: 'Guardar grupo', exact: true }).click();
  await expect(page.getByRole('form')).toHaveCount(0);
  await navigate(page, 'Alumnos');
  for (let i = 0; i < count; i++) await addStudent(page, `Alumno ${i}`);
  await attachAudit(page);
}
export async function addStudent(page: Page, name: string) {
  await page.getByLabel('Nombre o nombres').fill(name);
  await page.getByLabel('Apellido o apellidos').fill('Prueba');
  await page.getByRole('button', { name: 'Guardar alumno', exact: true }).click();
  await expect(page.getByLabel('Nombre o nombres')).toHaveValue('');
  await expect(
    page.getByRole('button', { name: `Ver ficha de Prueba, ${name}`, exact: true }).last(),
  ).toBeVisible();
}
export async function snapshot(page: Page) {
  return page.evaluate(async () => {
    const { db } = window.classNoteAudit;
    return db.transaction('r', db.tables, () =>
      Promise.all(db.tables.map((table) => table.toArray())),
    );
  });
}
export async function createTask(page: Page, title = 'Tarea de prueba') {
  await navigate(page, 'Tareas');
  await page.getByRole('button', { name: 'Crear tarea', exact: true }).click();
  await page.getByLabel('Título', { exact: true }).fill(title);
  await page.getByLabel('Fecha de asignación').fill('2026-10-19');
  await page.getByRole('button', { name: 'Guardar tarea', exact: true }).click();
  await expect(page.getByRole('form')).toHaveCount(0);
}
export async function failWrite(page: Page, table: string, method: 'add' | 'put' = 'put') {
  await page.evaluate(
    ({ table, method }) => {
      const original = IDBObjectStore.prototype[method];
      IDBObjectStore.prototype[method] = function (...args: Parameters<IDBObjectStore['put']>) {
        if (this.name === table) {
          IDBObjectStore.prototype[method] = original;
          throw new DOMException('Fallo sintético', 'UnknownError');
        }
        return original.apply(this, args);
      };
    },
    { table, method },
  );
}
export async function noOverflow(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
}
