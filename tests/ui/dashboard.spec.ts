import { expect, test } from '@playwright/test';
import { configure, navigate, snapshot, noOverflow, createTask } from '../helpers/audit-browser';
for (const width of [1100, 768, 360])
  test(`CN010 resumen real, enlaces y aislamiento offline a ${width}px`, async ({
    page,
    context,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await configure(page, 3);
    await createTask(page);
    await page.evaluate(async () => {
      const { r, db } = window.classNoteAudit;
      const g = (await db.groups.toArray())[0]!;
      const e = (await db.enrollments.toArray())[0]!;
      await r.createAttendance(
        { schoolYearId: g.schoolYearId, groupId: g.id, enrollmentId: e.id },
        { date: '2026-10-21', status: 'present' },
      );
      const a = (await db.assignments.toArray())[0]!;
      await r.createSubmission(
        { schoolYearId: g.schoolYearId, groupId: g.id, enrollmentId: e.id },
        { assignmentId: a.id, status: 'submitted' },
      );
    });
    const before = await snapshot(page);
    await context.setOffline(true);
    await navigate(page, 'Inicio');
    await expect(page.getByRole('link', { name: 'Alumnos del grupo', exact: true })).toContainText(
      '3',
    );
    await expect(page.getByRole('link', { name: 'Asistencia de hoy', exact: true })).toContainText(
      '1 / 3',
    );
    await expect(page.locator('.due-label')).toHaveText('2 pendientes');
    await expect(
      page.getByRole('navigation').getByRole('link', { name: /Lectura|Observaciones/ }),
    ).toHaveCount(0);
    await noOverflow(page);
    expect(await snapshot(page)).toEqual(before);
    await page.getByRole('link', { name: 'Abrir entregas de Tarea de prueba' }).focus();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('region', { name: 'Entregas de la tarea' })).toBeVisible();
    await expect(page.getByRole('group', { name: /Estado de/ })).toHaveCount(3);
    expect(await snapshot(page)).toEqual(before);
  });
test('CN010 error recuperable por teclado sin escrituras ni valores ficticios', async ({
  page,
}) => {
  await configure(page, 1);
  const before = await snapshot(page);
  await page.evaluate(() => {
    const original = IDBObjectStore.prototype.get;
    IDBObjectStore.prototype.get = function (...args) {
      if (this.name === 'groups') {
        IDBObjectStore.prototype.get = original;
        throw new DOMException('Sintético', 'UnknownError');
      }
      return original.apply(this, args);
    };
  });
  await navigate(page, 'Inicio');
  await expect(page.getByRole('alert')).toContainText('No se pudo consultar');
  await page.getByRole('button', { name: 'Reintentar resumen' }).focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('link', { name: 'Alumnos del grupo', exact: true })).toContainText(
    '1',
  );
  expect(await snapshot(page)).toEqual(before);
});
