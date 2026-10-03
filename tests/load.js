const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const ROOT = path.join(__dirname, "..");

function loadScripts(files, globals = {}) {
  const context = vm.createContext({ ...globals });
  context.window = context;
  for (const file of files) {
    vm.runInContext(fs.readFileSync(path.join(ROOT, file), "utf8"), context, { filename: file });
  }
  return context.window.Tojiru;
}

const readSource = (file) => fs.readFileSync(path.join(ROOT, file), "utf8");

module.exports = { ROOT, loadScripts, readSource };
