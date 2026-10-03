const test = require("node:test");
const assert = require("node:assert");
const { loadScripts } = require("./load");

test("image decoder closes the bitmap when PNG conversion fails", async () => {
  let closeCount = 0;
  const bitmap = {
    width: 10,
    height: 10,
    close: () => closeCount++,
  };
  const { infra } = loadScripts(["src/domain/library.js", "src/infrastructure/images.js"], {
    createImageBitmap: async () => bitmap,
  });
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
