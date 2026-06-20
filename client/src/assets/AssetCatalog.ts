export type AssetKind =
  | 'card_face'
  | 'card_back'
  | 'avatar'
  | 'background'
  | 'icon'
  | 'effect'
  | 'sfx'
  | 'voice'
  | 'bgm';

export type AssetPackage = 'main' | 'game' | 'room' | 'cdn';

export type AssetDefinition = {
  assetKey: string;
  file: string;
  kind: AssetKind;
  package: AssetPackage;
  licenseId?: string;
};

const colors = ['red', 'yellow', 'blue', 'green'] as const;
const numbers = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'] as const;

export const ASSET_CATALOG: AssetDefinition[] = [
  ...colors.flatMap((color) =>
    numbers.map((value) => ({
      assetKey: `card.${color}.${value}`,
      file: `cards/${color}_${value}.svg`,
      kind: 'card_face' as const,
      package: 'game' as const
    }))
  ),
  ...colors.flatMap((color) =>
    ['skip', 'reverse', 'plus2'].map((type) => ({
      assetKey: `card.${color}.${type}`,
      file: `cards/${color}_${type}.svg`,
      kind: 'card_face' as const,
      package: 'game' as const
    }))
  ),
  { assetKey: 'card.wild.color', file: 'cards/wild_color.svg', kind: 'card_face', package: 'game' },
  { assetKey: 'card.wild.plus4', file: 'cards/wild_plus4.svg', kind: 'card_face', package: 'game' },
  { assetKey: 'card.special.same_color_dump', file: 'cards/special_same_color_dump.svg', kind: 'card_face', package: 'game' },
  { assetKey: 'card.special.balloon', file: 'cards/special_balloon.svg', kind: 'card_face', package: 'game' },
  { assetKey: 'card.special.swap_hand', file: 'cards/special_swap_hand.svg', kind: 'card_face', package: 'game' },
  { assetKey: 'card.special.color_lock', file: 'cards/special_color_lock.svg', kind: 'card_face', package: 'game' },
  { assetKey: 'card_back.default', file: 'cards/card_back_default.svg', kind: 'card_back', package: 'game' },
  { assetKey: 'avatar.player.default', file: 'avatars/player_default.svg', kind: 'avatar', package: 'main' },
  { assetKey: 'avatar.ai.wave', file: 'avatars/ai_wave.svg', kind: 'avatar', package: 'game' },
  { assetKey: 'avatar.ai.spark', file: 'avatars/ai_spark.svg', kind: 'avatar', package: 'game' },
  { assetKey: 'avatar.ai.leaf', file: 'avatars/ai_leaf.svg', kind: 'avatar', package: 'game' },
  { assetKey: 'background.lobby', file: 'backgrounds/lobby_bg.svg', kind: 'background', package: 'main' },
  { assetKey: 'background.table', file: 'backgrounds/table_bg.svg', kind: 'background', package: 'game' },
  { assetKey: 'background.result', file: 'backgrounds/result_bg.svg', kind: 'background', package: 'game' },
  { assetKey: 'icon.coin', file: 'icons/coin.svg', kind: 'icon', package: 'main' },
  { assetKey: 'icon.rank', file: 'icons/rank.svg', kind: 'icon', package: 'main' },
  { assetKey: 'icon.room', file: 'icons/room.svg', kind: 'icon', package: 'main' },
  { assetKey: 'icon.rules', file: 'icons/rules.svg', kind: 'icon', package: 'main' },
  { assetKey: 'icon.settings', file: 'icons/settings.svg', kind: 'icon', package: 'main' }
];

export class AssetCatalog {
  private readonly byKey = new Map(ASSET_CATALOG.map((asset) => [asset.assetKey, asset]));

  get(assetKey: string): AssetDefinition {
    const asset = this.byKey.get(assetKey);
    if (!asset) {
      throw new Error(`asset not found: ${assetKey}`);
    }
    return asset;
  }

  path(assetKey: string): string {
    return this.get(assetKey).file;
  }
}
