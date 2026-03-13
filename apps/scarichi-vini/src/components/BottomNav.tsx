import { Link } from 'wouter';
import { Archive, House, Settings } from 'lucide-react';

export function BottomNav({ currentPath }: { currentPath: string }) {
  const isHome = currentPath === '/';
  const isArchive = currentPath.startsWith('/admina');
  const isSettings = currentPath.startsWith('/admin') && !isArchive;

  return (
    <nav className="navbar">
      <div className="navbarInner">
        <Link
          href="/"
          className={`navNavItem ${isHome ? 'navNavItemActive' : ''}`}
          aria-label="Home"
        >
          <House size={26} strokeWidth={1.4} />
          <span>Home</span>
        </Link>
        <Link
          href="/admina"
          className={`navNavItem ${isArchive ? 'navNavItemActive' : ''}`}
          aria-label="Archivio"
        >
          <Archive size={26} strokeWidth={1.4} />
          <span>Archivio</span>
        </Link>
        <Link
          href="/admin"
          className={`navNavItem ${isSettings ? 'navNavItemActive' : ''}`}
          aria-label="Impostazioni"
        >
          <Settings size={26} strokeWidth={1.4} />
          <span>Impostazioni</span>
        </Link>
      </div>
    </nav>
  );
}
