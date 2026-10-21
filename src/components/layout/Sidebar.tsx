import { BookOpen, ChevronDown } from 'lucide-react';
import { navigation, type NavigationItem } from '../../app/navigation';
import { useWorkContext } from '../../app/useWorkContext';

export function Sidebar({ current }: { current: NavigationItem | undefined }) {
  const { data, busy, error, run } = useWorkContext();
  const year = data?.years.find((item) => item.id === data.selection.schoolYearId);
  const group = data?.groups.find((item) => item.id === data.selection.groupId);
  const main = navigation.filter((item) =>
    ['home', 'attendance', 'assignments', 'students'].includes(item.id),
  );
  const extra = navigation.filter((item) => !main.some((link) => link.id === item.id));
  const extraActive = extra.some((item) => item.id === current?.id);
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
    <header className="sidebar">
      <div className="app-topbar">
        <a href="#/inicio" className="brand" aria-label="ClassNote, ir a Inicio">
          <span className="brand-mark">
            <BookOpen size={22} aria-hidden="true" />
          </span>
          <span>
            ClassNote<span className="brand-caption">Mi cuaderno de clase</span>
          </span>
        </a>
        <div className="group-context" aria-label="Mi grupo">
          {busy ? (
            <span role="status">Cargando…</span>
          ) : error ? (
            <div role="alert">
              <span>{error}</span> <button onClick={() => void run()}>Reintentar</button>
            </div>
          ) : (
            <a href="#/configuracion" className="context-summary">
              <strong>{group ? `${group.grade}.º ${group.name}` : 'Configurar mi grupo'}</strong>
              {year && <span>{year.label}</span>}
            </a>
          )}
        </div>
      </div>
      <nav aria-label="Navegación principal" className="navigation">
        {main.map(link)}
        <details className="more-navigation" key={current?.id}>
          <summary className={extraActive ? 'is-active' : ''}>
            <span>Más</span>
            <ChevronDown size={15} aria-hidden="true" />
          </summary>
          <div className="more-menu">{extra.map(link)}</div>
        </details>
      </nav>
    </header>
  );
}
