const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const ROOT = path.join(__dirname, "..");
const LOCALES_DIR = path.join(ROOT, "locales");

const DOMAIN_SCRIPTS = Object.freeze([
  "src/domain/errors.js",
  "src/domain/files.js",
  "src/domain/manga.js",
  "src/domain/library.js",
]);

const APPLICATION_SCRIPTS = Object.freeze([
  "src/application/failures.js",
  "src/application/store.js",
  "src/application/titles.js",
  "src/application/output.js",
  "src/application/usecases.js",
]);

function readTranslations() {
  if (!fs.existsSync(LOCALES_DIR)) return {};
  const files = fs.readdirSync(LOCALES_DIR).filter((name) => name.endsWith(".json"));
  return Object.fromEntries(
    files.map((name) => [
      path.basename(name, ".json"),
      JSON.parse(fs.readFileSync(path.join(LOCALES_DIR, name), "utf8")),
    ]),
  );
}

function loadScripts(files, globals = {}) {
  const context = vm.createContext({ ...globals });
  context.window = context;
  context.window.Tojiru = context.window.Tojiru || {};
  context.window.Tojiru.i18n = context.window.Tojiru.i18n || {};
  context.window.Tojiru.i18n.TRANSLATIONS = readTranslations();
  for (const file of files) {
    vm.runInContext(fs.readFileSync(path.join(ROOT, file), "utf8"), context, { filename: file });
  }
  return context.window.Tojiru;
}

const readSource = (file) => fs.readFileSync(path.join(ROOT, file), "utf8");

module.exports = { ROOT, DOMAIN_SCRIPTS, APPLICATION_SCRIPTS, loadScripts, readSource, readTranslations };
