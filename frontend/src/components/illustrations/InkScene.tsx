import React from 'react';
import { G } from 'react-native-svg';

import { IllustrationBlob } from './IllustrationBlob';

export type IllustrationProps = {
  /** Container height in dp. Default 140. */
  height?: number;
  /** Layer 1: the flat blob. Defaults to primaryContainer. */
  tint?: string;
  /** Layer 2: the ink line. Defaults to onPrimaryContainer. */
  ink?: string;
};

type InkSceneProps = IllustrationProps & {
  accessibilityLabel: string;
  /** Ink shapes, drawn in the 320 x 140 illustration box. */
  children: React.ReactNode;
};

/** Shared frame for the line drawings: one blob, one ink group with a single stroke weight and round caps. */
export function InkScene({ height, tint, ink, accessibilityLabel, children }: InkSceneProps): React.JSX.Element {
  return (
    <IllustrationBlob height={height} tint={tint} ink={ink} accessibilityLabel={accessibilityLabel}>
      {(c) => (
        <G testID="illustration-ink" stroke={c} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" fill="none">
          {children}
        </G>
      )}
    </IllustrationBlob>
  );
}
