export const ATLAS_TEXTURE_URL = 'https://upload.wikimedia.org/wikipedia/commons/3/3e/Equirectangular-projection-topographic-world.jpg';
export const ATLAS_TEXTURE_SOURCE_PAGE = 'https://commons.wikimedia.org/wiki/File:Equirectangular-projection-topographic-world.jpg';
export const ATLAS_TEXTURE_CREDIT = 'Gundan / mapswire.com, CC BY-SA 4.0';
export const ATLAS_TEXTURE_SHA1 = '2d069905a76447a5de0c11bb02628fb8d8323528';

// Global detail remains an 8192x4096 equirectangular texture so the whole
// sphere is continuously available without a giant decoded image in memory.
export const ATLAS_RELIEF_TEXTURE_URL = 'https://upload.wikimedia.org/wikipedia/commons/0/04/Solarsystemscope_texture_8k_earth_daymap.jpg';
export const ATLAS_RELIEF_TEXTURE_FALLBACK_URL = 'https://thumb.wikimedia.org/wikipedia/commons/thumb/0/04/Solarsystemscope_texture_8k_earth_daymap.jpg/3840px-Solarsystemscope_texture_8k_earth_daymap.jpg';
export const ATLAS_RELIEF_SOURCE_PAGE = 'https://commons.wikimedia.org/wiki/File:Solarsystemscope_texture_8k_earth_daymap.jpg';
export const ATLAS_RELIEF_CREDIT = 'Solar System Scope, CC BY 4.0; based on NASA elevation and imagery data';

// The normal home view spends most of its time over the Great Lakes. Rather
// than stretching the global bitmap farther, request a high-resolution regional
// Level-of-Detail image from NASA GIBS. It is blended into the same sphere UVs
// only inside these geographic bounds, with feathered edges. The WMS service is
// intended for map-image requests and avoids decoding a 20K+ global JPEG in the
// browser merely to sharpen one visible region.
export const ATLAS_REGIONAL_DETAIL_BOUNDS = Object.freeze({
  west: -105,
  south: 35,
  east: -70,
  north: 55,
});
export const ATLAS_REGIONAL_DETAIL_URL = 'https://gibs.earthdata.nasa.gov/wms/epsg4326/best/wms.cgi?version=1.1.1&service=WMS&request=GetMap&format=image/jpeg&styles=&srs=EPSG:4326&bbox=-105,35,-70,55&height=2340&width=4096&layers=BlueMarble_NextGeneration';
export const ATLAS_REGIONAL_DETAIL_SOURCE_PAGE = 'https://science.nasa.gov/earth/earth-observatory/blue-marble-next-generation/base-map/';
export const ATLAS_REGIONAL_DETAIL_CREDIT = 'NASA Earth Observatory Blue Marble: Next Generation, served by NASA GIBS';

// The home person is geographically anchored in the central Upper Peninsula.
// This is a visual home reference, not a claim that genealogy layout positions
// encode every person's birthplace or residence.
export const ATLAS_HOME_ANCHOR = Object.freeze({
  latitude: 46.55,
  longitude: -87.45,
  label: 'Upper Peninsula, Michigan',
});
