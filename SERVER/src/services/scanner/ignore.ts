import { DEFAULT_GLOBAL_IGNORE_GLOBS } from '../../models/settings.model';

function globToRegExp(pattern: string): RegExp {
  let source = '';

  for (let index = 0; index < pattern.length; index += 1) {
    const char = pattern[index];

    if (char === '*') {
      if (pattern[index + 1] === '*') {
        source += '.*';
        index += 1;
      } else {
        source += '[^/]*';
      }
    } else if (char === '?') {
      source += '[^/]';
    } else {
      source += char.replace(/[.+^${}()|[\]\\]/g, '\\$&');
    }
  }

  return new RegExp(`^${source}$`);
}

/**
 * Directory-relative glob matching.
 *
 * A pattern with a slash is matched against the whole relative path; a bare name such as
 * `node_modules` matches any path segment at any depth, which is what a user means when they type
 * a folder name.
 */
export function matchesGlob(relativePath: string, pattern: string): boolean {
  const trimmed = pattern.trim();

  if (!trimmed) return false;

  const normalised = trimmed.replace(/^\/+/, '').replace(/\/+$/, '');

  if (normalised.includes('/')) {
    return globToRegExp(normalised).test(relativePath);
  }

  if (globToRegExp(normalised).test(relativePath)) return true;

  return relativePath.split('/').some((segment) => globToRegExp(normalised).test(segment));
}

export function buildIgnoreList(projectGlobs: readonly string[], globalGlobs: readonly string[]): string[] {
  const seen = new Set<string>();

  for (const glob of [...DEFAULT_GLOBAL_IGNORE_GLOBS, ...globalGlobs, ...projectGlobs]) {
    const trimmed = glob.trim();
    if (trimmed) seen.add(trimmed);
  }

  return [...seen];
}

export function isIgnored(relativePath: string, ignoreList: readonly string[]): boolean {
  return ignoreList.some((pattern) => matchesGlob(relativePath, pattern));
}
