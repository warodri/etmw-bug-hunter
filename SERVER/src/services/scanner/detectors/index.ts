import {
  dangerousHtmlDetector,
  evalDetector,
  hardcodedSecretDetector,
  insecureHttpDetector,
  insecureRandomDetector,
  sqlInjectionDetector,
  weakCryptoDetector
} from './security.detectors';
import {
  consoleStatementDetector,
  debuggerDetector,
  emptyCatchDetector,
  largeFileDetector,
  pythonPrintDetector,
  todoDetector,
  tsAnyDetector
} from './quality.detectors';
import { Detector } from './types';

/**
 * Every static rule, in one list.
 *
 * Adding a rule means adding a file beside the others and one entry here; nothing else in the
 * scanner changes. The AI pass, when enabled, adds its findings on top of these.
 */
export const DETECTORS: readonly Detector[] = [
  hardcodedSecretDetector,
  evalDetector,
  sqlInjectionDetector,
  dangerousHtmlDetector,
  weakCryptoDetector,
  insecureRandomDetector,
  insecureHttpDetector,
  emptyCatchDetector,
  debuggerDetector,
  todoDetector,
  consoleStatementDetector,
  pythonPrintDetector,
  tsAnyDetector,
  largeFileDetector
];

export const DETECTOR_COUNT = DETECTORS.length;
