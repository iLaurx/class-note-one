import { useEffect, useRef, useState } from 'react';
import { useStorage } from '../../app/useStorage';
import { useWorkContext } from '../../app/useWorkContext';
import type { GroupContext } from '../../db/repositories';
import { defaultDate } from '../attendance/attendanceDomain';
import { reportRange } from '../../services/export/reportRange';

export function Reports() {
  const { data, busy, error } = useWorkContext();
  const { state } = useStorage();
  const year = data?.years.find((row) => row.id === data.selection.schoolYearId);
  const group = data?.groups.find((row) => row.id === data.selection.groupId);
  return (
    <section className="school-management panel assignments-panel" aria-labelledby="reports-title">
      <h2 id="reports-title">Reportes del grupo</h2>
      <p>Elige un periodo para descargar el registro de tu grupo.</p>
      <details className="filter-disclosure">
        <summary>Qué incluye el reporte</summary>
        <p>Alumnos, asistencia, tareas y lecturas. Las observaciones privadas no se incluyen.</p>
        <p>
          Las fechas filtran la asistencia, la asignación de tareas y las lecturas. Se incluyen
          todos los alumnos del grupo.
        </p>
        <p>
          Guarda el archivo en un lugar privado. El Excel es un reporte; para recuperar tus datos
          utiliza un respaldo.
        </p>
      </details>
      {busy || state.status === 'loading' ? (
        <p role="status">Cargando contexto…</p>
      ) : error || state.status === 'error' ? (
        <p>Reintenta desde el aviso de almacenamiento o contexto.</p>
      ) : !year || !group ? (
        <p>Configura tu grupo en Configuración para exportar.</p>
      ) : (
        <ReportForm
          key={`${year.id}:${group.id}`}
          context={{ schoolYearId: year.id, groupId: group.id }}
        />
      )}
    </section>
  );
}

function ReportForm({ context }: { context: GroupContext }) {
  const { repositories } = useStorage();
  const [from, setFrom] = useState(() => defaultDate()),
    [to, setTo] = useState(() => defaultDate());
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState(''),
    [error, setError] = useState('');
  const locked = useRef(false),
    active = useRef(true);
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
    };
  }, []);
  return (
    <form
      className="school-form"
      onSubmit={(event) => {
        event.preventDefault();
        if (locked.current || !repositories) return;
        setMessage('');
        setError('');
        try {
          reportRange(from, to);
        } catch (cause) {
          setError(cause instanceof Error ? cause.message : 'Revisa las fechas.');
          return;
        }
        locked.current = true;
        setBusy(true);
        void (async () => {
          try {
            const data = await repositories.loadGroupReport(context, from, to);
            const { groupWorkbook } = await import('../../services/export/groupWorkbook');
            const bytes = await groupWorkbook(data);
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
      <label>
        Desde
        <input
          type="date"
          value={from}
          required
          disabled={busy}
          onChange={(event) => {
            setFrom(event.target.value);
            setMessage('');
            setError('');
          }}
        />
      </label>
      <label>
        Hasta
        <input
          type="date"
          value={to}
          required
          disabled={busy}
          onChange={(event) => {
            setTo(event.target.value);
            setMessage('');
            setError('');
          }}
        />
      </label>
      {error && <p role="alert">{error}</p>}
      <p role="status">{busy ? 'Preparando reporte…' : message}</p>
      <button type="submit" className="button-primary" disabled={busy}>
        {busy ? 'Exportando…' : 'Exportar Excel'}
      </button>
    </form>
  );
}
