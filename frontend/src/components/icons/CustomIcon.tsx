import React from 'react';
import Svg, { Circle, G, Path } from 'react-native-svg';

import { customIconShapes } from './paths';

export type CustomIconProps = {
  /** Custom icon name, e.g. "auto_rickshaw". Unknown names render nothing. */
  name: string;
  size?: number;
  color: string;
};

/** Outline icon from the custom India set. Decorative: hidden from accessibility. */
export function CustomIcon({ name, size = 24, color }: CustomIconProps): React.JSX.Element {
  const shapes = customIconShapes[name] ?? [];
  return (
    <Svg
      testID={`custom-icon-${name}`}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <G stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" fill="none">
        {shapes.map((s, i) =>
          'd' in s ? <Path key={i} d={s.d} /> : <Circle key={i} cx={s.c[0]} cy={s.c[1]} r={s.c[2]} />,
        )}
      </G>
    </Svg>
  );
}
