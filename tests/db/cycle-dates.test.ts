import 'fake-indexeddb/auto';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ClassNoteDatabase } from '../../src/db/database.ts';
import { Repositories } from '../../src/db/repositories.ts';
import {
  TABLE_NAMES,
  validateRows,
  type BackupRows,
} from '../../src/services/backup/validation.ts';

test('el ciclo gobierna las fechas aunque los alumnos antiguos tengan ingreso futuro', async (t) => {
  const db = new ClassNoteDatabase(`cycle-dates-${crypto.randomUUID()}`);
  t.after(() => db.delete());
  const r = new Repositories(db);
  const year = await r.createSchoolYear({ label: 'Ciclo', startDate: '2026-10-26' });
  const group = await r.createGroup({ schoolYearId: year.id, grade: 2, name: 'A' });
  const context = { schoolYearId: year.id, groupId: group.id };
  const { enrollment } = await r.createStudentWithEnrollment(context, {
    firstName: 'Ana',
    lastName: 'Prueba',
  });
  assert.equal(Object.hasOwn(enrollment, 'joinedAt'), false);
  // Reproduce data saved by the previous app with the old cycle start.
  await db.enrollments.update(enrollment.id, { joinedAt: '2026-10-26' });
  await r.updateSchoolYear(year.id, { ...year, startDate: '2026-10-20' });
  const member = { ...context, enrollmentId: enrollment.id };
  const date = '2026-10-20';
  await r.saveAttendanceDay(context, date, [
    { enrollmentId: enrollment.id, status: 'present', expected: null },
  ]);
  assert.equal((await r.loadAttendanceDay(context, date))[0]?.attendance?.status, 'present');
  const task = await r.createAssignment(context, { title: 'Tarea', assignedDate: date });
  assert.equal((await r.loadAssignment(context, task.id)).rows.length, 1);
  await r.createReadingLog(member, { title: 'Cuento', date, minutes: 10 });
  await r.createStudentNote(member, { category: 'academic', body: 'Observación', date });
  const summary = await r.loadDashboard(context, date);
  assert.equal(summary.students, 1);
  assert.equal(summary.attendance?.present, 1);
  const rows = Object.fromEntries(
    await Promise.all(TABLE_NAMES.map(async (name) => [name, await db.table(name).toArray()])),
  ) as BackupRows;
  validateRows(rows);
  db.close();
  await db.open();
  assert.equal((await r.loadAttendanceDay(context, date))[0]?.attendance?.status, 'present');
  await assert.rejects(
    r.updateSchoolYear(year.id, { ...year, startDate: '2026-10-21' }),
    /asistencias/,
  );
  assert.equal((await r.listSchoolYears())[0]?.startDate, date);
  await assert.rejects(r.createAttendance(member, { date: '2026-10-19', status: 'present' }));
});

test('las altas ignoran el campo antiguo y las bajas conservan su límite', async (t) => {
  const db = new ClassNoteDatabase(`cycle-dates-${crypto.randomUUID()}`);
  t.after(() => db.delete());
  const r = new Repositories(db);
  const year = await r.createSchoolYear({ label: 'Ciclo', startDate: '2026-10-20' });
  const group = await r.createGroup({ schoolYearId: year.id, grade: 2, name: 'A' });
  const context = { schoolYearId: year.id, groupId: group.id };
  const { enrollment } = await r.createStudentWithEnrollment(context, {
    firstName: 'Ana',
    lastName: 'Prueba',
    joinedAt: '2026-10-26',
  });
  assert.equal(Object.hasOwn(enrollment, 'joinedAt'), false);
  const member = { ...context, enrollmentId: enrollment.id };
  await r.updateEnrollment(member, { status: 'inactive', leftAt: '2026-10-23' });
  assert.equal((await r.loadAttendanceDay(context, '2026-10-20')).length, 1);
  assert.equal((await r.loadAttendanceDay(context, '2026-10-24')).length, 0);
  await assert.rejects(r.createAttendance(member, { date: '2026-10-24', status: 'present' }));
});
