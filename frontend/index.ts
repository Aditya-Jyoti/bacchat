import { registerRootComponent } from 'expo';

import App from './App';
import { registerSmsHeadlessTask } from './src/services/smsHeadless';

// Background SMS: lets the native receiver run the ingest pipeline while the app is closed.
registerSmsHeadlessTask();
registerRootComponent(App);
