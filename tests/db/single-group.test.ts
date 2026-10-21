import 'fake-indexeddb/auto';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ClassNoteDatabase } from '../../src/db/database.ts';
import { Repositories } from '../../src/db/repositories.ts';

test('solo un grupo activo por ciclo; archivo y reactivación conservan el historial', async (t) => {
  const db = new ClassNoteDatabase(`single-group-${crypto.randomUUID()}`);
  t.after(() => db.delete());
  const r = new Repositories(db);
  const fields = { startDate: '2026-08-01', endDate: '2027-07-31' };
  const year = await r.createSchoolYear({ ...fields, label: '2026' });
  const first = await r.createGroup({ schoolYearId: year.id, grade: 2, name: 'A' });
  const context = { schoolYearId: year.id, groupId: first.id };
  await assert.rejects(
    r.createGroup({ schoolYearId: year.id, grade: 3, name: 'B' }),
    /grupo activo/,
  );
  assert.equal(await db.groups.count(), 1);
  await r.archiveGroup(context);
  const next = await r.createGroup({ schoolYearId: year.id, grade: 3, name: 'B' });
  await assert.rejects(r.reactivateGroup(context), /grupo activo/);
  assert.equal((await db.groups.get(first.id))?.archived, true);
  await r.archiveGroup({ schoolYearId: year.id, groupId: next.id });
  await r.reactivateGroup(context);
  assert.equal((await db.groups.get(first.id))?.createdAt, first.createdAt);
  assert.equal((await r.loadWorkspace()).selection.groupId, first.id);
  const otherYear = await r.createSchoolYear({ ...fields, label: '2027' });
  await r.createGroup({ schoolYearId: otherYear.id, grade: 4, name: 'A' });
  assert.equal(await db.groups.count(), 3);
});

test('dos altas simultáneas no crean dos grupos activos', async (t) => {
  const db = new ClassNoteDatabase(`single-group-race-${crypto.randomUUID()}`);
  t.after(() => db.delete());
  const r = new Repositories(db);
  const year = await r.createSchoolYear({
    label: '2026',
    startDate: '2026-08-01',
    endDate: '2027-07-31',
  });
  const results = await Promise.allSettled([
    r.createGroup({ schoolYearId: year.id, grade: 1, name: 'A' }),
    r.createGroup({ schoolYearId: year.id, grade: 2, name: 'B' }),
  ]);
  assert.equal(results.filter((result) => result.status === 'fulfilled').length, 1);
  assert.equal(await db.groups.count(), 1);
});
