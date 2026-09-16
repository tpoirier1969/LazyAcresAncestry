import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync(new URL('../src/scene.js', import.meta.url), 'utf8');

assert.doesNotMatch(
  source,
  /if \(moving \|\| gap > RELATIONSHIP_OVERVIEW_HIDE_GAP\) return;/,
  'relationship lines must not disappear merely because the globe is moving or zoomed out',
);
assert.match(
  source,
  /drawRelationships\(camera\) \{[\s\S]*?super\.drawRelationships\(camera\);[\s\S]*?\}/,
  'scene must continue delegating relationship drawing at all camera states',
);
assert.match(
  source,
  /drawBranchControls\(\)/,
  'branch expansion must be rendered on the tree rather than hidden in an unrelated panel',
);
assert.match(
  source,
  /action === 'expand'/,
  'inline branch controls must distinguish expansion arrows',
);
assert.match(
  source,
  /action === 'collapse'/,
  'inline branch controls must support folding manually expanded branches back up',
);
assert.match(
  source,
  /chevrons expand branches/,
  'the compact tree status must explain the inline chevron interaction',
);
assert.doesNotMatch(
  source,
  /branchCollapseButton|Collapse descendants/,
  'the obsolete toolbar-style collapse interaction must not remain active',
);

console.log('relationship lines remain continuous and inline branch chevrons own expand/collapse interaction');
