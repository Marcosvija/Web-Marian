import { describe, expect, it } from 'vitest';
import { buildAlbumMap, getPortfolioEditorialMap } from '../../src/lib/album-map';

describe('canonical album map', () => {
  it('contains every routeable album destination in one stable order', () => {
    const categories = [
      { data: { slug: 'primera', title: 'Primera', photos: Array.from({ length: 11 }, (_, index) => index) } },
      { data: { slug: 'segunda', title: 'Segunda', photos: [] } },
    ];

    const map = buildAlbumMap(categories);

    expect(map.map(({ href }) => href)).toEqual([
      '/',
      '/sobre-mi/',
      '/portfolio/',
      '/portfolio/primera/',
      '/portfolio/primera/2/',
      '/portfolio/segunda/',
      '/contacto/',
      '/contraportada/',
    ]);
    expect(map.map(({ label }) => label)).toEqual([
      'Portada',
      'Quién soy',
      'Atrapando instantes',
      'Primera',
      'Pliego 2',
      'Segunda',
      'Contacto',
      'Contraportada',
    ]);
    expect(map[4]).toMatchObject({
      kind: 'category',
      categorySlug: 'primera',
      categoryLabel: 'Primera',
      categoryIndex: 1,
      spreadIndex: 2,
      navigationLabel: 'Primera · 2',
    });
    expect(map[0]?.kind).toBe('cover');
    expect(map.at(-1)?.kind).toBe('back-cover');
  });

  it('derives the photographic editorial index from the global album map', () => {
    const map = buildAlbumMap([
      { data: { slug: 'primera', title: 'Primera', photos: Array.from({ length: 11 }, (_, index) => index) } },
      { data: { slug: 'segunda', title: 'Segunda', photos: [] } },
    ]);

    const editorial = getPortfolioEditorialMap(map);

    expect(editorial.map(({ href }) => href)).toEqual([
      '/portfolio/primera/',
      '/portfolio/primera/2/',
      '/portfolio/segunda/',
    ]);
    expect(editorial.map(({ label }) => label)).toEqual(['Primera', 'Pliego 2', 'Segunda']);
    expect(editorial.every((item) => item.categorySlug)).toBe(true);
    expect(editorial.some((item) => item.href === '/portfolio/')).toBe(false);
    expect(editorial.some((item) => item.kind === 'cover' || item.kind === 'back-cover')).toBe(false);
  });
});
