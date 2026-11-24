/** Small, explicit readers for process.env. Every value has a documented default. */

export function getOptionalEnv(key: string, fallback: string): string {
  const value = process.env[key];

  return value === undefined || value.trim() === '' ? fallback : value.trim();
}

export function getNumberEnv(key: string, fallback: number): number {
  const raw = process.env[key];

  if (raw === undefined || raw.trim() === '') return fallback;

  const parsed = Number(raw);

  return Number.isFinite(parsed) ? parsed : fallback;
}

export function getBooleanEnv(key: string, fallback: boolean): boolean {
  const raw = process.env[key]?.trim().toLowerCase();

  if (raw === undefined || raw === '') return fallback;
  if (['1', 'true', 'yes', 'on'].includes(raw)) return true;
  if (['0', 'false', 'no', 'off'].includes(raw)) return false;

  return fallback;
}

export function getStringListEnv(key: string, fallback: readonly string[]): string[] {
  const raw = process.env[key];

  if (raw === undefined || raw.trim() === '') return [...fallback];

  return raw
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
}
