import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { iconSizes, iconSources, nekurelOgImage, staticIcon } from '../shared/lib/static-icons.ts';

// The pages point at these files; a source added to iconSources without running the script would serve a 404 icon.
test('every pre-rendered icon and the social card are in public/ (run npm run icons after changing a source)', () => {
  const paths = iconSources.flatMap(source => iconSizes.map(size => staticIcon(source, size))).concat(nekurelOgImage);
  assert.deepEqual(paths.filter(path => !existsSync(join(process.cwd(), 'public', path))), []);
});
