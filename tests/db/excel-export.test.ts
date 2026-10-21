import 'fake-indexeddb/auto';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import ExcelJS from 'exceljs';
import { mkdir, writeFile } from 'node:fs/promises';
import { ClassNoteDatabase } from '../../src/db/database.ts';
import { Repositories } from '../../src/db/repositories.ts';
import { fillRelated, createFixture } from './fixtures.ts';
import { groupWorkbook, safeCell } from '../../src/services/export/groupWorkbook.ts';
import {
  defaultReportOptions,
  periodRange,
  type ReportSection,
} from '../../src/services/export/reportOptions.ts';
import { memberStats, selectReport } from '../../src/services/export/reportData.ts';

async function open(bytes: Uint8Array) {
  const book = new ExcelJS.Workbook();
  await book.xlsx.load(bytes as unknown as ExcelJS.Buffer);
  return book;
}
function values(sheet: ExcelJS.Worksheet) {
  const rows: ExcelJS.CellValue[][] = [];
  sheet.eachRow((r) => rows.push((r.values as ExcelJS.CellValue[]).slice(1)));
  return rows;
}
function blockRow(sheet: ExcelJS.Worksheet, title: string, offset = 2) {
  let found = 0;
  sheet.eachRow((r) => {
    if (r.getCell(1).value === title) found = r.number;
  });
  assert.ok(found, title);
  return sheet.getRow(found + offset);
}

test('periodos locales: semana completa, fin de mes, bisiesto, recorte al ciclo y fechas libres', () => {
  const year = {
    id: '',
    createdAt: '',
    updatedAt: '',
    label: 'Ciclo',
    startDate: '2026-08-01',
    endDate: '2027-07-31',
    archived: false,
  };
  assert.deepEqual(periodRange('week', '2026-10-21', year, '', ''), {
    from: '2026-10-19',
    to: '2026-10-25',
  });
  assert.deepEqual(periodRange('week', '2026-08-01', year, '', ''), {
    from: '2026-08-01',
    to: '2026-08-02',
  });
  assert.deepEqual(periodRange('month', '2026-10-01', year, '', ''), {
    from: '2026-10-01',
    to: '2026-10-31',
  });
  assert.deepEqual(periodRange('total', '2026-10-21', year, '', ''), {
    from: year.startDate,
    to: year.endDate,
  });
  assert.deepEqual(periodRange('total', '2026-10-21', { ...year, endDate: undefined }, '', ''), {
    from: year.startDate,
    to: '2026-10-21',
  });
  assert.deepEqual(periodRange('month', '2028-02-01', { ...year, endDate: '2028-07-31' }, '', ''), {
    from: '2028-02-01',
    to: '2028-02-29',
  });
  assert.deepEqual(periodRange('custom', '', year, '2026-10-19', '2026-10-19'), {
    from: '2026-10-19',
    to: '2026-10-19',
  });
  assert.throws(() => periodRange('custom', '', year, '2026-10-20', '2026-10-19'), /posterior/);
  assert.throws(() => periodRange('month', '2026-02-29', year, '', ''));
});

