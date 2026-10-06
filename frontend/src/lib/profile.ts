/** Profile display helpers: the name a person typed, or the sample name while the sample notebook is shown. */
export type ProfileView = {
  /** First name, for greetings. Empty when there is none. */
  firstName: string;
  /** Full name for the profile header. Empty when there is none. */
  fullName: string;
  /** One letter for the avatar. */
  initial: string;
  /** True when the person set the name themselves. */
  custom: boolean;
};

/** First character of the name as a capital (works for Devanagari too: no case change there). */
export function initialOf(name: string): string {
  const first = Array.from(name.trim())[0];
  return first ? first.toLocaleUpperCase() : '';
}

export function firstNameOf(name: string): string {
  return name.trim().split(/\s+/)[0] ?? '';
}

/**
 * Resolve what to show. A saved name always wins. With none, the sample notebook shows its sample
 * person and a real notebook shows no name at all (screens then drop the name from the greeting).
 */
export function resolveProfile(
  stored: string,
  sample: { sample: boolean; fullName: string; firstName: string; initial: string },
): ProfileView {
  const name = stored.trim();
  if (name) return { firstName: firstNameOf(name), fullName: name, initial: initialOf(name), custom: true };
  if (sample.sample) return { firstName: sample.firstName, fullName: sample.fullName, initial: sample.initial, custom: false };
  return { firstName: '', fullName: '', initial: '', custom: false };
}
