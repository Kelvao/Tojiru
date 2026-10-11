const test = require("node:test");
const assert = require("node:assert");
const { DOMAIN_SCRIPTS, loadScripts, readSource } = require("./load");

const {
  domain: D,
  i18n,
  infra: { cbz },
} = loadScripts(
  [
    ...DOMAIN_SCRIPTS,
    "src/presentation/i18n.js",
    "src/infrastructure/xml.js",
    "src/infrastructure/zipstream.js",
    "src/infrastructure/cbz.js",
  ],
  { TextEncoder },
);

const nonChapterKinds = () => D.ALL_KINDS.filter((kind) => kind !== D.Kind.CHAPTER);

test("the kind lists cover every kind exactly once", () => {
  assert.deepEqual([...D.ALL_KINDS].sort(), Object.values(D.Kind).sort());
  assert.equal(new Set(D.ALL_KINDS).size, D.ALL_KINDS.length);
  assert.deepEqual([...D.MANUAL_KINDS].sort(), [...nonChapterKinds()].sort());
  assert.equal(D.MANUAL_KINDS[0], D.Kind.CONTENTS);
});

test("every kind except chapter maps to a ComicInfo page type", () => {
  assert.deepEqual(Object.keys(cbz.PAGE_TYPES).sort(), [...nonChapterKinds()].sort());
});

test("every kind has a label and a name in every language", () => {
  for (const [language, entries] of Object.entries(i18n.TRANSLATIONS)) {
    for (const kind of D.ALL_KINDS) {
      assert.ok(entries[`kind.${kind}.label`], `${language}: kind.${kind}.label`);
      assert.ok(entries[`kind.${kind}.name`], `${language}: kind.${kind}.name`);
    }
  }
});

test("the metadata form has one field row per metadata key", () => {
  const rows = [...readSource("index.html").matchAll(/data-field="(\w+)"/g)].map((match) => match[1]);
  assert.deepEqual([...rows].sort(), [...D.METADATA_KEYS].sort());
});

test("every metadata key has a hint in the form and in every language", () => {
  const html = readSource("index.html");
  for (const key of D.METADATA_KEYS) {
    assert.match(html, new RegExp(`id="hint-${key}"`), `hint element for ${key}`);
    for (const [language, entries] of Object.entries(i18n.TRANSLATIONS)) {
      assert.ok(entries[`hint.${key}`], `${language}: hint.${key}`);
    }
  }
});

test("required fields are a subset of the metadata keys", () => {
  assert.ok(D.REQUIRED_FIELDS.length > 0);
  assert.ok(D.REQUIRED_FIELDS.every((key) => D.METADATA_KEYS.includes(key)));
});

test("createManga starts with empty metadata defaults and no items", () => {
  const manga = D.createManga();
  assert.deepEqual([...manga.items], []);
  assert.deepEqual(Object.keys(manga.metadata), [...D.METADATA_KEYS]);
  assert.equal(manga.metadata.series, "");
  assert.equal(manga.metadata.readingMode, D.ReadingMode.RIGHT_TO_LEFT);
});

test("setMetadataField returns a new object and ignores unknown keys", () => {
  const metadata = D.createMetadata();
  const changed = D.setMetadataField(metadata, "series", "X");
  assert.equal(changed.series, "X");
  assert.equal(metadata.series, "");
  assert.equal(D.setMetadataField(metadata, "nope", "x"), metadata);
});

test("index.html loads the manga schema before the library that depends on it", () => {
  const html = readSource("index.html");
  const scripts = [...html.matchAll(/<script src="([^"]+)"/g)].map((match) => match[1]);
  assert.ok(scripts.indexOf("src/domain/manga.js") >= 0);
  assert.ok(scripts.indexOf("src/domain/manga.js") < scripts.indexOf("src/domain/library.js"));
});
