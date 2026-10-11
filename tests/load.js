const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const ROOT = path.join(__dirname, "..");

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

function loadScripts(files, globals = {}) {
  const context = vm.createContext({ ...globals });
  context.window = context;
  for (const file of files) {
    vm.runInContext(fs.readFileSync(path.join(ROOT, file), "utf8"), context, { filename: file });
  }
  return context.window.Tojiru;
}

const readSource = (file) => fs.readFileSync(path.join(ROOT, file), "utf8");

module.exports = { ROOT, DOMAIN_SCRIPTS, APPLICATION_SCRIPTS, loadScripts, readSource };
