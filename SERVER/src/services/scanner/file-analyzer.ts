import { Severity } from '../../constants/severity';
import { DETECTORS } from './detectors';
import { DetectorContext, Detection } from './detectors/types';
import { SourceFile } from './file-walker';

/** Runs every static rule that applies to this file, de-duplicated by rule and line. */
export function analyseContent(file: SourceFile, content: string): Detection[] {
  const lines = content.split(/\r?\n/);
  const context: DetectorContext = {
    relativePath: file.relativePath,
    language: file.language,
    content,
    lines
  };

  const detections: Detection[] = [];

  for (const detector of DETECTORS) {
    if (detector.languages && !detector.languages.includes(file.language)) continue;

    try {
      detections.push(...detector.detect(context));
    } catch {
      // One broken rule must never abort a scan.
    }
  }

  return dedupe(detections);
}

function dedupe(detections: readonly Detection[]): Detection[] {
  const seen = new Set<string>();
  const unique: Detection[] = [];

  for (const detection of detections) {
    const key = `${detection.detectorId}:${detection.line ?? 'file'}:${detection.message}`;

    if (seen.has(key)) continue;

    seen.add(key);
    unique.push(detection);
  }

  return unique;
}

/** Severity of the worst finding in a list, or null. */
export function worstSeverity(detections: readonly Detection[]): Severity | null {
  const order: Severity[] = ['critical', 'high', 'medium', 'low', 'info'];

  for (const severity of order) {
    if (detections.some((detection) => detection.severity === severity)) return severity;
  }

  return null;
}
