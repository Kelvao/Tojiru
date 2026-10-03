const test = require("node:test");
const assert = require("node:assert");
const { loadScripts } = require("./load");

const { i18n } = loadScripts(["src/presentation/i18n.js"]);
const supported = Object.keys(i18n.LANGUAGES);

test("detectLanguage prefers a stored supported language", () => {
  const language = i18n.detectLanguage({ stored: "en", preferred: ["pt-BR"], supported, fallback: "en" });
  assert.equal(language, "en");
});

test("detectLanguage ignores unsupported stored values and maps Portuguese variants", () => {
  assert.equal(i18n.detectLanguage({ stored: "fr", preferred: ["pt-PT", "en"], supported, fallback: "en" }), "pt-BR");
  assert.equal(i18n.detectLanguage({ stored: null, preferred: ["", "EN-gb"], supported, fallback: "pt-BR" }), "en");
});

test("detectLanguage falls back when nothing matches", () => {
  assert.equal(i18n.detectLanguage({ stored: null, preferred: ["fr-FR", "ja"], supported, fallback: "en" }), "en");
});

test("translator interpolates parameters and chooses plural forms", () => {
  const translator = i18n.createTranslator({ translations: i18n.TRANSLATIONS, fallback: "en", language: "en" });
  assert.equal(translator.t("count.pages", { n: 1 }), "1 page");
  assert.equal(translator.t("count.pages", { n: 3 }), "3 pages");
  assert.equal(translator.t("status.error", { message: "boom" }), "Error: boom");
  translator.setLanguage("pt-BR");
  assert.equal(translator.t("count.chapters", { n: 2 }), "2 capítulos");
  assert.equal(translator.t("status.done", { n: 1, size: "0.1" }), "Pronto: 1 página, 0.1 MB.");
});

test("translator falls back to English and then to the key", () => {
  const translator = i18n.createTranslator({
    translations: { en: { hello: "Hello" }, xx: {} },
    fallback: "en",
    language: "xx",
  });
  assert.equal(translator.t("hello"), "Hello");
  assert.equal(translator.t("missing.key"), "missing.key");
});

test("every language defines the same keys", () => {
  const [first, ...others] = Object.values(i18n.TRANSLATIONS).map((entries) => Object.keys(entries).sort());
  others.forEach((keys) => assert.deepEqual(keys, first));
});

test("nextLanguage cycles through supported languages", () => {
  assert.equal(i18n.nextLanguage("en", supported), "pt-BR");
  assert.equal(i18n.nextLanguage("pt-BR", supported), "en");
});
