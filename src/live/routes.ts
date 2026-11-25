// Where a signed-in official goes. Plans 2 and 3 replace '/ring-status' with the judge, operator
// and chief work screens.
import type { Profile } from '../api/types';

export type Home = '/rings' | '/ring-status';

export function homeFor(p: Profile): Home {
  if (!p.ring) return '/rings';
  if (p.role === 'JUDGE' && p.seat == null) return '/rings';
  return '/ring-status';
}
