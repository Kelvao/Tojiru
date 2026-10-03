(function (Tojiru) {
  const D = Tojiru.domain;
  const SAVE_CLEANUP_DELAY_MS = 10000;
  const OPFS_DIRECTORY = "tojiru-tmp";
  const OPFS_QUOTA_MARGIN = 1.05;

  function pagesFromFileList(fileList) {
    return Array.from(fileList)
      .filter((file) => D.isImageName(file.name))
      .map((file) => ({ name: file.name, path: file.webkitRelativePath, source: file }));
  }

  function createBlobSaver(documentRef) {
    function save(blob, fileName) {
      const link = documentRef.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = fileName;
      documentRef.body.append(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(link.href), SAVE_CLEANUP_DELAY_MS);
    }

    function saveText({ content, mediaType, fileName }) {
      save(new Blob([content], { type: mediaType }), fileName);
    }

    return { save, saveText };
  }

  function createOpfsStorage({ navigatorRef }) {
    const rootOrNull = async () => {
      if (typeof navigatorRef.storage?.getDirectory !== "function") return null;
      try {
        return await navigatorRef.storage.getDirectory();
      } catch {
        return null;
      }
    };

    async function purge() {
      const root = await rootOrNull();
      if (!root) return;
      try {
        await root.removeEntry(OPFS_DIRECTORY, { recursive: true });
      } catch {
        return;
      }
    }

    async function assertSpaceFor(requiredBytes) {
      if (typeof navigatorRef.storage.estimate !== "function") return;
      const { quota, usage } = await navigatorRef.storage.estimate();
      if (quota === undefined || usage === undefined) return;
      if (quota - usage < requiredBytes * OPFS_QUOTA_MARGIN) throw new Error("Not enough storage quota");
    }

    async function createSink({ fileName, requiredBytes }) {
      const root = await rootOrNull();
      if (!root) throw new Error("OPFS unavailable");
      await assertSpaceFor(requiredBytes);
      await purge();
      const directory = await root.getDirectoryHandle(OPFS_DIRECTORY, { create: true });
      const handle = await directory.getFileHandle(fileName, { create: true });
      if (typeof handle.createWritable !== "function") throw new Error("OPFS writable streams unavailable");
      const writable = await handle.createWritable();
      return {
        write: (bytes) => writable.write(bytes),
        async close() {
          await writable.close();
          return handle.getFile();
        },
        async abort() {
          try {
            await writable.abort();
          } catch {
            return;
          }
        },
      };
    }

    return { createSink, purge };
  }

  function createLanguageStore({ storageKey, windowRef }) {
    return {
      read() {
        try {
          return windowRef.localStorage.getItem(storageKey);
        } catch {
          return null;
        }
      },
      write(language) {
        try {
          windowRef.localStorage.setItem(storageKey, language);
        } catch {
          return;
        }
      },
      preferred() {
        const { languages, language } = windowRef.navigator;
        return languages?.length ? [...languages] : [language || ""];
      },
    };
  }

  function createPreviewUrls() {
    let urls = [];
    return {
      urlFor(page) {
        const url = URL.createObjectURL(page.source);
        urls.push(url);
        return url;
      },
      releaseAll() {
        urls.forEach((url) => URL.revokeObjectURL(url));
        urls = [];
      },
    };
  }

  function generateUuid() {
    if (crypto.randomUUID) return crypto.randomUUID();
    const bytes = crypto.getRandomValues(new Uint8Array(16));
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hex = [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  }

  Tojiru.infra = Tojiru.infra || {};
  Tojiru.infra.browser = {
    pagesFromFileList,
    createBlobSaver,
    createOpfsStorage,
    createLanguageStore,
    createPreviewUrls,
    generateUuid,
  };
})((window.Tojiru = window.Tojiru || {}));
