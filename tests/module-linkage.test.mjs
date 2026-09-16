import assert from 'node:assert/strict';

const dataModule = await import('../src/data.js');
assert.equal(typeof dataModule.loadFamily, 'function', 'data.js must link successfully and export loadFamily');

const proofModule = await import('../src/proof-family.js');
assert.equal(typeof proofModule.buildProofFamily, 'function', 'proof-family.js must link successfully and export buildProofFamily');

console.log('browser data-module linkage ok');
