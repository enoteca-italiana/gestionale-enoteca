import { getBool, storageKeys } from '@/pages/admin/storage';
import { useEffect, useState } from 'react';
import { settingsChangedEvent } from '@/pages/admin/storage';

export type AppSettings = {
  requireFinalConfirm: boolean;
  enableUserLabel: boolean;
};

export function loadAppSettings(): AppSettings {
  return {
    requireFinalConfirm: getBool(storageKeys.settingRequireFinalConfirm, true),
    enableUserLabel: getBool(storageKeys.settingEnableUserLabel, false)
  };
}

export function useAppSettings() {
  const [settings, setSettings] = useState<AppSettings>(() => loadAppSettings());

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (!e.key) return;
      if (
        e.key !== storageKeys.settingRequireFinalConfirm &&
        e.key !== storageKeys.settingEnableUserLabel
      )
        return;
      setSettings(loadAppSettings());
    };

    const onLocal = () => {
      setSettings(loadAppSettings());
    };

    window.addEventListener('storage', onStorage);
    window.addEventListener(settingsChangedEvent, onLocal);
    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener(settingsChangedEvent, onLocal);
    };
  }, []);

  return settings;
}
