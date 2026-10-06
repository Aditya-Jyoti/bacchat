import { resolveProfile, type ProfileView } from '../lib/profile';
import { t } from '../lib/i18n';
import { usePreferences } from '../lib/preferences';
import { useServices } from './AppServicesProvider';

/** The profile to show on Home and in You: the saved name, else the sample person in sample mode. */
export function useProfile(): ProfileView {
  const stored = usePreferences((s) => s.profileName);
  const sample = useServices().isSample();
  return resolveProfile(stored, {
    sample,
    fullName: t('youUi.name'),
    firstName: t('homeUi.sampleFirstName'),
    initial: t('homeUi.initial'),
  });
}
