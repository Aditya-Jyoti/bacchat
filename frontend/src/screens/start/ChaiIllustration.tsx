import React from 'react';
import Svg, { Circle, Ellipse, Path } from 'react-native-svg';

export type ChaiIllustrationProps = {
  /** Ink line layer (single weight). */
  ink: string;
  /** Flat blob layer behind the drawing (primaryContainer). */
  blob: string;
  width?: number;
  height?: number;
};

/** Placeholder illustration with two tintable layers: ink line chai glass over a flat blob. */
export function ChaiIllustration({ ink, blob, width = 200, height = 180 }: ChaiIllustrationProps): React.JSX.Element {
  return (
    <Svg width={width} height={height} viewBox="0 0 200 180" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Path
        testID="illustration-blob"
        fill={blob}
        d="M30 96C22 56 62 20 104 24c44 4 74 34 70 74-4 42-38 64-78 60-34-3-60-24-66-62z"
      />
      <Path
        testID="illustration-ink"
        fill="none"
        stroke={ink}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M78 68h44l-5 54a8 8 0 0 1-8 7H91a8 8 0 0 1-8-7zM81 84h38M122 78h6a8 8 0 0 1 0 16h-7M92 56c-3-5 3-8 0-13M104 56c-3-5 3-8 0-13M116 56c-3-5 3-8 0-13"
      />
      <Ellipse cx={100} cy={141} rx={30} ry={5} fill="none" stroke={ink} strokeWidth={2} />
      <Circle cx={146} cy={132} r={8} fill="none" stroke={ink} strokeWidth={2} />
      <Circle cx={56} cy={136} r={6} fill="none" stroke={ink} strokeWidth={2} />
    </Svg>
  );
}
