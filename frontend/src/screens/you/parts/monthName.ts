/** Full English month name for a date, such as "October". */
export function monthName(ms: number, offset = 0): string {
  const d = new Date(ms);
  return new Date(d.getFullYear(), d.getMonth() + offset, 1).toLocaleDateString('en-IN', { month: 'long' });
}

/** Short month such as "Oct". */
export function monthShort(ms: number): string {
  return new Date(ms).toLocaleDateString('en-IN', { month: 'short' });
}

/** "31 Oct" */
export function dayMonth(ms: number): string {
  return `${new Date(ms).getDate()} ${monthShort(ms)}`;
}
