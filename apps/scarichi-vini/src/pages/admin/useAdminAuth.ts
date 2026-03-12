import { useCallback, useEffect, useMemo, useState } from 'react';
import { sha256Base64 } from '@/pages/admin/crypto';
import { storageKeys } from '@/pages/admin/storage';

const DEFAULT_PASSWORD = '1909';
const SESSION_MS = 12 * 60 * 60 * 1000;

export function useAdminAuth() {
  const [ready, setReady] = useState(false);
  const [authedUntil, setAuthedUntil] = useState<number | null>(null);

  useEffect(() => {
    const init = async () => {
      const existing = localStorage.getItem(storageKeys.adminPasswordHash);
      if (!existing) {
        const hash = await sha256Base64(DEFAULT_PASSWORD);
        localStorage.setItem(storageKeys.adminPasswordHash, hash);
      }

      const untilRaw = localStorage.getItem(storageKeys.adminAuthedUntil);
      const until = untilRaw ? Number(untilRaw) : null;
      setAuthedUntil(Number.isFinite(until as number) ? until : null);
      setReady(true);
    };

    void init();
  }, []);

  const isAuthed = useMemo(() => {
    if (!authedUntil) return false;
    return Date.now() < authedUntil;
  }, [authedUntil]);

  const login = useCallback(async (password: string) => {
    const stored = localStorage.getItem(storageKeys.adminPasswordHash);
    if (!stored) return false;
    const hash = await sha256Base64(password);
    if (hash !== stored) return false;

    const until = Date.now() + SESSION_MS;
    localStorage.setItem(storageKeys.adminAuthedUntil, String(until));
    setAuthedUntil(until);
    return true;
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(storageKeys.adminAuthedUntil);
    setAuthedUntil(null);
  }, []);

  const changePassword = useCallback(async (currentPassword: string, newPassword: string) => {
    const stored = localStorage.getItem(storageKeys.adminPasswordHash);
    if (!stored) return false;

    const currentHash = await sha256Base64(currentPassword);
    if (currentHash !== stored) return false;

    const newHash = await sha256Base64(newPassword);
    localStorage.setItem(storageKeys.adminPasswordHash, newHash);

    const until = Date.now() + SESSION_MS;
    localStorage.setItem(storageKeys.adminAuthedUntil, String(until));
    setAuthedUntil(until);
    return true;
  }, []);

  return { ready, isAuthed, login, logout, changePassword };
}
