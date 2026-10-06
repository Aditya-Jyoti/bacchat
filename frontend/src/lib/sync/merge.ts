/** Record model and three-way merge used by the sync engine. Pure functions, no I/O. */

export type SyncRecord = {
  id: string;
  /** ISO 8601 time of the last edit. Used by last-writer-wins. */
  updatedAt: string;
  /** Tombstone time. Deleted rows stay in the data set so deletions sync. */
  deletedAt?: string | null;
  [field: string]: unknown;
};

export type DataSetName =
  | 'entries'
  | 'accounts'
  | 'goals'
  | 'budgets'
  | 'categories'
  | 'rules'
  | 'screenshots'
  | 'asks';

export type Resolution = 'local' | 'remote' | 'both';

export interface ConflictSide {
  record: SyncRecord | null;
  /** Last edit (or deletion) time of this side. */
  at: string | null;
  deleted: boolean;
  deviceId?: string;
  deviceName?: string;
}

/**
 * One row both phones changed in different ways. Shaped for the k9 pattern:
 * a = this phone ("keep A"), b = the other phone ("keep B"), plus "both".
 */
export interface SyncConflict {
  id: string;
  blob: DataSetName;
  recordId: string;
  a: ConflictSide;
  b: ConflictSide;
  base: SyncRecord | null;
  /** Field names that differ between a and b (id excluded). */
  changedFields: string[];
  resolution?: Resolution;
}

export function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') {
    const o = value as Record<string, unknown>;
    return `{${Object.keys(o)
      .filter((k) => o[k] !== undefined)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${canonical(o[k])}`)
      .join(',')}}`;
  }
  return JSON.stringify(value) ?? 'null';
}

export function sameRecord(a: SyncRecord | null, b: SyncRecord | null): boolean {
  if (a === null || b === null) return a === b;
  return canonical(a) === canonical(b);
}

export function sortById(records: SyncRecord[]): SyncRecord[] {
  return [...records].sort((x, y) => (x.id < y.id ? -1 : x.id > y.id ? 1 : 0));
}

export function sameSet(a: SyncRecord[], b: SyncRecord[]): boolean {
  return canonical(sortById(a)) === canonical(sortById(b));
}

/** Time a side last changed, counting a deletion as a change. */
export function changeTime(r: SyncRecord | null): string | null {
  if (!r) return null;
  const d = r.deletedAt ?? '';
  return d && d > r.updatedAt ? d : r.updatedAt;
}

function diffFields(a: SyncRecord | null, b: SyncRecord | null): string[] {
  const ra: Record<string, unknown> = a ?? {};
  const rb: Record<string, unknown> = b ?? {};
  const keys = new Set<string>([...Object.keys(ra), ...Object.keys(rb)]);
  keys.delete('id');
  return [...keys].filter((k) => canonical(ra[k]) !== canonical(rb[k])).sort();
}

export interface MergeResult {
  /** Rows that merged cleanly. Conflicting ids are absent until resolved. */
  merged: SyncRecord[];
  conflicts: SyncConflict[];
}

export function threeWayMerge(
  blob: DataSetName,
  base: SyncRecord[],
  local: SyncRecord[],
  remote: SyncRecord[],
): MergeResult {
  const toMap = (rs: SyncRecord[]) => new Map(rs.map((r) => [r.id, r] as const));
  const b = toMap(base);
  const l = toMap(local);
  const r = toMap(remote);
  const ids = new Set<string>([...b.keys(), ...l.keys(), ...r.keys()]);
  const merged: SyncRecord[] = [];
  const conflicts: SyncConflict[] = [];
  for (const id of ids) {
    const bi = b.get(id) ?? null;
    const li = l.get(id) ?? null;
    const ri = r.get(id) ?? null;
    let pick: SyncRecord | null;
    if (sameRecord(li, ri)) pick = li;
    else if (sameRecord(li, bi)) pick = ri;
    else if (sameRecord(ri, bi)) pick = li;
    else {
      conflicts.push({
        id: `${blob}:${id}`,
        blob,
        recordId: id,
        a: { record: li, at: changeTime(li), deleted: !li || !!li.deletedAt },
        b: { record: ri, at: changeTime(ri), deleted: !ri || !!ri.deletedAt },
        base: bi,
        changedFields: diffFields(li, ri),
      });
      continue;
    }
    if (pick) merged.push(pick);
  }
  return { merged: sortById(merged), conflicts };
}

/** Last-writer-wins choice for one conflict. A tie goes to the other phone. */
export function newestSide(c: SyncConflict): Resolution {
  return (c.a.at ?? '') > (c.b.at ?? '') ? 'local' : 'remote';
}

/** Applies resolutions to a merge. "both" keeps the other phone's row and a copy of this phone's. */
export function applyResolutions(merged: SyncRecord[], conflicts: SyncConflict[]): SyncRecord[] {
  const out = [...merged];
  for (const c of conflicts) {
    const choice = c.resolution;
    if (!choice) throw new Error(`Conflict ${c.id} is not resolved`);
    if (choice === 'local' && c.a.record) out.push(c.a.record);
    else if (choice === 'remote' && c.b.record) out.push(c.b.record);
    else if (choice === 'both') {
      if (c.b.record) out.push(c.b.record);
      if (c.a.record) out.push({ ...c.a.record, id: `${c.recordId}~copy` });
    }
  }
  return sortById(out);
}
