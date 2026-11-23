// Prototype data for the committee demo. All names, IDs and scores are samples.
import type { Athlete, AuditEntry, Bout, Category, CategoryRound, EntryScore, Official, Performance, RingPanel } from '@/core/types';

const base = { ring: 'Ring A', clockSec: 0, clockRunning: false, status: 'QUEUED' as const };
const a = (entryId: string, name: string, nat: string): Athlete => ({ entryId, name, nat });

// ---------------- Phase 1–2: categories and rounds ----------------

export const SEED_CATEGORIES: Category[] = [
  { id: 'C-M30', tmsCategoryId: 'TMS-CAT-1102', name: 'Male Under 30', discipline: 'RECOGNIZED', division: 'Individual', mode: 'PK' },
  { id: 'C-F17', tmsCategoryId: 'TMS-CAT-1207', name: 'Female Under 17', discipline: 'RECOGNIZED', division: 'Individual', mode: 'CUTOFF' },
  { id: 'C-M17', tmsCategoryId: 'TMS-CAT-1206', name: 'Male Under 17', discipline: 'RECOGNIZED', division: 'Individual', mode: 'PK_CUTOFF' },
  { id: 'C-M30P', tmsCategoryId: 'TMS-CAT-1110', name: 'Male Over 30', discipline: 'RECOGNIZED', division: 'Individual', mode: 'CUTOFF' },
  { id: 'C-FSP', tmsCategoryId: 'TMS-CAT-1301', name: 'Mixed Pair Freestyle', discipline: 'FREESTYLE', division: 'Pair', mode: 'CUTOFF' },
];

const f = (formNo: number, name: string) => ({ formNo, tmsFormId: `TMS-FRM-${name.toUpperCase().replace(/\s/g, '')}`, name });
const r = (id: string, categoryId: string, name: string, order: number, format: 'PK' | 'CUTOFF', forms: ReturnType<typeof f>[], advanceCount: number | null, status: CategoryRound['status'], ruleSetId = 1): CategoryRound =>
  ({ id, categoryId, name, order, format, ruleSetId, judgeCount: 5, forms, advanceCount, status });

export const SEED_ROUNDS: CategoryRound[] = [
  r('R-M30-16', 'C-M30', 'Round of 16', 1, 'PK', [f(1, 'Keumgang')], 8, 'LIVE'),
  r('R-M30-QF', 'C-M30', 'Quarter-final', 2, 'PK', [f(1, 'Taebaek')], 4, 'SETUP'),
  r('R-M30-SF', 'C-M30', 'Semi-final', 3, 'PK', [f(1, 'Pyongwon')], 2, 'SETUP'),
  r('R-M30-F', 'C-M30', 'Final', 4, 'PK', [f(1, 'Sipjin')], null, 'SETUP'),
  r('R-F17-P', 'C-F17', 'Preliminary', 1, 'CUTOFF', [f(1, 'Taegeuk 7'), f(2, 'Taegeuk 8')], 8, 'LIVE'),
  r('R-F17-S', 'C-F17', 'Semi-final', 2, 'CUTOFF', [f(1, 'Koryo'), f(2, 'Keumgang')], 4, 'SETUP'),
  r('R-F17-F', 'C-F17', 'Final', 3, 'CUTOFF', [f(1, 'Taebaek'), f(2, 'Pyongwon')], null, 'SETUP'),
  r('R-M17-P', 'C-M17', 'Preliminary', 1, 'CUTOFF', [f(1, 'Taegeuk 6'), f(2, 'Taegeuk 7')], 8, 'SCORED'),
  r('R-M17-S', 'C-M17', 'Semi-final', 2, 'CUTOFF', [f(1, 'Koryo'), f(2, 'Taegeuk 8')], 2, 'SETUP'),
  r('R-M17-F', 'C-M17', 'Final', 3, 'PK', [f(1, 'Keumgang')], null, 'SETUP'),
  r('R-M30P-F', 'C-M30P', 'Final', 1, 'CUTOFF', [f(1, 'Taebaek'), f(2, 'Pyongwon')], null, 'CONFIRMED'),
  r('R-FSP-F', 'C-FSP', 'Final', 1, 'CUTOFF', [f(1, 'Freestyle routine')], null, 'LIVE', 2),
];

