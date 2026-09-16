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
  /this\.branchCollapseButton\.hidden = false;/,
  'collapse control must remain visible instead of disappearing contextually',
);
assert.match(
  source,
  /No descendants to collapse/,
  'collapse control must explain when the focused person has no descendant branch',
);

console.log('relationship lines remain continuous and collapse controls remain discoverable');
