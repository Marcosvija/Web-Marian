import { getOrderedCategories } from './categories';

export interface NavigationItem {
  href: string;
  label: string;
  kind: 'section' | 'category';
}

export async function getAlbumNavigation(): Promise<NavigationItem[]> {
  const categories = await getOrderedCategories();

  return [
    { href: '/sobre-mi/', label: 'Quién soy', kind: 'section' },
    { href: '/portfolio/', label: 'Portfolio', kind: 'section' },
    ...categories.map(({ data }) => ({
      href: `/portfolio/${data.slug}/`,
      label: data.title,
      kind: 'category' as const,
    })),
    { href: '/contacto/', label: 'Contacto', kind: 'section' },
  ];
}
