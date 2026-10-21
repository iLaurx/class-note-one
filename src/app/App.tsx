import { Reports } from '../features/reports/Reports';
import { Assignments } from '../features/assignments/Assignments';
import { Students } from '../features/students/Students';
import { Attendance } from '../features/attendance/Attendance';
import { useEffect, useRef, useState } from 'react';
import { Header } from '../components/layout/Header';
import { Sidebar } from '../components/layout/Sidebar';
import { PanelDecoration } from '../components/layout/PanelDecoration';
import { Dashboard } from '../features/dashboard/Dashboard';
import { ModulePlaceholder } from '../features/ModulePlaceholder';
import { useLocationHash } from './useNavigation';
import { resolveSection } from './navigation';
import { SchoolManagement } from '../features/school-years/SchoolManagement';
import { useStorage } from './useStorage';
import { BackupRestore } from '../features/settings/BackupRestore';

export function App() {
  const hash = useLocationHash();
  const current = resolveSection(hash || '#/inicio');
  const { state, retry } = useStorage();
  const [settingsRevision, setSettingsRevision] = useState(0);
  const mainRef = useRef<HTMLElement>(null);
  const previousSection = useRef(current?.id);

  useEffect(() => {
    document.title = `${current?.label ?? 'Sección no encontrada'} · ClassNote`;
    if (previousSection.current !== current?.id) {
      mainRef.current?.querySelector<HTMLElement>('h1')?.focus();
      window.scrollTo(0, 0);
    }
    previousSection.current = current?.id;
  }, [current]);

  return (
    <div className="app-shell">
      <a
        className="skip-link"
        href="#main-content"
        onClick={(event) => {
          event.preventDefault();
          mainRef.current?.focus();
        }}
      >
        Saltar al contenido
      </a>
      <Sidebar current={current} />
      <main
        id="main-content"
        ref={mainRef}
        tabIndex={-1}
        className={`main-content${current?.id === 'home' ? ' main-content--home' : ''}`}
      >
        <Header current={current} />
        {state.status === 'error' ? (
          <section className="panel school-management" role="alert">
            <h2>No se pudieron abrir tus datos</h2>
            <p>Intenta de nuevo para continuar.</p>
            <button onClick={() => void retry()}>Reintentar</button>
          </section>
        ) : current?.id === 'home' ? (
          <Dashboard />
        ) : current?.id === 'students' ? (
          <Students />
        ) : current?.id === 'attendance' ? (
          <Attendance />
        ) : current?.id === 'assignments' ? (
          <Assignments
            key={hash}
            initialAssignmentId={new URLSearchParams(hash.split('?')[1]).get('tarea')}
          />
        ) : current?.id === 'settings' ? (
          <>
            <SchoolManagement key={settingsRevision} />
            <details className="settings-disclosure">
              <summary>Respaldos y recuperación</summary>
              <BackupRestore onRestored={() => setSettingsRevision((value) => value + 1)} />
            </details>
          </>
        ) : current?.id === 'reports' ? (
          <Reports />
        ) : (
          <ModulePlaceholder section={current} />
        )}
        {state.status !== 'error' && current && (
          <PanelDecoration key={current.id} section={current.id} />
        )}
      </main>
    </div>
  );
}