/** TMS Poomsae forms available to round setup. */
export const TMS_FORMS = ['Taegeuk 1', 'Taegeuk 2', 'Taegeuk 3', 'Taegeuk 4', 'Taegeuk 5', 'Taegeuk 6', 'Taegeuk 7', 'Taegeuk 8', 'Koryo', 'Keumgang', 'Taebaek', 'Pyongwon', 'Sipjin', 'Jitae', 'Chonkwon', 'Hansu', 'Ilyeo'];

// ---------------- Phase 4: ring queue ----------------

const M30 = { category: 'Male Under 30', round: 'Round of 16', roundId: 'R-M30-16', format: 'PK' as const, form: 'Keumgang', formNo: 1, formCount: 1 };
const F17 = { category: 'Female Under 17 · Cut-off', round: 'Preliminary', roundId: 'R-F17-P', format: 'CUTOFF' as const, formCount: 2 };
const NUR = a('E-3025', 'Nur Aisyah binti Rahman', 'MAS');
const pair = (entryId: string, m1: string, m2: string, nat: string): Athlete => ({ entryId, name: `${m1.split(' ').slice(-1)[0]} / ${m2.split(' ').slice(-1)[0]}`, nat, members: [m1, m2] });
const FS_PAIR = pair('E-6011', 'Jiwoo Lee', 'Minho Park', 'KOR');
const FSP = { category: 'Mixed Pair Freestyle', round: 'Final', roundId: 'R-FSP-F', format: 'CUTOFF' as const, form: 'Freestyle routine', formNo: 1, formCount: 1 };

export const SEED_QUEUE: Performance[] = [
  { ...base, ...M30, id: 'P-101', matchNo: '101', chung: a('E-2201', 'Kiyoung Eom', 'KOR'), hong: a('E-2245', 'Changwon Im', 'ARG') },
  { ...base, ...M30, id: 'P-102', matchNo: '102', chung: a('E-2207', 'Dohyun Kang', 'KOR'), hong: a('E-2290', 'Pedro Silva', 'BRA') },
  { ...base, ...F17, id: 'P-012', matchNo: 'P-12', form: 'Taegeuk 7', formNo: 1, chung: NUR },
  { ...base, ...F17, id: 'P-013', matchNo: 'P-13', form: 'Taegeuk 8', formNo: 2, chung: NUR },
  { ...base, ...FSP, id: 'P-014', matchNo: 'F-1', chung: FS_PAIR },
  { ...base, ...M30, id: 'P-103', matchNo: '103', chung: a('E-2231', 'Omar Haddad', 'JOR'), hong: a('E-2266', 'Faris Rahman', 'MAS') },
  { ...base, ...M30, id: 'P-104', matchNo: '104', chung: a('E-2240', 'Hiroto Tanaka', 'JPN'), hong: a('E-2271', 'Lukas Becker', 'GER') },
];

// ---------------- Phase 3: officials and ring panel ----------------

