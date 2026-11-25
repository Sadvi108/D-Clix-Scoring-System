import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Sheet, SheetItem } from '../api/types';
import { calc, missingItems } from './sheetCalc';

const item = (code: string, max = 2): SheetItem => ({ code, label: code, min: 0, max, step: 0.1 });

const recognized: Sheet = {
  sheetCode: 'POOMSAE_RECOGNIZED_V1', formNo: 1, formName: 'Taegeuk 4', total: { decimals: 1 },
  sections: [
    { label: 'Accuracy', max: 4, keys: [{ code: 'ACC_01', label: 'Minor', value: -0.1 }, { code: 'ACC_03', label: 'Major', value: -0.3 }] },
    { label: 'Presentation', items: [item('P1'), item('P2'), item('P3')] },
  ],
};

const freestyle: Sheet = {
  sheetCode: 'POOMSAE_FREESTYLE_V1', formNo: 1, formName: 'Freestyle', total: { decimals: 1 },
  sections: [
    { label: 'Technical', max: 6, items: [item('T1', 1), item('T2', 1)], keys: [{ code: 'D3', label: '−0.3', value: -0.3, target: 'TOTAL' }, { code: 'DP', label: 'Pres', value: -0.1, target: 'PRESENTATION' }] },
    { label: 'Presentation', items: [item('Q1', 1), item('Q2', 1)] },
  ],
};

test('recognized: accuracy max minus deductions, plus presentation', () => {
  const r = calc(recognized, { ded: { ACC_01: 2, ACC_03: 1 }, items: { P1: 1.5, P2: 1.4, P3: 1.3 } });
  assert.deepEqual({ acc: r.acc, pres: r.pres, tot: r.tot, ok: r.ok, ded: r.ded }, { acc: 3.5, pres: 4.2, tot: 7.7, ok: true, ded: 0.5 });
});

test('recognized: an unset item makes it incomplete; accuracy never below 0', () => {
  const r = calc(recognized, { ded: { ACC_03: 20 }, items: { P1: 1 } });
  assert.equal(r.ok, false);
  assert.equal(r.acc, 0);
});

test('freestyle: technical items sum; TOTAL comes off presentation first', () => {
  const r = calc(freestyle, { ded: { D3: 2 }, items: { T1: 0.8, T2: 0.6, Q1: 1.0, Q2: 0.5 } });
  assert.deepEqual({ techSum: r.techSum, presSum: r.presSum, acc: r.acc, pres: r.pres, tot: r.tot }, { techSum: 1.4, presSum: 1.5, acc: 1.4, pres: 0.9, tot: 2.3 });
});

test('freestyle: TOTAL larger than presentation takes the rest off the technical part', () => {
  const r = calc(freestyle, { ded: { D3: 7 }, items: { T1: 0.8, T2: 0.6, Q1: 1.0, Q2: 0.5 } });
  assert.deepEqual({ acc: r.acc, pres: r.pres, tot: r.tot }, { acc: 0.8, pres: 0, tot: 0.8 });
});

test('PRESENTATION target comes off presentation only', () => {
  const r = calc(freestyle, { ded: { DP: 3 }, items: { T1: 1, T2: 1, Q1: 1, Q2: 1 } });
  assert.deepEqual({ acc: r.acc, pres: r.pres }, { acc: 2, pres: 1.7 });
});

test('missingItems counts unset items of both sections for every athlete', () => {
  assert.equal(missingItems(freestyle, [{ ded: {}, items: { T1: 1 } }, { ded: {}, items: {} }]), 7);
  assert.equal(missingItems(recognized, [{ ded: {}, items: { P1: 1, P2: 1, P3: 1 } }]), 0);
});

test('a sheet with fewer than 2 sections is treated as empty instead of throwing', () => {
  const one = { ...recognized, sections: [recognized.sections[0]] } as unknown as Sheet;
  const r = calc(one, { ded: { ACC_01: 1 }, items: {} });
  assert.deepEqual({ acc: r.acc, pres: r.pres, ok: r.ok }, { acc: 3.9, pres: 0, ok: true });
  assert.equal(missingItems(one, [{ ded: {}, items: {} }]), 0);

  const none = { ...recognized, sections: [] } as unknown as Sheet;
  const z = calc(none, { ded: {}, items: {} });
  assert.deepEqual({ acc: z.acc, pres: z.pres, tot: z.tot, ok: z.ok }, { acc: 0, pres: 0, tot: 0, ok: true });
  assert.equal(missingItems(none, [{ ded: {}, items: {} }]), 0);
});
