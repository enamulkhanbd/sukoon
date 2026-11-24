import { describe, expect, it } from 'vitest';
import { buildPath, hidesBottomNav, parseRoute } from '../../router';

describe('router profile & legacy URL handling', () => {
  it('parses /profile and legacy /stats to the profile tab', () => {
    expect(parseRoute('/profile', '')).toEqual({ type: 'tab', tab: 'profile' });
    expect(parseRoute('/stats', '')).toEqual({ type: 'tab', tab: 'profile' });
    expect(buildPath({ type: 'tab', tab: 'profile' })).toBe('/profile');
  });

  it('maps legacy /settings cleanly to the home base route', () => {
    expect(parseRoute('/settings', '')).toEqual({ type: 'tab', tab: 'home' });
  });

  it('shows bottom nav on profile tab and hides it on ramadan schedule and admin panel', () => {
    expect(hidesBottomNav({ type: 'tab', tab: 'profile' })).toBe(false);
    expect(hidesBottomNav({ type: 'ramadan' })).toBe(true);
    expect(hidesBottomNav({ type: 'admin' })).toBe(true);
  });

  it('parses and builds /admin cleanly', () => {
    expect(parseRoute('/admin', '')).toEqual({ type: 'admin' });
    expect(buildPath({ type: 'admin' })).toBe('/admin');
  });
});
