import { useEffect, useState } from 'react';
import { ArrowRight, BookOpen, CalendarCheck, ClipboardList, UsersRound } from 'lucide-react';
import { useStorage } from '../../app/useStorage';
import { useWorkContext } from '../../app/useWorkContext';
import type { GroupContext, Repositories } from '../../db/repositories';
import { localDay } from './dashboardDomain';

export function Dashboard() {
  const { data, busy, error, run } = useWorkContext();
  const { state, retry } = useStorage();
  const year = data?.years.find((row) => row.id === data.selection.schoolYearId);
  const group = data?.groups.find((row) => row.id === data.selection.groupId);
  const [today, setToday] = useState(localDay);
  useEffect(() => {
    const refresh = () => setToday(localDay());
    const timer = window.setInterval(refresh, 30_000);
    window.addEventListener('focus', refresh);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('focus', refresh);
    };
  }, []);
  return (
    <div className="dashboard">
      {state.status === 'loading' || (state.status !== 'error' && busy) ? (
        <p role="status">Cargando tu grupo…</p>
      ) : state.status === 'error' || error ? (
        <div className="empty-state" role="alert">
          <h2>No pudimos cargar tu grupo</h2>
          <button
            onClick={() => {
              if (state.status === 'error') void retry();
              else void run();
            }}
          >
            Reintentar
          </button>
        </div>
      ) : !year || !group ? (
        <section className="welcome-banner setup-banner">
          <span className="icon-tile">
            <BookOpen size={28} aria-hidden="true" />
          </span>
          <div>
            <span className="eyebrow">BIENVENIDA A TU CUADERNO</span>
            <h2>Un pequeño grupo. Todo a la mano.</h2>
            <p>Configura tu grupo y agrega a tus alumnos para empezar.</p>
            <a className="button-primary" href="#/configuracion">
              Configurar mi grupo <ArrowRight size={17} aria-hidden="true" />
            </a>
          </div>
        </section>
      ) : (
        <DashboardSummary
          key={`${year.id}:${group.id}:${today}`}
          context={{ schoolYearId: year.id, groupId: group.id }}
          today={today}
        />
      )}
    </div>
  );
}

function DashboardSummary({ context, today }: { context: GroupContext; today: string }) {
  const { repositories } = useStorage();
  const [data, setData] = useState<Awaited<ReturnType<Repositories['loadDashboard']>> | null>(null);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const { schoolYearId, groupId } = context;
  useEffect(() => {
    let cancelled = false;
    if (repositories)
      void repositories.loadDashboard({ schoolYearId, groupId }, today).then(
        (result) => {
          if (!cancelled) setData(result);
        },
        () => {
          if (!cancelled) setError(true);
        },
      );
    return () => {
      cancelled = true;
    };
  }, [repositories, schoolYearId, groupId, today, attempt]);
  if (error)
    return (
      <div role="alert">
        <p>No se pudo consultar el resumen.</p>
        <button
          onClick={() => {
            setError(false);
            setAttempt((value) => value + 1);
          }}
        >
          Reintentar resumen
        </button>
      </div>
    );
  if (!data) return <p role="status">Cargando resumen…</p>;
  const registered = data.attendance ? data.students - data.attendance.unregistered : 0;
  return (
    <>
      <section className="welcome-banner" aria-labelledby="welcome-title">
        <div>
          <span className="eyebrow">TU GRUPO, PASO A PASO</span>
          <h2 id="welcome-title">Vamos con el día de hoy</h2>
          <p>
            {!data.inYear
              ? 'Hoy está fuera del ciclo escolar.'
              : !data.groupStudents
                ? 'Agrega a tus alumnos para comenzar.'
                : !data.students
                  ? 'No hay alumnos para pasar lista en esta fecha.'
                  : registered === data.students
                    ? 'La asistencia de hoy está lista.'
                    : 'Empieza pasando lista a tu grupo.'}
          </p>
        </div>
        <a className="button-primary" href={data.groupStudents ? '#/asistencia' : '#/alumnos'}>
          {data.groupStudents ? 'Pasar lista' : 'Agregar alumnos'}
          <ArrowRight size={17} aria-hidden="true" />
        </a>
      </section>
      <div className="stats-grid">
        <a href="#/alumnos" className="stat-card panel" aria-label="Alumnos del grupo">
          <UsersRound size={20} aria-hidden="true" />
          <strong className="stat-number">{data.groupStudents}</strong>
          <span>Alumnos</span>
        </a>
        <a href="#/asistencia" className="stat-card panel" aria-label="Asistencia de hoy">
          <CalendarCheck size={20} aria-hidden="true" />
          <strong className="stat-number">
            {data.attendance ? data.attendance.present : '—'}
            <span className="stat-denominator"> / {data.students}</span>
          </strong>
          <span>Presentes hoy</span>
          {data.inYear && data.students !== data.groupStudents && (
            <small>
              {data.students} {data.students === 1 ? 'alumno para' : 'alumnos para'} esta fecha
            </small>
          )}
          <small>
            {data.attendance && data.attendance.unregistered
              ? `${data.attendance.unregistered} sin registrar`
              : data.attendance
                ? 'Sin registros pendientes'
                : 'Fuera del ciclo'}
          </small>
        </a>
        <a href="#/lectura" className="stat-card panel" aria-label="Lecturas de la semana">
          <BookOpen size={20} aria-hidden="true" />
          <strong className="stat-number">
            {data.reading.minutes}
            <span className="stat-denominator"> min</span>
          </strong>
          <span>Lectura esta semana</span>
          <small>{data.reading.count} registros</small>
        </a>
      </div>
      <section className="panel agenda-panel" aria-labelledby="agenda-title">
        <div className="section-heading">
          <h2 id="agenda-title">Tareas recientes y próximas</h2>
          <a className="text-link" href="#/tareas">
            Ver tareas <ArrowRight size={15} aria-hidden="true" />
          </a>
        </div>
        {!data.assignments.length ? (
          <div className="empty-state">
            <ClipboardList size={28} aria-hidden="true" />
            <h3>Todo despejado por aquí</h3>
            <p>Las tareas de tu grupo aparecerán aquí.</p>
            <a className="text-link" href="#/tareas">
              Crear una tarea <ArrowRight size={15} aria-hidden="true" />
            </a>
          </div>
        ) : (
          <ul className="assignment-list">
            {data.assignments.slice(0, 5).map((row) => (
              <li key={row.id}>
                <span className="icon-tile">
                  <ClipboardList size={18} aria-hidden="true" />
                </span>
                <div>
                  <h3>{row.title}</h3>
                  <p>
                    {row.dueDate
                      ? `Entrega: ${new Intl.DateTimeFormat('es-MX', { day: 'numeric', month: 'short' }).format(new Date(`${row.dueDate}T12:00:00`))}`
                      : 'Sin fecha de entrega'}
                  </p>
                  {!!row.incidents && (
                    <p role="status">Revisa {row.incidents} entregas en Tareas.</p>
                  )}
                </div>
                <span className="due-label">{row.pending} pendientes</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
