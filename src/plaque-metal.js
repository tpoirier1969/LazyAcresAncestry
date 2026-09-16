export const PLAQUE_METALS = Object.freeze({
  M: Object.freeze({
    id: 'oil-rubbed-bronze',
    dark: '#2d2116',
    mid: '#5d4329',
    light: '#95704a',
    bright: '#c2a075',
    edge: '#1f160e',
    line: '#1f160e',
    rule: 'rgba(168,125,72,.84)',
  }),
  F: Object.freeze({
    id: 'rose-bronze',
    dark: '#6a3034',
    mid: '#ad535b',
    light: '#dc8487',
    bright: '#efaaa7',
    edge: '#d8d4cf',
    line: '#d8d4cf',
    rule: 'rgba(218,214,207,.90)',
  }),
  U: Object.freeze({
    id: 'aged-pewter',
    dark: '#4e4b46',
    mid: '#87827a',
    light: '#bbb4a8',
    bright: '#ded7cb',
    edge: '#413f3b',
    line: '#413f3b',
    rule: 'rgba(174,168,157,.82)',
  }),
});

export function plaqueMetalForSex(sex) {
  const key = String(sex || 'U').trim().toUpperCase();
  return PLAQUE_METALS[key] || PLAQUE_METALS.U;
}
