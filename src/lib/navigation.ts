import { getOrderedCategories } from './categories';

export interface NavigationItem {
  href: string;
  label: string;
  kind: 'section' | 'category';
}

export interface AlbumPage {
  href: string;
  label: string;
  kind: 'cover' | 'section' | 'category';
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

  return [
    { href: '/', label: 'Portada', kind: 'cover' },
    { href: '/sobre-mi/', label: 'Quién soy', kind: 'section' },
    { href: '/portfolio/', label: 'Índice', kind: 'section' },
    ...categories.map(({ data }) => ({
      href: `/portfolio/${data.slug}/`,
      label: data.title,
      kind: 'category' as const,
    })),
    { href: '/contacto/', label: 'Contacto', kind: 'section' },
  ];
}
