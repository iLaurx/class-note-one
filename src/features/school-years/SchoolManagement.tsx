import { useRef, useState } from 'react';
import type { Group, SchoolYear } from '../../domain/models';
import { useWorkContext } from '../../app/useWorkContext';
import { SchoolYearForm } from './SchoolYearForm';
import { GroupForm } from '../groups/GroupForm';

export function SchoolManagement() {
  const { data, busy, run } = useWorkContext();
  const [showArchived, setShowArchived] = useState(false);
  const [form, setForm] = useState<
    { kind: 'year'; year?: SchoolYear } | { kind: 'group'; year: SchoolYear; group?: Group } | null
  >(null);
  const [confirmation, setConfirmation] = useState<{ year: SchoolYear; group?: Group } | null>(
    null,
  );
  const heading = useRef<HTMLHeadingElement>(null);
  const done = () => {
    setForm(null);
    heading.current?.focus();
  };
  async function archive() {
    if (!confirmation) return;
    const { year, group } = confirmation;
    if (
      await run((r) =>
        group
          ? r.archiveGroup({ schoolYearId: year.id, groupId: group.id })
          : r.archiveSchoolYear(year.id),
      )
    ) {
      setConfirmation(null);
      heading.current?.focus();
    }
  }
  return (
    <section className="panel school-management" aria-busy={busy}>
      <h2 ref={heading} tabIndex={-1}>
        Ciclos y grupo
      </h2>
      <label className="archive-filter">
        <input
          type="checkbox"
          checked={showArchived}
          onChange={(event) => {
            setShowArchived(event.target.checked);
            setForm(null);
          }}
        />{' '}
        Mostrar archivados
      </label>
      {!data ? (
        <p role="status">Cargando configuración…</p>
      ) : (
        <>
          <button disabled={busy || !!confirmation} onClick={() => setForm({ kind: 'year' })}>
            Crear ciclo escolar
          </button>
          {!data.years.length && <p>Crea el ciclo escolar y después su grupo.</p>}
          <ul className="school-list">
            {data.years
              .filter((year) => showArchived || !year.archived)
              .map((year) => {
                const groups = data.groups.filter((group) => group.schoolYearId === year.id);
                const activeGroups = groups.filter((group) => !group.archived);
                return (
                  <li key={year.id}>
                    <h3>
                      {year.label}
                      {year.archived ? ' · Archivado' : ''}
                    </h3>
                    <p>
                      {year.endDate
                        ? `${year.startDate} — ${year.endDate}`
                        : `Desde ${year.startDate}`}
                    </p>
                    {year.archived ? (
                      <button
                        disabled={busy}
                        onClick={() => void run((r) => r.reactivateSchoolYear(year.id))}
                      >
                        Reactivar ciclo
                      </button>
                    ) : (
                      <>
                        <button
                          disabled={busy || !!confirmation}
                          onClick={() => setForm({ kind: 'year', year })}
                        >
                          Editar ciclo
                        </button>
                        {data.selection.schoolYearId !== year.id && activeGroups.length === 1 && (
                          <button
                            disabled={busy || !!form || !!confirmation}
                            onClick={() =>
                              void run((r) =>
                                r.selectContext({
                                  schoolYearId: year.id,
                                  groupId: activeGroups[0]!.id,
                                }),
                              )
                            }
                          >
                            Usar ciclo
                          </button>
                        )}
                        <button disabled={busy || !!form} onClick={() => setConfirmation({ year })}>
                          Archivar ciclo
                        </button>
                        {activeGroups.length === 0 && (
                          <button
                            disabled={busy || !!confirmation}
                            onClick={() => setForm({ kind: 'group', year })}
                          >
                            Crear grupo
                          </button>
                        )}
                        {activeGroups.length > 1 && (
                          <p role="alert">
                            Este ciclo conserva varios grupos de la versión anterior. Archiva los
                            que ya no uses para dejar uno activo; sus registros se conservan.
                          </p>
                        )}
                      </>
                    )}
                    <ul className="school-list">
                      {groups
                        .filter((group) => showArchived || !group.archived)
                        .map((group) => (
                          <li key={group.id}>
                            <strong>
                              {group.grade}.º {group.name}
                              {group.archived ? ' · Archivado' : ''}
                            </strong>
                            {!year.archived &&
                              (group.archived ? (
                                <button
                                  disabled={busy || activeGroups.length > 0 || !!confirmation}
                                  onClick={() =>
                                    void run((r) =>
                                      r.reactivateGroup({
                                        schoolYearId: year.id,
                                        groupId: group.id,
                                      }),
                                    )
                                  }
                                >
                                  Reactivar grupo
                                </button>
                              ) : (
                                <>
                                  <button
                                    disabled={busy || !!confirmation}
                                    onClick={() => setForm({ kind: 'group', year, group })}
                                  >
                                    Editar grupo
                                  </button>
                                  <button
                                    disabled={busy || !!form}
                                    onClick={() => setConfirmation({ year, group })}
                                  >
                                    Archivar grupo
                                  </button>
                                </>
                              ))}
                          </li>
                        ))}
                    </ul>
                  </li>
                );
              })}
          </ul>
        </>
      )}
      {form?.kind === 'year' && (
        <SchoolYearForm key={form.year?.id ?? 'new-year'} year={form.year} done={done} />
      )}
      {form?.kind === 'group' && (
        <GroupForm
          key={form.group?.id ?? form.year.id}
          year={form.year}
          group={form.group}
          done={done}
        />
      )}
      {confirmation && (
        <div className="school-form" role="region" aria-label="Confirmar archivo">
          <h3>
            Archivar{' '}
            {confirmation.group
              ? `${confirmation.group.grade}.º ${confirmation.group.name}`
              : confirmation.year.label}
          </h3>
          <p>Se conserva todo el historial. Puedes reactivar este registro después.</p>
          <button autoFocus disabled={busy} onClick={() => void archive()}>
            Confirmar archivo
          </button>
          <button
            disabled={busy}
            onClick={() => {
              setConfirmation(null);
              heading.current?.focus();
            }}
          >
            Cancelar archivo
          </button>
        </div>
      )}
    </section>
  );
}
