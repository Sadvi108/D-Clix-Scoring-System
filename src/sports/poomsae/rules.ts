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
  // Min 0.5 and step 0.1 follow the WT judge's score sheet; DB MinPoints/StepPoints are NULL (pending).
  criteria: [
    { code: 'POWER_SPEED', label: 'Power & Speed', short: 'Power & Speed', minTenths: 5, maxTenths: 20, stepTenths: 1 },
    { code: 'RHYTHM_TEMPO', label: 'Coordination of Rhythm & Tempo and Softness & Power', short: 'Rhythm & Tempo', sub: 'Softness & Power', minTenths: 5, maxTenths: 20, stepTenths: 1 },
    { code: 'ENERGY', label: 'Expression of Energy', short: 'Expression of Energy', minTenths: 5, maxTenths: 20, stepTenths: 1 },
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
 * Freestyle: Technical skills 6.0 + Presentation 4.0, Cut-off only. Judges score every item; there are no tap deductions.
 * Items follow the WT Freestyle score sheet (each 0.0–1.0, step 0.1). DRAFT: confirm items and ranges before go-live.
 */
export const FREESTYLE_V1: RuleSet = {
  id: 2,
  name: 'Freestyle',
  version: 1,
  status: 'DRAFT',
  discipline: 'FREESTYLE',
  accuracyMaxTenths: 60,
  presentationMaxTenths: 40,
  deductions: [],
  criteria: [
    fs('FS_JUMP_SIDE', 'Height of jump side kick', 'Jump side kick', 'TECHNICAL', 'Height'),
    fs('FS_JUMP_FRONT', 'Number of front kicks in one jump', 'Jump front kicks', 'TECHNICAL', 'Kicks in one jump'),
    fs('FS_SPIN', 'Gradient of spin kick', 'Spin kick', 'TECHNICAL', 'Degree of rotation'),
    fs('FS_CONSECUTIVE', 'Performance of consecutive kicks', 'Consecutive kicks', 'TECHNICAL'),
    fs('FS_ACROBATIC', 'Acrobatic kicks', 'Acrobatic kicks', 'TECHNICAL'),
    fs('FS_BASIC', 'Basic movements and practicability', 'Basic movements', 'TECHNICAL', 'Practicability'),
    fs('FS_CREATIVITY', 'Creativity', 'Creativity', 'PRESENTATION'),
    fs('FS_HARMONY', 'Harmony', 'Harmony', 'PRESENTATION'),
    fs('FS_ENERGY', 'Expression of energy', 'Expression of energy', 'PRESENTATION'),
    fs('FS_MUSIC', 'Music and choreography', 'Music & choreography', 'PRESENTATION'),
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

export const isConfigured = (r: RuleSet) => r.criteria.length > 0 && (r.discipline === 'FREESTYLE' || r.deductions.length > 0);
