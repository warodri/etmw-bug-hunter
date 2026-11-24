import { readdir, stat } from 'node:fs/promises';
import path from 'node:path';

import { detectLanguage } from './language';
import { isIgnored } from './ignore';

export interface SourceFile {
  readonly absolutePath: string;
  readonly relativePath: string;
  readonly size: number;
  readonly language: string;
}

export interface WalkResult {
  readonly files: SourceFile[];
  readonly skipped: number;
  /** True when the file ceiling was hit; the walk stopped early. */
  readonly truncated: boolean;
}

export interface WalkOptions {
  readonly ignoreList: readonly string[];
  readonly maxFileBytes: number;
  readonly maxFiles: number;
}

/**
 * Collects the analysable files under a project root.
 *
 * Read-only in the strictest sense: this module calls `readdir`/`stat` and nothing else. Symlinked
 * directories are skipped so a link cannot pull the whole disk into a scan or make the walk loop.
 */
export async function walkProject(root: string, options: WalkOptions): Promise<WalkResult> {
  const files: SourceFile[] = [];
  let skipped = 0;
  let truncated = false;

  const queue: string[] = [''];
  const seenDirs = new Set<string>();

  while (queue.length > 0) {
    if (files.length >= options.maxFiles) {
      truncated = true;
      break;
    }

    const relativeDir = queue.shift() as string;
    const absoluteDir = relativeDir ? path.join(root, relativeDir) : root;

    if (seenDirs.has(absoluteDir)) continue;
    seenDirs.add(absoluteDir);

    let entries: import('node:fs').Dirent[];

    try {
      entries = await readdir(absoluteDir, { withFileTypes: true, encoding: 'utf8' });
    } catch {
      skipped += 1;
      continue;
    }

    for (const entry of entries) {
      const relativePath = relativeDir ? `${relativeDir}/${entry.name}` : entry.name;

      if (isIgnored(relativePath, options.ignoreList)) {
        continue;
      }

      if (entry.isSymbolicLink()) {
        continue;
      }

      if (entry.isDirectory()) {
        queue.push(relativePath);
        continue;
      }

      if (!entry.isFile()) continue;

      const language = detectLanguage(entry.name);

      if (!language) continue;

      const absolutePath = path.join(root, relativePath);

      let size = 0;

      try {
        size = (await stat(absolutePath)).size;
      } catch {
        skipped += 1;
        continue;
      }

      if (size === 0 || size > options.maxFileBytes) {
        skipped += 1;
        continue;
      }

      files.push({ absolutePath, relativePath, size, language });

      if (files.length >= options.maxFiles) {
        truncated = true;
        break;
      }
    }
  }

  files.sort((left, right) => left.relativePath.localeCompare(right.relativePath));

  return { files, skipped, truncated };
}
