/**
 * Task 1 gate — brand assets derived by tools/prepare_logo.py.
 *
 * Uses node:test so it can run without a build step. PNG dimensions and colour
 * type are read straight from the IHDR chunk, which avoids pulling in an image
 * library just to assert a handful of numbers.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const PUBLIC_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'public');

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

/** PNG colour types that carry an alpha channel (6 = RGBA, 4 = grey+alpha). */
const ALPHA_COLOUR_TYPES = new Set([4, 6]);

function readPng(name) {
  const buffer = readFileSync(join(PUBLIC_DIR, name));
  assert.ok(
    buffer.subarray(0, 8).equals(PNG_SIGNATURE),
    `${name} is not a valid PNG (bad signature)`,
  );
  // Byte layout after the 8-byte signature: length(4) "IHDR"(4) width(4) height(4) depth(1) colour(1)
  assert.equal(buffer.subarray(12, 16).toString('ascii'), 'IHDR', `${name} lacks an IHDR chunk`);
  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20),
    colourType: buffer.readUInt8(25),
    bytes: buffer.length,
  };
}

describe('brand assets', () => {
  /** [file, expected square size, must have alpha] */
  const EXPECTED = [
    ['logo.png', 512, true],
    ['logo@2x.png', 1024, true],
    ['icon-192.png', 192, true],
    ['icon-512.png', 512, true],
    ['apple-touch-icon.png', 180, false],
    ['favicon-16.png', 16, true],
    ['favicon-32.png', 32, true],
    ['favicon-48.png', 48, true],
  ];

  for (const [name, size, needsAlpha] of EXPECTED) {
    test(`${name} is ${size}x${size} and non-empty`, () => {
      const png = readPng(name);
      assert.equal(png.width, size, `${name} width`);
      assert.equal(png.height, size, `${name} height`);
      assert.ok(png.bytes > 200, `${name} is suspiciously small (${png.bytes} bytes)`);

      if (needsAlpha) {
        assert.ok(
          ALPHA_COLOUR_TYPES.has(png.colourType),
          `${name} must keep an alpha channel so it does not show a white box on dark surfaces ` +
            `(colour type ${png.colourType})`,
        );
      }
    });
  }

  test('favicon.ico exists and bundles multiple resolutions', () => {
    const buffer = readFileSync(join(PUBLIC_DIR, 'favicon.ico'));
    // ICO header: reserved(2)=0, type(2)=1, imageCount(2)
    assert.equal(buffer.readUInt16LE(0), 0, 'ICO reserved field must be 0');
    assert.equal(buffer.readUInt16LE(2), 1, 'ICO type must be 1 (icon)');
    assert.ok(buffer.readUInt16LE(4) >= 3, 'favicon.ico should bundle at least 3 sizes');
  });

  test('og-image.png is exactly 1200x630 for social previews', () => {
    const png = readPng('og-image.png');
    assert.equal(png.width, 1200);
    assert.equal(png.height, 630);
  });

  test('the logo source is vendored so builds do not depend on ~/Downloads', () => {
    const vendored = join(PUBLIC_DIR, '..', 'src', 'assets', 'brand', 'logo-source.jpeg');
    assert.ok(statSync(vendored).size > 1024, 'vendored logo source is missing or truncated');
  });
});
