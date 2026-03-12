import { Link } from 'wouter';

export function BottomNav({ currentPath }: { currentPath: string }) {
  const isHome = currentPath === '/';
  const isAdmin = currentPath.startsWith('/admin');

  return (
    <nav className="navbar">
      <div className="navbarInner">
        <Link href="/" className={`navItem ${isHome ? 'navItemActive' : ''}`}>Home</Link>
        <Link href="/admin" className={`navItem ${isAdmin ? 'navItemActive' : ''}`}>Admin</Link>
      </div>
    </nav>
  );
}
