#!/usr/bin/env node

import { writeFile } from 'node:fs/promises';

export const DEFAULT_SOURCE_URL = 'https://schakal.ru/hosts/alive_hosts_ru_com.txt';
export const DEFAULT_OUTPUT_PATH = 'hosts';
export const ALLOWED_HOST_PATTERN = /\.ru\.?$/i;

export function filterHosts(sourceText) {
  let recordCount = 0;

  const outputLines = sourceText.trimEnd().split(/\r?\n/).flatMap((rawLine) => {
    if (rawLine.startsWith('!')) return [rawLine];

    const trimmed = rawLine.trim();
    if (!trimmed) return [''];

    const parts = trimmed.split(/\s+/);
    if (parts.length < 2) return [];

    if (!ALLOWED_HOST_PATTERN.test(parts[1])) return [];

    recordCount += 1;
    return [rawLine.trimEnd()];
  });

  const outputText = outputLines
    .map((line) => line.startsWith('!Records:') ? `!Records: ${recordCount}` : line)
    .join('\n');

  return `${outputText}\n`;
}

export async function readSourceText() {
  const response = await fetch(DEFAULT_SOURCE_URL, {
    signal: AbortSignal.timeout(30_000),
  });

  if (!response.ok) {
    throw new Error(`Failed to download hosts source: ${response.status} ${response.statusText}`.trim());
  }

  return response.text();
}

export async function main() {
  const sourceText = await readSourceText();
  const filteredText = filterHosts(sourceText);
  await writeFile(DEFAULT_OUTPUT_PATH, filteredText, 'utf8');
}

if (import.meta.main) {
  await main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
