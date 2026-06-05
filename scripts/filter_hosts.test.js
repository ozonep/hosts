import test from 'node:test';
import assert from 'node:assert/strict';

import { filterHosts } from './filter_hosts.js';

test('filterHosts keeps metadata, blank lines, and .ru hosts only', () => {
  const sourceText = [
    '!Title: source blocklist',
    '',
    '0.0.0.0 example.ru',
    '0.0.0.0 example.spb.ru',
    '0.0.0.0 tracker.net',
    '0.0.0.0 ads.com',
    '0.0.0.0 mixed-case.RU.',
    '',
  ].join('\n');

  assert.equal(
    filterHosts(sourceText),
    [
      '!Title: source blocklist',
      '',
      '0.0.0.0 example.ru',
      '0.0.0.0 example.spb.ru',
      '0.0.0.0 mixed-case.RU.',
      '',
    ].join('\n'),
  );
});

test('filterHosts reads the hostname from the first host token', () => {
  const sourceText = [
    '0.0.0.0 keep.ru # trailing source comment',
    '0.0.0.0 drop.net # trailing source comment',
  ].join('\n');

  assert.equal(
    filterHosts(sourceText),
    '0.0.0.0 keep.ru # trailing source comment\n',
  );
});

test('filterHosts updates records metadata to the retained host count', () => {
  const sourceText = [
    '!Title: source blocklist',
    '!Records: 999',
    '0.0.0.0 first.ru',
    '0.0.0.0 second.net',
    '0.0.0.0 third.ru',
  ].join('\n');

  assert.equal(
    filterHosts(sourceText),
    [
      '!Title: source blocklist',
      '!Records: 2',
      '0.0.0.0 first.ru',
      '0.0.0.0 third.ru',
      '',
    ].join('\n'),
  );
});
