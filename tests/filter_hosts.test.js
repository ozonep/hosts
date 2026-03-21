import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';

const currentFilePath = fileURLToPath(import.meta.url);
const currentDir = path.dirname(currentFilePath);
const repoRoot = path.resolve(currentDir, '..');
const scriptPath = path.join(repoRoot, 'scripts', 'filter_hosts.js');
const scriptUrl = pathToFileURL(scriptPath).href;

async function loadScriptModule() {
  return import(scriptUrl);
}

test('filterHosts normalizes blank lines and trailing newline', async () => {
  const moduleUnderTest = await loadScriptModule();

  const source = ['!Header', '', '0.0.0.0 keep.example.net   ', ''].join('\n');

  assert.equal(
    moduleUnderTest.filterHosts(source),
    ['!Header', '', '0.0.0.0 keep.example.net', ''].join('\n'),
  );
});

test('filterHosts strips only one optional trailing dot for matching', async () => {
  const moduleUnderTest = await loadScriptModule();

  assert.equal(moduleUnderTest.filterHosts('0.0.0.0 odd.example.net..\n'), '\n');
});

test('filterHosts keeps metadata blank lines and matching tlds', async () => {
  const moduleUnderTest = await loadScriptModule();

  const source = [
    '!Title: Example list',
    '!Last modified: 20 Mar 2026 00:00 UTC',
    '',
    '127.0.0.1 localhost',
    '0.0.0.0 ads.example.com',
    '0.0.0.0 tracker.example.ru',
    '0.0.0.0 cdn.example.net',
    '0.0.0.0 MixedCase.Example.RU.',
    '',
  ].join('\n');

  const expected = [
    '!Title: Example list',
    '!Last modified: 20 Mar 2026 00:00 UTC',
    '',
    '0.0.0.0 tracker.example.ru',
    '0.0.0.0 cdn.example.net',
    '0.0.0.0 MixedCase.Example.RU.',
    '',
  ].join('\n');

  assert.equal(moduleUnderTest.filterHosts(source), expected);
});

test('filterHosts ignores malformed non-comment lines', async () => {
  const moduleUnderTest = await loadScriptModule();

  const source = ['!Header', 'invalid-only-one-token', '0.0.0.0 example.org', '0.0.0.0 good.example.net', ''].join(
    '\n',
  );

  const expected = ['!Header', '0.0.0.0 good.example.net', ''].join('\n');

  assert.equal(moduleUnderTest.filterHosts(source), expected);
});

test('filterHosts ignores matching hostname when trailing token is non-matching', async () => {
  const moduleUnderTest = await loadScriptModule();

  assert.equal(moduleUnderTest.filterHosts('0.0.0.0 example.ru # inline comment\n'), '\n');
});

test('readSourceText downloads the remote source with fetch when no input path is provided', async () => {
  const moduleUnderTest = await loadScriptModule();

  let capturedUrl;
  let capturedOptions;
  const originalFetch = globalThis.fetch;

  globalThis.fetch = async (url, options) => {
    capturedUrl = url;
    capturedOptions = options;

    return {
      ok: true,
      async text() {
        return 'remote hosts data\n';
      },
    };
  };

  try {
    const sourceText = await moduleUnderTest.readSourceText();

    assert.equal(sourceText, 'remote hosts data\n');
    assert.equal(capturedUrl, moduleUnderTest.DEFAULT_SOURCE_URL);
    assert.equal(typeof capturedOptions, 'object');
    assert.ok(capturedOptions.signal instanceof AbortSignal);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('package declares Node.js 22+ as the minimum supported runtime', () => {
  const packageJsonPath = path.join(repoRoot, 'package.json');
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));

  assert.equal(packageJson.engines.node, '>=22');
});

test('writeOutput preserves LF newlines', async () => {
  const moduleUnderTest = await loadScriptModule();

  const tmpdir = fs.mkdtempSync(path.join(os.tmpdir(), 'filter-hosts-'));
  const outputPath = path.join(tmpdir, 'hosts');

  try {
    await moduleUnderTest.writeOutput(outputPath, 'line1\nline2\n');

    assert.deepEqual(fs.readFileSync(outputPath), Buffer.from('line1\nline2\n'));
  } finally {
    fs.rmSync(tmpdir, { recursive: true, force: true });
  }
});

test('cli reads local input and writes output', () => {
  const tmpdir = fs.mkdtempSync(path.join(os.tmpdir(), 'filter-hosts-'));
  const inputPath = path.join(tmpdir, 'source.txt');
  const outputPath = path.join(tmpdir, 'hosts');

  try {
    fs.writeFileSync(inputPath, '0.0.0.0 keep.example.net\n', 'utf8');

    const result = spawnSync(process.execPath, [scriptPath, '--input', inputPath, '--output', outputPath], {
      encoding: 'utf8',
    });

    assert.equal(result.status, 0, result.stderr || result.stdout);
    assert.equal(fs.readFileSync(outputPath, 'utf8'), '0.0.0.0 keep.example.net\n');
  } finally {
    fs.rmSync(tmpdir, { recursive: true, force: true });
  }
});

test('module exposes native esm named exports without a CommonJS default export object', () => {
  const result = spawnSync(
    process.execPath,
    [
      '--input-type=module',
      '--eval',
      `
        const moduleUnderTest = await import(${JSON.stringify(scriptUrl)});
        if ('default' in moduleUnderTest) {
          console.error('unexpected default export');
          process.exit(1);
        }
        if (typeof moduleUnderTest.filterHosts !== 'function') {
          console.error('missing named filterHosts export');
          process.exit(1);
        }
      `,
    ],
    { encoding: 'utf8' },
  );

  assert.equal(result.status, 0, result.stderr || result.stdout);
});
