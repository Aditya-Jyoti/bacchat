import React from 'react';
import { Circle, G, Path } from 'react-native-svg';

import { IllustrationBlob } from './IllustrationBlob';

export type BeachChairIllustrationProps = {
  height?: number;
  /** Blob colour override (layer 1). */
  tint?: string;
  /** Ink colour override (layer 2). */
  ink?: string;
};

/** Beach chair and a coconut with a straw, drawn as ink lines over the blob. Used for goal headers. */
export function BeachChairIllustration({ height, tint, ink }: BeachChairIllustrationProps): React.JSX.Element {
  return (
    <IllustrationBlob height={height} tint={tint} ink={ink} accessibilityLabel="Illustration of a beach chair and a coconut">
      {(c) => (
        <G testID="illustration-ink" stroke={c} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" fill="none">
          <Path d="M64 116H262" />
          <Path d="M128 112L156 48" />
          <Path d="M156 48L206 94" />
          <Path d="M206 94L218 112" />
          <Path d="M146 84L190 112" />
          <Path d="M141 80L174 56" />
          <Path d="M152 98L184 70" />
          <Path d="M166 48C170 40 180 40 184 46" />
          <Circle cx={240} cy={100} r={15} />
          <Path d="M232 98H232.1M240 94H240.1M246 102H246.1" />
          <Path d="M248 86L260 60L268 60" />
          <Path d="M100 40L104 34M112 44L118 38M96 52L90 50" />
        </G>
      )}
    </IllustrationBlob>
  );
}
