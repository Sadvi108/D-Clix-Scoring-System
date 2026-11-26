// Where a signed-in official goes: judges to their scoring screen, the operator and the chief
// referee to their consoles.
import type { Profile } from '../api/types';

export type Home = '/rings' | '/judge' | '/operator' | '/referee';

export function homeFor(p: Profile): Home {
  if (!p.ring) return '/rings';
  if (p.role === 'JUDGE') return p.seat == null ? '/rings' : '/judge';
  return p.role === 'CHIEF' ? '/referee' : '/operator';
}
