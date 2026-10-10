(function (Tojiru) {
  const D = Tojiru.domain;
  const { defaultTitleOf } = Tojiru.usecases;
  const HIDDEN_CLASS = "hide";
  const ERROR_CLASS = "error";

  function createView({ documentRef, translator, previews }) {
    const byId = (id) => documentRef.getElementById(id);
    const t = (key, params) => translator.t(key, params);

    const elements = {
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
      formatButtons: documentRef.querySelectorAll("[data-format]"),
      metadataFields: documentRef.querySelectorAll("[data-field] :is(input, select, textarea)"),
      picker: byId("picker"),
      pickName: byId("pickName"),
      pickKind: byId("pickKind"),
      pickPages: byId("pickPages"),
      pickCount: byId("pickCount"),
      pickOk: byId("pickOk"),
      pickCancel: byId("pickCancel"),
    };

    function createElement(tag, className = "", text = "") {
      const element = documentRef.createElement(tag);
      element.className = className;
      element.textContent = text;
      return element;
    }

    const kindLabel = (kind) => t(`kind.${kind}.label`);
    const folderName = (folder) => (folder === D.LOOSE_FOLDER ? t("item.root") : folder);

    function folderLabel(item) {
      if (!item.manual) return folderName(item.folder);
      const folders = [...new Set(item.origins.values())].map(folderName).join(", ");
      return t("item.from", { folders });
    }

    function createMoveButton(symbol, onClick) {
      const button = createElement("button", "", symbol);
      button.tabIndex = -1;
      button.addEventListener("click", onClick);
      return button;
    }

    function createReorderControls(index, intents) {
      const controls = createElement("div", "ord");
      controls.append(
        createMoveButton("▲", () => intents.onMove(index, -1)),
        createMoveButton("▼", () => intents.onMove(index, 1)),
      );
      return controls;
    }

    function createUndoButton(index, intents) {
      const button = createElement("button", "lnk", t("item.undo"));
      button.tabIndex = -1;
      button.addEventListener("click", () => intents.onUndo(index));
      return button;
    }

    function createFolderLabel(item, index, intents) {
      const label = createElement("div", item.manual ? "fn man" : "fn");
      label.title = folderLabel(item);
      label.append(createElement("span", "", folderLabel(item)));
      if (item.manual) label.append(createUndoButton(index, intents));
      return label;
    }

    function createTitleInput(item, index, items, intents) {
      const input = createElement("input");
      input.placeholder = defaultTitleOf(item, items, t);
      input.value = item.title;
      input.addEventListener("input", () => intents.onRename(index, input.value));
      return input;
    }

    function createKindSelect(item, index, intents) {
      const select = createElement("select", "kd");
      select.setAttribute("aria-label", t("item.kind"));
      D.ALL_KINDS.forEach((kind) => {
        const option = createElement("option", "", kindLabel(kind));
        option.value = kind;
        select.append(option);
      });
      select.value = item.kind;
      select.addEventListener("change", () => intents.onKindChange(index, select.value));
      return select;
    }

    function createStartPageLabel(item, startPage) {
      const label = createElement("div", "pg", t("page.start", { n: startPage + 1 }));
      label.title = t("count.pages", { n: item.pages.length });
      return label;
    }

    function createItemRow({ item, index, items, startPage, intents }) {
      const row = createElement("div", "ch");
      row.append(
        createReorderControls(index, intents),
        createFolderLabel(item, index, intents),
        createTitleInput(item, index, items, intents),
        createKindSelect(item, index, intents),
        createStartPageLabel(item, startPage),
      );
      return row;
    }

    function describeSummary(items) {
      if (!items.length) return t("summary.empty");
      const chapters = items.filter(D.isChapter).length;
      const extras = items.length - chapters;
      const parts = [t("count.chapters", { n: chapters })];
      if (extras) parts.push(t("count.extras", { n: extras }));
      parts.push(t("count.pages", { n: D.countPages(items) }));
      return parts.join(" · ");
    }

    function describeFolder({ items, folderLoaded }) {
      if (items.length)
        return `${t("count.items", { n: items.length })}, ${t("count.pages", { n: D.countPages(items) })}.`;
      return t(folderLoaded ? "folder.noImages" : "folder.hint");
    }

    function renderLibrary(state, intents) {
      const { items } = state;
      const startPages = D.computeStartPages(items);
      const rows = items.map((item, index) =>
        createItemRow({ item, index, items, startPage: startPages[index], intents }),
      );
      if (rows.length) elements.list.replaceChildren(...rows);
      else elements.list.textContent = t("list.empty");
      elements.summary.textContent = describeSummary(items);
      elements.folderStatus.textContent = describeFolder(state);
    }

    function renderFormat(formats, selectedId) {
      const format = formats[selectedId];
      elements.formatButtons.forEach((button) => {
        button.setAttribute("aria-checked", String(button.dataset.format === selectedId));
      });
      elements.sidecarButton.hidden = !format.sidecar;
      if (format.sidecar) {
        elements.sidecarButton.textContent = t("action.downloadSidecar", { name: format.sidecar.fileName });
      }
      elements.generateButton.textContent = t("action.generate", { format: format.label });
    }

    const fieldRows = () => documentRef.querySelectorAll("[data-field]");
    const fieldRow = (field) => documentRef.querySelector(`[data-field="${field}"]`);
    const controlOf = (row) => row.querySelector("input, select, textarea");

    function renderFieldTags() {
      fieldRows().forEach((row) => {
        const required = D.REQUIRED_FIELDS.includes(row.dataset.field);
        const tag = row.querySelector(".tag");
        tag.textContent = t(required ? "field.required" : "field.optional");
        tag.classList.toggle("required", required);
      });
    }

    function clearFieldError(row) {
      row.classList.remove("invalid");
      controlOf(row).removeAttribute("aria-invalid");
    }

    const clearFieldErrors = () => fieldRows().forEach(clearFieldError);

    function showFieldErrors(problems) {
      clearFieldErrors();
      problems.forEach(({ field }) => {
        const row = fieldRow(field);
        row.classList.add("invalid");
        controlOf(row).setAttribute("aria-invalid", "true");
      });
      if (problems.length) controlOf(fieldRow(problems[0].field)).focus();
    }

    function applyStaticTranslations() {
      documentRef.documentElement.lang = translator.language;
      documentRef.title = t("app.title");
      documentRef.querySelectorAll("[data-i18n]").forEach((element) => {
        element.textContent = t(element.dataset.i18n);
      });
      documentRef.querySelectorAll("[data-i18n-placeholder]").forEach((element) => {
        element.placeholder = t(element.dataset.i18nPlaceholder);
      });
      documentRef.querySelectorAll("[data-i18n-aria-label]").forEach((element) => {
        element.setAttribute("aria-label", t(element.dataset.i18nAriaLabel));
        element.title = t(element.dataset.i18nAriaLabel);
      });
      renderFieldTags();
    }

    function renderLanguageCode(languages) {
      elements.languageCode.textContent = languages[translator.language].code;
    }

    function renderStatus(message) {
      const notes = message?.notes ?? [];
      elements.status.textContent = message
        ? [message, ...notes].map((part) => t(part.key, part.params)).join(" ")
        : "";
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

    let hasItems = false;
    let generating = false;

    function updateControls() {
      const enabled = hasItems && !generating;
      elements.generateButton.disabled = !enabled;
      elements.sidecarButton.disabled = !enabled;
      elements.addButton.disabled = !enabled;
      elements.numberButton.disabled = !enabled;
      elements.clearButton.disabled = !enabled;
      elements.extractButton.disabled = !enabled;
      elements.folderInput.disabled = generating;
      elements.languageButton.disabled = generating;
      elements.list.inert = generating;
      elements.metadataFields.forEach((field) => {
        field.disabled = generating;
      });
      elements.formatButtons.forEach((button) => {
        button.disabled = generating;
      });
    }

    const setExportEnabled = (enabled) => {
      hasItems = enabled;
      updateControls();
    };

    const setGenerating = (busy) => {
      generating = busy;
      updateControls();
    };

    function readMetadataForm() {
      const value = (id) => byId(id).value;
      return {
        series: value("series"),
        volume: value("volume"),
        summary: value("summary"),
        year: value("year"),
        writer: value("writer"),
        penciller: value("penciller"),
        publisher: value("publisher"),
        genres: value("genre"),
        language: value("lang"),
        readingMode: value("manga"),
      };
    }

    const setSeries = (name) => {
      elements.seriesInput.value = name;
    };

    function fillMangaLanguageOptions() {
      const locale = translator.language;
      const names = new Intl.DisplayNames([locale], { type: "language" });
      const collator = new Intl.Collator(locale);
      const capitalize = (name) => name.charAt(0).toLocaleUpperCase(locale) + name.slice(1);
      const options = D.ISO_639_1_CODES.map((code) => ({ code, name: capitalize(names.of(code)) }))
        .sort((a, b) => collator.compare(a.name, b.name))
        .map(({ code, name }) => {
          const option = createElement("option");
          option.value = code;
          option.label = name;
          return option;
        });
      elements.mangaLanguageList.replaceChildren(...options);
    }

    function fillPickerKinds() {
      const selected = elements.pickKind.value;
      const options = D.MANUAL_KINDS.map((kind) => {
        const option = createElement("option", "", kindLabel(kind));
        option.value = kind;
        return option;
      });
      elements.pickKind.replaceChildren(...options);
      if (selected) elements.pickKind.value = selected;
    }

    function createPickerThumb(page, onToggle) {
      const label = createElement("label", "pk-thumb");
      const checkbox = createElement("input");
      checkbox.type = "checkbox";
      checkbox.addEventListener("change", () => onToggle(page, checkbox.checked));
      const image = createElement("img");
      image.loading = "lazy";
      image.decoding = "async";
      image.alt = page.name;
      image.src = previews.urlFor(page);
      label.append(checkbox, image, createElement("span", "", page.name));
      return label;
    }

    function createPickerGroup(item, onToggle) {
      const group = createElement("div", "pk-group");
      const grid = createElement("div", "pk-grid");
      grid.append(...item.pages.map((page) => createPickerThumb(page, onToggle)));
      const title = `${folderLabel(item)} · ${t("count.pages", { n: item.pages.length })}`;
      group.append(createElement("div", "pk-title", title), grid);
      return group;
    }

    function openPicker(items, onToggle) {
      elements.pickName.value = "";
      elements.pickPages.replaceChildren(...items.map((item) => createPickerGroup(item, onToggle)));
      elements.picker.showModal();
    }

    function updatePickerCount(count) {
      elements.pickOk.disabled = count === 0;
      elements.pickCount.textContent = t("count.selectedPages", { n: count });
    }

    const readPickerChoice = () => ({ kind: elements.pickKind.value, title: elements.pickName.value });
    const closePicker = () => elements.picker.close();

    fieldRows().forEach((row) => row.addEventListener("input", () => clearFieldError(row)));

    return {
      elements,
      showFieldErrors,
      clearFieldErrors,
      applyStaticTranslations,
      renderLanguageCode,
      renderFormat,
      renderLibrary,
      renderStatus,
      resetProgress,
      hideProgress,
      showProgress,
      setExportEnabled,
      setGenerating,
      readMetadataForm,
      setSeries,
      fillPickerKinds,
      fillMangaLanguageOptions,
      openPicker,
      updatePickerCount,
      readPickerChoice,
      closePicker,
    };
  }

  Tojiru.ui = Tojiru.ui || {};
  Tojiru.ui.createView = createView;
})((window.Tojiru = window.Tojiru || {}));
