import assert from 'node:assert/strict';
import test from 'node:test';

import { analyseContent } from '../src/services/scanner/file-analyzer';
import { matchesGlob } from '../src/services/scanner/ignore';
import { extractJson } from '../src/services/ai-review.service';

function file(relativePath: string, language: string) {
  return { relativePath, absolutePath: relativePath, size: 100, language };
}

test('a hard-coded credential is reported with its line', () => {
  const content = ['const config = {', '  apiKey: "sk-live-9f8e7d6c5b4a3210"', '};'].join('\n');
  const detections = analyseContent(file('config.ts', 'typescript'), content);
  const secret = detections.find((detection) => detection.detectorId === 'security.hardcoded-secret');

  assert.ok(secret);
  assert.equal(secret?.line, 2);
  assert.equal(secret?.severity, 'high');
});

test('a placeholder credential is not reported', () => {
  const content = 'const apiKey = "your-api-key-here";';
  const detections = analyseContent(file('config.ts', 'typescript'), content);

  assert.equal(
    detections.some((detection) => detection.detectorId === 'security.hardcoded-secret'),
    false
  );
});

test('an empty catch and a debugger statement are reported', () => {
  const content = ['try { run(); } catch (error) {}', 'debugger;'].join('\n');
  const detections = analyseContent(file('run.ts', 'typescript'), content);

  assert.ok(detections.some((detection) => detection.detectorId === 'bug.empty-catch'));
  assert.ok(detections.some((detection) => detection.detectorId === 'bug.debugger'));
});

test('a TODO marker is reported but never duplicates on one line', () => {
  const content = '// TODO: TODO remove this';
  const detections = analyseContent(file('notes.ts', 'typescript'), content);
  const todos = detections.filter((detection) => detection.detectorId === 'todo.marker');

  assert.equal(todos.length, 1);
});

test('glob matching works for bare folder names and paths', () => {
  assert.equal(matchesGlob('node_modules/lib/index.js', 'node_modules'), true);
  assert.equal(matchesGlob('src/app/main.ts', 'src/app/**'), true);
  assert.equal(matchesGlob('src/app/main.ts', '*.spec.ts'), false);
  assert.equal(matchesGlob('src/app/main.spec.ts', '*.spec.ts'), true);
});

test('truncated AI JSON is salvaged', () => {
  const answer = '{"issues":[{"line":1,"severity":"high","category":"bug","message":"one"},{"line":2,';
  const parsed = extractJson(answer);

  assert.ok(parsed);
  assert.equal(Array.isArray(parsed?.issues), true);
});
