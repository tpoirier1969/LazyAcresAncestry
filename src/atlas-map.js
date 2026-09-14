export const ATLAS_TEXTURE_URL = 'https://upload.wikimedia.org/wikipedia/commons/3/3e/Equirectangular-projection-topographic-world.jpg';
export const ATLAS_TEXTURE_SOURCE_PAGE = 'https://commons.wikimedia.org/wiki/File:Equirectangular-projection-topographic-world.jpg';
export const ATLAS_TEXTURE_CREDIT = 'Gundan / mapswire.com, CC BY-SA 4.0';
export const ATLAS_TEXTURE_SHA1 = '2d069905a76447a5de0c11bb02628fb8d8323528';

// A true 8192×4096 equirectangular terrain image restores fine geographic
// detail when the globe is viewed close-up. WebGL implementations limited to
// 4K textures use the Wikimedia 3840px derivative instead of failing the atlas.
export const ATLAS_RELIEF_TEXTURE_URL = 'https://upload.wikimedia.org/wikipedia/commons/0/04/Solarsystemscope_texture_8k_earth_daymap.jpg';
export const ATLAS_RELIEF_TEXTURE_FALLBACK_URL = 'https://thumb.wikimedia.org/wikipedia/commons/thumb/0/04/Solarsystemscope_texture_8k_earth_daymap.jpg/3840px-Solarsystemscope_texture_8k_earth_daymap.jpg';
export const ATLAS_RELIEF_SOURCE_PAGE = 'https://commons.wikimedia.org/wiki/File:Solarsystemscope_texture_8k_earth_daymap.jpg';
export const ATLAS_RELIEF_CREDIT = 'Solar System Scope, CC BY 4.0; based on NASA elevation and imagery data';

// A vector-derived political layer is sampled only for its boundaries. The
// shader extracts edges instead of painting modern country colors onto the
// antique atlas.
export const ATLAS_BOUNDARY_TEXTURE_URL = 'https://thumb.wikimedia.org/wikipedia/commons/thumb/d/df/World_location_map_mono.svg/3840px-World_location_map_mono.svg.png';
export const ATLAS_BOUNDARY_SOURCE_PAGE = 'https://commons.wikimedia.org/wiki/File:World_location_map_mono.svg';
export const ATLAS_BOUNDARY_CREDIT = 'STyx, RicHard-59, Mîḵā\'ēl, SharkD; public domain';

// The home person is geographically anchored in the central Upper Peninsula.
// This is a visual home reference, not a claim that genealogy layout positions
// encode every person's birthplace or residence.
export const ATLAS_HOME_ANCHOR = Object.freeze({
  latitude: 46.55,
  longitude: -87.45,
  label: 'Upper Peninsula, Michigan',
});
