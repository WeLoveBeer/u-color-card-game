import { AssetCatalog } from './AssetCatalog.js';

export type PlayerCosmeticSelection = {
  selectedCardBackId: string;
  selectedAvatarFrameId?: string;
  selectedTableSkinId?: string;
  selectedVoicePackId?: string;
};

export class SkinResolver {
  constructor(private readonly assets = new AssetCatalog()) {}

  cardBack(selection?: Partial<PlayerCosmeticSelection>): string {
    return this.assets.path(selection?.selectedCardBackId ? `card_back.${selection.selectedCardBackId}` : 'card_back.default');
  }

  tableSkin(selection?: Partial<PlayerCosmeticSelection>): string {
    return selection?.selectedTableSkinId ? this.assets.path(`table.${selection.selectedTableSkinId}`) : this.assets.path('background.table');
  }
}
