/** Rupee amounts for the model: integer paise in, a plain number with at most 2 decimals out. */
export function rupees(paise: number): number {
  const sign = paise < 0 ? -1 : 1;
  const a = Math.abs(Math.round(paise));
  return sign * Number(`${Math.floor(a / 100)}.${String(a % 100).padStart(2, '0')}`);
}
