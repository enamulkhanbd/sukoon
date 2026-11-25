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
    expect(hidesBottomNav({ type: 'admin', section: 'overview' })).toBe(true);
    expect(hidesBottomNav({ type: 'admin', section: 'duas' })).toBe(true);
  });

  it('parses and builds /admin and section subroutes cleanly', () => {
    expect(parseRoute('/admin', '')).toEqual({ type: 'admin', section: 'overview' });
    expect(parseRoute('/admin/overview', '')).toEqual({ type: 'admin', section: 'overview' });
    expect(parseRoute('/admin/duas', '')).toEqual({ type: 'admin', section: 'duas' });
    expect(parseRoute('/admin/chapters', '')).toEqual({ type: 'admin', section: 'chapters' });
    expect(parseRoute('/admin/routines', '')).toEqual({ type: 'admin', section: 'routines' });
    expect(parseRoute('/admin/surahs', '')).toEqual({ type: 'admin', section: 'surahs' });
    expect(parseRoute('/admin/spotlight', '')).toEqual({ type: 'admin', section: 'featured' });
    expect(parseRoute('/admin/featured', '')).toEqual({ type: 'admin', section: 'featured' });
    expect(parseRoute('/admin/unknown', '')).toEqual({ type: 'admin', section: 'overview' });

    expect(buildPath({ type: 'admin', section: 'overview' })).toBe('/admin');
    expect(buildPath({ type: 'admin', section: 'duas' })).toBe('/admin/duas');
    expect(buildPath({ type: 'admin', section: 'chapters' })).toBe('/admin/chapters');
    expect(buildPath({ type: 'admin', section: 'routines' })).toBe('/admin/routines');
    expect(buildPath({ type: 'admin', section: 'surahs' })).toBe('/admin/surahs');
    expect(buildPath({ type: 'admin', section: 'featured' })).toBe('/admin/spotlight');
  });
});
