(function (Tojiru) {
  const { LOOSE_FOLDER } = Tojiru.domain;

  function createLabels(translate) {
    const kindLabel = (kind) => translate(`kind.${kind}.label`);
    const folderName = (folder) => (folder === LOOSE_FOLDER ? translate("item.root") : folder);

    function folderLabel(item) {
      if (!item.manual) return folderName(item.folder);
      const folders = [...new Set(item.origins.values())].map(folderName).join(", ");
      return translate("item.from", { folders });
    }

    function sizeLabel(bytes) {
      if (!bytes) return "0 B";
      const units = ["B", "KB", "MB", "GB", "TB"];
      const exponent = Math.min(Math.floor(Math.log10(bytes) / 3), units.length - 1);
      const value = bytes / Math.pow(10, exponent * 3);
      const formatted = exponent === 0 ? Math.round(value) : value.toFixed(1).replace(/\.0$/, "");
      return `~${formatted} ${units[exponent]}`;
    }

    return { kindLabel, folderLabel, sizeLabel };
  }

  Tojiru.ui = Tojiru.ui || {};
  Tojiru.ui.createLabels = createLabels;
})((window.Tojiru = window.Tojiru || {}));
