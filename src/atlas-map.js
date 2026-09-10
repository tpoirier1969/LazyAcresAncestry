export const ATLAS_TEXTURE_URL = new URL('../assets/antique-atlas-texture.svg', import.meta.url).href;

let cachedTexture = null;

export function getAtlasTexture(onReady) {
  if (cachedTexture) {
    if (cachedTexture.complete && cachedTexture.naturalWidth) onReady?.(cachedTexture);
    return cachedTexture;
  }

  const image = new Image();
  image.decoding = 'async';
  image.src = ATLAS_TEXTURE_URL;
  image.addEventListener('load', () => onReady?.(image), { once: true });
  cachedTexture = image;
  return image;
}
