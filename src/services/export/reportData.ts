import type { Repositories } from '../../db/repositories.ts';
import { includesDate } from '../../features/attendance/attendanceDomain.ts';
import type { ReportOptions } from './reportOptions.ts';

export type GroupReport = Awaited<ReturnType<Repositories['loadGroupReport']>> & {
  /** Captured group days remain available when selecting individual students. */
  attendanceDays?: string[];
};
export function selectReport(data: GroupReport, options: ReportOptions): GroupReport {
  const enrollments = data.enrollments.filter(
    (row) => !options.enrollmentIds || options.enrollmentIds.includes(row.id),
  );
  const ids = new Set(enrollments.map((row) => row.id));
  return {
    ...data,
    attendanceDays: data.attendanceDays ?? [...new Set(data.attendance.map((row) => row.date))],
    enrollments,
    students: data.students.filter((row) =>
      enrollments.some((member) => member.studentId === row.id),
    ),
    attendance: data.attendance.filter((row) => ids.has(row.enrollmentId)),
    readings: data.readings.filter((row) => ids.has(row.enrollmentId)),
    submissions: data.submissions.filter((row) => ids.has(row.enrollmentId)),
  };
}
export function reportMembers(data: GroupReport) {
  const students = new Map(data.students.map((row) => [row.id, row]));
  return data.enrollments
    .map((row) => {
      const student = students.get(row.studentId)!;
      return { ...row, name: `${student.lastName}, ${student.firstName}` };
    })
    .sort((a, b) => a.name.localeCompare(b.name, 'es') || a.id.localeCompare(b.id));
}
export function memberStats(
  data: GroupReport,
  id: string,
  from = data.range.from,
  to = data.range.to,
) {
  const member = data.enrollments.find((row) => row.id === id)!;
  const attendance = data.attendance.filter(
    (row) => row.enrollmentId === id && row.date >= from && row.date <= to,
  );
  const dates = (data.attendanceDays ?? [...new Set(data.attendance.map((row) => row.date))])
    .filter((date) => date >= from && date <= to)
    .filter((date) => includesDate(member, date) || attendance.some((row) => row.date === date));
  const tasks = data.assignments.filter(
    (row) =>
      row.assignedDate >= from &&
      row.assignedDate <= to &&
      (includesDate(member, row.assignedDate) ||
        data.submissions.some((s) => s.assignmentId === row.id && s.enrollmentId === id)),
  );
  const states = tasks.map(
    (task) =>
      data.submissions.find((row) => row.assignmentId === task.id && row.enrollmentId === id)
        ?.status ?? 'pending',
  );
  const readings = data.readings.filter(
    (row) => row.enrollmentId === id && row.date >= from && row.date <= to,
  );
  const present = attendance.filter(
    (row) => row.status === 'present' || row.status === 'late',
  ).length;
  return {
    present,
    absent: attendance.filter((row) => row.status === 'absent').length,
    late: attendance.filter((row) => row.status === 'late').length,
    excused: attendance.filter((row) => row.status === 'excused').length,
    captured: attendance.length,
    missing: dates.length - attendance.length,
    rate: attendance.length ? present / attendance.length : null,
    assigned: tasks.length,
    submitted: states.filter((s) => s === 'submitted').length,
    incomplete: states.filter((s) => s === 'incomplete').length,
    notSubmitted: states.filter((s) => s === 'not_submitted').length,
    pending: states.filter((s) => s === 'pending').length,
    readings: readings.length,
    minutes: readings.reduce((sum, row) => sum + row.minutes, 0),
  };
}
