/**
 * Picks one screenshot from the phone's gallery for the import flow (k4 "From screenshot" to k7).
 * On Android this opens the system photo picker, which needs no storage permission: the app only
 * sees the one image the person chose. Tests swap the picker with setScreenshotPicker.
 */
export type ScreenshotPicker = () => Promise<string | null>;

const systemPicker: ScreenshotPicker = async () => {
  // Required lazily so Jest and web never load the native module.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const ImagePicker = require('expo-image-picker') as typeof import('expo-image-picker');
  const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsMultipleSelection: false, quality: 1 });
  if (res.canceled) return null;
  return res.assets?.[0]?.uri ?? null;
};

let picker: ScreenshotPicker = systemPicker;

/** Replace the picker (tests). Pass null to go back to the system picker. */
export function setScreenshotPicker(next: ScreenshotPicker | null): void {
  picker = next ?? systemPicker;
}

/** The chosen image's uri, or null when the person backed out or the picker failed. */
export async function pickScreenshot(): Promise<string | null> {
  try {
    return await picker();
  } catch {
    return null;
  }
}
