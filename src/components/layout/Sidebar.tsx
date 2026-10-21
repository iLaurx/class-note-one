import { BookOpen, ChevronDown } from 'lucide-react';
import { navigation, type NavigationItem } from '../../app/navigation';
import { useWorkContext } from '../../app/useWorkContext';
import snoopy from './snoopy-notebook.png';

export function Sidebar({ current }: { current: NavigationItem | undefined }) {
  const { data, busy, error, run } = useWorkContext();
  const year = data?.years.find((item) => item.id === data.selection.schoolYearId);
  const group = data?.groups.find((item) => item.id === data.selection.groupId);
  function link(item: NavigationItem) {
    const Icon = item.icon;
    return (
      <a key={item.id} href={item.href} aria-current={current?.id === item.id ? 'page' : undefined}>
        <Icon size={18} aria-hidden="true" />
        <span>{item.label}</span>
      </a>
    );
  }
  return (
    <aside className="sidebar">
      <div className="app-topbar">
        <a href="#/inicio" className="brand" aria-label="ClassNote, ir a Inicio">
          <span className="brand-mark">
            <BookOpen size={22} aria-hidden="true" />
          </span>
          <span>
            ClassNote<span className="brand-caption">Tu agenda escolar</span>
          </span>
        </a>
      </div>
      <div className="sidebar-context">
        <span className="sidebar-eyebrow">Contexto de trabajo</span>
        <div className="context-summary" aria-label="Mi grupo">
          {busy ? (
            <span role="status">Cargando…</span>
          ) : error ? (
            <div role="alert">
              <span>{error}</span> <button onClick={() => void run()}>Reintentar</button>
            </div>
          ) : (
            <a href="#/configuracion" className="context-summary-link">
              <strong>{group ? `${group.grade}.º ${group.name}` : 'Configurar mi grupo'}</strong>
              {year && <span>{year.label}</span>}
              <span className="context-config">
                Ver configuración <ChevronDown size={15} aria-hidden="true" />
              </span>
            </a>
          )}
        </div>
      </div>
      <nav aria-label="Navegación principal" className="navigation">
        <span className="sidebar-eyebrow">Mi espacio</span>
        {navigation.map(link)}
      </nav>
      <footer className="sidebar-footer">
        <img
          className="sidebar-mascot"
          src={snoopy}
          alt=""
          aria-hidden="true"
          width="1619"
          height="971"
        />
        <span className="sidebar-credit">ClassNote · Agenda escolar</span>
      </footer>
    </aside>
  );
}
