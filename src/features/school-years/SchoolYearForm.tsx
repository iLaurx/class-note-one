import { useState, type SubmitEvent } from 'react';
import type { SchoolYear } from '../../domain/models';
import { defaultDate } from '../attendance/attendanceDomain';
import { useWorkContext } from '../../app/useWorkContext';
export function SchoolYearForm({ year, done }: { year?: SchoolYear; done: () => void }) {
  const { busy, run } = useWorkContext();
  const [label, setLabel] = useState(year?.label ?? '');
  const [startDate, setStart] = useState(() => year?.startDate ?? defaultDate());
  const [endDate, setEnd] = useState(year?.endDate ?? '');
  async function save(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (
      await run((r) =>
        year
          ? r.updateSchoolYear(year.id, { label, startDate, endDate: endDate || undefined })
          : r.createSchoolYear({ label, startDate, endDate: endDate || undefined }),
      )
    )
      done();
  }
  return (
    <form
      className="school-form"
      aria-label={year ? 'Editar ciclo escolar' : 'Crear ciclo escolar'}
      onSubmit={save}
    >
      <h3>{year ? 'Editar ciclo escolar' : 'Crear ciclo escolar'}</h3>
      <label>
        Etiqueta
        <input autoFocus required value={label} onChange={(e) => setLabel(e.target.value)} />
      </label>
      <label>
        Fecha de inicio
        <input required type="date" value={startDate} onChange={(e) => setStart(e.target.value)} />
      </label>
      <label>
        Fecha de fin (opcional)
        <input type="date" value={endDate} onChange={(e) => setEnd(e.target.value)} />
      </label>
      <div>
        <button disabled={busy} type="submit">
          Guardar ciclo
        </button>{' '}
        <button disabled={busy} type="button" onClick={done}>
          Cancelar formulario
        </button>
      </div>
    </form>
  );
}
