import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

export type AppDomain = 'wine' | 'spirits';

const ACTIVE_DOMAIN_KEY = 'scarichi.activeDomain.v1';
const DEFAULT_DOMAIN: AppDomain = 'wine';

type AppDomainContextValue = {
  activeDomain: AppDomain;
  setActiveDomain: (domain: AppDomain) => void;
};

const AppDomainContext = createContext<AppDomainContextValue | null>(null);

function isValidDomain(value: string | null): value is AppDomain {
  return value === 'wine' || value === 'spirits';
}

function readStoredDomain(): AppDomain {
  try {
    const raw = window.localStorage.getItem(ACTIVE_DOMAIN_KEY);
    return isValidDomain(raw) ? raw : DEFAULT_DOMAIN;
  } catch {
    return DEFAULT_DOMAIN;
  }
}

function writeStoredDomain(domain: AppDomain) {
  try {
    window.localStorage.setItem(ACTIVE_DOMAIN_KEY, domain);
  } catch {
    // Ignore storage failures.
  }
}

export function AppDomainProvider({ children }: { children: ReactNode }) {
  const [activeDomain, setActiveDomain] = useState<AppDomain>(() => readStoredDomain());

  useEffect(() => {
    writeStoredDomain(activeDomain);
  }, [activeDomain]);

  const value = useMemo<AppDomainContextValue>(
    () => ({
      activeDomain,
      setActiveDomain
    }),
    [activeDomain]
  );

  return <AppDomainContext.Provider value={value}>{children}</AppDomainContext.Provider>;
}

export function useAppDomain(): AppDomainContextValue {
  const ctx = useContext(AppDomainContext);
  if (!ctx) {
    throw new Error('useAppDomain must be used within AppDomainProvider');
  }
  return ctx;
}