export const SEED_OFFICIALS: Official[] = [
  { officialId: 'TO-1042', name: 'Kim Minjun', nat: 'KOR', licence: 'International', role: 'JUDGE' },
  { officialId: 'TO-2210', name: 'Ahmad Faiz', nat: 'MAS', licence: 'International', role: 'JUDGE' },
  { officialId: 'TO-0877', name: 'Sara Lindqvist', nat: 'SWE', licence: 'International', role: 'JUDGE' },
  { officialId: 'TO-3301', name: 'Rafiq Hossain', nat: 'BAN', licence: 'National', role: 'JUDGE' },
  { officialId: 'TO-1188', name: 'Lucia Ortega', nat: 'ARG', licence: 'International', role: 'JUDGE' },
  { officialId: 'TO-4410', name: 'Yuki Nakamura', nat: 'JPN', licence: 'International', role: 'JUDGE' },
  { officialId: 'TO-5023', name: 'Hassan El-Amin', nat: 'EGY', licence: 'National', role: 'JUDGE' },
  { officialId: 'TO-6120', name: 'Anna Kowalska', nat: 'POL', licence: 'International', role: 'JUDGE' },
  { officialId: 'TO-6604', name: 'Tran Quoc Bao', nat: 'VIE', licence: 'National', role: 'JUDGE' },
  { officialId: 'TO-0101', name: 'Park Jisoo', nat: 'KOR', licence: 'International', role: 'REFEREE' },
  { officialId: 'TO-0450', name: 'Mei Lin Tan', nat: 'SGP', licence: 'National', role: 'OPERATOR' },
];

const seat = (judgeNo: number, officialId: string | null, device: string | null) => ({
  judgeNo, assignmentId: `A-8${judgeNo}`, officialId, deviceName: device, pairedAt: device ? '2026-11-20T08:41:00.000Z' : null, pairingCode: null, pairingExpiresAt: null,
});

export const SEED_PANEL: RingPanel = {
  ringId: 'R-A',
  judgeCount: 5,
  seats: [
    seat(1, 'TO-1042', 'Galaxy Tab · J1'),
    seat(2, 'TO-2210', 'iPad · J2'),
    seat(3, 'TO-0877', 'This device'),
    seat(4, 'TO-3301', 'iPad · J4'),
    seat(5, 'TO-1188', 'Galaxy Tab · J5'),
    seat(6, null, null),
    seat(7, null, null),
  ],
  chiefReferee: 'TO-0101',
  operator: 'TO-0450',
};

/** Demo PIN for every seat. Real PINs are issued per assignment by the chief referee. */
export const DEMO_PIN = '1234';

/** Demo 6-digit PINs, one per role (the PIN decides who signs in). */
export const DEMO_ACCOUNTS: Record<string, { officialId: string; name: string; role: 'JUDGE' | 'CHIEF' | 'OPERATOR' }> = {
  '111111': { officialId: 'TO-0877', name: 'Sara Lindqvist', role: 'JUDGE' },
  '222222': { officialId: 'TO-0450', name: 'Mei Lin Tan', role: 'OPERATOR' },
  '333333': { officialId: 'TO-0101', name: 'Park Jisoo', role: 'CHIEF' },
};

/** Rings of the venue. Ring A runs the sample games; B and C share them in this demo. */
export const SEED_RINGS: { id: string; name: string; operatorIn: boolean; taken: Record<number, string> }[] = [
  { id: 'R-A', name: 'Ring A', operatorIn: true, taken: { 1: 'Kim Minjun', 2: 'Ahmad Faiz', 4: 'Rafiq Hossain', 5: 'Lucia Ortega' } },
  { id: 'R-B', name: 'Ring B', operatorIn: false, taken: {} },
  { id: 'R-C', name: 'Ring C', operatorIn: true, taken: { 1: 'Yuki Nakamura', 2: 'Hassan El-Amin' } },
];
export const DEMO_QR_CODE = 'DEMO-SEAT';

/**
 * Plausible scores for the simulated judges, in tenths: [minor taps, major taps, c1, c2, c3].
 * Index = judgeNo - 1 (7 seats). Kept deterministic so rehearsals match the live demo.
 */
export const SIM_SCORES: Record<string, Record<'chung' | 'hong', number[][]>> = {
  default: {
    chung: [[2, 1, 18, 17, 18], [1, 1, 18, 18, 18], [3, 1, 17, 17, 18], [0, 1, 19, 18, 18], [2, 1, 18, 18, 18], [1, 2, 18, 17, 17], [2, 0, 17, 18, 18]],
    hong: [[1, 0, 19, 18, 18], [2, 1, 17, 17, 18], [1, 1, 18, 18, 18], [0, 0, 19, 19, 18], [1, 1, 18, 17, 18], [2, 1, 18, 18, 17], [1, 1, 17, 18, 18]],
  },
};

