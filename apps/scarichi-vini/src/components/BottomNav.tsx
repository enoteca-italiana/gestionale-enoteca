import { Link } from 'wouter';
import { Archive, CircleArrowLeft, House, Settings } from 'lucide-react';
import { APP_ROUTES, isArchivePath, isSettingsPath } from '@/app/routes';

const FORCE_HOME_ONCE_SESSION_KEY = 'scarichi:force-home-once';
const BEFORE_NAV_EVENT = 'scarichi:beforeNav';

function canNavigateTo(href: string) {
  const evt = new CustomEvent(BEFORE_NAV_EVENT, {
    detail: { href },
    cancelable: true
  });
  return window.dispatchEvent(evt);
}

export function BottomNav({
  currentPath,
  hidden,
  adminInSubSection
}: {
  currentPath: string;
  hidden?: boolean;
  adminInSubSection?: boolean;
}) {
  if (hidden) return null;
  const isHome = currentPath === APP_ROUTES.HOME;
  const isArchive = isArchivePath(currentPath);
  const isSettings = isSettingsPath(currentPath) && !isArchive;

  const settingsHomeOnly = isSettings && !adminInSubSection;

  function renderRightTab() {
    if (settingsHomeOnly) return null;

    if (adminInSubSection) {
      return (
        <button
          type="button"
          className="navNavItem navNavItemActive navNavItemBack"
          aria-label="Torna a Impostazioni"
          onClick={() => {
            window.dispatchEvent(new CustomEvent('scarichi:openAdminHome'));
          }}
        >
          <CircleArrowLeft size={26} strokeWidth={1.4} />
        </button>
      );
    }

    return (
      <Link
        href={APP_ROUTES.SETTINGS}
        className={`navNavItem ${isSettings ? 'navNavItemActive' : ''}`}
        aria-label="Impostazioni"
        onClick={(event) => {
          if (!canNavigateTo(APP_ROUTES.SETTINGS)) {
            event.preventDefault();
            return;
          }
          window.dispatchEvent(new CustomEvent('scarichi:openAdminHome'));
        }}
      >
        <Settings size={26} strokeWidth={1.4} />
        <span>Impostazioni</span>
      </Link>
    );
  }

  return (
    <nav className="navbar">
      <div className={`navbarInner${settingsHomeOnly ? ' navbarInnerCentered' : ''}`}>
        <Link
          href={APP_ROUTES.HOME}
          className={`navNavItem ${isHome ? 'navNavItemActive' : ''}`}
          aria-label="Home"
          onClick={(event) => {
            if (!canNavigateTo(APP_ROUTES.HOME)) {
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
<<<<<<< HEAD
        <Link
          href={APP_ROUTES.ARCHIVE}
          className={`navNavItem navNavItemArchive ${isArchive ? 'navNavItemActive' : ''}`}
          aria-label="Archivio"
          onClick={(event) => {
            if (!canNavigateTo(APP_ROUTES.ARCHIVE)) {
              event.preventDefault();
            }
          }}
        >
          <Archive size={26} strokeWidth={1.4} />
          <span>Archivio</span>
        </Link>
        {renderRightTab()}
      </div>
    </nav>
  );
}
