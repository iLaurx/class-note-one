import { useEffect, useRef, useState } from 'react';
import { CalendarDays, Download, FileSpreadsheet, Check } from 'lucide-react';
import { useStorage } from '../../app/useStorage';
import { useWorkContext } from '../../app/useWorkContext';
import type { GroupContext } from '../../db/repositories';
import type { SchoolYear } from '../../domain/models';
import { defaultDate } from '../attendance/attendanceDomain';
import {
  defaultReportOptions,
  displayDate,
  periodLabels,
  periodRange,
  reportSections,
  type ReportOptions,
  type ReportPeriod,
} from '../../services/export/reportOptions';
import {
  memberStats,
  reportMembers,
  selectReport,
  type GroupReport,
} from '../../services/export/reportData';
import './reports.css';

export function Reports() {
  const { data, busy, error } = useWorkContext();
  const { state } = useStorage();
  const year = data?.years.find((row) => row.id === data.selection.schoolYearId);
  const group = data?.groups.find((row) => row.id === data.selection.groupId);
  return (
    <section className="reports-page" aria-labelledby="reports-title">
      <header className="reports-heading">
        <div>
          <span className="reports-eyebrow">EL CUADERNO DE TU GRUPO</span>
          <h2 id="reports-title">Prepara tu reporte</h2>
          <p>Elige qué necesitas y llévalo a Excel.</p>
        </div>
        <FileSpreadsheet size={30} aria-hidden="true" />
      </header>
      {busy || state.status === 'loading' ? (
        <p role="status">Cargando grupo…</p>
      ) : error || state.status === 'error' ? (
        <p>Reintenta desde el aviso de almacenamiento o contexto.</p>
      ) : !year || !group ? (
        <p>Configura tu grupo en Configuración para exportar.</p>
      ) : (
        <ReportForm
          key={`${year.id}:${group.id}:${year.startDate}:${year.endDate}`}
          context={{ schoolYearId: year.id, groupId: group.id }}
          year={year}
          groupName={`${group.grade}.º ${group.name}`}
        />
      )}
    </section>
  );
}
function ReportForm({
  context,
  year,
  groupName,
}: {
  context: GroupContext;
  year: SchoolYear;
  groupName: string;
}) {
  const { repositories } = useStorage();
  const today = defaultDate();
  const initial =
    today < year.startDate
      ? year.startDate
      : year.endDate && today > year.endDate
        ? year.endDate
        : today;
  const [anchor, setAnchor] = useState(initial);
  const [from, setFrom] = useState(today),
    [to, setTo] = useState(today);
  const [options, setOptions] = useState<ReportOptions>(() => ({ ...defaultReportOptions }));
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState(''),
    [error, setError] = useState('');
  const [loaded, setLoaded] = useState<{ key: string; data?: GroupReport; error?: string } | null>(
    null,
  );
  const [retry, setRetry] = useState(0);
  const locked = useRef(false),
    active = useRef(true);
  let range: { from: string; to: string } | undefined,
    rangeError = '';
  try {
    range = periodRange(
      options.period,
      options.period === 'total' ? today : anchor,
      year,
      from,
      to,
    );
  } catch (cause) {
    rangeError = cause instanceof Error ? cause.message : 'Revisa las fechas.';
  }
  const rangeFrom = range?.from,
    rangeTo = range?.to;
  const key = `${rangeFrom}:${rangeTo}:${retry}`;
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
    };
  }, []);
  useEffect(() => {
    let cancelled = false;
    if (repositories && rangeFrom && rangeTo)
      void repositories.loadGroupReport(context, rangeFrom, rangeTo).then(
        (data) => {
          if (!cancelled) setLoaded({ key, data });
        },
        () => {
          if (!cancelled)
            setLoaded({ key, error: 'No se pudo cargar la vista previa. Reintenta.' });
        },
      );
    return () => {
      cancelled = true;
    };
  }, [repositories, context, rangeFrom, rangeTo, key]);
  const data = loaded?.key === key ? loaded.data : undefined;
  const loadError = loaded?.key === key ? loaded.error : undefined;
  const selected = data ? selectReport(data, options) : undefined;
  const members = selected ? reportMembers(selected) : [];
  const sectionLabels = reportSections.filter((s) => options.sections.includes(s.id));
  const selectionError = !options.sections.length
    ? 'Elige al menos un contenido.'
    : options.enrollmentIds?.length === 0
      ? 'Elige al menos un alumno.'
      : '';
  function update(patch: Partial<ReportOptions>) {
    setOptions((current) => ({ ...current, ...patch }));
    setMessage('');
    setError('');
  }
  function datesChanged() {
    setMessage('');
    setError('');
  }
  return (
    <form
      className="reports-workspace"
      aria-label="Preparar reporte"
      onSubmit={(event) => {
        event.preventDefault();
        if (locked.current || !repositories) return;
        setMessage('');
        setError('');
        if (rangeError || selectionError || !range) {
          setError(rangeError || selectionError);
          return;
        }
        locked.current = true;
        setBusy(true);
        const exportRange = range;
        void (async () => {
          try {
            const fresh = await repositories.loadGroupReport(
              context,
              exportRange.from,
              exportRange.to,
            );
            const { groupWorkbook } = await import('../../services/export/groupWorkbook');
            const bytes = await groupWorkbook(fresh, options);
            if (!active.current) return;
            const { saveReport } = await import('../../lib/tauri/saveReport');
            if (!active.current) return;
            const saved = await saveReport(bytes);
            if (active.current)
              setMessage(
                saved
                  ? 'Reporte Excel guardado.'
                  : 'Exportación cancelada. No se escribió ningún archivo.',
              );
          } catch (cause) {
            if (active.current)
              setError(
                cause instanceof Error
                  ? cause.message
                  : 'No se pudo exportar el reporte. Reintenta.',
              );
          } finally {
            locked.current = false;
            if (active.current) setBusy(false);
          }
        })();
      }}
    >
      <div className="report-controls panel">
        <fieldset disabled={busy} className="report-fieldset">
          <legend>
            <span>1</span> El periodo
          </legend>
          <div className="report-periods">
            {(Object.keys(periodLabels) as ReportPeriod[]).map((period) => (
              <button
                type="button"
                key={period}
                aria-pressed={options.period === period}
                onClick={() => update({ period })}
              >
                {periodLabels[period]}
              </button>
            ))}
          </div>
          {options.period === 'week' && (
            <label className="report-date">
              Un día de la semana
              <input
                type="date"
                value={anchor}
                required
                min={year.startDate}
                max={year.endDate}
                onChange={(event) => {
                  setAnchor(event.target.value);
                  datesChanged();
                }}
              />
            </label>
          )}
          {options.period === 'month' && (
            <label className="report-date">
              Mes del reporte
              <input
                type="month"
                value={anchor.slice(0, 7)}
                required
                min={year.startDate.slice(0, 7)}
                max={year.endDate?.slice(0, 7)}
                onChange={(event) => {
                  const month = event.target.value;
                  setAnchor(
                    month === year.startDate.slice(0, 7)
                      ? year.startDate
                      : month
                        ? `${month}-01`
                        : '',
                  );
                  datesChanged();
                }}
              />
            </label>
          )}
          {options.period === 'custom' && (
            <div className="report-date-pair">
              <label className="report-date">
                Desde
                <input
                  type="date"
                  value={from}
                  required
                  onChange={(event) => {
                    setFrom(event.target.value);
                    datesChanged();
                  }}
                />
              </label>
              <label className="report-date">
                Hasta
                <input
                  type="date"
                  value={to}
                  required
                  onChange={(event) => {
                    setTo(event.target.value);
                    datesChanged();
                  }}
                />
              </label>
            </div>
          )}
          {range && (
            <p className="report-range">
              <CalendarDays size={15} aria-hidden="true" /> {displayDate(range.from)} al{' '}
              {displayDate(range.to)}
            </p>
          )}
        </fieldset>
        <fieldset disabled={busy} className="report-fieldset">
          <legend>
            <span>2</span> Qué quieres incluir
          </legend>
          <div className="report-content-options">
            {reportSections.map((section) => (
              <label key={section.id} className="report-content-option">
                <input
                  type="checkbox"
                  checked={options.sections.includes(section.id)}
                  onChange={(event) =>
                    update({
                      sections: event.target.checked
                        ? [...options.sections, section.id]
                        : options.sections.filter((id) => id !== section.id),
                    })
                  }
                />
                <span>
                  <strong>{section.label}</strong>
                  <small>{section.description}</small>
                </span>
              </label>
            ))}
          </div>
        </fieldset>
        <fieldset disabled={busy} className="report-fieldset report-presentation">
          <legend>
            <span>3</span> Cómo lo quieres
          </legend>
          <label>
            <input
              type="checkbox"
              checked={options.summary}
              onChange={(e) => update({ summary: e.target.checked })}
            />{' '}
            Resumen del grupo
          </label>
          <label>
            <input
              type="checkbox"
              checked={options.detail}
              onChange={(e) => update({ detail: e.target.checked })}
            />{' '}
            Detalle por día y actividad
          </label>
          <label>
            <input
              type="checkbox"
              checked={options.comments}
              disabled={!options.detail}
              onChange={(e) => update({ comments: e.target.checked })}
            />{' '}
            Notas y comentarios de los registros
          </label>
          <details className="report-student-picker">
            <summary>
              {options.enrollmentIds
                ? `${options.enrollmentIds.length} alumnos seleccionados`
                : 'Todo el grupo'}{' '}
              · Elegir alumnos
            </summary>
            <label>
              <input
                type="checkbox"
                checked={!options.enrollmentIds}
                onChange={(e) => update({ enrollmentIds: e.target.checked ? undefined : [] })}
              />{' '}
              Todo el grupo
            </label>
            {data &&
              reportMembers(data).map((m) => (
                <label key={m.id}>
                  <input
                    type="checkbox"
                    checked={!options.enrollmentIds || options.enrollmentIds.includes(m.id)}
                    onChange={(e) => {
                      const ids = options.enrollmentIds ?? data.enrollments.map((r) => r.id);
                      update({
                        enrollmentIds: e.target.checked
                          ? [...ids, m.id]
                          : ids.filter((id) => id !== m.id),
                      });
                    }}
                  />
                  {m.name}
                </label>
              ))}
          </details>
        </fieldset>
      </div>
      <aside className="report-preview panel" aria-label="Vista previa del reporte">
        <div className="report-preview-icon">
          <FileSpreadsheet size={24} aria-hidden="true" />
        </div>
        <span className="reports-eyebrow">TU ARCHIVO EXCEL</span>
        <h3>
          Reporte{' '}
          {options.period === 'week'
            ? 'semanal'
            : options.period === 'month'
              ? 'mensual'
              : options.period === 'total'
                ? 'del ciclo'
                : 'personalizado'}
        </h3>
        <p className="report-preview-context">
          {groupName} · {year.label}
        </p>
        {range && (
          <p className="report-preview-period">
            {displayDate(range.from)} — {displayDate(range.to)}
          </p>
        )}
        <div className="report-sheet-list">
          {options.summary && (
            <span>
              <Check size={15} aria-hidden="true" />
              Resumen del grupo
            </span>
          )}
          {sectionLabels.map((s) => (
            <span key={s.id}>
              <Check size={15} aria-hidden="true" />
              {s.label}
            </span>
          ))}
        </div>
        {data && selected && !rangeError && (
          <>
            <div className="report-preview-counts">
              <strong>
                {members.length} <small>alumnos</small>
              </strong>
              {options.sections.includes('assignments') && (
                <strong>
                  {selected.assignments.length} <small>actividades / tareas</small>
                </strong>
              )}
            </div>
            <div className="report-preview-table">
              <table>
                <caption>Resumen de los datos seleccionados</caption>
                <thead>
                  <tr>
                    <th>Alumno</th>
                    {options.sections.includes('attendance') && <th>Asist.</th>}
                    {options.sections.includes('assignments') && <th>Entregas</th>}
                  </tr>
                </thead>
                <tbody>
                  {members.map((m) => {
                    const s = memberStats(selected, m.id);
                    return (
                      <tr key={m.id}>
                        <th scope="row">{m.name}</th>
                        {options.sections.includes('attendance') && (
                          <td>{s.rate === null ? '—' : `${Math.round(s.rate * 100)}%`}</td>
                        )}
                        {options.sections.includes('assignments') && (
                          <td>
                            {s.submitted}/{s.assigned}
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {!members.length && <p className="report-hint">No hay alumnos en esta selección.</p>}
            {!selected.attendance.length && !selected.assignments.length && (
              <p className="report-hint">
                No hay registros en este periodo. Puedes exportar el reporte vacío.
              </p>
            )}
          </>
        )}
        {!data && !loadError && !rangeError && <p role="status">Cargando vista previa…</p>}
        {loadError && (
          <p role="alert">
            {loadError}{' '}
            <button type="button" onClick={() => setRetry((n) => n + 1)}>
              Reintentar
            </button>
          </p>
        )}
        <p className="report-hint">
          {options.detail
            ? options.period === 'total'
              ? 'Resumen por mes y detalle en bloques cortos.'
              : 'Cuadrículas por alumno, con fechas y leyendas.'
            : 'Solo totales por alumno, sin el detalle de registros.'}
        </p>
        {(rangeError || selectionError || error) && (
          <p role="alert">{error || rangeError || selectionError}</p>
        )}
        <button
          type="submit"
          className="button-primary report-download"
          disabled={busy || !!rangeError || !!selectionError}
        >
          <Download size={18} aria-hidden="true" />
          {busy ? 'Preparando Excel…' : 'Descargar Excel'}
        </button>
        <p role="status">{message}</p>
      </aside>
    </form>
  );
}
