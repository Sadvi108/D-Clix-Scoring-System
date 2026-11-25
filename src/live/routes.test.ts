import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Profile } from '../api/types';
import { homeFor } from './routes';

const p = (x: Partial<Profile>): Profile => ({ officialId: 1, name: 'A', role: 'JUDGE', tournament: { id: 1, name: 'T' }, ring: null, date: 'd', seat: null, language: 'en', ...x });

test('no ring goes to the ring picker', () => {
  assert.equal(homeFor(p({ role: 'OPERATOR' })), '/rings');
});

test('a judge needs a seat as well as a ring', () => {
  assert.equal(homeFor(p({ ring: 'A' })), '/rings');
  assert.equal(homeFor(p({ ring: 'A', seat: 2 })), '/judge');
});

test('operator and chief with a ring go to work', () => {
  assert.equal(homeFor(p({ role: 'OPERATOR', ring: 'A' })), '/ring-status');
  assert.equal(homeFor(p({ role: 'CHIEF', ring: 'B' })), '/ring-status');
});
