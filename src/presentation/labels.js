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

    return { kindLabel, folderLabel };
  }

  Tojiru.ui = Tojiru.ui || {};
  Tojiru.ui.createLabels = createLabels;
})((window.Tojiru = window.Tojiru || {}));
