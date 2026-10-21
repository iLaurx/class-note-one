import { useMemo, useState } from 'react';
import { useWorkContext } from '../../app/useWorkContext';
import { useStorage } from '../../app/useStorage';
import { allowNavigation } from '../../app/pendingChanges';
import type { GroupContext } from '../../db/repositories';
import type { AttendanceStatus, SchoolYear } from '../../domain/models';
import {
  attendanceCounts,
  attendanceLabels,
  dateInYear,
  defaultDate,
  isChanged,
} from './attendanceDomain';
import { useAttendance } from './useAttendance';

export function Attendance() {
  const { data } = useWorkContext();
  const { repositories } = useStorage();
  const selection = data?.selection;
  const year = data?.years.find((item) => item.id === selection?.schoolYearId);
  const groupId = selection?.groupId;
  return (
    <section className="attendance" aria-label="Registro de asistencia">
      {!repositories || !year || !groupId ? (
        <p>Configura tu grupo en Configuración para registrar asistencia.</p>
      ) : (
        <AttendanceCalendar key={`${year.id}:${groupId}`} year={year} groupId={groupId} />
      )}
    </section>
  );
}

function AttendanceCalendar({ year, groupId }: { year: SchoolYear; groupId: string }) {
  const [date, setDate] = useState(() => defaultDate());
  const context = useMemo(() => ({ schoolYearId: year.id, groupId }), [year.id, groupId]);
  let valid = false;
  try {
    dateInYear(date, year);
    valid = true;
  } catch {
    /* Explicit empty/invalid date state below. */
  }
  return (
    <>
      <label className="attendance-date">
        Fecha de asistencia
        <input
          type="date"
          value={date}
          min={year.startDate}
          max={year.endDate}
          onChange={(event) => {
            if (allowNavigation()) setDate(event.target.value);
          }}
        />
      </label>
      {valid ? (
        <AttendanceDay key={date} context={context} date={date} />
      ) : (
        <p role="status">
          Elige una fecha válida desde {year.startDate}
          {year.endDate ? ` hasta ${year.endDate}` : ''}.
        </p>
      )}
    </>
  );
}

function AttendanceDay({ context, date }: { context: GroupContext; date: string }) {
  const day = useAttendance(context, date);
  const counts = attendanceCounts(day.rows);
  return (
    <div aria-busy={day.busy}>
      {day.busy && <p role="status">Cargando o guardando asistencia…</p>}
      {day.error && <p role="alert">{day.error}</p>}
      {day.readFailed && (
        <button disabled={day.busy} onClick={() => void day.load()}>
          Reintentar lectura
        </button>
      )}
      {day.message && <p role="status">{day.message}</p>}
      {day.error && !day.readFailed && (
        <button
          disabled={day.busy}
          onClick={() => {
            if (allowNavigation()) day.review();
          }}
        >
          Revisar día guardado
        </button>
      )}
      {day.members && (
        <>
          {!day.message && (
            <p role="status">
              {day.dirty
                ? 'Cambios sin guardar'
                : !day.rows.length
                  ? 'Sin alumnos en esta fecha'
                  : counts.unregistered === counts.total
                    ? 'Elige la asistencia de cada alumno'
                    : counts.unregistered
                      ? 'Asistencia pendiente'
                      : 'Asistencia guardada'}
            </p>
          )}
          <dl className="attendance-counts" aria-label="Recuentos del día">
            {Object.entries(attendanceLabels).map(([status, label]) => (
              <div key={status}>
                <dt>{label}</dt>
                <dd>{counts[status as AttendanceStatus]}</dd>
              </div>
            ))}
            <div>
              <dt>Sin registrar</dt>
              <dd>{counts.unregistered}</dd>
            </div>
            <div>
              <dt>Total</dt>
              <dd>{counts.total}</dd>
            </div>
          </dl>
          {day.rows.length > 0 && (
            <>
              <div className="attendance-actions">
                <button disabled={day.busy} onClick={day.markAll}>
                  Marcar todos presentes
                </button>
                <button
                  disabled={day.busy || !day.rows.some((row) => row.status && isChanged(row))}
                  onClick={() => void day.save()}
                >
                  Guardar asistencia
                </button>
              </div>
              <ul className="attendance-list">
                {day.members.map(({ student, enrollment }, index) => {
                  const row = day.rows[index];
                  if (!row) return null;
                  const name = `${student.lastName}, ${student.firstName}`;
                  return (
                    <li className="panel attendance-row" key={enrollment.id}>
                      <div>
                        <strong>{name}</strong>
                        {!student.active && <p>Ficha archivada</p>}
                        {enrollment.status === 'inactive' && (
                          <p>
                            Matrícula inactiva
                            {!enrollment.leftAt ? ' · Sin salida registrada' : ''}
                          </p>
                        )}
                      </div>
                      <div className="status-options" role="group" aria-label={`Estado de ${name}`}>
                        {Object.entries(attendanceLabels).map(([status, label]) => (
                          <button
                            type="button"
                            key={status}
                            disabled={day.busy}
                            aria-pressed={row.status === status}
                            data-status={status}
                            onClick={() =>
                              day.edit(enrollment.id, { status: status as AttendanceStatus })
                            }
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                      <details className="row-note" open={row.note ? true : undefined}>
                        <summary>{row.note ? 'Ver nota' : 'Añadir nota'}</summary>
                        <label>
                          Nota de {name} (opcional)
                          <input
                            disabled={day.busy}
                            value={row.note}
                            onChange={(event) =>
                              day.edit(enrollment.id, { note: event.target.value })
                            }
                          />
                        </label>
                      </details>
                    </li>
                  );
                })}
              </ul>
              {day.rows.some((row) => row.note && !row.status) && (
                <p role="status">Elige un estado para guardar las notas pendientes.</p>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}
