import { Link } from 'wouter';
import { Archive, House, Settings } from 'lucide-react';

const FORCE_HOME_ONCE_SESSION_KEY = 'scarichi:force-home-once';
const BEFORE_NAV_EVENT = 'scarichi:beforeNav';

function canNavigateTo(href: string) {
  const evt = new CustomEvent(BEFORE_NAV_EVENT, {
    detail: { href },
    cancelable: true
  });
  return window.dispatchEvent(evt);
}

export function BottomNav({ currentPath, hidden }: { currentPath: string; hidden?: boolean }) {
  if (hidden) return null;
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
          onClick={(event) => {
            if (!canNavigateTo('/')) {
              event.preventDefault();
              return;
            }
            try {
              window.sessionStorage.setItem(FORCE_HOME_ONCE_SESSION_KEY, '1');
            } catch {
              // Ignore storage failures and fallback to default routing behavior.
            }
          }}
        >
          <House size={26} strokeWidth={1.4} />
          <span>Home</span>
        </Link>
        <Link
          href="/admina"
          className={`navNavItem navNavItemArchive ${isArchive ? 'navNavItemActive' : ''}`}
          aria-label="Archivio"
          onClick={(event) => {
            if (!canNavigateTo('/admina')) {
              event.preventDefault();
            }
          }}
        >
          <Archive size={26} strokeWidth={1.4} />
          <span>Archivio</span>
        </Link>
        <Link
          href="/admin"
          className={`navNavItem ${isSettings ? 'navNavItemActive' : ''}`}
          aria-label="Impostazioni"
          onClick={(event) => {
            if (!canNavigateTo('/admin')) {
              event.preventDefault();
              return;
            }
            window.dispatchEvent(new CustomEvent('scarichi:openAdminHome'));
          }}
        >
          <Settings size={26} strokeWidth={1.4} />
          <span>Impostazioni</span>
        </Link>
      </div>
    </nav>
  );
}
