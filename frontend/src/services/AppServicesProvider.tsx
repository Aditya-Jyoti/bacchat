import React, { createContext, useContext, useEffect, useState } from 'react';

import { createServices, type Services, type ServicesOptions } from './services';

type Ctx = { services: Services | null; ready: boolean };

const ServicesContext = createContext<Ctx>({ services: null, ready: false });

export type AppServicesProviderProps = {
  /** Ready-made services (tests). Skips opening the database. */
  services?: Services;
  /** Options for createServices when no services are given. */
  options?: ServicesOptions;
  /** Run the once-a-day NAV refresh after the services are ready. The app sets this; tests do not. */
  autoRefreshNavs?: boolean;
  children: React.ReactNode;
};

/**
 * Opens the database, seeds sample data on first launch and provides the services. Renders
 * nothing until ready, so the native splash stays up (the app mounts this after fonts and stores).
 */
export function AppServicesProvider({
  services: given,
  options,
  autoRefreshNavs = false,
  children,
}: AppServicesProviderProps): React.JSX.Element | null {
  const [services, setServices] = useState<Services | null>(given ?? null);

  useEffect(() => {
    if (given) return;
    let alive = true;
    createServices(options)
      .then((s) => {
        if (alive) setServices(s);
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
    // Open once per mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const active = given ?? services;
  useEffect(() => {
    if (autoRefreshNavs && active) void active.refreshNavs();
  }, [autoRefreshNavs, active]);

  if (!active) return null;
  return <ServicesContext.Provider value={{ services: active, ready: true }}>{children}</ServicesContext.Provider>;
}

/** The app services. Throws outside AppServicesProvider (it renders children only once ready). */
export function useServices(): Services {
  const { services } = useContext(ServicesContext);
  if (!services) throw new Error('useServices must be used inside AppServicesProvider.');
  return services;
}

/** True when inside a ready provider. Useful for components that may render outside one. */
export function useServicesReady(): boolean {
  return useContext(ServicesContext).ready;
}
