/** Extension → language. Anything not listed is not analysed. */
const LANGUAGE_BY_EXTENSION: Record<string, string> = {
  '.ts': 'typescript',
  '.tsx': 'typescript',
  '.mts': 'typescript',
  '.cts': 'typescript',
  '.js': 'javascript',
  '.jsx': 'javascript',
  '.mjs': 'javascript',
  '.cjs': 'javascript',
  '.py': 'python',
  '.php': 'php',
  '.rb': 'ruby',
  '.go': 'go',
  '.java': 'java',
  '.kt': 'kotlin',
  '.kts': 'kotlin',
  '.swift': 'swift',
  '.cs': 'csharp',
  '.c': 'c',
  '.h': 'c',
  '.cpp': 'cpp',
  '.cc': 'cpp',
  '.hpp': 'cpp',
  '.rs': 'rust',
  '.sql': 'sql',
  '.sh': 'shell',
  '.bash': 'shell',
  '.zsh': 'shell',
  '.html': 'html',
  '.htm': 'html',
  '.vue': 'html',
  '.svelte': 'html',
  '.css': 'css',
  '.scss': 'css',
  '.sass': 'css',
  '.less': 'css',
  '.json': 'json',
  '.yml': 'yaml',
  '.yaml': 'yaml',
  '.toml': 'toml',
  '.env': 'env',
  '.properties': 'properties',
  '.md': 'markdown'
};

export function detectLanguage(filePath: string): string | null {
  const lower = filePath.toLowerCase();
  const dot = lower.lastIndexOf('.');

  if (dot === -1) return null;

  // ".env.local" and friends count as env files.
  if (lower.includes('.env')) return 'env';

  return LANGUAGE_BY_EXTENSION[lower.slice(dot)] ?? null;
}

/** Code languages where a debug/TODO/any scan is meaningful. */
export function isCodeLanguage(language: string): boolean {
  return !['json', 'markdown'].includes(language);
}
