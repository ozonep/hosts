#!/usr/bin/env node

import { writeFile } from 'node:fs/promises';

export function normalizeHostname(hostname) {
  return hostname.replace(/\.$/, '').toLowerCase();
}

export function filterHosts(sourceText) {
  const outputLines = sourceText.trimEnd().split(/\r?\n/).flatMap((rawLine) => {
    if (rawLine.startsWith('!')) return [rawLine];
    if (!rawLine.trim()) return [''];

    const parts = rawLine.trim().split(/\s+/);
    if (parts.length < 2) return [];

    const host = normalizeHostname(parts.at(-1));
    return (host.endsWith('.ru') || host.endsWith('.net')) ? [rawLine.trimEnd()] : [];
  });

  return `${outputLines.join('\n')}\n`;
}

export async function readSourceText() {
  const response = await fetch('https://schakal.ru/hosts/alive_hosts_ru_com.txt', {
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
  await writeFile('hosts', filteredText, 'utf8');
}

if (import.meta.main) {
  await main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
