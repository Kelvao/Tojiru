(function (Tojiru) {
  const D = Tojiru.domain;
  const { readImageSize } = Tojiru.infra.imagesize;
  const CONVERTED_IMAGE = { extension: "png", mediaType: "image/png" };
  const NATIVE_MEDIA_TYPES = {
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    webp: "image/webp",
    gif: "image/gif",
  };

  function createImageDecoder({ documentRef }) {
    async function createBitmapOrNull(file) {
      try {
        return await createImageBitmap(file);
      } catch {
        return null;
      }
    }

    async function decodeWithImageElement(file) {
      const url = URL.createObjectURL(file);
      try {
        const image = new Image();
        image.src = url;
        await image.decode();
        return image;
      } finally {
        URL.revokeObjectURL(url);
      }
    }

    async function decode(file) {
      const bitmap = typeof createImageBitmap === "function" ? await createBitmapOrNull(file) : null;
      return bitmap ?? decodeWithImageElement(file);
    }

    const sizeOf = (decoded) => ({
      width: decoded.naturalWidth ?? decoded.width,
      height: decoded.naturalHeight ?? decoded.height,
    });

    function toPngBlob(decoded, { width, height }) {
      const canvas = documentRef.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      canvas.getContext("2d").drawImage(decoded, 0, 0);
      return new Promise((resolve, reject) =>
        canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("toBlob failed"))), CONVERTED_IMAGE.mediaType),
      );
    }

    const rangeReaderOf = (file) => async (offset, length) =>
      new Uint8Array(await file.slice(offset, offset + length).arrayBuffer());

    async function measure(file) {
      const headerSize = await readImageSize(rangeReaderOf(file));
      if (headerSize) return headerSize;
      const decoded = await decode(file);
      try {
        return sizeOf(decoded);
      } finally {
        decoded?.close?.();
      }
    }

    async function convertToPng(file) {
      const decoded = await decode(file);
      try {
        const size = sizeOf(decoded);
        return { data: await toPngBlob(decoded, size), ...CONVERTED_IMAGE, ...size };
      } finally {
        decoded?.close?.();
      }
    }

    async function prepare(page) {
      const extension = D.extensionOf(page.name);
      try {
        if (!Object.hasOwn(NATIVE_MEDIA_TYPES, extension)) return await convertToPng(page.source);
        return {
          data: page.source,
          extension,
          mediaType: NATIVE_MEDIA_TYPES[extension],
          ...(await measure(page.source)),
        };
      } catch (error) {
        throw new D.ImageReadError(page.name, { cause: error });
      }
    }

    return { prepare };
  }

  Tojiru.infra = Tojiru.infra || {};
  Tojiru.infra.images = { createImageDecoder };
})((window.Tojiru = window.Tojiru || {}));
