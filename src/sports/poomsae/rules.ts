// Recognized Poomsae rule profile — mirrors MAASUAT RuleSetID 1 (DRAFT).
// Values that are NULL / pending in the database are marked; do not treat them as approved.

export interface DeductionType { code: string; label: string; tenths: number }
/** One judged criterion. Recognized: all PRESENTATION. Freestyle: TECHNICAL (adds up to accuracy/technical max) + PRESENTATION. */
export interface PresentationCriterion { code: string; label: string; short: string; sub?: string; minTenths: number; maxTenths: number; stepTenths: number; group?: 'TECHNICAL' | 'PRESENTATION' }

export interface RuleSet {
  id: number;
  name: string;
  version: number;
  status: 'DRAFT' | 'APPROVED';
  discipline: 'RECOGNIZED' | 'FREESTYLE';
  accuracyMaxTenths: number;
  presentationMaxTenths: number;
  deductions: DeductionType[];
  criteria: PresentationCriterion[];
  judgeCounts: number[];
  defaultJudges: number;
  trimMode: 'PENDING_APPROVAL' | 'APPROVED';
  excludeHigh: number;
  excludeLow: number;
}

export const RECOGNIZED_V1: RuleSet = {
  id: 1,
  name: 'Recognized Standard',
  version: 1,
  status: 'DRAFT',
  discipline: 'RECOGNIZED',
  accuracyMaxTenths: 40,
  presentationMaxTenths: 60,
  deductions: [
    { code: 'ACC_01', label: 'Minor', tenths: 1 },
    { code: 'ACC_03', label: 'Major', tenths: 3 },
  ],
  // 0.0–2.0 in 0.1 steps, as on the judge tablet manual; DB MinPoints/StepPoints are NULL (pending).
  criteria: [
    { code: 'POWER_SPEED', label: 'Speed & Power', short: 'Speed & Power', minTenths: 0, maxTenths: 20, stepTenths: 1 },
    { code: 'RHYTHM_TEMPO', label: 'Rhythm / Tempo / Softness / Power', short: 'Rhythm / Tempo', sub: 'Softness / Power', minTenths: 0, maxTenths: 20, stepTenths: 1 },
    { code: 'ENERGY', label: 'Expression of Energy', short: 'Expression of Energy', minTenths: 0, maxTenths: 20, stepTenths: 1 },
  ],
  judgeCounts: [3, 5, 7],
  defaultJudges: 5,
  trimMode: 'PENDING_APPROVAL',
  excludeHigh: 1,
  excludeLow: 1,
};

const fs = (code: string, label: string, short: string, group: 'TECHNICAL' | 'PRESENTATION', sub?: string): PresentationCriterion =>
  ({ code, label, short, sub, group, minTenths: 0, maxTenths: 10, stepTenths: 1 });

/**
 * Freestyle: Technical skills 6.0 + Presentation 4.0, Cut-off only. Items as on the judge tablet manual (each 0.0–1.0,
 * step 0.1). The judge also taps −0.3 / −0.1 deductions, taken off the total. DRAFT: confirm before go-live.
 */
export const FREESTYLE_V1: RuleSet = {
  id: 2,
  name: 'Freestyle',
  version: 1,
  status: 'DRAFT',
  discipline: 'FREESTYLE',
  accuracyMaxTenths: 60,
  presentationMaxTenths: 40,
  deductions: [
    { code: 'ACC_01', label: 'Minor', tenths: 1 },
    { code: 'ACC_03', label: 'Major', tenths: 3 },
  ],
  criteria: [
    fs('FS_JUMP_SIDE', 'Height of Jump', 'Height of Jump', 'TECHNICAL'),
    fs('FS_JUMP_FRONT', 'Jumping Kicks', 'Jumping Kicks', 'TECHNICAL'),
    fs('FS_SPIN', 'Turn', 'Turn', 'TECHNICAL'),
    fs('FS_CONSECUTIVE', 'Consecutive Kicks', 'Consecutive Kicks', 'TECHNICAL'),
    fs('FS_ACROBATIC', 'Acrobatic', 'Acrobatic', 'TECHNICAL'),
    fs('FS_BASIC', 'Basic', 'Basic', 'TECHNICAL'),
    fs('FS_CREATIVITY', 'Creativeness', 'Creativeness', 'PRESENTATION'),
    fs('FS_HARMONY', 'Harmony', 'Harmony', 'PRESENTATION'),
    fs('FS_ENERGY', 'Expression of Energy', 'Expression of Energy', 'PRESENTATION'),
    fs('FS_MUSIC', 'Music & Choreography', 'Music & Choreography', 'PRESENTATION'),
  ],
  judgeCounts: [3, 5, 7],
  defaultJudges: 5,
  trimMode: 'PENDING_APPROVAL',
  excludeHigh: 1,
  excludeLow: 1,
};

export const isFreestyle = (r: RuleSet) => r.discipline === 'FREESTYLE';
export const technicalCriteria = (r: RuleSet) => r.criteria.filter((c) => c.group === 'TECHNICAL');
export const presentationCriteria = (r: RuleSet) => r.criteria.filter((c) => c.group !== 'TECHNICAL');

export const isConfigured = (r: RuleSet) => r.criteria.length > 0 && r.deductions.length > 0;

/**
 * Game penalties (DRAFT, as in the ring operator demo): taken off the athlete's final score for that form.
 * Over time is given by the chief referee only.
 */
export const PENALTY_TYPES = {
  OVER_TIME: { label: 'Over time', tenths: 3, chiefOnly: true },
  OUT_OF_BOUNDS: { label: 'Out of bounds', tenths: 1, chiefOnly: false },
} as const;
