import { expect, test } from '@playwright/test';
import { configure, navigate, snapshot, noOverflow } from './audit-browser';
export function hiddenHistory(module: 'reading' | 'notes') {
  for (const width of [1100, 768, 360])
    test(`${module}: historial oculto se conserva, valida y restaura offline a ${width}px`, async ({
      page,
      context,
    }) => {
      await page.setViewportSize({ width, height: 900 });
      await configure(page, 1);
      await page.evaluate(async (module) => {
        const { r, db } = window.classNoteAudit;
        const g = (await db.groups.toArray())[0]!;
        const e = (await db.enrollments.toArray())[0]!;
        const c = { schoolYearId: g.schoolYearId, groupId: g.id, enrollmentId: e.id };
        if (module === 'reading')
          await r.createReadingLog(c, { date: '2026-10-19', title: 'Histórico', minutes: 12 });
        else
          await r.createStudentNote(c, {
            date: '2026-10-19',
            category: 'academic',
            body: 'Histórico',
          });
      }, module);
      const before = await snapshot(page);
      await context.setOffline(true);
      for (const section of ['Inicio', 'Alumnos', 'Tareas', 'Reportes', 'Configuración']) {
        await navigate(page, section);
        await expect(
          page.getByRole('navigation').getByRole('link', { name: /Lectura|Observaciones/ }),
        ).toHaveCount(0);
        await noOverflow(page);
      }
      expect(await snapshot(page)).toEqual(before);
      const counts = await page.evaluate(async () => {
        const { backup } = window.classNoteAudit;
        const source = await backup.export();
        const preview = await backup.preview(source);
        await backup.restore(source, true, async () => true);
        return preview.counts;
      });
      expect(counts[module === 'reading' ? 'readingLogs' : 'studentNotes']).toBe(1);
      expect(await snapshot(page)).toEqual(before);
    });
  test(`${module}: fechas y propiedad inválidas, aislamiento e historial archivado`, async ({
    page,
  }) => {
    await configure(page, 1);
    const result = await page.evaluate(async (module) => {
      const { r, db } = window.classNoteAudit;
      const g = (await db.groups.toArray())[0]!;
      const e = (await db.enrollments.toArray())[0]!;
      const c = { schoolYearId: g.schoolYearId, groupId: g.id, enrollmentId: e.id };
      let rejected = 0;
      for (const date of ['2026-07-31', '2027-08-01', '2026-02-30']) {
        try {
          if (module === 'reading')
            await r.createReadingLog(c, { date, title: 'Historia', minutes: 10 });
          else await r.createStudentNote(c, { date, category: 'academic', body: 'Historia' });
        } catch {
          rejected++;
        }
      }
      await r.setStudentActive(e.studentId, false);
      if (module === 'reading')
        await r.createReadingLog(c, { date: '2026-10-19', title: 'Historia', minutes: 0 });
      else
        await r.createStudentNote(c, {
          date: '2026-10-19',
          category: 'academic',
          body: 'Historia',
        });
      await r.archiveGroup(c);
      return {
        rejected,
        rows: await db.table(module === 'reading' ? 'readingLogs' : 'studentNotes').toArray(),
      };
    }, module);
    expect(result.rejected).toBe(3);
    expect(result.rows).toHaveLength(1);
    const before = await snapshot(page);
    await navigate(page, 'Reportes');
    expect(await snapshot(page)).toEqual(before);
  });
  test(`${module}: fallo de escritura conserva el historial y reintento no duplica`, async ({
    page,
  }) => {
    await configure(page, 1);
    const before = await snapshot(page);
    const result = await page.evaluate(async (module) => {
      const { r, db } = window.classNoteAudit;
      const g = (await db.groups.toArray())[0]!;
      const e = (await db.enrollments.toArray())[0]!;
      const c = { schoolYearId: g.schoolYearId, groupId: g.id, enrollmentId: e.id };
      const table = module === 'reading' ? db.readingLogs : db.studentNotes;
      const fail = () => {
        throw new Error('Sintético');
      };
      table.hook('creating', fail);
      let rejected = false;
      try {
        if (module === 'reading')
          await r.createReadingLog(c, { date: '2026-10-19', title: 'Historia', minutes: 12 });
        else
          await r.createStudentNote(c, {
            date: '2026-10-19',
            category: 'academic',
            body: 'Historia',
          });
      } catch {
        rejected = true;
      }
      table.hook('creating').unsubscribe(fail);
      return rejected;
    }, module);
    expect(result).toBe(true);
    expect(await snapshot(page)).toEqual(before);
    await page.evaluate(async (module) => {
      const { r, db } = window.classNoteAudit;
      const g = (await db.groups.toArray())[0]!;
      const e = (await db.enrollments.toArray())[0]!;
      const c = { schoolYearId: g.schoolYearId, groupId: g.id, enrollmentId: e.id };
      if (module === 'reading')
        await r.createReadingLog(c, { date: '2026-10-19', title: 'Historia', minutes: 12 });
      else
        await r.createStudentNote(c, {
          date: '2026-10-19',
          category: 'academic',
          body: 'Historia',
        });
    }, module);
    expect(
      await page.evaluate(
        (module) =>
          window.classNoteAudit.db
            .table(module === 'reading' ? 'readingLogs' : 'studentNotes')
            .count(),
        module,
      ),
    ).toBe(1);
  });
  test(`${module}: dos correcciones concurrentes conservan la versión ganadora y rechazan la antigua`, async ({
    page,
  }) => {
    await configure(page, 1);
    const result = await page.evaluate(async (module) => {
      const { r, db } = window.classNoteAudit;
      const g = (await db.groups.toArray())[0]!;
      const e = (await db.enrollments.toArray())[0]!;
      const c = { schoolYearId: g.schoolYearId, groupId: g.id, enrollmentId: e.id };
      if (module === 'reading') {
        const a = await r.createReadingLog(c, {
          date: '2026-10-19',
          title: 'Original',
          minutes: 12,
        });
        const saved = await r.updateReadingLog(c, a.id, { ...a, title: 'Primera' }, a);
        let rejected = false;
        try {
          await r.updateReadingLog(c, a.id, { ...a, title: 'Segunda' }, a);
        } catch {
          rejected = true;
        }
        return { rejected, saved, current: await db.readingLogs.get(a.id) };
      }
      const a = await r.createStudentNote(c, {
        date: '2026-10-19',
        category: 'academic',
        body: 'Original',
      });
      const saved = await r.updateStudentNote(c, a.id, { ...a, body: 'Primera' }, a);
      let rejected = false;
      try {
        await r.updateStudentNote(c, a.id, { ...a, body: 'Segunda' }, a);
      } catch {
        rejected = true;
      }
      return { rejected, saved, current: await db.studentNotes.get(a.id) };
    }, module);
    expect(result.rejected).toBe(true);
    expect(result.current).toEqual(result.saved);
  });
  if (module === 'notes')
    test('notes: eliminación requiere confirmación y versión vigente, sin borrar corrección ajena', async ({
      page,
    }) => {
      await configure(page, 1);
      const result = await page.evaluate(async () => {
        const { r, db } = window.classNoteAudit;
        const g = (await db.groups.toArray())[0]!;
        const e = (await db.enrollments.toArray())[0]!;
        const c = { schoolYearId: g.schoolYearId, groupId: g.id, enrollmentId: e.id };
        const a = await r.createStudentNote(c, {
          date: '2026-10-19',
          category: 'academic',
          body: 'Original',
        });
        const saved = await r.updateStudentNote(c, a.id, { ...a, body: 'Corregida' }, a);
        let rejected = 0;
        for (const [expected, confirmed] of [
          [saved, false],
          [a, true],
        ] as const) {
          try {
            await r.deleteStudentNote(c, a.id, expected, confirmed);
          } catch {
            rejected++;
          }
        }
        const current = await db.studentNotes.get(a.id);
        await r.deleteStudentNote(c, a.id, saved, true);
        return { rejected, current, saved, count: await db.studentNotes.count() };
      });
      expect(result.rejected).toBe(2);
      expect(result.current).toEqual(result.saved);
      expect(result.count).toBe(0);
    });
}
