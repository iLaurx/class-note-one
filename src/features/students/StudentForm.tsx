import { useState, type SubmitEvent } from 'react';
import type { Group, SchoolYear } from '../../domain/models';
import type { useStudents } from './useStudents';
import type { StudentFormState } from './studentFormState';
import { allowNavigation } from '../../app/pendingChanges';
import { useDraftGuard } from '../assignments/useDraftGuard';
import { fullName } from './studentPresentation';
export function StudentForm({
  form,
  year,
  group,
  state,
  done,
}: {
  form: StudentFormState;
  year: SchoolYear;
  group: Group;
  state: ReturnType<typeof useStudents>;
  done: () => void;
}) {
  const enrollment = 'enrollment' in form ? form.enrollment : undefined;
  const student = 'student' in form ? form.student : undefined;
  const [firstName, setFirst] = useState(student?.firstName ?? '');
  const [lastName, setLast] = useState(student?.lastName ?? '');
  const [leftAt, setLeft] = useState(enrollment?.leftAt ?? '');
  const dirty =
    firstName !== (student?.firstName ?? '') ||
    lastName !== (student?.lastName ?? '') ||
    leftAt !== (enrollment?.leftAt ?? '');
  useDraftGuard(dirty, state.busy, 'alumnos');
  const titles = {
    new: 'Nuevo alumno',
    edit: 'Editar ficha',
    dates: 'Corregir fechas',
    leave: 'Confirmar baja del grupo',
    reactivate: 'Confirmar reactivación de matrícula',
    archive: 'Confirmar archivo global',
  };
  async function save(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (state.busy) return;
    const context = { schoolYearId: year.id, groupId: group.id };
    if (
      await state.run(async (r) => {
        switch (form.kind) {
          case 'new':
            return r.createStudentWithEnrollment(context, { firstName, lastName });
          case 'edit':
            return r.updateStudent(form.student.id, { firstName, lastName });
          case 'archive':
            return r.setStudentActive(form.student.id, false);
          default:
            return r.updateEnrollment(
              { ...context, enrollmentId: form.enrollment.id },
              {
                leftAt: leftAt || undefined,
                status:
                  form.kind === 'leave'
                    ? 'inactive'
                    : form.kind === 'reactivate'
                      ? 'active'
                      : form.enrollment.status,
              },
            );
        }
      })
    )
      done();
  }
  return (
    <form className="school-form" aria-label={titles[form.kind]} onSubmit={save}>
      <h3>{titles[form.kind]}</h3>
      {form.kind !== 'new' && (
        <p>
          {year.label} · {group.grade}.º {group.name}
        </p>
      )}
      {(form.kind === 'new' || form.kind === 'edit') && (
        <>
          <label>
            Nombre o nombres
            <input
              autoFocus={form.kind === 'edit'}
              required
              disabled={state.busy}
              value={firstName}
              onChange={(e) => setFirst(e.target.value)}
            />
          </label>
          <label>
            Apellido o apellidos
            <input
              required
              disabled={state.busy}
              value={lastName}
              onChange={(e) => setLast(e.target.value)}
            />
          </label>
        </>
      )}
      {form.kind !== 'edit' && form.kind !== 'archive' && (
        <>
          {enrollment && (
            <>
              <label>
                Fecha de salida (opcional)
                <input
                  disabled={state.busy}
                  type="date"
                  min={year.startDate}
                  max={year.endDate}
                  value={leftAt}
                  onChange={(e) => setLeft(e.target.value)}
                />
              </label>
              <p>
                Confirma el intervalo. Para retirar la salida, vacía su campo explícitamente. Se
                conservan las asistencias.
              </p>
            </>
          )}
        </>
      )}
      {form.kind === 'leave' && (
        <p>
          Solo se dará de baja esta matrícula. La ficha y las demás matrículas se conservan. No se
          inventará una fecha de salida.
        </p>
      )}
      {form.kind === 'archive' && (
        <p>
          Archivar a {fullName(form.student)} desactivará{' '}
          {
            state.records?.enrollments.filter(
              (e) => e.studentId === form.student.id && e.status === 'active',
            ).length
          }{' '}
          matrículas activas. Se conserva todo el historial y sus fechas. Reactivar la ficha no
          reactiva matrículas.
        </p>
      )}
      <div>
        <button autoFocus={form.kind === 'archive'} disabled={state.busy} type="submit">
          {form.kind === 'archive'
            ? 'Confirmar archivo del alumno'
            : form.kind === 'leave'
              ? 'Confirmar baja'
              : 'Guardar alumno'}
        </button>
        <button
          disabled={state.busy}
          type="button"
          onClick={() => {
            if (allowNavigation()) done();
          }}
        >
          Cancelar formulario
        </button>
      </div>
    </form>
  );
}
