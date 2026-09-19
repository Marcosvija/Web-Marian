import { getOrderedCategories } from './categories';
import { buildAlbumMap } from './album-map';

export {
  buildAlbumMap,
  getPortfolioEditorialMap,
  type AlbumDestination,
  type AlbumPage,
  type NavigationItem,
  type NavigationKind,
} from './album-map';

export async function getAlbumMap() {
  return buildAlbumMap(await getOrderedCategories());
}