test('Excel: siete alumnos, cifras correctas, registros ausentes y aislamiento sin modificar datos', async (t) => {
  const db = new ClassNoteDatabase(`reports-${crypto.randomUUID()}`);
  t.after(() => db.delete());
  const r = new Repositories(db),
    f = await fillRelated(r);
  const extra = [];
  for (const firstName of ['Ana', 'Bruno', 'Carla', 'Diego', 'Elena', 'Felipe']) {
    const student = await r.createStudent({ firstName, lastName: 'Prueba' });
    extra.push(await r.createEnrollment(f.context, { studentId: student.id, status: 'active' }));
  }
  await r.createAttendance(f.enrollmentContext, { date: '2026-10-20', status: 'late' });
  await r.createAttendance(f.enrollmentContext, {
    date: '2026-10-21',
    status: 'excused',
    note: 'NOTA_OPCIONAL',
  });
  await r.createAttendance(
    { ...f.context, enrollmentId: extra[0]!.id },
    { date: '2026-10-20', status: 'absent' },
  );
  const task = await r.createAssignment(f.context, {
    title: 'Árbol y canción',
    description: 'DESCRIPCION',
    assignedDate: '2026-10-20',
    dueDate: '2026-11-01',
  });
  await r.createSubmission(f.enrollmentContext, {
    assignmentId: task.id,
    status: 'incomplete',
    comment: 'COMENTARIO_OPCIONAL',
  });
  await r.createReadingLog(f.enrollmentContext, {
    date: '2026-10-20',
    title: 'Libro cero minutos',
    minutes: 0,
  });
  await r.createReadingLog(f.enrollmentContext, {
    date: '2026-10-26',
    title: 'FUERA',
    minutes: 99,
  });
  const other = await createFixture(r, 'Otro ciclo');
  await r.createReadingLog(other.enrollmentContext, {
    date: '2026-10-19',
    title: 'OTRO_GRUPO',
    minutes: 99,
  });
  const before = await Promise.all(db.tables.map((table) => table.toArray()));
  const data = await r.loadGroupReport(f.context, '2026-10-19', '2026-10-25');
  assert.equal(data.enrollments.length, 7);
  assert.deepEqual(memberStats(data, f.enrollment.id), {
    present: 2,
    absent: 0,
    late: 1,
    excused: 1,
    captured: 3,
    missing: 0,
    rate: 2 / 3,
    assigned: 2,
    submitted: 1,
    incomplete: 1,
    notSubmitted: 0,
    pending: 0,
    readings: 2,
    minutes: 12,
  });
  const missing = memberStats(data, extra[1]!.id);
  assert.equal(missing.rate, null);
  assert.equal(missing.missing, 3);
  assert.equal(missing.pending, 2);
  assert.equal(
    memberStats(
      selectReport(data, { ...defaultReportOptions, enrollmentIds: [extra[1]!.id] }),
      extra[1]!.id,
    ).missing,
    3,
  );
  const bytes = await groupWorkbook(data),
    book = await open(bytes);
  assert.deepEqual(
    book.worksheets.map((s) => s.name),
    ['Resumen', 'Asistencia', 'Tareas'],
  );
  const attendance = book.getWorksheet('Asistencia')!;
  const rows = values(attendance);
  assert.ok(rows.some((row) => row.includes('✓') && row.includes('R') && row.includes('J')));
  assert.equal(
    attendance.getCell(blockRow(attendance, 'Asistencia del periodo').number, 8).value,
    2 / 3,
  );
  assert.equal(
    attendance.getCell(blockRow(attendance, 'Asistencia del periodo').number, 8).numFmt,
    '0%',
  );
  assert.match(JSON.stringify(attendance.model), /dataBar/);
  assert.ok(JSON.stringify(book.getWorksheet('Tareas')!.model).includes('Árbol y canción'));
  assert.ok(
    values(book.getWorksheet('Tareas')!)
      .flat()
      .some((v) => v instanceof Date && v.getUTCMonth() === 10),
  );
  assert.doesNotMatch(
    JSON.stringify(book.model),
    /OTRO_GRUPO|FUERA|Observación sintética|synthetic-test|NOTA_OPCIONAL|COMENTARIO_OPCIONAL/,
  );
  assert.deepEqual(await Promise.all(db.tables.map((table) => table.toArray())), before);
  await assert.rejects(
    r.loadGroupReport({ ...f.context, schoolYearId: other.year.id }, '2026-10-19', '2026-10-20'),
  );
  const commented = await open(
    await groupWorkbook(data, { ...defaultReportOptions, comments: true }),
  );
  assert.match(JSON.stringify(commented.model), /NOTA_OPCIONAL/);
  assert.match(JSON.stringify(commented.model), /COMENTARIO_OPCIONAL/);
  await mkdir('test-results/reports', { recursive: true });
  await writeFile('test-results/reports/semanal-siete.xlsx', bytes);
  await writeFile(
    'test-results/reports/mensual-siete.xlsx',
    await groupWorkbook(await r.loadGroupReport(f.context, '2026-10-01', '2026-10-31'), {
      ...defaultReportOptions,
      period: 'month',
    }),
  );
  await writeFile(
    'test-results/reports/ciclo-siete.xlsx',
    await groupWorkbook(await r.loadGroupReport(f.context, '2026-08-01', '2027-07-31'), {
      ...defaultReportOptions,
      period: 'total',
    }),
  );
});

