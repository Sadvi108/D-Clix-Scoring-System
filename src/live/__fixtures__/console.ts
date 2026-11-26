// Operator / chief data shaped exactly like UAT (2026-11-26), with sample athletes.
import type { Current, GameOptions, Review, RingState } from '../../api/types';

export const cutoffOpCurrent: Current = {
  gameId: 'g-1', gameNo: 1, method: 'APP', readOnly: false, stage: 'SCORING_OPEN', kind: 'CUTOFF', free: true,
  athletes: [{ corner: 'SOLO', entryId: 6136, name: 'SAMPLE ATHLETE A', team: 'TEAM ONE' }],
  forms: [{ formNo: 1, name: 'Freestyle Poomsae', status: 'SCORING' }, { formNo: 2, name: 'Form 3', status: 'NEXT' }], formNo: 1,
  clock: { state: 'RUNNING', running: true, plannedSec: 90, elapsedMs: 20000, remainingMs: 70000, timeUp: false },
  operatorStart: true, scoringOpen: true, waiting: null, submissions: { sent: 1, total: 3 }, tie: undefined,
  bout: { roundName: 'Final' },
};

export const pkOpCurrent: Current = {
  ...cutoffOpCurrent, gameId: 'g-21', gameNo: 21, kind: 'PK', free: false,
  athletes: [
    { corner: 'BLUE', entryId: 7001, name: 'SAMPLE BLUE', team: 'TEAM BLUE' },
    { corner: 'RED', entryId: 7002, name: 'SAMPLE RED', team: 'TEAM RED' },
  ],
  forms: [{ formNo: 1, name: 'Keumgang', status: 'SCORING' }],
};

export function opState(current: Current | null, patch: Partial<Current> = {}, seats?: RingState['seats']): RingState {
  return {
    changed: true, version: 9, sport: 'POOMSAE', role: 'OPERATOR', seat: null, tournament: { id: 1232, name: 'UAT Tournament' }, ring: 'A', date: '2026-11-26',
    round: { name: 'FINAL' }, category: { name: 'RECOGNIZED INDIVIDUAL WANITA', ageGroup: 'Cadet', gender: 'Female' },
    settings: { swapCorners: false }, display: { mode: 'CALLUP' },
    seats: seats ?? [
      { seat: 1, online: true, status: 'SENT', unsent: 0, device: 'iPad Pro 11-inch (M5)', draft: [], scores: [{ corner: 'SOLO', accuracy: '4.5', presentation: '2.8', total: '7.3' }] },
      { seat: 2, online: true, status: 'DRAFT', unsent: 0, device: 'Tab 2', draft: [{ corner: 'SOLO', accuracy: '4.0', presentation: '1.4' }], scores: [] },
      { seat: 3, online: false, status: 'OFFLINE', unsent: 1, device: 'Tab 3', draft: [], scores: [] },
    ],
    current: current ? { ...current, ...patch } : null,
    previous: [{ gameId: 'g-0', gameNo: 0, label: 'SAMPLE PREVIOUS', kind: 'CUTOFF', stage: 'RELEASED', outcome: 'RELEASED' }],
    next: [{ gameId: 'g-2', gameNo: 2, label: 'SAMPLE NEXT', kind: 'CUTOFF', stage: 'QUEUED' }],
  };
}

export const cutoffReview: Review = {
  gameId: 'g-1', gameNo: 1, stage: 'JUDGES_SENT', kind: 'CUTOFF', pk: null, tie: { state: 'NONE' }, result: [],
  forms: [{ formNo: 1, name: 'Freestyle Poomsae', free: true, athletes: [{
    corner: 'SOLO', name: 'SAMPLE ATHLETE A', team: 'TEAM ONE', status: 'OK', attempt: 1, penalties: [], provisional: '6.97',
    judges: [
      { seat: 1, parts: [{ code: 'ACCURACY', value: '4.5' }, { code: 'PRESENTATION', value: '2.8' }], penalty: '0.0', total: '7.3', counted: true, accCounted: true, presCounted: true, excluded: null, revision: 1, offline: false, receivedAt: '2026-11-26T06:18:54Z' },
      { seat: 2, parts: [{ code: 'ACCURACY', value: '4.1' }, { code: 'PRESENTATION', value: '2.7' }], penalty: '0.0', total: '6.8', counted: true, accCounted: true, presCounted: true, excluded: null, revision: 1, offline: false, receivedAt: '2026-11-26T06:19:10Z' },
      { seat: 3, parts: [{ code: 'ACCURACY', value: '4.1' }, { code: 'PRESENTATION', value: '2.7' }], penalty: '0.0', total: '6.8', counted: false, accCounted: false, presCounted: true, excluded: 'LOW', revision: 1, offline: false, receivedAt: '2026-11-26T06:19:10Z' },
    ] }] }],
};

export const pkReview: Review = {
  gameId: 'g-21', stage: 'JUDGES_SENT', kind: 'PK', tie: { state: 'NONE' }, result: [], forms: [],
  pk: { suggested: 'BLUE', declareMode: 'MANUAL', declared: false, athletes: [
    { corner: 'BLUE', total: '7.40', accuracy: '3.60', presentation: '3.80' },
    { corner: 'RED', total: '7.10', accuracy: '3.50', presentation: '3.60' },
  ] },
};

export const tieReview: Review = {
  ...cutoffReview, tie: { state: 'OPEN', athletes: [
    { entryId: 6136, name: 'SAMPLE ATHLETE A', team: 'TEAM ONE', rank: 3, total: '6.970' },
    { entryId: 6140, name: 'SAMPLE ATHLETE B', team: 'TEAM TWO', rank: 3, total: '6.970' },
  ], forms: [{ formNo: 1, name: 'Freestyle Poomsae' }, { formNo: 2, name: 'Form 3' }] },
};

export const cutoffOptions: GameOptions = {
  gameId: 'g-1', stage: 'JUDGES_SENT', kind: 'CUTOFF', formNo: 1,
  performances: [
    { performanceId: 3876, entryId: 6136, corner: 'SOLO', name: 'SAMPLE ATHLETE A', formNo: 1, formName: 'Freestyle Poomsae', status: 'SUBMITTED', attempt: 1, ruleSetId: 213, restartsUsed: 0, penalties: [] },
    { performanceId: 3877, entryId: 6136, corner: 'SOLO', name: 'SAMPLE ATHLETE A', formNo: 2, formName: 'Form 3', status: 'PENDING', attempt: 1, ruleSetId: 213, restartsUsed: 0, penalties: [] },
  ],
  penaltyTypes: { 213: [
    { code: 'OVERTIME', label: 'Over time', value: '0.3', appliedBy: 'OPERATOR', requireReason: false, max: 1 },
    { code: 'UNDERTIME', label: 'Under time', value: '0.3', appliedBy: 'OPERATOR', requireReason: false, max: 1 },
    { code: 'BOUNDARY', label: 'Crossed boundary line', value: '0.3', appliedBy: 'CHIEF', requireReason: false, max: 1 },
  ] },
  rules: { 213: { restartAllowed: false, maxRestarts: null, restartPenalty: '0.6', disqualifyAt: 2, disqualifyMode: 'AUTO' } },
};
