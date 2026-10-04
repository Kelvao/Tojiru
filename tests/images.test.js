const test = require("node:test");
const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert");
const { loadScripts } = require("./load");

test("image decoder closes the bitmap when PNG conversion fails", async () => {
  let closeCount = 0;
  const bitmap = {
    width: 10,
    height: 10,
    close: () => closeCount++,
  };
  const { infra } = loadScripts(
    ["src/domain/library.js", "src/infrastructure/imagesize.js", "src/infrastructure/images.js"],
    {
      createImageBitmap: async () => bitmap,
    },
  );
  const documentRef = {
    createElement: () => ({
      getContext: () => ({ drawImage: () => {} }),
      toBlob: (callback) => callback(null),
    }),
  };
  const decoder = infra.images.createImageDecoder({ documentRef });

  await assert.rejects(decoder.prepare({ name: "page.avif", source: {} }), (error) => error.name === "ImageReadError");
  assert.equal(closeCount, 1);
});

const fixture = (name) => new Uint8Array(fs.readFileSync(path.join(__dirname, "fixtures", name)));

const fileOf = (bytes) => ({
  reads: 0,
  slice(start, end) {
    this.reads++;
    return { arrayBuffer: async () => Uint8Array.from(bytes.subarray(start, end)).buffer };
  },
});

function decoderWith({ bitmap, decodeCalls }) {
  const { infra } = loadScripts(
    ["src/domain/library.js", "src/infrastructure/imagesize.js", "src/infrastructure/images.js"],
    {
      createImageBitmap: async () => {
        decodeCalls.count++;
        return bitmap;
      },
    },
  );
  const documentRef = {
    createElement: () => ({
      getContext: () => ({ drawImage: () => {} }),
      toBlob: (callback) => callback({ converted: true }),
    }),
  };
  return infra.images.createImageDecoder({ documentRef });
}

test("native images are measured from their header without decoding", async () => {
  const decodeCalls = { count: 0 };
  const decoder = decoderWith({ bitmap: { width: 1, height: 1, close: () => {} }, decodeCalls });
  const cases = [
    ["a.jpg", "baseline.jpg", 33, 17, "image/jpeg"],
    ["a.jpeg", "progressive.jpg", 40, 30, "image/jpeg"],
    ["a.png", "image.png", 19, 11, "image/png"],
    ["a.gif", "image.gif", 9, 7, "image/gif"],
    ["a.webp", "lossless.webp", 50, 31, "image/webp"],
  ];
  for (const [name, file, width, height, mediaType] of cases) {
    const source = fileOf(fixture(file));
    const prepared = await decoder.prepare({ name, source });
    assert.deepEqual([prepared.width, prepared.height, prepared.mediaType], [width, height, mediaType], name);
    assert.equal(prepared.data, source);
  }
  assert.equal(decodeCalls.count, 0);
});

test("native images with an unreadable header fall back to a full decode and close the bitmap", async () => {
  let closed = 0;
  const decodeCalls = { count: 0 };
  const decoder = decoderWith({ bitmap: { width: 70, height: 50, close: () => closed++ }, decodeCalls });
  const prepared = await decoder.prepare({ name: "a.jpg", source: fileOf(fixture("exif-rotated.jpg")) });
  assert.deepEqual([prepared.width, prepared.height], [70, 50]);
  assert.equal(decodeCalls.count, 1);
  assert.equal(closed, 1);
});

test("native images that cannot be read at all raise ImageReadError", async () => {
  const decoder = decoderWith({ bitmap: null, decodeCalls: { count: 0 } });
  await assert.rejects(
    decoder.prepare({ name: "empty.png", source: fileOf(new Uint8Array(0)) }),
    (error) => error.name === "ImageReadError" && error.message.includes("empty.png"),
  );
});

test("non-native images are still decoded and converted to PNG", async () => {
  let closed = 0;
  const decodeCalls = { count: 0 };
  const decoder = decoderWith({ bitmap: { width: 30, height: 20, close: () => closed++ }, decodeCalls });
  const prepared = await decoder.prepare({ name: "a.avif", source: {} });
  assert.deepEqual(prepared.data, { converted: true });
  assert.deepEqual(
    [prepared.extension, prepared.mediaType, prepared.width, prepared.height],
    ["png", "image/png", 30, 20],
  );
  assert.equal(decodeCalls.count, 1);
  assert.equal(closed, 1);
});
