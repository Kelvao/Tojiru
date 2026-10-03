(function (Tojiru) {
  const D = Tojiru.domain;
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
        canvas.toBlob(
          (blob) => (blob ? resolve(blob) : reject(new Error("toBlob failed"))),
          CONVERTED_IMAGE.mediaType,
        ),
      );
    }

    async function prepare(page) {
      try {
        const decoded = await decode(page.source);
        const size = sizeOf(decoded);
        const extension = D.extensionOf(page.name);
        const isNative = Object.hasOwn(NATIVE_MEDIA_TYPES, extension);
        const data = isNative ? page.source : await toPngBlob(decoded, size);
        decoded.close?.();
        return {
          data,
          extension: isNative ? extension : CONVERTED_IMAGE.extension,
          mediaType: isNative ? NATIVE_MEDIA_TYPES[extension] : CONVERTED_IMAGE.mediaType,
          ...size,
        };
      } catch {
        throw new D.ImageReadError(page.name);
      }
    }

    return { prepare };
  }

  Tojiru.infra = Tojiru.infra || {};
  Tojiru.infra.images = { createImageDecoder };
})((window.Tojiru = window.Tojiru || {}));
