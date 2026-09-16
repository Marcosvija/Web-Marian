import { getCollection, type CollectionEntry } from 'astro:content';
import { sortCategories } from './category-order';

export { getAdjacentCategories, sortCategories } from './category-order';

export type CategoryEntry = CollectionEntry<'categories'>;

export async function getOrderedCategories(): Promise<CategoryEntry[]> {
  return sortCategories(await getCollection('categories'));
}
