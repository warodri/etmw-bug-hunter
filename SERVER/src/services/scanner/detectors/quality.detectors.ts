import { Detector, DetectorContext, Detection, lineDetection } from './types';

const CODE_LANGUAGES = [
  'typescript',
  'javascript',
  'python',
  'php',
  'ruby',
  'go',
  'java',
  'kotlin',
  'swift',
  'csharp',
  'c',
  'cpp',
  'rust',
  'shell'
];

export const emptyCatchDetector: Detector = {
  id: 'bug.empty-catch',
  label: 'Silent catch block',
  category: 'bug',
  severity: 'medium',
  languages: CODE_LANGUAGES,
  detect(context: DetectorContext): Detection[] {
    const found: Detection[] = [];

    context.lines.forEach((line, index) => {
      // `catch {}`, `catch (e) {}` and `catch { /* comment */ }` on one line.
      if (!/catch\s*(\([^)]*\))?\s*\{\s*(\/\/.*|\/\*.*\*\/)?\s*\}/.test(line)) return;

      found.push(
        lineDetection(
          emptyCatchDetector,
          index + 1,
          'An error is swallowed without a log or a fallback. The failure will be invisible in production.',
          line
        )
      );
    });

    return found.slice(0, 15);
  }
};

export const debuggerDetector: Detector = {
  id: 'bug.debugger',
  label: 'Debugger statement',
  category: 'bug',
  severity: 'medium',
  languages: ['typescript', 'javascript'],
  detect(context: DetectorContext): Detection[] {
    const found: Detection[] = [];

    context.lines.forEach((line, index) => {
      if (!/\bdebugger\s*;?/.test(line)) return;

      found.push(
        lineDetection(
          debuggerDetector,
          index + 1,
          'A debugger statement pauses execution when developer tools are open. Remove it before shipping.',
          line
        )
      );
    });

    return found.slice(0, 10);
  }
};

export const todoDetector: Detector = {
  id: 'todo.marker',
  label: 'TODO / FIXME marker',
  category: 'todo',
  severity: 'info',
  languages: null,
  detect(context: DetectorContext): Detection[] {
    const found: Detection[] = [];
    const pattern = /\b(TODO|FIXME|HACK|XXX)\b/;

    context.lines.forEach((line, index) => {
      const match = pattern.exec(line);

      if (!match) return;

      found.push(
        lineDetection(
          todoDetector,
          index + 1,
          `A ${match[1]} marker is left in the code. It is work someone still intends to do.`,
          line
        )
      );
    });

    return found.slice(0, 25);
  }
};

export const consoleStatementDetector: Detector = {
  id: 'style.console',
  label: 'Debug output left in',
  category: 'style',
  severity: 'low',
  languages: ['typescript', 'javascript'],
  detect(context: DetectorContext): Detection[] {
    const found: Detection[] = [];
    const pattern = /\bconsole\.(log|debug|info|warn|error)\s*\(/;

    context.lines.forEach((line, index) => {
      const trimmed = line.trim();

      if (trimmed.startsWith('//') || trimmed.startsWith('*')) return;
      if (!pattern.test(line)) return;

      found.push(
        lineDetection(
          consoleStatementDetector,
          index + 1,
          'A console statement is left in the code. A logger with a level is usually what production needs.',
          line
        )
      );
    });

    return found.slice(0, 20);
  }
};

export const pythonPrintDetector: Detector = {
  id: 'style.print',
  label: 'Print statement left in',
  category: 'style',
  severity: 'low',
  languages: ['python'],
  detect(context: DetectorContext): Detection[] {
    const found: Detection[] = [];

    context.lines.forEach((line, index) => {
      const trimmed = line.trimStart();

      if (trimmed.startsWith('#')) return;
      if (!/^print\s*\(/.test(trimmed)) return;

      found.push(
        lineDetection(
          pythonPrintDetector,
          index + 1,
          'A print() call is left in the code. Use the logging module so output can be controlled.',
          line
        )
      );
    });

    return found.slice(0, 20);
  }
};

export const tsAnyDetector: Detector = {
  id: 'maintainability.ts-any',
  label: 'TypeScript "any"',
  category: 'maintainability',
  severity: 'low',
  languages: ['typescript'],
  detect(context: DetectorContext): Detection[] {
    const found: Detection[] = [];
    const pattern = /:\s*any\b|\bas\s+any\b|<any>/;

    context.lines.forEach((line, index) => {
      const trimmed = line.trim();

      if (trimmed.startsWith('//') || trimmed.startsWith('*')) return;
      if (!pattern.test(line)) return;

      found.push(
        lineDetection(
          tsAnyDetector,
          index + 1,
          '`any` switches type checking off for this value. A real type or `unknown` keeps the compiler useful.',
          line
        )
      );
    });

    return found.slice(0, 20);
  }
};

export const largeFileDetector: Detector = {
  id: 'maintainability.large-file',
  label: 'Very large file',
  category: 'maintainability',
  severity: 'info',
  languages: null,
  detect(context: DetectorContext): Detection[] {
    if (context.lines.length < 700) return [];

    return [
      {
        detectorId: largeFileDetector.id,
        rule: largeFileDetector.label,
        category: largeFileDetector.category,
        severity: largeFileDetector.severity,
        message: `This file has ${context.lines.length} lines. Large files tend to gather unrelated responsibilities.`,
        line: null,
        column: null,
        snippet: ''
      }
    ];
  }
};
