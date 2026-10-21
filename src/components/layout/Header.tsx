import type { NavigationItem } from '../../app/navigation';

export function Header({ current }: { current: NavigationItem | undefined }) {
  const date = new Intl.DateTimeFormat('es-MX', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(new Date());
  return (
    <header className="page-header">
      <h1 id="page-title" tabIndex={-1}>
        {current?.id === 'home' ? 'Mi día' : (current?.label ?? 'Sección no encontrada')}
      </h1>
      <span className="header-date">{date}</span>
    </header>
  );
}
