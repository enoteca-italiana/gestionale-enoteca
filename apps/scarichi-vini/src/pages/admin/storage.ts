export const storageKeys = {
  adminPasswordHash: 'scarichi.admin.passwordHash',
  adminAuthedUntil: 'scarichi.admin.authedUntil',
  settingRequireFinalConfirm: 'scarichi.settings.requireFinalConfirm',
  settingEnableUserLabel: 'scarichi.settings.enableUserLabel'
} as const;

export const settingsChangedEvent = 'scarichi:settingsChanged';

export function getBool(key: string, fallback: boolean) {
  const v = localStorage.getItem(key);
  if (v === null) return fallback;
  return v === 'true';
}

export function setBool(key: string, value: boolean) {
  localStorage.setItem(key, value ? 'true' : 'false');
  window.dispatchEvent(new CustomEvent(settingsChangedEvent, { detail: { key } }));
}
