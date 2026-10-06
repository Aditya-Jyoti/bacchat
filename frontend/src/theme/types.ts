export type ColorMode = 'light' | 'dark';

/** Named colour roles. Screens read these from useTheme(); never hard-code hex. */
export type BacchatColors = {
  primary: string;
  onPrimary: string;
  primaryContainer: string;
  onPrimaryContainer: string;
  secondaryContainer: string;
  onSecondaryContainer: string;
  tertiaryContainer: string;
  onTertiaryContainer: string;
  surface: string;
  surfaceContainer: string;
  surfaceContainerHigh: string;
  surfaceContainerLowest: string;
  onSurface: string;
  onSurfaceVariant: string;
  outlineVariant: string;
  outline: string;
  error: string;
  inverseSurface: string;
  inverseOnSurface: string;
  caution: string;
  onCaution: string;
  chart2: string;
  chart3: string;
  chart4: string;
  /** rgba() string for sheet and dialog scrims. */
  scrim: string;
};

export const COLOR_ROLES: readonly (keyof BacchatColors)[] = [
  'primary',
  'onPrimary',
  'primaryContainer',
  'onPrimaryContainer',
  'secondaryContainer',
  'onSecondaryContainer',
  'tertiaryContainer',
  'onTertiaryContainer',
  'surface',
  'surfaceContainer',
  'surfaceContainerHigh',
  'surfaceContainerLowest',
  'onSurface',
  'onSurfaceVariant',
  'outlineVariant',
  'outline',
  'error',
  'inverseSurface',
  'inverseOnSurface',
  'caution',
  'onCaution',
  'chart2',
  'chart3',
  'chart4',
  'scrim',
];
