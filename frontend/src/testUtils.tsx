import React from 'react';
import { render } from '@testing-library/react-native';

import type { BacchatDb } from './data/db';
import { AppServicesProvider, createTestServices, type Services, type ServicesOptions } from './services';
import { ThemeProvider } from './theme/ThemeProvider';
import type { ColorMode } from './theme/types';

export type RenderOptions = {
  /** Custom database (default: an in-memory db seeded with the design's sample data on first query). */
  db?: BacchatDb;
  /** Ready-made services. Wins over db. */
  services?: Services;
  /** Extra options for the test services (seed: false, now, secure, fetch ...). */
  servicesOptions?: ServicesOptions;
};

/**
 * Render a component inside the Bacchat ThemeProvider (light by default) and an AppServicesProvider
 * over an in-memory seeded db. The result also carries `services`. Seeding is lazy, so tests that
 * do not read data pay nothing.
 */
export function renderWithTheme(ui: React.ReactElement, mode: ColorMode = 'light', options: RenderOptions = {}) {
  const services = options.services ?? createTestServices({ ...options.servicesOptions, db: options.db ?? options.servicesOptions?.db });
  const result = render(
    <ThemeProvider mode={mode}>
      <AppServicesProvider services={services}>{ui}</AppServicesProvider>
    </ThemeProvider>,
  );
  return Object.assign(result, { services });
}
