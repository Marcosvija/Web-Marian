import { describe, expect, it } from 'vitest';
import {
  getCategorySpreads,
  getCategorySpreadPath,
  getCategoryPhotoLocations,
  MAX_PHOTOS_PER_PAGE,
  MAX_PHOTOS_PER_SPREAD,
} from '../../src/lib/category-layout';

describe('category editorial spreads', () => {
  it('balances small selections across both pages without exceeding five photos per page', () => {
    const three = getCategorySpreads(['A', 'B', 'C']);
    const five = getCategorySpreads(['A', 'B', 'C', 'D', 'E']);

    expect(three).toEqual([{ index: 0, left: ['A', 'B'], right: ['C'] }]);
    expect(five).toEqual([{ index: 0, left: ['A', 'B', 'C'], right: ['D', 'E'] }]);
    expect(MAX_PHOTOS_PER_PAGE).toBe(5);
  });

  it('uses at most ten photos per spread and continues excess content into another routeable spread', () => {
    const photos = Array.from({ length: 13 }, (_, index) => index + 1);
    const spreads = getCategorySpreads(photos);

    expect(MAX_PHOTOS_PER_SPREAD).toBe(10);
    expect(spreads).toHaveLength(2);
    expect(spreads[0]?.left).toHaveLength(5);
    expect(spreads[0]?.right).toHaveLength(5);
    expect(spreads[1]?.left).toHaveLength(2);
    expect(spreads[1]?.right).toHaveLength(1);
    expect(getCategorySpreadPath('eventos', 0)).toBe('/portfolio/eventos/');
    expect(getCategorySpreadPath('eventos', 1)).toBe('/portfolio/eventos/2/');
  });

  it('keeps an empty category renderable as one stable spread', () => {
    expect(getCategorySpreads([])).toEqual([{ index: 0, left: [], right: [] }]);
  });

  it('maps the canonical photo order across real spreads with image-free metadata', () => {
    const photos = Array.from({ length: 18 }, (_, i) => ({
      id: `photo-${i + 1}`, decorative: false, image: { src: 'must-not-be-serialized.jpg' },
    }));
    expect(getCategoryPhotoLocations('eventos', photos)).toEqual(photos.map((photo, i) => ({
      id: photo.id, position: i + 1, path: i < 10 ? '/portfolio/eventos/' : '/portfolio/eventos/2/',
    })));
  });

  it('leaves decorative images out of the viewer without moving spread boundaries', () => {
    const photos = Array.from({ length: 11 }, (_, i) => ({ id: `p-${i}`, decorative: i === 0 }));
    const locations = getCategoryPhotoLocations('eventos', photos);
    expect(locations).toHaveLength(10);
    expect(locations[0]).toEqual({ id: 'p-1', position: 1, path: '/portfolio/eventos/' });
    expect(locations[9]).toEqual({ id: 'p-10', position: 10, path: '/portfolio/eventos/2/' });
    expect(getCategoryPhotoLocations('vacia', [])).toEqual([]);
  });
});
