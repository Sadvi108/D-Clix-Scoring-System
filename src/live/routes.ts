// Where a signed-in official goes. Plan 3 moves the operator and the chief referee from
// '/ring-status' to their own consoles.
import type { Profile } from '../api/types';

export type Home = '/rings' | '/judge' | '/ring-status';

export function homeFor(p: Profile): Home {
  if (!p.ring) return '/rings';
  if (p.role === 'JUDGE') return p.seat == null ? '/rings' : '/judge';
  return '/ring-status';
}
