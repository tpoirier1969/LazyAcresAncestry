export const ATLAS_TEXTURE_URL = 'https://upload.wikimedia.org/wikipedia/commons/3/3e/Equirectangular-projection-topographic-world.jpg';
export const ATLAS_TEXTURE_SOURCE_PAGE = 'https://commons.wikimedia.org/wiki/File:Equirectangular-projection-topographic-world.jpg';
export const ATLAS_TEXTURE_CREDIT = 'Gundan / mapswire.com, CC BY-SA 4.0';
export const ATLAS_TEXTURE_SHA1 = '2d069905a76447a5de0c11bb02628fb8d8323528';

// An 8K elevation/bathymetry layer restores fine terrain detail when the globe
// is viewed close-up. WebGL implementations limited to 4K textures use the
// Wikimedia 3840px derivative instead of failing the whole atlas.
export const ATLAS_RELIEF_TEXTURE_URL = 'https://thumb.wikimedia.org/wikipedia/commons/thumb/2/2b/World_elevation_map.png/8192px-World_elevation_map.png';
export const ATLAS_RELIEF_TEXTURE_FALLBACK_URL = 'https://thumb.wikimedia.org/wikipedia/commons/thumb/2/2b/World_elevation_map.png/3840px-World_elevation_map.png';
export const ATLAS_RELIEF_SOURCE_PAGE = 'https://commons.wikimedia.org/wiki/File:World_elevation_map.png';
export const ATLAS_RELIEF_CREDIT = 'Avsa / NASA Blue Marble topography and bathymetry, CC BY-SA 4.0';

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
