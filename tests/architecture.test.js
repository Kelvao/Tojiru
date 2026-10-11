const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const { ROOT, readSource } = require("./load");

const SRC = path.join(ROOT, "src");
const BROWSER_APIS = /\b(document|localStorage|navigator|Blob|File|FileReader|URL|createImageBitmap|crypto)\b|window\./;
const JSZIP = /JSZip/;
const BROWSER_ADAPTERS = ["browser.js", "images.js"];

const withoutNamespaceLine = (source) => source.replace(/\(window\.Tojiru = window\.Tojiru \|\| \{\}\)/g, "");
const sourceFilesIn = (folder) => fs.readdirSync(path.join(SRC, folder)).filter((name) => name.endsWith(".js"));

const layers = [
  {
    folder: "domain",
    reason: "the domain depends on nothing",
    forbids: () => [BROWSER_APIS, JSZIP, /Tojiru\.(usecases|infra|ui|i18n)/],
  },
  {
    folder: "application",
    reason: "use cases know only the domain and injected ports",
    forbids: () => [BROWSER_APIS, JSZIP, /Tojiru\.(infra|ui|i18n)/],
  },
  {
    folder: "infrastructure",
    reason: "adapters do not reach into the application or the UI",
    forbids: (file) => [/Tojiru\.(usecases|ui|i18n)/, ...(BROWSER_ADAPTERS.includes(file) ? [] : [BROWSER_APIS])],
  },
  {
    folder: "presentation",
    reason: "the UI uses injected browser objects and never touches infrastructure",
    forbids: () => [BROWSER_APIS, JSZIP, /Tojiru\.infra/],
  },
];

for (const { folder, reason, forbids } of layers) {
  for (const file of sourceFilesIn(folder)) {
    test(`src/${folder}/${file}: ${reason}`, () => {
      const source = withoutNamespaceLine(readSource(`src/${folder}/${file}`));
      for (const pattern of forbids(file)) {
        assert.doesNotMatch(source, pattern, `src/${folder}/${file} must not match ${pattern}`);
      }
    });
  }
}

test("every source file lives in a layer folder or is the composition root", () => {
  const entries = fs.readdirSync(SRC, { withFileTypes: true });
  const layerFolders = layers.map((layer) => layer.folder);
  for (const entry of entries) {
    if (entry.isDirectory()) assert.ok(layerFolders.includes(entry.name), `unknown folder src/${entry.name}`);
    else assert.equal(entry.name, "main.js", `stray file src/${entry.name}`);
  }
});

test("only the composition root wires infrastructure into the application", () => {
  assert.match(readSource("src/main.js"), /Tojiru\.infra\.cbz/);
  assert.match(readSource("src/main.js"), /window\.JSZip/);
});

test("source files import named dependencies instead of whole-layer aliases", () => {
  for (const { folder } of layers) {
    for (const file of sourceFilesIn(folder)) {
      const source = readSource(`src/${folder}/${file}`);
      assert.doesNotMatch(source, /const \w+ = Tojiru\.\w+;/, `src/${folder}/${file} aliases a whole layer`);
    }
  }
});

test("the controller talks to the view only through its API, never through DOM elements", () => {
  const source = readSource("src/presentation/controller.js");
  assert.doesNotMatch(source, /\belements\b|addEventListener|querySelector|getElementById/);
});

test("index.html loads the layers from the inside out", () => {
  const scripts = [...readSource("index.html").matchAll(/<script src="src\/(\w+)\//g)].map((match) => match[1]);
  const order = ["domain", "application", "infrastructure", "presentation"];
  const ranks = scripts.map((folder) => order.indexOf(folder));
  assert.deepEqual(
    ranks,
    [...ranks].sort((a, b) => a - b),
  );
});

test("source files contain no comments", () => {
  const files = [
    ...layers.flatMap(({ folder }) => sourceFilesIn(folder).map((file) => `src/${folder}/${file}`)),
    "src/main.js",
  ];
  for (const file of files) {
    const source = readSource(file)
      .replace(/https?:\/\/\S+/g, "")
      .replace(/`[^`]*`/gs, "``");
    assert.doesNotMatch(source, /^\s*\/\/|\/\*/m, `${file} has comments`);
  }
});
