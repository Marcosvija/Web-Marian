import { describe, expect, it } from 'vitest';
import { buildAlbumMap } from '../../src/lib/album-map';

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
      categoryIndex: 1,
      spreadIndex: 2,
      navigationLabel: 'Primera · 2',
    });
    expect(map[0]?.kind).toBe('cover');
    expect(map.at(-1)?.kind).toBe('back-cover');
  });
});