test('todas las combinaciones de contenido, selección de alumnos y resumen sin detalle', async (t) => {
  const db = new ClassNoteDatabase(`reports-${crypto.randomUUID()}`);
  t.after(() => db.delete());
  const r = new Repositories(db),
    f = await fillRelated(r);
  const student = await r.createStudent({ firstName: 'EXCLUIDO', lastName: 'EXCLUIDO' });
  await r.createEnrollment(f.context, { studentId: student.id, status: 'active' });
  const data = await r.loadGroupReport(f.context, '2026-10-19', '2026-10-25');
  const sections: ReportSection[] = ['attendance', 'assignments', 'readings', 'students'];
  const names = ['Asistencia', 'Tareas', 'Lecturas', 'Alumnos'];
  for (let mask = 1; mask < 16; mask++) {
    const chosen = sections.filter((_, index) => (mask & (1 << index)) !== 0);
    const options = {
      ...defaultReportOptions,
      sections: chosen,
      enrollmentIds: [f.enrollment.id],
      summary: false,
      detail: false,
      comments: true,
    };
    const book = await open(await groupWorkbook(data, options));
    assert.deepEqual(
      book.worksheets.map((s) => s.name),
      ['Alumnos', 'Asistencia', 'Tareas', 'Lecturas'].filter((name) =>
        chosen.some((id) => names[sections.indexOf(id)] === name),
      ),
    );
    assert.doesNotMatch(
      JSON.stringify(book.model),
      /EXCLUIDO|Libro sintético|Tarea sintética|Observación sintética/,
    );
    assert.equal(selectReport(data, options).enrollments.length, 1);
  }
  await assert.rejects(groupWorkbook(data, { ...defaultReportOptions, sections: [] }), /contenido/);
  await assert.rejects(
    groupWorkbook(data, { ...defaultReportOptions, enrollmentIds: [] }),
    /alumno/,
  );
});

test('mensual: seis semanas parciales, fin de semana registrado y total por mes sin porcentajes ficticios', async (t) => {
  const db = new ClassNoteDatabase(`reports-${crypto.randomUUID()}`);
  t.after(() => db.delete());
  const r = new Repositories(db),
    f = await fillRelated(r);
  await r.createAttendance(f.enrollmentContext, { date: '2026-08-01', status: 'absent' });
  const monthly = await open(
    await groupWorkbook(await r.loadGroupReport(f.context, '2026-08-01', '2026-08-31'), {
      ...defaultReportOptions,
      period: 'month',
      sections: ['attendance'],
    }),
  );
  const sheet = monthly.getWorksheet('Asistencia')!;
  assert.equal(values(sheet).filter((row) => String(row[0]).startsWith('Semana del')).length, 6);
  assert.ok(values(sheet).some((row) => row.includes('Sáb 01/08')));
  const total = await open(
    await groupWorkbook(await r.loadGroupReport(f.context, '2026-08-01', '2027-07-31'), {
      ...defaultReportOptions,
      period: 'total',
      detail: false,
      sections: ['attendance'],
    }),
  );
  const trend = blockRow(total.getWorksheet('Asistencia')!, 'Porcentaje de asistencia por mes');
  assert.equal(trend.getCell(2).value, 0);
  assert.equal(trend.getCell(3).value, 1);
  assert.doesNotMatch(JSON.stringify(total.model), /Semana del/);
});

test('vacíos y tareas sin destinatarios conservan el catálogo; sin registros no equivale a falta', async (t) => {
  const db = new ClassNoteDatabase(`reports-${crypto.randomUUID()}`);
  t.after(() => db.delete());
  const r = new Repositories(db),
    f = await createFixture(r);
  const year = await r.createSchoolYear({ label: 'Ciclo vacío', startDate: '2026-08-01' });
  const group = await r.createGroup({ schoolYearId: year.id, grade: 3, name: 'Vacío' });
  const context = { schoolYearId: year.id, groupId: group.id };
  await r.createAssignment(context, { title: 'Sin alumnos', assignedDate: '2026-10-19' });
  const book = await open(
    await groupWorkbook(await r.loadGroupReport(context, '2026-10-19', '2026-10-19')),
  );
  assert.match(JSON.stringify(book.model), /Sin alumnos/);
  assert.match(JSON.stringify(book.model), /Sin registros para este reporte/);
  const data = await r.loadGroupReport(f.context, '2026-10-19', '2026-10-19');
  assert.equal(memberStats(data, f.enrollment.id).rate, null);
  assert.equal(memberStats(data, f.enrollment.id).absent, 0);
});

