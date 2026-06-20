import { AssetCatalog } from './AssetCatalog.js';

export class AssetManager {
  constructor(private readonly catalog = new AssetCatalog()) {}

  resolve(assetKey: string): string {
    return `u_color_card_assets/${this.catalog.path(assetKey)}`;
  }
}
