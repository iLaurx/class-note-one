import 'fake-indexeddb/auto';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ClassNoteDatabase } from '../../src/db/database.ts';
import { Repositories } from '../../src/db/repositories.ts';
import { createFixture } from './fixtures.ts';

const snapshot = (db: ClassNoteDatabase) =>
  db.transaction('r', db.tables, () => Promise.all(db.tables.map((table) => table.toArray())));

for (const relation of [
  'assignment',
  'dueDate',
  'attendance',
  'reading',
  'note',
  'leftAt',
] as const) {
  test(`ciclo: valida ${relation}, grupos archivados, ambos extremos y rechazo atómico`, async (t) => {
    const db = new ClassNoteDatabase(`audit-${crypto.randomUUID()}`);
    t.after(() => db.delete());
    const r = new Repositories(db);
    const f = await createFixture(r);
    if (relation !== 'assignment' && relation !== 'dueDate') await db.assignments.clear();
    if (relation === 'dueDate')
      await db.assignments.update(f.assignment.id, { dueDate: '2026-10-25' });
    if (relation === 'attendance')
      await r.createAttendance(f.enrollmentContext, { date: '2026-10-19', status: 'present' });
    if (relation === 'reading')
      await r.createReadingLog(f.enrollmentContext, {
        date: '2026-10-19',
        title: 'Libro',
        minutes: 10,
      });
    if (relation === 'note')
      await r.createStudentNote(f.enrollmentContext, {
        date: '2026-10-19',
        category: 'academic',
        body: 'Nota',
      });
    if (relation === 'leftAt')
      await r.updateEnrollment(f.enrollmentContext, { status: 'active', leftAt: '2026-10-19' });
    await r.archiveGroup(f.context);
    const before = await snapshot(db);
    for (const patch of [
      { startDate: '2026-10-20' },
      { endDate: relation === 'dueDate' ? '2026-10-24' : '2026-10-18' },
    ]) {
      await assert.rejects(
        r.updateSchoolYear(f.year.id, { ...f.year, label: 'No guardar', ...patch }),
      );
      assert.deepEqual(await snapshot(db), before);
    }
    const valid = await r.updateSchoolYear(f.year.id, {
      ...f.year,
      startDate: '2026-10-19',
      endDate: '2026-10-25',
    });
    assert.equal(valid.startDate, '2026-10-19');
  });
}

for (const relation of ['submission', 'attendance', 'reading', 'note'] as const) {
  test(`baja: ${relation} del 19 impide salida el 18 y conserva todas las tablas`, async (t) => {
    const db = new ClassNoteDatabase(`audit-${crypto.randomUUID()}`);
    t.after(() => db.delete());
    const r = new Repositories(db);
    const f = await createFixture(r);
    if (relation === 'submission')
      await r.createSubmission(f.enrollmentContext, {
        assignmentId: f.assignment.id,
        status: 'submitted',
      });
    if (relation === 'attendance')
      await r.createAttendance(f.enrollmentContext, { date: '2026-10-19', status: 'present' });
    if (relation === 'reading')
      await r.createReadingLog(f.enrollmentContext, {
        date: '2026-10-19',
        title: 'Libro',
        minutes: 10,
      });
    if (relation === 'note')
      await r.createStudentNote(f.enrollmentContext, {
        date: '2026-10-19',
        category: 'academic',
        body: 'Nota',
      });
    const before = await snapshot(db);
    await assert.rejects(
      r.updateEnrollment(f.enrollmentContext, { status: 'inactive', leftAt: '2026-10-18' }),
    );
    assert.deepEqual(await snapshot(db), before);
    const valid = await r.updateEnrollment(f.enrollmentContext, {
      status: 'inactive',
      leftAt: '2026-10-19',
      joinedAt: '2026-10-25',
    });
    assert.equal(valid.leftAt, '2026-10-19');
    assert.equal((await r.loadAttendanceDay(f.context, f.year.startDate)).length, 1);
    await r.updateEnrollment(f.enrollmentContext, { status: 'active' });
    assert.equal((await db.enrollments.get(f.enrollment.id))?.leftAt, undefined);
  });
}

test('tareas: dos conexiones con timestamps iguales, conflicto atómico y reintento con lectura vigente', async (t) => {
  const db = new ClassNoteDatabase(`audit-${crypto.randomUUID()}`);
  const second = new ClassNoteDatabase(db.name);
  t.after(async () => {
    second.close();
    await db.delete();
  });
  const r = new Repositories(db),
    other = new Repositories(second);
  const f = await createFixture(r);
  const original = (await other.loadAssignment(f.context, f.assignment.id)).assignment;
  await r.updateAssignment(
    f.context,
    original.id,
    { ...original, title: 'Primera sesión' },
    original,
  );
  // Force a colliding clock to prove comparison includes values, not only timestamps.
  await db.assignments.update(original.id, { updatedAt: original.updatedAt });
  const before = await snapshot(db);
  await assert.rejects(
    other.updateAssignment(
      f.context,
      original.id,
      { ...original, description: 'Borrador segunda sesión' },
      original,
    ),
    /otra ventana/,
  );
  assert.deepEqual(await snapshot(db), before);
  const latest = (await other.loadAssignment(f.context, original.id)).assignment;
  const result = await other.updateAssignment(
    f.context,
    original.id,
    { ...latest, description: 'Borrador segunda sesión' },
    latest,
  );
  assert.equal(result.title, 'Primera sesión');
  assert.equal(result.description, 'Borrador segunda sesión');
  assert.deepEqual(await other.updateAssignment(f.context, result.id, result, result), result);
  const concurrent = await Promise.allSettled([
    r.updateAssignment(f.context, result.id, { ...result, title: 'A' }, result),
    other.updateAssignment(f.context, result.id, { ...result, title: 'B' }, result),
  ]);
  assert.equal(concurrent.filter((item) => item.status === 'fulfilled').length, 1);
  assert.equal(concurrent.filter((item) => item.status === 'rejected').length, 1);
});
