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

// Size the atlas against the apparent sphere radius. The texture is deliberately
// large enough to read as a map, while still repeating beyond the viewport so a
// rotation never exposes an untextured patch.
export function atlasTexturePlacement({ yaw, pitch, sphereRadius, imageWidth, imageHeight }) {
  const height = sphereRadius * 0.78;
  const width = height * Math.max(1, imageWidth / Math.max(1, imageHeight));
  const xShift = -(yaw / (Math.PI * 2)) * width;
  const yShift = pitch * height * 0.18;
  return { width, height, xShift, yShift };
}
