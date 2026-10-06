jest.mock('react-native-safe-area-context', () =>
  require('react-native-safe-area-context/jest/mock').default,
);

// Render vector icons synchronously as text (the real component loads its font asynchronously).
jest.mock('@expo/vector-icons/MaterialIcons', () => {
  const React = require('react');
  const { Text } = require('react-native');
  const glyphMap = require('@expo/vector-icons/build/vendor/react-native-vector-icons/glyphmaps/MaterialIcons.json');
  const Icon = (props) => React.createElement(Text, { testID: props.testID }, props.name);
  Icon.glyphMap = glyphMap;
  return { __esModule: true, default: Icon };
});