test('texto libre neutralizado al reabrir XLSX, sin fórmulas y con comentarios opcionales', async (t) => {
  const db = new ClassNoteDatabase(`reports-${crypto.randomUUID()}`);
  t.after(() => db.delete());
  const r = new Repositories(db),
    f = await fillRelated(r);
  for (const prefix of [
    '=',
    '+',
    '-',
    '@',
    '\t',
    '\r',
    ' =',
    '  +',
    ' -',
    ' @',
    ' \t',
    ' \r',
    '\n=',
  ]) {
    const danger = `${prefix}HYPERLINK("https://example.invalid")`;
    assert.equal(safeCell(danger), `'${danger}`);
    const data = await r.loadGroupReport(f.context, '2026-10-19', '2026-10-19');
    data.students[0]!.lastName = danger;
    data.assignments[0]!.title = danger;
    data.assignments[0]!.description = danger;
    data.attendance[0]!.note = danger;
    data.submissions[0]!.comment = danger;
    data.readings[0]!.title = danger;
    data.readings[0]!.comment = danger;
    const book = await open(
      await groupWorkbook(data, {
        ...defaultReportOptions,
        comments: true,
        sections: ['attendance', 'assignments', 'readings', 'students'],
      }),
    );
    for (const sheet of book.worksheets) {
      let protectedCells = 0;
      sheet.eachRow((row) =>
        row.eachCell((cell) => {
          assert.notEqual(cell.type, ExcelJS.ValueType.Formula);
          if (String(cell.value).includes('HYPERLINK')) {
            assert.ok(String(cell.value).startsWith("'"));
            protectedCells++;
          }
        }),
      );
      assert.ok(protectedCells > 0, sheet.name);
    }
  }
  assert.equal(safeCell('Árbol'), 'Árbol');
});

test('tareas agrupadas por semana: números locales, fechas, nombres repetidos y cuadrículas delimitadas', async (t) => {
  const db = new ClassNoteDatabase(`reports-weeks-${crypto.randomUUID()}`);
  t.after(() => db.delete());
  const r = new Repositories(db),
    f = await fillRelated(r);
  for (const firstName of ['Ana', 'Bruno', 'Carla', 'Diego', 'Elena', 'Felipe']) {
    const student = await r.createStudent({ firstName, lastName: 'Prueba' });
    await r.createEnrollment(f.context, { studentId: student.id, status: 'active' });
  }
  for (const date of ['2026-10-05', '2026-10-12', '2026-10-19', '2026-10-26']) {
    for (let i = 0; i < 10; i++)
      await r.createAssignment(f.context, { title: `Trabajo ${i + 1}`, assignedDate: date });
  }
  const data = await r.loadGroupReport(f.context, '2026-10-01', '2026-10-31');
  for (const period of ['month', 'total', 'custom'] as const) {
    const bytes = await groupWorkbook(data, { ...defaultReportOptions, period });
    const book = await open(bytes);
    const tasks = book.getWorksheet('Tareas')!;
    const labels = values(tasks).map((row) => String(row[0]));
    for (const [from, to] of [
      ['05/10/2026', '11/10/2026'],
      ['12/10/2026', '18/10/2026'],
      ['19/10/2026', '25/10/2026'],
      ['26/10/2026', '01/11/2026'],
    ]) {
      assert.ok(labels.includes(`Semana del ${from} al ${to} · Actividades 1 a 6`));
      assert.ok(labels.includes(`Actividades y tareas · Semana del ${from} al ${to}`));
    }
    const headers = values(tasks).filter((row) => row[0] === 'Alumno');
    assert.equal(headers.filter((row) => String(row[1]).startsWith('Actividad 1\n')).length, 4);
    assert.equal(
      values(tasks)
        .flat()
        .filter((v) => v === 'Trabajo 1').length,
      4,
    );
    assert.doesNotMatch(
      JSON.stringify(book.worksheets.flatMap(values)),
      /Actividad 12|Actividad 43|Asistencias =|denominador|Sin observaciones privadas|ClassNote|¹/,
    );
    for (const sheet of book.worksheets) {
      sheet.eachRow((row) => {
        if (row.getCell(1).value !== 'Alumno') return;
        for (let index = row.number; index <= row.number + 7; index++) {
          sheet.getRow(index).eachCell((cell) => {
            for (const side of ['top', 'bottom', 'left', 'right'] as const)
              assert.equal(
                cell.border[side]?.style,
                'thin',
                `${sheet.name}:${cell.address}:${side}`,
              );
          });
        }
      });
      assert.equal(sheet.views[0]?.state, 'frozen');
      assert.equal(sheet.headerFooter.oddFooter, 'Página &P');
    }
    if (period === 'month') {
      await mkdir('test-results/reports', { recursive: true });
      await writeFile('test-results/reports/mensual-semanas.xlsx', bytes);
    }
  }
});
