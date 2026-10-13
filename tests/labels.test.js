const test = require("node:test");
const assert = require("node:assert");
const { DOMAIN_SCRIPTS, loadScripts } = require("./load");

const {
  domain: D,
  ui: { createLabels },
} = loadScripts([...DOMAIN_SCRIPTS, "src/presentation/labels.js"]);

const fakeTranslate = (key, params = {}) => {
  if (key === "item.root") return "(raiz)";
  if (key === "item.from") return `de ${params.folders}`;
  return key;
};

test("kindLabel delegates to the translator key", () => {
  const labels = createLabels((key) => `[${key}]`);
  assert.equal(labels.kindLabel(D.Kind.COVER), "[kind.cover.label]");
  assert.equal(labels.kindLabel(D.Kind.CHAPTER), "[kind.chapter.label]");
});

test("folderLabel returns folder name or root for normal items", () => {
  const labels = createLabels(fakeTranslate);
  assert.equal(labels.folderLabel({ manual: false, folder: "Capítulo 1" }), "Capítulo 1");
  assert.equal(labels.folderLabel({ manual: false, folder: null }), "(raiz)");
});

test("folderLabel combines unique origins for manual items", () => {
  const labels = createLabels(fakeTranslate);
  const origins = new Map([
    ["p1", "Capítulo 1"],
    ["p2", "Capítulo 1"],
    ["p3", null],
  ]);
  const item = { manual: true, origins };
  assert.equal(labels.folderLabel(item), "de Capítulo 1, (raiz)");
});

test("sizeLabel formats bytes in traditional decimal units", () => {
  const labels = createLabels(fakeTranslate);
  assert.equal(labels.sizeLabel(0), "0 B");
  assert.equal(labels.sizeLabel(500), "~500 B");
  assert.equal(labels.sizeLabel(1000), "~1 KB");
  assert.equal(labels.sizeLabel(1500), "~1.5 KB");
  assert.equal(labels.sizeLabel(10000000), "~10 MB");
  assert.equal(labels.sizeLabel(12400000), "~12.4 MB");
  assert.equal(labels.sizeLabel(1500000000), "~1.5 GB");
});
