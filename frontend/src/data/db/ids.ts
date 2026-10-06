let counter = 0;

/** Short unique id such as "e_k3j9x2_1". Not secure; ids are only record keys. */
export function newId(prefix: string): string {
  counter += 1;
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}_${counter}`;
}
