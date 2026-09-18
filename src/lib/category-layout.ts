export const MAX_PHOTOS_PER_PAGE = 5;
export const MAX_PHOTOS_PER_SPREAD = MAX_PHOTOS_PER_PAGE * 2;

export interface CategorySpread<T> {
  index: number;
  left: T[];
  right: T[];
}

export function getCategorySpreads<T>(photos: readonly T[]): CategorySpread<T>[] {
  if (photos.length === 0) {
    return [{ index: 0, left: [], right: [] }];
  }

  const spreads: CategorySpread<T>[] = [];

  for (let offset = 0; offset < photos.length; offset += MAX_PHOTOS_PER_SPREAD) {
    const slice = photos.slice(offset, offset + MAX_PHOTOS_PER_SPREAD);
    const leftCount = Math.min(MAX_PHOTOS_PER_PAGE, Math.ceil(slice.length / 2));

    spreads.push({
      index: spreads.length,
      left: slice.slice(0, leftCount),
      right: slice.slice(leftCount),
    });
  }

  return spreads;
}

export function getCategorySpreadPath(slug: string, spreadIndex: number): string {
  const base = `/portfolio/${slug}/`;
  return spreadIndex === 0 ? base : `${base}${spreadIndex + 1}/`;
}
