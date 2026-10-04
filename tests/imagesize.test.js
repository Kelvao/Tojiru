const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const { loadScripts } = require("./load");

const { readImageSize } = loadScripts(["src/infrastructure/imagesize.js"]).infra.imagesize;

const fixture = (name) => new Uint8Array(fs.readFileSync(path.join(__dirname, "fixtures", name)));

function readerOf(bytes) {
  const calls = [];
  const read = async (offset, length) => {
    calls.push([offset, length]);
    return bytes.slice(offset, offset + length);
  };
  return { read, calls };
}

const sizeOf = (bytes) => readImageSize(readerOf(bytes).read);

test("reads dimensions from JPEG, PNG, GIF and WebP headers", async () => {
  const expected = {
    "baseline.jpg": { width: 33, height: 17 },
    "progressive.jpg": { width: 40, height: 30 },
    "gray.jpg": { width: 21, height: 13 },
    "exif-upright.jpg": { width: 40, height: 20 },
    "image.png": { width: 19, height: 11 },
    "alpha.png": { width: 19, height: 11 },
    "image.gif": { width: 9, height: 7 },
    "lossy.webp": { width: 50, height: 31 },
    "lossless.webp": { width: 50, height: 31 },
    "alpha.webp": { width: 50, height: 31 },
    "animated.webp": { width: 30, height: 20 },
  };
  for (const [name, size] of Object.entries(expected)) assert.deepEqual(await sizeOf(fixture(name)), size, name);
});

test("JPEGs whose EXIF orientation swaps the axes are left to a real decode", async () => {
  assert.equal(await sizeOf(fixture("exif-rotated.jpg")), null);
});

test("finds the JPEG frame header behind large segments with few reads", async () => {
  const jpeg = fixture("gray.jpg");
  const segment = (fill) => {
    const body = new Uint8Array(35000).fill(fill);
    const header = Uint8Array.of(0xff, 0xe2, (35002 >> 8) & 0xff, 35002 & 0xff);
    return Uint8Array.from([...header, ...body]);
  };
  const padded = Uint8Array.from([...jpeg.subarray(0, 2), ...segment(1), ...segment(2), ...jpeg.subarray(2)]);
  const { read, calls } = readerOf(padded);
  assert.deepEqual(await readImageSize(read), { width: 21, height: 13 });
  assert.ok(calls.length <= 6, `${calls.length} reads`);
});

test("returns null instead of guessing for unknown, truncated or empty data", async () => {
  const jpeg = fixture("baseline.jpg");
  assert.equal(await sizeOf(Uint8Array.from({ length: 256 }, (_, index) => index)), null);
  assert.equal(await sizeOf(jpeg.subarray(0, 20)), null);
  assert.equal(await sizeOf(fixture("image.png").subarray(0, 20)), null);
  assert.equal(await sizeOf(fixture("lossy.webp").subarray(0, 20)), null);
  assert.equal(await sizeOf(new Uint8Array(0)), null);
});

test("propagates read errors", async () => {
  await assert.rejects(
    readImageSize(async () => {
      throw new Error("NotReadableError");
    }),
    /NotReadableError/,
  );
});
