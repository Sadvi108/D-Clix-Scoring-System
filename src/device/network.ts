// How this device reaches the venue network: a USB-C Ethernet cable, Wi-Fi, or nothing.
// The venue LAN usually has no internet, so "connected" means a link exists, not that the
// internet is reachable.
import { NetworkStateType, useNetworkState } from 'expo-network';
import type { PillStatus } from '@/ui/primitives';

export type LinkKind = 'wired' | 'wifi' | 'cellular' | 'other' | 'none' | 'unknown';

export function useLink(): { kind: LinkKind; connected: boolean; label: string } {
  const n = useNetworkState();
  if (n.isConnected === false || n.type === NetworkStateType.NONE) return { kind: 'none', connected: false, label: 'No network' };
  switch (n.type) {
    case NetworkStateType.ETHERNET: return { kind: 'wired', connected: true, label: 'Wired (USB-C Ethernet)' };
    case NetworkStateType.WIFI: return { kind: 'wifi', connected: true, label: 'Wi-Fi' };
    case NetworkStateType.CELLULAR: return { kind: 'cellular', connected: true, label: 'Mobile data' };
    case undefined: return { kind: 'unknown', connected: true, label: 'Checking…' };
    default: return { kind: 'other', connected: true, label: 'Connected' };
  }
}

/** Status pill for the match bar: wired / Wi-Fi / offline, or "sending" while a score is in flight. */
export function useLinkPill(sending = false): PillStatus {
  const { kind, connected } = useLink();
  if (sending) return 'sending';
  if (!connected) return 'offline';
  return kind === 'wired' ? 'wired' : kind === 'wifi' ? 'wifi' : 'online';
}
