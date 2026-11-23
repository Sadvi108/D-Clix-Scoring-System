// Who is signed in on this device, and where each role goes after signing in.
import type { Href } from 'expo-router';
import type { Account, AccountRole } from '@/core/types';
import type { ScoringSnapshot } from '@/data';

export const ROLE_LABEL: Record<AccountRole, string> = { JUDGE: 'Judge', CHIEF: 'Chief referee', OPERATOR: 'Ring operator' };

/** URL value for each role (/rings?as=…, /sign-in?next=…). */
export const ROLE_PARAM: Record<AccountRole, 'judge' | 'chief' | 'operator'> = { JUDGE: 'judge', CHIEF: 'chief', OPERATOR: 'operator' };
export const roleFromParam = (p: unknown): AccountRole | null =>
  p === 'judge' ? 'JUDGE' : p === 'chief' || p === 'referee' ? 'CHIEF' : p === 'operator' ? 'OPERATOR' : null;

/** Screen each role works on once a ring is chosen. */
export const ROLE_HOME: Record<AccountRole, Href> = { JUDGE: '/judge', CHIEF: '/referee', OPERATOR: '/operator' };

export const accountFor = (s: ScoringSnapshot, role: AccountRole): Account | null => s.accounts.find((a) => a.role === role) ?? null;

/** Ring operator screen: the operator, or the chief referee (who can run any ring). */
export const canOperate = (s: ScoringSnapshot) => s.accounts.some((a) => a.role === 'OPERATOR' || a.role === 'CHIEF');
