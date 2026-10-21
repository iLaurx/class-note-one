import { ArrowUpRight, UserRoundPlus, UsersRound } from 'lucide-react';
import { StudentForm } from './StudentForm';
import type { StudentFormState } from './studentFormState';
import { fullName, matches } from './studentPresentation';
import { useMemo, useRef, useState } from 'react';
import { useWorkContext } from '../../app/useWorkContext';
import type { Group, SchoolYear } from '../../domain/models';
import { useStudents } from './useStudents';

export function Students() {
  const { data, busy } = useWorkContext();
  const year = data?.years.find((y) => y.id === data.selection.schoolYearId);
  const group = data?.groups.find((g) => g.id === data.selection.groupId);
  return (
    <>
      {year && group && !busy ? (
        <StudentGroup key={`${year.id}/${group.id}`} year={year} group={group} />
      ) : (
        <section className="panel school-management">
          <h2>Alumnos del grupo</h2>
          <p>{busy ? 'Cargando grupo…' : 'Configura tu grupo en Configuración para continuar.'}</p>
        </section>
      )}
    </>
  );
}
function StudentGroup({ year, group }: { year: SchoolYear; group: Group }) {
  const context = useMemo(
    () => ({ schoolYearId: year.id, groupId: group.id }),
    [year.id, group.id],
  );
  const state = useStudents(context);
  const [query, setQuery] = useState('');
  const [inactive, setInactive] = useState(false);
  const [form, setForm] = useState<StudentFormState | null>(null);
  const [detail, setDetail] = useState<string | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const register = useRef<HTMLElement>(null);
  const [formRevision, setFormRevision] = useState(0);
  const done = () => {
    setForm(null);
    setFormRevision((value) => value + 1);
    heading.current?.focus();
  };
  const rows = state.rows
    ?.filter(
      (row) => (inactive || row.enrollment.status === 'active') && matches(row.student, query),
    )
    .sort((a, b) => fullName(a.student).localeCompare(fullName(b.student), 'es'));
  const student = state.records?.students.find((s) => s.id === detail);
  const history = state.records?.enrollments.filter((e) => e.studentId === detail) ?? [];
  async function open(next: StudentFormState) {
    if (next.kind === 'archive' && !(await state.openRecords())) return;
    setForm(next);
  }
  return (
    <div className="students-workspace" aria-busy={state.busy}>
      <section className="students-directory" aria-label="Alumnos del grupo">
        <div className="students-heading">
          <div>
            <h2 tabIndex={-1} ref={heading}>
              Alumnos del grupo
            </h2>
            {state.rows && (
              <span className="student-count">
                {rows?.length ?? 0} {(rows?.length ?? 0) === 1 ? 'alumno' : 'alumnos'}
              </span>
            )}
          </div>
          <button
            className="student-add-shortcut"
            disabled={state.busy || !!form}
            onClick={() => {
              register.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
              register.current
                ?.querySelector<HTMLInputElement>('input')
                ?.focus({ preventScroll: true });
            }}
          >
            <UserRoundPlus size={17} aria-hidden="true" />
            Agregar alumno
          </button>
        </div>
        {state.error && (
          <p role="alert">
            {state.error} <button onClick={() => void state.load()}>Reintentar lista</button>
          </p>
        )}
        {!state.rows && !state.error && <p role="status">Cargando alumnos…</p>}
        <details className="filter-disclosure">
          <summary>Buscar y filtrar</summary>
          <label className="search-field">
            Buscar alumno
            <input value={query} onChange={(e) => setQuery(e.target.value)} />
          </label>
          <label className="archive-filter">
            <input
              type="checkbox"
              checked={inactive}
              onChange={(e) => setInactive(e.target.checked)}
            />{' '}
            Mostrar alumnos dados de baja
          </label>
        </details>
        {state.rows && rows?.length === 0 && (
          <div className="panel empty-state students-empty">
            <UsersRound size={30} aria-hidden="true" />
            <h3>{query.trim() ? 'Sin coincidencias' : 'Tu grupo empieza aquí'}</h3>
            <p>
              {query.trim() || inactive || state.rows.length
                ? 'Revisa la búsqueda o los filtros.'
                : 'Agrega a tus alumnos con el formulario de registro.'}
            </p>
          </div>
        )}
        <ul className="student-card-grid">
          {rows?.map(({ student: s, enrollment: e }, index) => (
            <li className="student-card" key={e.id} data-selected={detail === s.id}>
              <span className="student-avatar" data-tone={index % 4} aria-hidden="true">
                {s.firstName.trim().charAt(0)}
                {s.lastName.trim().charAt(0)}
              </span>
              <h3>
                {s.firstName}
                <span>{s.lastName}</span>
              </h3>
              {(e.status !== 'active' || !s.active) && (
                <span className="student-status">{!s.active ? 'Archivado' : 'Baja del grupo'}</span>
              )}
              <button
                aria-label={`Ver ficha de ${fullName(s)}`}
                disabled={state.busy || !!form}
                onClick={async () => {
                  if (await state.openRecords()) setDetail(s.id);
                }}
              >
                Ver ficha <ArrowUpRight size={16} aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
        {student && (
          <section className="school-form" aria-label="Detalle del alumno">
            <h3>
              {fullName(student)} · {student.active ? 'Ficha activa' : 'Archivado'}
            </h3>
            <button
              disabled={state.busy || !!form}
              onClick={() => setForm({ kind: 'edit', student })}
            >
              Editar ficha
            </button>
            {student.active ? (
              <button
                disabled={state.busy || !!form}
                onClick={() => void open({ kind: 'archive', student })}
              >
                Archivar alumno
              </button>
            ) : (
              <button
                disabled={state.busy || !!form}
                onClick={() => void state.run((r) => r.setStudentActive(student.id, true))}
              >
                Reactivar ficha
              </button>
            )}
            <h3>Historial del alumno</h3>
            <ul className="school-list">
              {history.map((e) => {
                const g = state.records?.groups.find((g) => g.id === e.groupId);
                const y = state.records?.years.find((y) => y.id === g?.schoolYearId);
                return (
                  <li key={e.id}>
                    <strong>
                      {y?.label} · {g?.grade}.º {g?.name}{' '}
                      {e.groupId === group.id ? '· Grupo actual' : ''}
                    </strong>
                    <span>
                      {g?.shift || 'Sin turno'} · {e.status === 'active' ? 'Activa' : 'Inactiva'} ·
                      Salida: {e.leftAt || 'Sin fecha'}
                    </span>
                    {(g?.archived || y?.archived) && <span>Grupo o ciclo archivado</span>}
                    {e.groupId === group.id && (
                      <div>
                        <button
                          disabled={state.busy || !!form}
                          onClick={() => setForm({ kind: 'dates', enrollment: e })}
                        >
                          Corregir fechas
                        </button>
                        <button
                          disabled={
                            state.busy || !!form || (!student.active && e.status === 'inactive')
                          }
                          onClick={() =>
                            setForm({
                              kind: e.status === 'active' ? 'leave' : 'reactivate',
                              enrollment: e,
                            })
                          }
                        >
                          {e.status === 'active' ? 'Dar de baja del grupo' : 'Volver al grupo'}
                        </button>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
            <button
              disabled={!!form || state.busy}
              onClick={() => {
                setDetail(null);
                heading.current?.focus();
              }}
            >
              Cerrar detalle
            </button>
          </section>
        )}
      </section>
      <aside className="student-register panel" ref={register} aria-label="Registro de alumnos">
        <span className="register-icon">
          <UserRoundPlus size={23} aria-hidden="true" />
        </span>
        <StudentForm
          key={`${formRevision}:${JSON.stringify(form)}`}
          form={form ?? { kind: 'new' }}
          year={year}
          group={group}
          state={state}
          done={done}
        />
      </aside>
    </div>
  );
}
