export interface CategoryLike {
  data: {
    order: number;
    slug: string;
    title: string;
  };
}

export function sortCategories<T extends CategoryLike>(categories: readonly T[]): T[] {
  return [...categories].sort(
    (left, right) =>
      left.data.order - right.data.order ||
      left.data.title.localeCompare(right.data.title, 'es'),
  );
}

export function getAdjacentCategories<T>(
  categories: readonly T[],
  index: number,
): { previous?: T; next?: T } {
  const previous = index > 0 ? categories[index - 1] : undefined;
  const next = index < categories.length - 1 ? categories[index + 1] : undefined;

  return {
    ...(previous ? { previous } : {}),
    ...(next ? { next } : {}),
  };
}
