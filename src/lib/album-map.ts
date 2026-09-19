import { getCategorySpreads, getCategorySpreadPath } from './category-layout';

export type NavigationKind = 'cover' | 'back-cover' | 'section' | 'category';

export interface AlbumDestination {
  href: string;
  label: string;
  kind: NavigationKind;
  navigationLabel?: string;
  categorySlug?: string;
  categoryLabel?: string;
  categoryIndex?: number;
  spreadIndex?: number;
}

export type NavigationItem = AlbumDestination;
export type AlbumPage = AlbumDestination;

interface AlbumMapCategory {
  data: {
    slug: string;
    title: string;
    photos: readonly unknown[];
  };
}

export function buildAlbumMap(categories: readonly AlbumMapCategory[]): AlbumDestination[] {
  const categoryDestinations = categories.flatMap(({ data }, categoryIndex) =>
    getCategorySpreads(data.photos).map((spread) => ({
      href: getCategorySpreadPath(data.slug, spread.index),
      label: spread.index === 0 ? data.title : `Pliego ${spread.index + 1}`,
      navigationLabel: spread.index === 0 ? data.title : `${data.title} · ${spread.index + 1}`,
      kind: 'category' as const,
      categorySlug: data.slug,
      categoryLabel: data.title,
      categoryIndex: categoryIndex + 1,
      spreadIndex: spread.index + 1,
    })),
  );

  return [
    { href: '/', label: 'Portada', kind: 'cover' },
    { href: '/sobre-mi/', label: 'Quién soy', kind: 'section' },
    { href: '/portfolio/', label: 'Atrapando instantes', navigationLabel: 'Índice', kind: 'section' },
    ...categoryDestinations,
    { href: '/contacto/', label: 'Contacto', kind: 'section' },
    { href: '/contraportada/', label: 'Contraportada', kind: 'back-cover' },
  ];
}


export function getPortfolioEditorialMap(
  items: readonly AlbumDestination[],
): AlbumDestination[] {
  return items.filter((item) => Boolean(item.categorySlug));
}
