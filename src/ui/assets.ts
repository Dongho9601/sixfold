export const UI_ASSET_PATHS = {
  forge: '/assets/hlbm/black_iron_forge.png',
  runeTile: '/assets/rune-foundry/rune-tile.svg',
} as const;

export type UiAssetName = keyof typeof UI_ASSET_PATHS;

/**
 * Small eager image cache for the Canvas renderer. Rendering only reads this
 * cache; failed or still-loading images resolve to null and use vector fallbacks.
 */
export class UiAssets {
  private images = new Map<UiAssetName, HTMLImageElement>();

  constructor() {
    for (const [name, path] of Object.entries(UI_ASSET_PATHS) as Array<[UiAssetName, string]>) {
      const image = new Image();
      image.decoding = 'async';
      image.src = path;
      this.images.set(name, image);
    }
  }

  get(name: UiAssetName): HTMLImageElement | null {
    const image = this.images.get(name);
    return image?.complete && image.naturalWidth > 0 ? image : null;
  }
}
