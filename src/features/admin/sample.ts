// Competition setup is managed in TMS: no setup API exists yet. The admin tabs keep their layout and
// show this fixed sample, read-only, until the backend offers the setup endpoints. All names, IDs
// and figures are samples.
import type { Athlete, Bout, Category, CategoryRound, Official, Performance, RingPanel } from '@/core/types';
import { FREESTYLE_V1, RECOGNIZED_V1, type RuleSet } from '@/sports/poomsae/rules';

export const MANAGED_IN_TMS = 'Managed in TMS';

const base = { ring: 'Ring A', clockSec: 0, clockRunning: false, status: 'QUEUED' as const };
const a = (entryId: string, name: string, nat: string): Athlete => ({ entryId, name, nat });

// ---------------- Rule sets, categories and rounds ----------------

const SAMPLE_RULE_SETS: RuleSet[] = [RECOGNIZED_V1, FREESTYLE_V1];

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

// ---------------- Ring queue ----------------

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

// ---------------- Officials and ring panel ----------------

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

// ---------------- Results on record ----------------

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

export interface SetupSample {
  ring: { id: string; name: string; session: string };
  queue: Performance[];
  setup: { ruleSets: RuleSet[]; categories: Category[]; rounds: CategoryRound[]; officials: Official[]; panel: RingPanel };
  results: { entries: Record<string, Athlete[]>; bouts: Bout[] };
}

const SAMPLE: SetupSample = {
  ring: { id: 'ring-1', name: 'Sample ring', session: 'Sample session' },
  queue: SEED_QUEUE,
  setup: { ruleSets: SAMPLE_RULE_SETS, categories: SEED_CATEGORIES, rounds: SEED_ROUNDS, officials: SEED_OFFICIALS, panel: SEED_PANEL },
  results: { entries: SEED_ENTRIES, bouts: SEED_BOUTS },
};

export const useSetupSample = (): SetupSample => SAMPLE;

type Refused = { ok: false; error: string };
const refuse = async (): Promise<Refused> => ({ ok: false, error: MANAGED_IN_TMS });
/** Same calls the tabs made on the mock; every one is refused. */
export const tms = {
  approveRuleSet: (_id: number) => refuse(),
  updateRuleSet: (_id: number, _patch: unknown) => refuse(),
  updateRound: (_id: string, _patch: unknown) => refuse(),
  setPanelSize: (_n: number) => refuse(),
  assignSeat: (_judgeNo: number, _officialId: string | null) => refuse(),
  pairDevice: (_judgeNo: number) => refuse(),
  unpairDevice: (_judgeNo: number) => refuse(),
};