// ---------------- Phase 5–7: results already on record ----------------

/** Entries per round (TMSPlayerEntryID). */
export const SEED_ENTRIES: Record<string, Athlete[]> = {
  'R-F17-P': [
    a('E-3001', 'Hana Sato', 'JPN'), a('E-3004', 'Mina Choi', 'KOR'), a('E-3008', 'Léa Moreau', 'FRA'), a('E-3011', 'Sofia Rossi', 'ITA'),
    a('E-3014', 'Ayla Demir', 'TUR'), a('E-3017', 'Nguyen Thi Lan', 'VIE'), a('E-3019', 'Emma Larsen', 'DEN'), a('E-3021', 'Priya Nair', 'IND'),
    a('E-3023', 'Isabela Costa', 'BRA'), NUR, a('E-3027', 'Zara Ahmed', 'BAN'), a('E-3029', 'Chloé Martin', 'CAN'),
  ],
  'R-M17-P': [
    a('E-4001', 'Ali Karimi', 'IRI'), a('E-4003', 'Jun Park', 'KOR'), a('E-4006', 'Diego López', 'MEX'), a('E-4009', 'Tomáš Novák', 'CZE'),
    a('E-4012', 'Ibrahim Musa', 'NGR'), a('E-4015', 'Arjun Mehta', 'IND'), a('E-4018', 'Leo Schmidt', 'GER'), a('E-4021', 'Kenji Mori', 'JPN'),
    a('E-4024', 'Samuel Oduya', 'KEN'), a('E-4027', 'Tariq Aziz', 'PAK'),
  ],
  'R-FSP-F': [
    pair('E-6003', 'Mai Nguyen', 'Duc Tran', 'VIE'), pair('E-6005', 'Sofia Garcia', 'Pablo Ruiz', 'ESP'),
    pair('E-6008', 'Aylin Kaya', 'Emre Yildiz', 'TUR'), FS_PAIR,
  ],
  'R-M30P-F': [
    a('E-5001', 'Seungho Lee', 'KOR'), a('E-5004', 'Marco Bianchi', 'ITA'), a('E-5007', 'Reza Tehrani', 'IRI'), a('E-5010', 'Carlos Ruiz', 'ESP'),
    a('E-5013', 'Daniel Wong', 'HKG'), a('E-5016', 'Mehmet Kaya', 'TUR'), a('E-5019', 'Paul Okafor', 'NGR'), a('E-5022', 'Arif Hakim', 'INA'),
  ],
};

const DAY = '2026-11-20T';
/** Two form scores around an average; `exact` gives both forms the same figures (used for the tie demo). */
function twoForms(roundId: string, entryId: string, avg: number, i: number, exact = false): EntryScore[] {
  const d = exact ? 0 : 0.03 + (i % 3) * 0.01;
  const pres = Math.round(avg * 0.68 * 100) / 100;
  const at = (n: number) => `${DAY}0${7 + n}:${String(10 + i * 3).padStart(2, '0')}:00.000Z`;
  return [
    { roundId, entryId, formNo: 1, final: Math.round((avg + d) * 10000) / 10000, presentation: exact ? 5.2 : pres, performanceId: `P-${entryId}-1`, releasedAt: at(1) },
    { roundId, entryId, formNo: 2, final: Math.round((avg - d) * 10000) / 10000, presentation: exact ? 5.2 : pres, performanceId: `P-${entryId}-2`, releasedAt: at(2) },
  ];
}

const F17_AVG = [8.12, 7.98, 7.86, 7.74, 7.7, 7.62, 7.55, 7.48, 7.4, null, 7.31, 7.22];
const M17_AVG = [8.05, 7.96, 7.88, 7.8, 7.71, 7.63, 7.55, 7.42, 7.42, 7.3];
const M30P_AVG = [8.21, 8.09, 7.97, 7.9, 7.81, 7.7, 7.62, 7.51];

