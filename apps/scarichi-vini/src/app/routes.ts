export const APP_ROUTES = {
  HOME: '/',
  ARCHIVE: '/admina',
  SETTINGS: '/impostazioni',
  SETTINGS_LEGACY: '/admin'
} as const;

function isExactOrNested(pathname: string, basePath: string): boolean {
  return pathname === basePath || pathname.startsWith(`${basePath}/`);
}

export function isArchivePath(pathname: string): boolean {
  return isExactOrNested(pathname, APP_ROUTES.ARCHIVE);
}

export function isSettingsPath(pathname: string): boolean {
  return (
    isExactOrNested(pathname, APP_ROUTES.SETTINGS_LEGACY) ||
    isExactOrNested(pathname, APP_ROUTES.SETTINGS)
  );
}
