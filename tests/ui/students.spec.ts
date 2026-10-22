import { expect, test } from '@playwright/test';
import {
  configure,
  navigate,
  addStudent,
  failWrite,
  noOverflow,
  snapshot,
} from '../helpers/audit-browser';
for (const width of [1100, 768, 360]) {
  test(`CN005 ficha, baja, reactivación y archivo a ${width}px`, async ({ page, context }) => {
    await page.setViewportSize({ width, height: 900 });
    await configure(page, 1);
    await context.setOffline(true);
    await page.getByRole('button', { name: 'Ver ficha de Prueba, Alumno 0' }).click();
    await page.getByRole('button', { name: 'Editar ficha', exact: true }).click();
    await page.getByLabel('Nombre o nombres').fill('Editado');
    await page.getByRole('button', { name: 'Guardar alumno', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Ver ficha de Prueba, Editado' })).toBeVisible();
    await page.getByRole('button', { name: 'Dar de baja del grupo' }).click();
    await page.getByLabel('Fecha de salida (opcional)').fill('2026-10-19');
    await page.getByRole('button', { name: 'Confirmar baja', exact: true }).click();
    await page.getByText('Buscar y filtrar', { exact: true }).click();
    await page.getByLabel('Mostrar alumnos dados de baja').check();
    await expect(page.getByText('Salida: 2026-10-19', { exact: false })).toBeVisible();
    await page.getByRole('button', { name: 'Volver al grupo' }).click();
    await page.getByLabel('Fecha de salida (opcional)').fill('');
    await page.getByRole('button', { name: 'Guardar alumno', exact: true }).click();
    await page.getByRole('button', { name: 'Archivar alumno', exact: true }).click();
    await page.getByRole('button', { name: 'Confirmar archivo del alumno' }).click();
    await page.getByRole('button', { name: 'Reactivar ficha', exact: true }).click();
    await page.getByRole('button', { name: 'Volver al grupo' }).click();
    await page.getByRole('button', { name: 'Guardar alumno', exact: true }).click();
    const rows = await page.evaluate(() => window.classNoteAudit.r.listStudentRecords());
    expect(rows.students).toHaveLength(1);
    expect(rows.enrollments).toHaveLength(1);
    expect(rows.students[0]?.firstName).toBe('Editado');
    expect(rows.enrollments[0]?.status).toBe('active');
    await noOverflow(page);
  });
}
test('CN005 homónimos conservan identidades y cambiar de formulario protege el alta', async ({
  page,
}) => {
  await configure(page);
  await addStudent(page, 'Homónimo');
  await addStudent(page, 'Homónimo');
  expect(await page.evaluate(() => window.classNoteAudit.db.students.count())).toBe(2);
  await page.getByRole('button', { name: 'Ver ficha de Prueba, Homónimo' }).first().click();
  await page.getByLabel('Nombre o nombres').fill('Borrador');
  page.once('dialog', (d) => d.dismiss());
  await page.getByRole('button', { name: 'Editar ficha', exact: true }).click();
  await expect(page.getByLabel('Nombre o nombres')).toHaveValue('Borrador');
  page.once('dialog', (d) => d.accept());
  await page.getByRole('button', { name: 'Editar ficha', exact: true }).click();
  await expect(page.getByLabel('Nombre o nombres')).toHaveValue('Homónimo');
  await page.getByLabel('Nombre o nombres').fill('Edición');
  page.once('dialog', (d) => d.dismiss());
  await page.getByRole('button', { name: 'Cancelar formulario' }).click();
  await expect(page.getByLabel('Nombre o nombres')).toHaveValue('Edición');
});
test('CN005 fallo de escritura conserva campos, rollback y reintento por teclado', async ({
  page,
}) => {
  await configure(page);
  const before = await snapshot(page);
  await page.getByLabel('Nombre o nombres').fill('Error');
  await page.getByLabel('Apellido o apellidos').fill('Prueba');
  await failWrite(page, 'enrollments', 'add');
  await page.getByRole('button', { name: 'Guardar alumno' }).click();
  await expect(page.getByRole('alert')).toBeVisible();
  await expect(page.getByLabel('Nombre o nombres')).toHaveValue('Error');
  expect(await snapshot(page)).toEqual(before);
  await page.getByRole('button', { name: 'Guardar alumno' }).focus();
  await page.keyboard.press('Enter');
  await expect(page.getByLabel('Nombre o nombres')).toHaveValue('');
  expect(await page.evaluate(() => window.classNoteAudit.db.students.count())).toBe(1);
});
test('CN005 alta y edición protegen navegación, cancelación, recarga y cierre; guardar libera el aviso', async ({
  page,
}) => {
  await configure(page, 1);
  for (const edit of [false, true]) {
    if (edit) {
      await page.getByRole('button', { name: 'Ver ficha de Prueba, Alumno 0' }).click();
      await page.getByRole('button', { name: 'Editar ficha', exact: true }).click();
    }
    await page.getByLabel('Nombre o nombres').fill('Sin guardar');
    for (const action of [
      () => page.getByRole('navigation').getByRole('link', { name: 'Inicio', exact: true }).click(),
      () => page.getByRole('button', { name: 'Cancelar formulario' }).click(),
    ]) {
      page.once('dialog', (d) => d.dismiss());
      await action();
      await expect(page.getByLabel('Nombre o nombres')).toHaveValue('Sin guardar');
    }
    const prevented = await page.evaluate(() => {
      const event = new Event('beforeunload', { cancelable: true });
      window.dispatchEvent(event);
      return event.defaultPrevented;
    });
    expect(prevented).toBe(true);
    const closeDialog = page.waitForEvent('dialog');
    const reload = page.reload({ timeout: 1500 }).catch((error: Error) => error);
    const dialog = await closeDialog;
    expect(dialog.type()).toBe('beforeunload');
    await dialog.dismiss();
    const aborted = await reload;
    expect(aborted).toBeInstanceOf(Error);
    await expect(page.getByLabel('Nombre o nombres')).toHaveValue('Sin guardar');
    page.once('dialog', (d) => d.accept());
    await page.getByRole('button', { name: 'Cancelar formulario' }).click();
    await expect(page.getByLabel('Nombre o nombres')).toHaveValue('');
  }
  let dialogs = 0;
  page.on('dialog', async (d) => {
    dialogs++;
    await d.dismiss();
  });
  await addStudent(page, 'Guardado');
  await navigate(page, 'Inicio');
  expect(dialogs).toBe(0);
});
test('CN005 campos bloqueados durante guardado y baja inválida conserva datos', async ({
  page,
}) => {
  await configure(page, 1);
  await page.getByRole('button', { name: 'Ver ficha de Prueba, Alumno 0' }).click();
  await page.getByRole('button', { name: 'Corregir fechas' }).click();
  await page.evaluate(async () => {
    const { r, db } = window.classNoteAudit;
    const e = (await db.enrollments.toArray())[0]!;
    const g = (await db.groups.toArray())[0]!;
    const a = await r.createAssignment(
      { schoolYearId: g.schoolYearId, groupId: g.id },
      { title: 'Tarea', assignedDate: '2026-10-19' },
    );
    await r.createSubmission(
      { schoolYearId: g.schoolYearId, groupId: g.id, enrollmentId: e.id },
      { assignmentId: a.id, status: 'submitted' },
    );
  });
  const before = await snapshot(page);
  await page.getByLabel('Fecha de salida (opcional)').fill('2026-10-18');
  await page.getByRole('button', { name: 'Guardar alumno' }).click();
  await expect(page.getByRole('alert')).toContainText('entregas');
  expect(await snapshot(page)).toEqual(before);
  await expect(page.getByLabel('Fecha de salida (opcional)')).toHaveValue('2026-10-18');
  page.once('dialog', (d) => d.accept());
  await page.getByRole('button', { name: 'Cancelar formulario' }).click();
  await page.evaluate(() => {
    Object.assign(window, { releaseStudentSave: false });
    const original = IDBObjectStore.prototype.add;
    IDBObjectStore.prototype.add = function (...args) {
      const request = original.apply(this, args);
      if (this.name === 'enrollments') {
        IDBObjectStore.prototype.add = original;
        const pump = () => {
          if (!(window as unknown as { releaseStudentSave: boolean }).releaseStudentSave)
            this.get('keep-alive').onsuccess = pump;
        };
        pump();
      }
      return request;
    };
  });
  await page.getByLabel('Nombre o nombres').fill('Bloqueado');
  await page.getByLabel('Apellido o apellidos').fill('Prueba');
  await page.getByRole('button', { name: 'Guardar alumno' }).click();
  await expect(page.getByLabel('Nombre o nombres')).toBeDisabled();
  await expect(page.getByLabel('Apellido o apellidos')).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Cancelar formulario' })).toBeDisabled();
  await page.evaluate(() => {
    (window as unknown as { releaseStudentSave: boolean }).releaseStudentSave = true;
  });
  await expect(page.getByLabel('Nombre o nombres')).toHaveValue('');
  expect(await page.evaluate(() => window.classNoteAudit.db.students.count())).toBe(2);
});

test('CN005 fallo de consulta posterior al guardado no conserva un alta reenviable', async ({
  page,
}) => {
  await configure(page, 1);
  // Open the historical projection so saving refreshes it after committing.
  await page.getByRole('button', { name: 'Ver ficha de Prueba, Alumno 0' }).click();
  await page.getByLabel('Nombre o nombres').fill('Guardado con consulta fallida');
  await page.getByLabel('Apellido o apellidos').fill('Prueba');
  await page.evaluate(() => {
    const original = IDBObjectStore.prototype.getAll;
    IDBObjectStore.prototype.getAll = function (...args) {
      if (this.name === 'students') {
        IDBObjectStore.prototype.getAll = original;
        throw new DOMException('Consulta posterior sintética', 'UnknownError');
      }
      return original.apply(this, args);
    };
  });
  await page.getByRole('button', { name: 'Guardar alumno', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Los cambios se guardaron');
  await expect(page.getByLabel('Nombre o nombres')).toHaveValue('');
  expect(await page.evaluate(() => window.classNoteAudit.db.students.count())).toBe(2);
  await page.getByRole('button', { name: 'Reintentar lista' }).click();
  await expect(
    page.getByRole('button', { name: 'Ver ficha de Prueba, Guardado con consulta fallida' }),
  ).toHaveCount(1);
  let dialogs = 0;
  page.on('dialog', async (dialog) => {
    dialogs++;
    await dialog.dismiss();
  });
  await navigate(page, 'Inicio');
  expect(dialogs).toBe(0);
});