const FS_AVG: [string, number, number][] = [['E-6003', 7.86, 3.24], ['E-6005', 7.62, 3.12], ['E-6008', 7.41, 3.05]];

export const SEED_SCORES: EntryScore[] = [
  ...FS_AVG.map(([entryId, final, presentation], i) => ({ roundId: 'R-FSP-F', entryId, formNo: 1, final, presentation, performanceId: `P-FS-${i}`, releasedAt: `${DAY}09:1${i}:00.000Z` })),
  ...SEED_ENTRIES['R-F17-P'].flatMap((e, i) => (F17_AVG[i] == null ? [] : twoForms('R-F17-P', e.entryId, F17_AVG[i]!, i))),
  ...SEED_ENTRIES['R-M17-P'].flatMap((e, i) => twoForms('R-M17-P', e.entryId, M17_AVG[i], i, i === 7 || i === 8)),
  ...SEED_ENTRIES['R-M30P-F'].flatMap((e, i) => twoForms('R-M30P-F', e.entryId, M30P_AVG[i], i)),
];

const bout = (no: number, order: number, chung: Athlete, hong: Athlete, cf: number | null, hf: number | null): Bout => ({
  roundId: 'R-M30-16', performanceId: `P-${no}`, matchNo: String(no), order, chung, hong, chungFinal: cf, hongFinal: hf,
  winner: cf == null || hf == null ? null : cf > hf ? 'chung' : 'hong',
});

export const SEED_BOUTS: Bout[] = [
  bout(97, 1, a('E-2203', 'Minseo Park', 'KOR'), a('E-2250', 'Ali Rezaei', 'IRI'), 7.86, 7.72),
  bout(98, 2, a('E-2211', 'Thanh Vu', 'VIE'), a('E-2258', 'Ethan Brooks', 'USA'), 7.58, 7.66),
  bout(99, 3, a('E-2215', 'Yusuf Çelik', 'TUR'), a('E-2262', 'Mateo Gómez', 'COL'), 7.91, 7.8),
  bout(100, 4, a('E-2219', 'Rahim Uddin', 'BAN'), a('E-2280', 'Jonas Berg', 'NOR'), 7.44, 7.69),
  ...SEED_QUEUE.filter((p) => p.format === 'PK').map((p, i) => bout(Number(p.matchNo), 5 + i, p.chung, p.hong!, null, null)),
];

const au = (at: string, actor: string, action: string, area: AuditEntry['area'], target: string, detail?: string): AuditEntry =>
  ({ id: `AU-${at}-${action}`, at: `${DAY}${at}.000Z`, actor, action, area, target, detail });

/** Newest first. */
export const SEED_AUDIT: AuditEntry[] = [
  au('08:55:00', 'Chief referee', 'QUALIFY_CONFIRM', 'RESULTS', 'Male Over 30 · Final', 'Final standings confirmed · medals awarded'),
  au('08:54:10', 'Chief referee', 'RELEASE', 'RESULTS', 'Male Over 30 · Final', 'Last entry released'),
  au('08:41:00', 'Admin', 'DEVICE_PAIR', 'SETUP', 'Ring A · J1–J5', '5 devices paired'),
  au('08:30:00', 'Admin', 'PANEL_SIZE', 'SETUP', 'Ring A', 'Panel of 5 judges'),
  au('08:12:00', 'Chief referee', 'RELEASE', 'RESULTS', 'Male Under 17 · Preliminary', 'All 10 entries scored'),
  au('07:30:00', 'Admin', 'ROUND_EDIT', 'SETUP', 'Female Under 17 · Preliminary', 'Forms Taegeuk 7, Taegeuk 8 · 8 advance'),
  au('07:05:00', 'Admin', 'RULESET_EDIT', 'SETUP', 'Recognized Standard v1', 'Loaded from MAASUAT RuleSetID 1 (DRAFT)'),
];
