(function (Tojiru) {
  const { createDom, createLabels, createLibraryView, createMetadataFormView, createPickerView } = Tojiru.ui;
  const HIDDEN_CLASS = "hide";
  const ERROR_CLASS = "error";

  function findElements({ byId, all }) {
    return {
      folderInput: byId("dir"),
      mangaLanguageList: byId("langList"),
      folderStatus: byId("st"),
      list: byId("list"),
      summary: byId("sum"),
      progress: byId("pr"),
      status: byId("st2"),
      seriesInput: byId("series"),
      extractButton: byId("extract"),
      numberButton: byId("auto"),
      clearButton: byId("clear"),
      sidecarButton: byId("xml"),
      generateButton: byId("go"),
      addButton: byId("add"),
      languageButton: byId("langToggle"),
      languageCode: byId("langCode"),
      formatButtons: all("[data-format]"),
      metadataFields: all("[data-field] :is(input, select, textarea)"),
      picker: byId("picker"),
      pickName: byId("pickName"),
      pickKind: byId("pickKind"),
      pickPages: byId("pickPages"),
      pickCount: byId("pickCount"),
      pickOk: byId("pickOk"),
      pickCancel: byId("pickCancel"),
    };
  }

  function createView({ documentRef, translator, previews }) {
    const dom = createDom(documentRef);
    const elements = findElements(dom);
    const translate = (key, params) => translator.t(key, params);
    const labels = createLabels(translate);
    const library = createLibraryView({ dom, elements, translate, labels });
    const metadataForm = createMetadataFormView({ dom, elements, translator });
    const picker = createPickerView({ dom, elements, translate, labels, previews });

    function translateAttribute(attribute, apply) {
      dom.all(`[${attribute}]`).forEach((element) => apply(element, translate(element.getAttribute(attribute))));
    }

    function applyStaticTranslations() {
      dom.root.documentElement.lang = translator.language;
      dom.root.title = translate("app.title");
      translateAttribute("data-i18n", (element, text) => {
        element.textContent = text;
      });
      translateAttribute("data-i18n-placeholder", (element, text) => {
        element.placeholder = text;
      });
      translateAttribute("data-i18n-aria-label", (element, text) => {
        element.setAttribute("aria-label", text);
        element.title = text;
      });
      metadataForm.renderFieldTags();
    }

    function renderLanguageCode(languages) {
      elements.languageCode.textContent = languages[translator.language].code;
    }

    function renderFormat(formats, selectedId) {
      const { sidecar, label } = formats[selectedId];
      elements.formatButtons.forEach((button) => {
        button.setAttribute("aria-checked", String(button.dataset.format === selectedId));
      });
      elements.sidecarButton.hidden = !sidecar;
      if (sidecar) elements.sidecarButton.textContent = translate("action.downloadSidecar", { name: sidecar.fileName });
      elements.generateButton.textContent = translate("action.generate", { format: label });
    }

    function renderStatus(message) {
      const parts = message ? [message, ...(message.notes ?? [])] : [];
      elements.status.textContent = parts.map((part) => translate(part.key, part.params)).join(" ");
      elements.status.classList.toggle(ERROR_CLASS, message?.severity === "error");
    }

    function resetProgress() {
      elements.progress.value = 0;
      elements.progress.classList.remove(HIDDEN_CLASS);
    }

    const hideProgress = () => elements.progress.classList.add(HIDDEN_CLASS);

    const showProgress = (percent) => {
      elements.progress.value = percent;
    };

    const controlState = { hasItems: false, generating: false };

    function updateControls() {
      const { hasItems, generating } = controlState;
      const exportDisabled = !hasItems || generating;
      const exportControls = [
        elements.generateButton,
        elements.sidecarButton,
        elements.addButton,
        elements.numberButton,
        elements.clearButton,
        elements.extractButton,
      ];
      const editingControls = [
        elements.folderInput,
        elements.languageButton,
        ...elements.metadataFields,
        ...elements.formatButtons,
      ];
      exportControls.forEach((control) => {
        control.disabled = exportDisabled;
      });
      editingControls.forEach((control) => {
        control.disabled = generating;
      });
      elements.list.inert = generating;
    }

    const setExportEnabled = (enabled) => {
      controlState.hasItems = enabled;
      updateControls();
    };

    const setGenerating = (busy) => {
      controlState.generating = busy;
      updateControls();
    };

    const onClick = (element, handler) => element.addEventListener("click", () => handler());

    function bindActions(actions) {
      elements.folderInput.addEventListener("change", (event) => {
        const files = event.target.files;
        elements.folderInput.value = "";
        actions.onFolderSelected(files);
      });
      elements.seriesInput.addEventListener("input", () => actions.onSeriesTyped());
      onClick(elements.extractButton, actions.onExtractFolderNames);
      onClick(elements.numberButton, actions.onNumberChapters);
      onClick(elements.clearButton, actions.onClearTitles);
      onClick(elements.sidecarButton, actions.onExportSidecar);
      onClick(elements.generateButton, actions.onGenerate);
      onClick(elements.addButton, actions.onOpenPicker);
      onClick(elements.pickOk, actions.onConfirmPicker);
      onClick(elements.languageButton, actions.onToggleLanguage);
      elements.formatButtons.forEach((button) => onClick(button, () => actions.onSelectFormat(button.dataset.format)));
      metadataForm.onMetadataChange(actions.onMetadataChange);
    }

    return {
      bindActions,
      applyStaticTranslations,
      renderLanguageCode,
      renderFormat,
      renderLibrary: library.renderLibrary,
      renderStatus,
      resetProgress,
      hideProgress,
      showProgress,
      setExportEnabled,
      setGenerating,
      showFieldErrors: metadataForm.showFieldErrors,
      clearFieldErrors: metadataForm.clearFieldErrors,
      readMetadataForm: metadataForm.readMetadataForm,
      renderMetadata: metadataForm.renderMetadata,
      fillMangaLanguageOptions: metadataForm.fillMangaLanguageOptions,
      fillPickerKinds: picker.fillPickerKinds,
      openPicker: picker.openPicker,
      updatePickerCount: picker.updatePickerCount,
      readPickerChoice: picker.readPickerChoice,
      closePicker: picker.closePicker,
    };
  }

  Tojiru.ui = Tojiru.ui || {};
  Tojiru.ui.createView = createView;
})((window.Tojiru = window.Tojiru || {}));
