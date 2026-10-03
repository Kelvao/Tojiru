const test = require("node:test");
const assert = require("node:assert");
const { loadScripts } = require("./load");

const { createOpfsStorage } = loadScripts(["src/domain/library.js", "src/infrastructure/browser.js"]).infra.browser;

function fakeOpfs({ quota = 1e12, usage = 0, writable = true } = {}) {
  const state = { directories: new Map(), removed: [], writes: [], closed: 0, aborted: 0 };
  const makeFileHandle = (name) => ({
    name,
    ...(writable && {
      createWritable: async () => ({
        write: async (bytes) => {
          state.writes.push(bytes);
        },
        close: async () => {
          state.closed++;
        },
        abort: async () => {
          state.aborted++;
        },
      }),
    }),
    getFile: async () => ({ name, size: state.writes.length }),
  });
  const makeDirectory = () => {
    const files = new Map();
    return {
      files,
      getFileHandle: async (fileName) => {
        if (!files.has(fileName)) files.set(fileName, makeFileHandle(fileName));
        return files.get(fileName);
      },
    };
  };
  const root = {
    getDirectoryHandle: async (name) => {
      if (!state.directories.has(name)) state.directories.set(name, makeDirectory());
      return state.directories.get(name);
    },
    removeEntry: async (name, options) => {
      if (!state.directories.has(name)) throw new Error("NotFoundError");
      state.directories.delete(name);
      state.removed.push({ name, options });
    },
  };
  const navigatorRef = { storage: { getDirectory: async () => root, estimate: async () => ({ quota, usage }) } };
  return { state, navigatorRef };
}

test("OPFS sink writes, closes and returns the stored file", async () => {
  const { state, navigatorRef } = fakeOpfs();
  const storage = createOpfsStorage({ navigatorRef });
  const sink = await storage.createSink({ fileName: "a.cbz", requiredBytes: 100 });
  await sink.write(new Uint8Array([1, 2, 3]));
  const file = await sink.close();
  assert.equal(file.name, "a.cbz");
  assert.equal(state.writes.length, 1);
  assert.equal(state.closed, 1);
});

test("OPFS sink purges leftovers from earlier runs before creating a new file", async () => {
  const { state, navigatorRef } = fakeOpfs();
  const storage = createOpfsStorage({ navigatorRef });
  await storage.createSink({ fileName: "a.cbz", requiredBytes: 1 });
  await storage.createSink({ fileName: "b.cbz", requiredBytes: 1 });
  assert.equal(state.removed.length, 1);
  assert.deepEqual(state.removed[0].options, { recursive: true });
  assert.deepEqual([...state.directories.get("tojiru-tmp").files.keys()], ["b.cbz"]);
});

test("OPFS sink refuses when the storage quota cannot hold the archive", async () => {
  const { navigatorRef } = fakeOpfs({ quota: 1000, usage: 900 });
  const storage = createOpfsStorage({ navigatorRef });
  await assert.rejects(storage.createSink({ fileName: "a.cbz", requiredBytes: 500 }), /quota/);
});

test("OPFS sink refuses when writable streams or OPFS itself are missing", async () => {
  const noWritable = createOpfsStorage({ navigatorRef: fakeOpfs({ writable: false }).navigatorRef });
  await assert.rejects(noWritable.createSink({ fileName: "a.cbz", requiredBytes: 1 }), /writable/);
  const noOpfs = createOpfsStorage({ navigatorRef: { storage: {} } });
  await assert.rejects(noOpfs.createSink({ fileName: "a.cbz", requiredBytes: 1 }), /unavailable/);
});

test("OPFS purge never throws, even without OPFS or an existing directory", async () => {
  await createOpfsStorage({ navigatorRef: {} }).purge();
  await createOpfsStorage({ navigatorRef: fakeOpfs().navigatorRef }).purge();
});

test("OPFS sink abort swallows writable errors", async () => {
  const { navigatorRef } = fakeOpfs();
  const storage = createOpfsStorage({ navigatorRef });
  const sink = await storage.createSink({ fileName: "a.cbz", requiredBytes: 1 });
  await sink.abort();
});
