/**
 * Config plugin: copies the white-on-transparent notification icon (assets/notification-icon.png)
 * into res/drawable-xxhdpi/ic_stat_bacchat.png. The native SmsNotifier uses it as the small icon
 * (expo-notifications is not installed, so its own icon option is not available).
 */
const fs = require('fs');
const path = require('path');
const { withDangerousMod } = require('expo/config-plugins');

const DRAWABLE_NAME = 'ic_stat_bacchat';
const SOURCE = 'assets/notification-icon.png';

const withNotificationIcon = (config) =>
  withDangerousMod(config, [
    'android',
    async (c) => {
      const src = path.join(c.modRequest.projectRoot, SOURCE);
      if (!fs.existsSync(src)) return c;
      const dir = path.join(c.modRequest.platformProjectRoot, 'app', 'src', 'main', 'res', 'drawable-xxhdpi');
      fs.mkdirSync(dir, { recursive: true });
      fs.copyFileSync(src, path.join(dir, `${DRAWABLE_NAME}.png`));
      return c;
    },
  ]);

module.exports = withNotificationIcon;
module.exports.DRAWABLE_NAME = DRAWABLE_NAME;
