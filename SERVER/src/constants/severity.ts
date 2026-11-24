/** The one order every screen and the API agree on. */
export const SEVERITY_ORDER = ['critical', 'high', 'medium', 'low', 'info'] as const;

export type Severity = (typeof SEVERITY_ORDER)[number];

export function severityRank(severity: Severity): number {
  return SEVERITY_ORDER.indexOf(severity);
}

/** True when `severity` is at least as serious as `threshold`. */
export function meetsSeverity(severity: Severity, threshold: Severity): boolean {
  return severityRank(severity) <= severityRank(threshold);
}
