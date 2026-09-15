export const PLAQUE_METALS = Object.freeze({
  M: Object.freeze({
    id: 'antique-brass',
    dark: '#573815',
    mid: '#a87629',
    light: '#e1c16d',
    bright: '#f2d98c',
    edge: '#4a2f12',
    rule: 'rgba(205,157,75,.82)',
  }),
  F: Object.freeze({
    id: 'rose-bronze',
    dark: '#60382f',
    mid: '#a86758',
    light: '#d9a18e',
    bright: '#efc0ad',
    edge: '#4e2c27',
    rule: 'rgba(200,126,107,.82)',
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
