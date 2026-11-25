// Sample sheets and ring states shaped like the D-Clix API (OpenAPI 1.3.4 + the web app). Used by
// tests and the dev preview until real UAT responses are captured on test day.
import type { Current, RingState, Sheet } from '../../api/types';

export const recognizedSheet: Sheet = {
  sheetCode: 'POOMSAE_RECOGNIZED_V1', formNo: 1, formName: 'Keumgang', total: { max: 10, decimals: 1 },
  sections: [
    { code: 'ACCURACY', label: 'Accuracy', max: 4, keys: [
      { code: 'ACC_03', label: 'Major', value: -0.3 },
      { code: 'ACC_01', label: 'Minor', value: -0.1 },
    ] },
    { code: 'PRESENTATION', label: 'Presentation', items: [
      { code: 'PRES_SP', label: 'Speed & Power', min: 0, max: 2, step: 0.1 },
      { code: 'PRES_RT', label: 'Rhythm / Tempo', hint: 'Softness / Power', min: 0, max: 2, step: 0.1 },
      { code: 'PRES_EE', label: 'Expression of Energy', min: 0, max: 2, step: 0.1 },
    ] },
  ],
};

export const freestyleSheet: Sheet = {
  sheetCode: 'POOMSAE_FREESTYLE_V1', formNo: 1, formName: 'Freestyle routine', total: { max: 10, decimals: 1 },
  sections: [
    { code: 'TECHNICAL', label: 'Technical skills', max: 6,
      items: [
        { code: 'T_HJ', label: 'Height of Jump', min: 0, max: 1, step: 0.1 },
        { code: 'T_JK', label: 'Jumping Kicks', min: 0, max: 1, step: 0.1 },
        { code: 'T_TN', label: 'Turn', min: 0, max: 1, step: 0.1 },
        { code: 'T_CK', label: 'Consecutive Kicks', min: 0, max: 1, step: 0.1 },
        { code: 'T_AC', label: 'Acrobatic', min: 0, max: 1, step: 0.1 },
        { code: 'T_BA', label: 'Basic', min: 0, max: 1, step: 0.1 },
      ],
      keys: [
        { code: 'FS_03', label: '−0.3', value: -0.3, target: 'TOTAL' },
        { code: 'FS_01', label: '−0.1', value: -0.1, target: 'TOTAL' },
      ] },
    { code: 'PRESENTATION', label: 'Presentation', items: [
      { code: 'P_CR', label: 'Creativeness', min: 0, max: 1, step: 0.1 },
      { code: 'P_HA', label: 'Harmony', min: 0, max: 1, step: 0.1 },
      { code: 'P_EE', label: 'Expression of Energy', min: 0, max: 1, step: 0.1 },
      { code: 'P_MC', label: 'Music & Choreography', min: 0, max: 1, step: 0.1 },
    ] },
  ],
};

export const pkCurrent: Current = {
  gameId: 'g-101', gameNo: 101, method: 'APP', kind: 'PK', stage: 'SCORING_OPEN', scoringOpen: true, waiting: null,
  athletes: [
    { corner: 'BLUE', entryId: 2201, name: 'Kiyoung Eom', team: 'KOR' },
    { corner: 'RED', entryId: 2245, name: 'Changwon Im', team: 'ARG' },
  ],
  forms: [{ formNo: 1, name: 'Keumgang' }], formNo: 1,
  clock: { state: 'RUNNING', running: true, remainingMs: 60000, elapsedMs: 30000 },
  my: { sent: false },
};

export const cutoffCurrent: Current = {
  ...pkCurrent, gameId: 'g-12', gameNo: 12, kind: 'CUTOFF',
  athletes: [{ corner: 'SOLO', entryId: 3025, name: 'Nur Aisyah binti Rahman', team: 'MAS' }],
  forms: [{ formNo: 1, name: 'Taegeuk 7' }, { formNo: 2, name: 'Taegeuk 8' }],
};

export const freestyleCurrent: Current = {
  ...pkCurrent, gameId: 'g-14', gameNo: 14, kind: 'CUTOFF', free: true,
  athletes: [{ corner: 'SOLO', entryId: 6011, name: 'Lee / Park', team: 'KOR', members: ['Jiwoo Lee', 'Minho Park'] }],
  forms: [{ formNo: 1, name: 'Freestyle routine' }],
};

/** A judge's ring state around a current game (null = no game on the ring). */
export function ringState(current: Current | null, patch: Partial<Current> = {}): RingState {
  return {
    changed: true, version: 10, sport: 'POOMSAE', tournament: { id: 1, name: 'UAT Open' }, ring: 'A', date: '2026-11-26',
    round: { name: 'Round of 16' }, category: { name: 'Individual Male', ageGroup: 'Senior', gender: 'Male' },
    settings: { swapCorners: false }, display: { mode: 'LIVECLOCK' }, role: 'JUDGE', seat: 2,
    seats: [{ seat: 1, online: true }, { seat: 2, online: true }, { seat: 3, online: true }],
    current: current ? { ...current, ...patch } : null,
    next: [{ gameId: 'g-102', gameNo: 102, label: 'Kang vs Silva' }],
  };
}
