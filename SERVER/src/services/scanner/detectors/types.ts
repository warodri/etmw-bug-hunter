import { Severity } from '../../../constants/severity';
import { IssueCategory } from '../../../models/issue.model';

export interface Detection {
  readonly detectorId: string;
  readonly rule: string;
  readonly category: IssueCategory;
  readonly severity: Severity;
  readonly message: string;
  readonly line: number | null;
  readonly column: number | null;
  readonly snippet: string;
}

export interface DetectorContext {
  readonly relativePath: string;
  readonly language: string;
  readonly content: string;
  readonly lines: readonly string[];
}

export interface Detector {
  readonly id: string;
  readonly label: string;
  readonly category: IssueCategory;
  readonly severity: Severity;
  /** Only run on these languages; `null` means every analysed file. */
  readonly languages: readonly string[] | null;
  detect(context: DetectorContext): Detection[];
}

/** Trim a source line to something readable on one table row. */
export function makeSnippet(line: string): string {
  const trimmed = line.trim();

  return trimmed.length > 220 ? `${trimmed.slice(0, 217)}...` : trimmed;
}

/** A one-shot detection for a matched single line. */
export function lineDetection(
  detector: Detector,
  lineNumber: number,
  message: string,
  snippet: string,
  column: number | null = null
): Detection {
  return {
    detectorId: detector.id,
    rule: detector.label,
    category: detector.category,
    severity: detector.severity,
    message,
    line: lineNumber,
    column,
    snippet: makeSnippet(snippet)
  };
}
