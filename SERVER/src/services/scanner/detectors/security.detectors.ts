import { Detector, DetectorContext, Detection, lineDetection } from './types';

const SECRET_LANGUAGES = [
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
  'rust',
  'shell',
  'env',
  'json',
  'yaml',
  'toml',
  'properties'
];

const SECRET_ASSIGNMENT =
  /(api[_-]?key|apikey|secret|client[_-]?secret|password|passwd|pwd|token|access[_-]?key|private[_-]?key|auth[_-]?token)\s*[:=]\s*(['"`])([^'"`\s]{8,})\2/i;

const PLACEHOLDERS = [
  'your-',
  'your_',
  'changeme',
  'change-me',
  'placeholder',
  'example',
  'dummy',
  'xxxx',
  '<',
  '${',
  '{{',
  'process.env',
  '***',
  'none',
  'null',
  'undefined',
  'todo'
];

function looksLikePlaceholder(value: string): boolean {
  const lower = value.toLowerCase();

  return PLACEHOLDERS.some((placeholder) => lower.includes(placeholder));
}

export const hardcodedSecretDetector: Detector = {
  id: 'security.hardcoded-secret',
  label: 'Hard-coded credential',
  category: 'security',
  severity: 'high',
  languages: SECRET_LANGUAGES,
  detect(context: DetectorContext): Detection[] {
    const found: Detection[] = [];

    context.lines.forEach((line, index) => {
      if (line.trim().startsWith('//') || line.trim().startsWith('#')) return;

      const match = SECRET_ASSIGNMENT.exec(line);

      if (!match) return;

      const name = match[1];
      const value = match[3];

      if (looksLikePlaceholder(value)) return;

      found.push(
        lineDetection(
          hardcodedSecretDetector,
          index + 1,
          `A value is assigned to "${name}" in the source. Read it from the environment or a secret store instead.`,
          line
        )
      );
    });

    return found.slice(0, 15);
  }
};

export const evalDetector: Detector = {
  id: 'security.eval',
  label: 'Dynamic code execution',
  category: 'security',
  severity: 'high',
  languages: ['typescript', 'javascript', 'python', 'php', 'ruby'],
  detect(context: DetectorContext): Detection[] {
    const found: Detection[] = [];
    const pattern = /\beval\s*\(|\bnew\s+Function\s*\(/;

    context.lines.forEach((line, index) => {
      if (!pattern.test(line)) return;

      found.push(
        lineDetection(
          evalDetector,
          index + 1,
          'Dynamic code execution turns data into code. Prefer a parser or an explicit branch.',
          line
        )
      );
    });

    return found.slice(0, 10);
  }
};

export const sqlInjectionDetector: Detector = {
  id: 'security.sql-injection',
  label: 'String-built SQL query',
  category: 'security',
  severity: 'high',
  languages: ['typescript', 'javascript', 'python', 'php', 'ruby', 'java', 'csharp', 'go'],
  detect(context: DetectorContext): Detection[] {
    const found: Detection[] = [];
    const template = /\b(SELECT|INSERT\s+INTO|UPDATE|DELETE\s+FROM)\b[^;]*\$\{/i;
    const concatenation = /\b(SELECT|INSERT\s+INTO|UPDATE|DELETE\s+FROM)\b[^;]*['"]\s*\+/i;

    context.lines.forEach((line, index) => {
      if (!template.test(line) && !concatenation.test(line)) return;

      found.push(
        lineDetection(
          sqlInjectionDetector,
          index + 1,
          'A SQL statement is assembled from a string. Use parameterised queries so input cannot change the statement.',
          line
        )
      );
    });

    return found.slice(0, 10);
  }
};

export const dangerousHtmlDetector: Detector = {
  id: 'security.dangerous-html',
  label: 'Unsanitised HTML injection',
  category: 'security',
  severity: 'medium',
  languages: ['typescript', 'javascript', 'html'],
  detect(context: DetectorContext): Detection[] {
    const found: Detection[] = [];
    const pattern = /\.innerHTML\s*=|dangerouslySetInnerHTML|\bv-html\b|document\.write\s*\(/;

    context.lines.forEach((line, index) => {
      if (!pattern.test(line)) return;

      found.push(
        lineDetection(
          dangerousHtmlDetector,
          index + 1,
          'HTML is injected as raw markup. Sanitise it first, or bind text instead.',
          line
        )
      );
    });

    return found.slice(0, 10);
  }
};

export const weakCryptoDetector: Detector = {
  id: 'security.weak-hash',
  label: 'Weak hash algorithm',
  category: 'security',
  severity: 'medium',
  languages: ['typescript', 'javascript', 'python', 'php', 'ruby', 'java', 'go', 'csharp'],
  detect(context: DetectorContext): Detection[] {
    const found: Detection[] = [];
    const pattern =
      /createHash\(\s*['"](md5|sha1)['"]\)|hashlib\.(md5|sha1)\s*\(|\b(md5|sha1)\s*\(|MessageDigest\.getInstance\(\s*"(MD5|SHA-?1)"\)/i;

    context.lines.forEach((line, index) => {
      if (!pattern.test(line)) return;

      found.push(
        lineDetection(
          weakCryptoDetector,
          index + 1,
          'MD5 and SHA-1 are broken for security use. Use SHA-256 or a password hash such as bcrypt/argon2.',
          line
        )
      );
    });

    return found.slice(0, 10);
  }
};

export const insecureRandomDetector: Detector = {
  id: 'security.weak-random',
  label: 'Predictable randomness for a secret',
  category: 'security',
  severity: 'medium',
  languages: ['typescript', 'javascript', 'python', 'php', 'ruby', 'java'],
  detect(context: DetectorContext): Detection[] {
    const found: Detection[] = [];
    const pattern =
      /\b(token|secret|otp|nonce|salt|password|code)\b[^=]*=\s*[^;]*(Math\.random|random\.random|rand\s*\()/i;

    context.lines.forEach((line, index) => {
      if (!pattern.test(line)) return;

      found.push(
        lineDetection(
          insecureRandomDetector,
          index + 1,
          'A secret is derived from a non-cryptographic random source. Use crypto.randomBytes / secrets module.',
          line
        )
      );
    });

    return found.slice(0, 10);
  }
};

export const insecureHttpDetector: Detector = {
  id: 'security.insecure-http',
  label: 'Plain HTTP endpoint',
  category: 'security',
  severity: 'low',
  languages: ['typescript', 'javascript', 'python', 'php', 'ruby', 'go', 'java', 'csharp', 'swift', 'json', 'yaml'],
  detect(context: DetectorContext): Detection[] {
    const found: Detection[] = [];
    const pattern = /['"`]http:\/\/(?!localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\])/i;

    context.lines.forEach((line, index) => {
      if (!pattern.test(line)) return;

      found.push(
        lineDetection(
          insecureHttpDetector,
          index + 1,
          'An external endpoint is called over plain HTTP. Use HTTPS so the traffic is encrypted.',
          line
        )
      );
    });

    return found.slice(0, 10);
  }
};
