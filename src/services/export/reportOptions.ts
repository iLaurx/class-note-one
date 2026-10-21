import type { SchoolYear } from '../../domain/models.ts';
import { reportRange } from './reportRange.ts';

export type ReportPeriod = 'week' | 'month' | 'total' | 'custom';
export type ReportSection = 'attendance' | 'assignments' | 'readings' | 'students';
export interface ReportOptions {
  period: ReportPeriod;
  sections: ReportSection[];
  summary: boolean;
  detail: boolean;
  comments: boolean;
  enrollmentIds?: string[];
}
export const reportSections: { id: ReportSection; label: string; description: string }[] = [
  { id: 'attendance', label: 'Asistencia', description: 'Lista por día y porcentaje por alumno' },
  {
    id: 'assignments',
    label: 'Actividades y tareas',
    description: 'Entregas, pendientes y actividades del periodo',
  },
  { id: 'students', label: 'Lista de alumnos', description: 'Nombres y grupo' },
];
export const defaultReportOptions: ReportOptions = {
  period: 'week',
  sections: ['attendance', 'assignments'],
  summary: true,
  detail: true,
  comments: false,
};
export const periodLabels: Record<ReportPeriod, string> = {
  week: 'Semanal',
  month: 'Mensual',
  total: 'Todo el ciclo',
  custom: 'Fechas libres',
};
export function shiftDate(value: string, days: number) {
  const date = new Date(`${value}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}
export function weekStart(value: string) {
  const day = new Date(`${value}T12:00:00Z`).getUTCDay();
  return shiftDate(value, -((day + 6) % 7));
}
export function periodRange(
  period: ReportPeriod,
  anchor: string,
  year: SchoolYear,
  from: string,
  to: string,
) {
  let range: { from: string; to: string };
  if (period === 'custom') return reportRange(from, to);
  if (period === 'total')
    return reportRange(
      year.startDate,
      year.endDate ?? (anchor < year.startDate ? year.startDate : anchor),
    );
  reportRange(anchor, anchor);
  if (period === 'week') {
    const start = weekStart(anchor);
    range = { from: start, to: shiftDate(start, 6) };
  } else {
    const start = `${anchor.slice(0, 7)}-01`;
    const next = new Date(`${start}T12:00:00Z`);
    next.setUTCMonth(next.getUTCMonth() + 1);
    range = { from: start, to: shiftDate(next.toISOString().slice(0, 10), -1) };
  }
  return reportRange(
    range.from < year.startDate ? year.startDate : range.from,
    year.endDate && range.to > year.endDate ? year.endDate : range.to,
  );
}
export function displayDate(value: string) {
  return value.split('-').reverse().join('/');
}
export function monthLabel(value: string) {
  return new Intl.DateTimeFormat('es-MX', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${value.slice(0, 7)}-01T12:00:00Z`));
}
