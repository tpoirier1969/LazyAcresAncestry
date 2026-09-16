export const PLAQUE_METALS = Object.freeze({
  M: Object.freeze({
    id: 'oil-rubbed-bronze',
    dark: '#2b2119',
    mid: '#6f5639',
    light: '#a88c62',
    bright: '#c9ad7a',
    edge: '#1f1812',
    rule: 'rgba(157,126,84,.84)',
  }),
  F: Object.freeze({
    id: 'red-rose-bronze',
    dark: '#5c2d29',
    mid: '#a6574b',
    light: '#d88e78',
    bright: '#efb09a',
    edge: '#48221f',
    rule: 'rgba(205,105,84,.84)',
  }),
  U: Object.freeze({
    id: 'aged-pewter',
    dark: '#4e4b46',
    mid: '#87827a',
    light: '#bbb4a8',
    bright: '#ded7cb',
    edge: '#413f3b',
    rule: 'rgba(174,168,157,.82)',
  }),
});

export function plaqueMetalForSex(sex) {
  const key = String(sex || 'U').trim().toUpperCase();
  return PLAQUE_METALS[key] || PLAQUE_METALS.U;
}
