import { describe, expect, it } from 'vitest';
import { getAdjacentCategories, sortCategories } from '../../src/lib/category-order';

const categories = [
  { data: { order: 2, slug: 'segunda', title: 'Segunda' } },
  { data: { order: 1, slug: 'primera', title: 'Primera' } },
  { data: { order: 2, slug: 'tercera', title: 'Tercera' } },
];

describe('category navigation', () => {
  it('sorts by order and then by title without mutating content', () => {
    const result = sortCategories(categories);

    expect(result.map(({ data }) => data.slug)).toEqual(['primera', 'segunda', 'tercera']);
    expect(categories[0]?.data.slug).toBe('segunda');
  });

  it('derives the previous and next category from the ordered list', () => {
    const ordered = sortCategories(categories);

    expect(getAdjacentCategories(ordered, 1)).toEqual({
      previous: ordered[0],
      next: ordered[2],
    });
    expect(getAdjacentCategories(ordered, 0)).toEqual({ next: ordered[1] });
    expect(getAdjacentCategories(ordered, 2)).toEqual({ previous: ordered[1] });
  });
});
