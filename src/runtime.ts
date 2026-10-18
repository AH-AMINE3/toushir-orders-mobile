import { Platform } from 'react-native';
import { Linking } from 'react-native';

export type AppRole = 'MERCHANT' | 'DRIVER' | 'ADMIN';
export const MOBILE_BASE = '/mobile';
export const launchRole = (): AppRole => process.env.EXPO_PUBLIC_APP_ROLE === 'DRIVER' || (Platform.OS === 'web' && /\/driver(?:\/|$)/.test(window.location.pathname)) ? 'DRIVER' : 'MERCHANT';
export const rolePath = (role: AppRole) => role === 'DRIVER' ? `${MOBILE_BASE}/driver` : role === 'ADMIN' ? '/' : `${MOBILE_BASE}/merchant`;
export function navigateRole(role: AppRole) {
  if (Platform.OS !== 'web') return;
  // Preserve only public merchant routes; owner capabilities and auth fragments must be consumed.
  const hash=role==='MERCHANT'&&/^#(?:catalog|favorites|cart|orders|account|offers|messages)$/.test(window.location.hash)?window.location.hash:'';
  window.history.replaceState(null, '', rolePath(role)+hash);
}
export function merchantTab(tab: string) { if (Platform.OS === 'web') window.history.replaceState(null, '', `${MOBILE_BASE}/merchant#${tab}`); }
export function openWholesaler() { return Linking.openURL(Platform.OS === 'web' ? window.location.origin + '/' : (process.env.EXPO_PUBLIC_API_URL || 'http://localhost:5860') + '/'); }
