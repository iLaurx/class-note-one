import ExcelJS from 'exceljs';
import { includesDate, attendanceLabels } from '../../features/attendance/attendanceDomain.ts';
import { submissionLabels } from '../../features/assignments/assignmentDomain.ts';
import {
  defaultReportOptions,
  displayDate,
  monthLabel,
  shiftDate,
  weekStart,
  type ReportOptions,
} from './reportOptions.ts';
import { memberStats, reportMembers, selectReport, type GroupReport } from './reportData.ts';
export type { GroupReport } from './reportData.ts';

// User text must never become an Excel formula, including leading whitespace.
export function safeCell(value: string): string {
  return /^[\s]*[=+\-@\t\r\n]|^[\t\r\n]/u.test(value) ? `'${value}` : value;
}
type Value = string | number | null | Date;
const green = 'FF365B42',
  pale = 'FFEAF1E7',
  pink = 'FFF5E0E6';
const attendanceCodes = { present: '✓', absent: 'F', late: 'R', excused: 'J' };
const submissionCodes = { submitted: '✓', not_submitted: 'X', incomplete: 'P', pending: 'Pend.' };
const gridBorder: Partial<ExcelJS.Borders> = Object.fromEntries(
  ['top', 'bottom', 'left', 'right'].map((side) => [
    side,
    { style: 'thin', color: { argb: 'FF8C978C' } },
  ]),
);

