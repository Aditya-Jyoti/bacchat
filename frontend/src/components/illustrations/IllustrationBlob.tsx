import React from 'react';
import { View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { useTheme } from '../../theme';

export type IllustrationBlobProps = {
  /** Container height in dp. Width fills the parent. Default 140. */
  height?: number;
  /** Layer 1: the flat blob. Defaults to primaryContainer. */
  tint?: string;
  /** Layer 2: single-weight ink line. Defaults to onPrimaryContainer. */
  ink?: string;
  /** Spoken description of the picture. */
  accessibilityLabel: string;
  /** Draws the ink layer in a 320 x 140 viewBox using the ink colour. */
  children: (ink: string) => React.ReactNode;
};

/** One flat blob of primaryContainer with an ink line drawing on top: two tintable layers. */
export function IllustrationBlob({
  height = 140,
  tint,
  ink,
  accessibilityLabel,
  children,
}: IllustrationBlobProps): React.JSX.Element {
  const { colors } = useTheme();
  const inkColor = ink ?? colors.onPrimaryContainer;
  return (
    <View accessible accessibilityRole="image" accessibilityLabel={accessibilityLabel} testID="illustration" style={{ height }}>
      <Svg width="100%" height={height} viewBox="0 0 320 140" preserveAspectRatio="xMidYMid meet">
        <Path
          testID="illustration-tint"
          fill={tint ?? colors.primaryContainer}
          d="M46 78C34 40 76 14 126 18C168 21 190 6 238 20C286 34 300 70 282 100C266 128 220 134 168 130C120 127 96 138 70 120C58 111 50 96 46 78Z"
        />
        {children(inkColor)}
      </Svg>
    </View>
  );
}
