const test = require("node:test");
const assert = require("node:assert");
const { loadScripts } = require("./load");

const {
  domain: D,
  ui,
  i18n,
} = loadScripts(["src/domain/library.js", "src/presentation/i18n.js", "src/presentation/feedback.js"]);
const { describeFailure, describeNotices } = ui.feedback;
const translators = Object.keys(i18n.LANGUAGES).map((language) => ({
  language,
  translator: i18n.createTranslator({ translations: i18n.TRANSLATIONS, fallback: "en", language }),
}));

test("every error and notice code has a message in every supported language", () => {
  for (const { language, translator } of translators) {
    for (const code of Object.values(D.ErrorCode)) {
      const key = `error.${code}`;
      assert.notEqual(translator.t(key, { name: "x", detail: "x" }), key, `${language}:${key}`);
    }
    for (const code of Object.values(D.NoticeCode)) {
      const key = `notice.${code}`;
      assert.notEqual(translator.t(key), key, `${language}:${key}`);
    }
  }
});

test("describeFailure maps expected errors to their message key and params", () => {
  const failure = describeFailure(new D.ImageReadError("capa.jpg"));
  assert.equal(failure.key, "error.imageRead");
  assert.deepEqual({ ...failure.params }, { name: "capa.jpg" });
  assert.equal(failure.expected, true);
});

test("describeFailure marks unknown failures as unexpected and keeps the original cause", () => {
  const original = new TypeError("x is not a function");
  const failure = describeFailure(original);
  assert.equal(failure.key, "error.unexpected");
  assert.equal(failure.expected, false);
  assert.equal(failure.cause, original);
  assert.deepEqual({ ...failure.params }, { detail: "x is not a function" });
});

test("describeFailure falls back to unexpected for an application error with an unknown code", () => {
  const failure = describeFailure(new D.AppError("somethingNew"));
  assert.equal(failure.key, "error.unexpected");
});

test("messages are localized and never expose the raw technical error text", () => {
  const english = translators.find((entry) => entry.language === "en").translator;
  const portuguese = translators.find((entry) => entry.language === "pt-BR").translator;
  const { key, params } = describeFailure(new D.AppError(D.ErrorCode.ZIP_TOO_LARGE));
  assert.match(english.t(key, params), /4 GiB/);
  assert.match(portuguese.t(key, params), /4 GiB/);
  assert.doesNotMatch(english.t(key, params), /ZIP limit exceeded/);
});

test("describeNotices maps writer notices to localized keys", () => {
  assert.deepEqual(
    describeNotices([{ code: D.NoticeCode.DISK_FALLBACK }]).map((note) => note.key),
    ["notice.diskFallback"],
  );
});