export async function groupWorkbook(
  source: GroupReport,
  options: ReportOptions = defaultReportOptions,
): Promise<Uint8Array> {
  if (!options.sections.length) throw new Error('Selecciona al menos un contenido.');
  if (options.enrollmentIds?.length === 0) throw new Error('Selecciona al menos un alumno.');
  const data = selectReport(source, options);
  const members = reportMembers(data);
  const names = new Map(members.map((row) => [row.id, row.name]));
  const workbook = new ExcelJS.Workbook();
  const blocks = new Map<ExcelJS.Worksheet, { from: number; to: number }[]>();
  workbook.creator = 'ClassNote';
  workbook.title = 'Reporte del grupo';
  workbook.calcProperties.fullCalcOnLoad = true;
  const long =
    options.period === 'total' ||
    (Date.parse(data.range.to) - Date.parse(data.range.from)) / 86400000 > 62;
  const dateValue = (value: string) => new Date(`${value}T12:00:00Z`);
  const allDates = [
    ...new Set([
      ...(options.sections.includes('attendance')
        ? (data.attendanceDays ?? data.attendance.map((r) => r.date))
        : []),
      ...(options.sections.includes('assignments')
        ? data.assignments.map((r) => r.assignedDate)
        : []),
      ...(options.sections.includes('readings') ? data.readings.map((r) => r.date) : []),
    ]),
  ].sort();
  // Only months that contain records are needed in a long report; the heading retains the full requested range.
  const months = [...new Set(allDates.map((date) => date.slice(0, 7)))];
  function write(row: ExcelJS.Row, values: Value[]) {
    values.forEach((value, index) => {
      const cell = row.getCell(index + 1);
      cell.value = typeof value === 'string' ? safeCell(value) : value;
      cell.font = { name: 'Calibri', size: 11, color: { argb: 'FF303C38' } };
      cell.alignment = {
        vertical: 'middle',
        horizontal: index === 0 ? 'left' : 'center',
        wrapText: true,
      };
      cell.border = gridBorder;
      if (value instanceof Date) cell.numFmt = 'dd/mm/yyyy';
      if (row.number % 2 === 0)
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF5F8F2' } };
    });
    row.height = 22;
  }
  function band(sheet: ExcelJS.Worksheet, text: string, width: number, color = green) {
    const row = sheet.addRow([safeCell(text)]);
    sheet.mergeCells(row.number, 1, row.number, Math.max(2, width));
    row.height = 24;
    row.getCell(1).font = {
      name: 'Calibri',
      size: 12,
      bold: true,
      color: { argb: color === green ? 'FFFFFFFF' : green },
    };
    row.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: color } };
    row.getCell(1).alignment = { vertical: 'middle', wrapText: true };
    row.getCell(1).border = gridBorder;
    return row;
  }
  function sheet(name: string, width: number) {
    const s = workbook.addWorksheet(name, {
      properties: { defaultRowHeight: 28 },
      pageSetup: {
        paperSize: 9,
        orientation: width >= 6 && name !== 'Resumen' ? 'landscape' : 'portrait',
        fitToPage: true,
        fitToWidth: 1,
        fitToHeight: 0,
        margins: { left: 0.25, right: 0.25, top: 0.4, bottom: 0.4, header: 0.15, footer: 0.15 },
      },
    });
    band(
      s,
      name === 'Tareas'
        ? 'Registro de actividades y tareas'
        : name === 'Resumen'
          ? 'Reporte del grupo'
          : name,
      width,
    );
    band(
      s,
      `${data.group.grade}.º ${data.group.name} · ${data.year.label} · ${displayDate(data.range.from)} al ${displayDate(data.range.to)} · ${members.length} alumnos`,
      width,
      pale,
    );
    s.addRow([]).height = 8;
    s.views = [{ state: 'frozen', xSplit: 1, ySplit: 2, showGridLines: false }];
    s.getColumn(1).width = Math.min(
      58,
      Math.max(29, ...members.map((r) => Math.ceil(r.name.length * 1.1))),
    );
    for (let i = 2; i <= width; i++) s.getColumn(i).width = width > 15 ? 8 : 15;
    s.headerFooter.oddFooter = 'Página &P';
    s.pageSetup.printTitlesRow = '1:2';
    return s;
  }
  function table(s: ExcelJS.Worksheet, title: string, headers: string[], rows: Value[][]) {
    const first = s.rowCount + 1;
    band(s, title, headers.length, pale);
    const head = s.addRow(headers);
    head.height = 32;
    head.eachCell((c) => {
      c.font = { name: 'Calibri', size: 10, bold: true, color: { argb: green } };
      c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: pink } };
      c.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
      c.border = gridBorder;
    });
    const start = s.rowCount + 1;
    for (const values of rows) write(s.addRow([]), values);
    if (!rows.length) band(s, 'Sin registros para este reporte.', headers.length, 'FFF7F5EF');
    s.addRow([]).height = 8;
    blocks.set(s, [...(blocks.get(s) ?? []), { from: first, to: s.rowCount }]);
    return { start, end: start + rows.length - 1 };
  }
  function percent(s: ExcelJS.Worksheet, col: number, start: number, end: number) {
    if (end < start) return;
    for (let r = start; r <= end; r++) s.getCell(r, col).numFmt = '0%';
    // ExcelJS serializes `color` but its published DataBarRuleType omits it.
    const rule: ExcelJS.DataBarRuleType & { color: { argb: string } } = {
      type: 'dataBar',
      minLength: 0,
      maxLength: 100,
      cfvo: [
        { type: 'num', value: 0 },
        { type: 'num', value: 1 },
      ],
      color: { argb: 'FF99C49B' },
      priority: 1,
    };
    s.addConditionalFormatting({
      ref: `${s.getColumn(col).letter}${start}:${s.getColumn(col).letter}${end}`,
      rules: [rule],
    });
  }
  if (options.summary) {
    const width = options.sections.includes('attendance')
      ? 7
      : options.sections.includes('assignments')
        ? 6
        : 3;
    const s = sheet('Resumen', width);
    if (options.sections.includes('attendance')) {
      const block = table(
        s,
        'Asistencia por alumno',
        [
          'Alumno',
          'Asistencias',
          'Faltas',
          'Retardos',
          'Justificadas',
          'Sin registro',
          '% asistencia',
        ],
        members.map((m) => {
          const st = memberStats(data, m.id);
          return [m.name, st.present, st.absent, st.late, st.excused, st.missing, st.rate];
        }),
      );
      percent(s, 7, block.start, block.end);
    }
    if (options.sections.includes('assignments'))
      table(
        s,
        'Actividades y tareas por alumno',
        ['Alumno', 'Asignadas', 'Entregadas', 'Incompletas', 'No entregadas', 'Pendientes'],
        members.map((m) => {
          const st = memberStats(data, m.id);
          return [m.name, st.assigned, st.submitted, st.incomplete, st.notSubmitted, st.pending];
        }),
      );
    if (options.sections.includes('readings'))
      table(
        s,
        'Lectura por alumno',
        ['Alumno', 'Lecturas', 'Minutos'],
        members.map((m) => {
          const st = memberStats(data, m.id);
          return [m.name, st.readings, st.minutes];
        }),
      );
    if (options.sections.length === 1 && options.sections.includes('students'))
      table(
        s,
        'Alumnos del grupo',
        ['Alumno', 'Grado', 'Grupo'],
        members.map((m) => [m.name, data.group.grade, data.group.name]),
      );
  }
  if (options.sections.includes('students')) {
    const s = sheet('Alumnos', 3);
    table(
      s,
      'Lista del grupo',
      ['Alumno', 'Grado', 'Grupo'],
      members.map((m) => [m.name, data.group.grade, data.group.name]),
    );
  }
  if (options.sections.includes('attendance')) {
    const s = sheet('Asistencia', 8);
    const stats = table(
      s,
      'Asistencia del periodo',
      [
        'Alumno',
        'Asistencias',
        'Faltas',
        'Retardos',
        'Justificadas',
        'Capturados',
        'Sin registro',
        '% asistencia',
      ],
      members.map((m) => {
        const st = memberStats(data, m.id);
        return [
          m.name,
          st.present,
          st.absent,
          st.late,
          st.excused,
          st.captured,
          st.missing,
          st.rate,
        ];
      }),
    );
    percent(s, 8, stats.start, stats.end);
    if (long) {
      for (let i = 0; i < months.length; i += 6) {
        const batch = months.slice(i, i + 6);
        const block = table(
          s,
          'Porcentaje de asistencia por mes',
          ['Alumno', ...batch.map((m) => monthLabel(m))],
          members.map((m) => [
            m.name,
            ...batch.map((date) => memberStats(data, m.id, `${date}-01`, `${date}-31`).rate),
          ]),
        );
        batch.forEach((_, index) => percent(s, index + 2, block.start, block.end));
      }
    }
    if (options.detail) {
      const lookup = new Map(data.attendance.map((r) => [`${r.enrollmentId}:${r.date}`, r.status]));
      const weeks = long
        ? [
            ...new Set((data.attendanceDays ?? data.attendance.map((r) => r.date)).map(weekStart)),
          ].sort()
        : (() => {
            const result: string[] = [];
            for (let d = weekStart(data.range.from); d <= data.range.to; d = shiftDate(d, 7))
              result.push(d);
            return result;
          })();
      for (const start of weeks) {
        const dates = Array.from({ length: 7 }, (_, i) => shiftDate(start, i)).filter(
          (d, i) =>
            d >= data.range.from &&
            d <= data.range.to &&
            (i < 5 || data.attendance.some((r) => r.date === d)),
        );
        if (!dates.length) continue;
        table(
          s,
          `Semana del ${displayDate(start)} al ${displayDate(shiftDate(start, 6))}`,
          [
            'Alumno',
            ...dates.map(
              (d) =>
                `${['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'][dateValue(d).getUTCDay()]} ${displayDate(d).slice(0, 5)}`,
            ),
          ],
          members.map((m) => [
            m.name,
            ...dates.map((d) => {
              const status = lookup.get(`${m.id}:${d}`);
              return status ? attendanceCodes[status] : includesDate(m, d) ? '·' : '—';
            }),
          ]),
        );
      }
      if (options.comments)
        table(
          s,
          'Notas de asistencia',
          ['Alumno', 'Fecha', 'Estado', 'Nota'],
          [...data.attendance]
            .filter((r) => r.note)
            .sort((a, b) => a.date.localeCompare(b.date))
            .map((r) => [
              names.get(r.enrollmentId)!,
              dateValue(r.date),
              attendanceLabels[r.status],
              r.note!,
            ]),
        );
    }
  }
  if (options.sections.includes('assignments')) {
    const s = sheet('Tareas', 8);
    table(
      s,
      'Entregas por alumno',
      ['Alumno', 'Asignadas', 'Entregadas', 'Incompletas', 'No entregadas', 'Pendientes'],
      members.map((m) => {
        const st = memberStats(data, m.id);
        return [m.name, st.assigned, st.submitted, st.incomplete, st.notSubmitted, st.pending];
      }),
    );
    const buckets = long
      ? months.map((m) => ({ from: `${m}-01`, to: `${m}-31`, label: monthLabel(m) }))
      : (() => {
          const result = [];
          for (let d = weekStart(data.range.from); d <= data.range.to; d = shiftDate(d, 7))
            result.push({
              from: d,
              to: shiftDate(d, 6),
              label: `Semana ${displayDate(d).slice(0, 5)}`,
            });
          return result;
        })();
    if (buckets.length === 1) {
      const days = Array.from({ length: 7 }, (_, i) => shiftDate(buckets[0]!.from, i)).filter(
        (d, i) =>
          d >= data.range.from &&
          d <= data.range.to &&
          (i < 5 || data.assignments.some((a) => a.assignedDate === d)),
      );
      table(
        s,
        'Entregadas / asignadas por día',
        [
          'Alumno',
          ...days.map(
            (d) =>
              `${['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'][dateValue(d).getUTCDay()]} ${displayDate(d).slice(0, 5)}`,
          ),
        ],
        members.map((m) => [
          m.name,
          ...days.map((d) => {
            const st = memberStats(data, m.id, d, d);
            return st.assigned ? `${st.submitted} / ${st.assigned}` : '—';
          }),
        ]),
      );
    } else {
      for (let i = 0; i < buckets.length; i += 6) {
        const batch = buckets.slice(i, i + 6);
        table(
          s,
          'Entregadas / asignadas por periodo',
          ['Alumno', ...batch.map((b) => b.label)],
          members.map((m) => [
            m.name,
            ...batch.map((b) => {
              const st = memberStats(data, m.id, b.from, b.to);
              return st.assigned ? `${st.submitted} / ${st.assigned}` : '—';
            }),
          ]),
        );
      }
    }
    const tasks = [...data.assignments].sort(
      (a, b) =>
        a.assignedDate.localeCompare(b.assignedDate) ||
        a.title.localeCompare(b.title, 'es') ||
        a.id.localeCompare(b.id),
    );
    const submissions = new Map(
      data.submissions.map((r) => [`${r.assignmentId}:${r.enrollmentId}`, r]),
    );
    if (options.detail) {
      if (!tasks.length) band(s, 'Sin actividades ni tareas asignadas en este periodo.', 8, pale);
      const weeks = new Map<string, typeof tasks>();
      for (const task of tasks) {
        const start = weekStart(task.assignedDate);
        weeks.set(start, [...(weeks.get(start) ?? []), task]);
      }
      for (const [start, weeklyTasks] of weeks) {
        const week = `Semana del ${displayDate(start)} al ${displayDate(shiftDate(start, 6))}`;
        for (let i = 0; i < weeklyTasks.length; i += 6) {
          const batch = weeklyTasks.slice(i, i + 6);
          table(
            s,
            `${week} · Actividades ${i + 1} a ${i + batch.length}`,
            [
              'Alumno',
              ...batch.map(
                (task, j) =>
                  `Actividad ${i + j + 1}\n${displayDate(task.assignedDate).slice(0, 5)}`,
              ),
            ],
            members.map((m) => [
              m.name,
              ...batch.map((task) => {
                const submission = submissions.get(`${task.id}:${m.id}`);
                return includesDate(m, task.assignedDate) || submission
                  ? submissionCodes[submission?.status ?? 'pending']
                  : '—';
              }),
            ]),
          );
          table(
            s,
            `Actividades y tareas · ${week}`,
            ['N.º', 'Actividad o tarea', 'Asignación', 'Entrega', 'Descripción'],
            batch.map((task, j) => [
              i + j + 1,
              task.title,
              dateValue(task.assignedDate),
              task.dueDate ? dateValue(task.dueDate) : null,
              task.description ?? '',
            ]),
          );
        }
      }
      s.getColumn(2).width = 27;
      s.getColumn(5).width = 27;
      if (options.comments)
        table(
          s,
          'Comentarios de entregas',
          ['Alumno', 'Actividad o tarea', 'Estado', 'Comentario'],
          tasks.flatMap((task) =>
            members.flatMap((m) => {
              const r = submissions.get(`${task.id}:${m.id}`);
              return r?.comment
                ? [[m.name, task.title, submissionLabels[r.status], r.comment]]
                : [];
            }),
          ),
        );
    }
  }
  if (options.sections.includes('readings')) {
    const s = sheet('Lecturas', 5);
    table(
      s,
      'Lectura por alumno',
      ['Alumno', 'Lecturas', 'Minutos'],
      members.map((m) => {
        const st = memberStats(data, m.id);
        return [m.name, st.readings, st.minutes];
      }),
    );
    if (options.detail) {
      const headers = [
        'Alumno',
        'Fecha',
        'Título',
        'Minutos',
        ...(options.comments ? ['Comentario'] : []),
      ];
      table(
        s,
        'Registro de lecturas',
        headers,
        [...data.readings]
          .sort(
            (a, b) =>
              a.date.localeCompare(b.date) ||
              names.get(a.enrollmentId)!.localeCompare(names.get(b.enrollmentId)!, 'es') ||
              a.id.localeCompare(b.id),
          )
          .map((r) => [
            names.get(r.enrollmentId)!,
            dateValue(r.date),
            r.title,
            r.minutes,
            ...(options.comments ? [r.comment ?? ''] : []),
          ]),
      );
      s.getColumn(3).width = 35;
      if (options.comments) s.getColumn(5).width = 40;
    }
  }
  for (const s of workbook.worksheets) {
    // Color status codes without changing or guessing the underlying records.
    s.eachRow((row) =>
      row.eachCell((cell) => {
        const color =
          cell.value === '✓'
            ? 'FFE1EFDE'
            : cell.value === 'F' || cell.value === 'X'
              ? 'FFF9E2DC'
              : cell.value === 'R' || cell.value === 'P'
                ? 'FFFBF0D6'
                : null;
        if (color) {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: color } };
          cell.font = { ...cell.font, bold: true };
        }
        if (typeof cell.value === 'string' && !cell.isMerged) {
          const width = s.getColumn(cell.col).width ?? 15;
          row.height = Math.max(
            row.height ?? 22,
            Math.min(
              409,
              cell.value
                .split('\n')
                .reduce(
                  (lines, part) =>
                    lines + Math.max(1, Math.ceil(part.length / Math.max(5, width - 2))),
                  0,
                ) *
                14 +
                6,
            ),
          );
        }
      }),
    );
    for (const merge of s.model.merges) {
      const [start, end] = merge.split(':');
      const first = s.getCell(start!),
        last = s.getCell(end!);
      const text = String(first.value ?? '');
      let width = 0;
      for (let c = Number(first.col); c <= Number(last.col); c++)
        width += s.getColumn(c).width ?? 15;
      const row = s.getRow(Number(first.row));
      row.height = Math.max(
        row.height ?? 24,
        Math.min(409, Math.ceil(text.length / Math.max(5, width - 4)) * 14 + 8),
      );
    }
    // Keep each seven-student block together when it fits on a printed page.
    // Larger groups can still flow naturally over more than one page.
    const landscape = s.pageSetup.orientation === 'landscape';
    const gridWidth = s.columns.reduce((sum, col) => sum + ((col.width ?? 15) * 7 + 5) * 0.75, 0);
    const scale = Math.min(1, ((landscape ? 842 : 595) - 36) / gridWidth);
    const capacity = ((landscape ? 595 : 842) - 58) / scale;
    const height = (from: number, to: number) => {
      let sum = 0;
      for (let r = from; r <= to; r++) sum += s.getRow(r).height ?? 28;
      return sum;
    };
    const repeated = height(1, 2);
    let used = height(1, 3);
    for (const block of blocks.get(s) ?? []) {
      const size = height(block.from, block.to);
      if (used + size > capacity && size + repeated < capacity && used > height(1, 3)) {
        s.getRow(block.from - 1).addPageBreak();
        used = repeated;
      }
      used += size;
    }
    s.pageSetup.printArea = `A1:${s.getColumn(s.columnCount).letter}${s.rowCount}`;
  }
  return new Uint8Array(await workbook.xlsx.writeBuffer());
}
