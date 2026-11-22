// Schema migrations (SPEC 5: "on load, if schemaVersion is lower than the app
// version, run a migration function. Never drop user data.")
//
// To change the data model: bump CURRENT_VERSION (and schemaVersion in schema.ts),
// then add MIGRATIONS[old] that turns version `old` data into version `old + 1`.

import type { AppData } from './schema';

export const CURRENT_VERSION = 1;

type Migration = (data: Record<string, unknown>) => Record<string, unknown>;

/** MIGRATIONS[n] upgrades version n to version n + 1. None yet: version 1 is the first. */
export const MIGRATIONS: Record<number, Migration> = {};

export class MigrationError extends Error {}

/**
 * Bring saved data up to the current version. Throws MigrationError when the data is
 * not app data, is from a newer app version, or a migration step is missing.
 */
export function migrate(
  raw: unknown,
  migrations: Record<number, Migration> = MIGRATIONS,
  current: number = CURRENT_VERSION,
): { data: AppData; fromVersion: number } {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new MigrationError('Not app data');
  let data = raw as Record<string, unknown>;
  const fromVersion = data.schemaVersion;
  if (typeof fromVersion !== 'number' || !Number.isInteger(fromVersion) || fromVersion < 0) {
    throw new MigrationError('No schema version');
  }
  if (fromVersion > current) throw new MigrationError(`Saved by a newer app (version ${fromVersion})`);
  for (let v = fromVersion; v < current; v++) {
    const step = migrations[v];
    if (!step) throw new MigrationError(`No migration from version ${v}`);
    data = { ...step(data), schemaVersion: v + 1 };
  }
  return { data: data as unknown as AppData, fromVersion };
}
