import { getOrderedCategories } from './categories';
import { getCategorySpreads, getCategorySpreadPath } from './category-layout';

export interface NavigationItem {
  href: string;
  label: string;
  kind: 'section' | 'category';
}

export interface AlbumPage {
  href: string;
  label: string;
  kind: 'cover' | 'back-cover' | 'section' | 'category';
}

export async function getAlbumNavigation(): Promise<NavigationItem[]> {
  const categories = await getOrderedCategories();

  return [
    { href: '/sobre-mi/', label: 'Quién soy', kind: 'section' },
    ...categories.map(({ data }) => ({
      href: `/portfolio/${data.slug}/`,
      label: data.title,
      kind: 'category' as const,
    })),
    { href: '/contacto/', label: 'Contacto', kind: 'section' },
  ];
}

export async function getAlbumPageSequence(): Promise<AlbumPage[]> {
  const categories = await getOrderedCategories();
  const categoryPages = categories.flatMap(({ data }) => {
    const spreads = getCategorySpreads(data.photos);

    return spreads.map((spread) => ({
      href: getCategorySpreadPath(data.slug, spread.index),
      label: spread.index === 0 ? data.title : `${data.title} · ${spread.index + 1}`,
      kind: 'category' as const,
    }));
  });

  return [
    { href: '/', label: 'Portada', kind: 'cover' },
    { href: '/sobre-mi/', label: 'Quién soy', kind: 'section' },
    { href: '/portfolio/', label: 'Índice', kind: 'section' },
    ...categoryPages,
    { href: '/contacto/', label: 'Contacto', kind: 'section' },
    { href: '/contraportada/', label: 'Contraportada', kind: 'back-cover' },
  ];
}
