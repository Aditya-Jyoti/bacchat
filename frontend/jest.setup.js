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

// Reanimated / worklets need native runtimes; use their official Jest mocks.
jest.mock('react-native-worklets', () => require('react-native-worklets/src/mock'));
jest.mock('react-native-reanimated', () => require('react-native-reanimated/mock'));
require('react-native-gesture-handler/jestSetup');

// Key-value storage: use the official in-memory mock so persisted stores never touch native code.
jest.mock('@react-native-async-storage/async-storage', () => require('@react-native-async-storage/async-storage/jest'));

// react-native-paper renders its icons with MaterialCommunityIcons; same synchronous stand-in.
jest.mock('@expo/vector-icons/MaterialCommunityIcons', () => {
  const React = require('react');
  const { Text } = require('react-native');
  const Icon = (props) => React.createElement(Text, { testID: props.testID }, props.name);
  Icon.glyphMap = {};
  return { __esModule: true, default: Icon };
});
