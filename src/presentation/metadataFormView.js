(function (Tojiru) {
  const { ISO_639_1_CODES, REQUIRED_FIELDS } = Tojiru.domain;
  const INVALID_CLASS = "invalid";

  function createMetadataFormView({ dom, elements, translator }) {
    const translate = (key, params) => translator.t(key, params);
    const fieldRows = () => dom.all("[data-field]");
    const fieldRow = (field) => dom.one(`[data-field="${field}"]`);
    const controlOf = (row) => row.querySelector("input, select, textarea");

    function renderFieldTags() {
      fieldRows().forEach((row) => {
        const required = REQUIRED_FIELDS.includes(row.dataset.field);
        const tag = row.querySelector(".tag");
        tag.textContent = translate(required ? "field.required" : "field.optional");
        tag.classList.toggle("required", required);
      });
    }

    function markFieldInvalid(row, invalid) {
      row.classList.toggle(INVALID_CLASS, invalid);
      if (invalid) controlOf(row).setAttribute("aria-invalid", "true");
      else controlOf(row).removeAttribute("aria-invalid");
    }

    const clearFieldErrors = () => fieldRows().forEach((row) => markFieldInvalid(row, false));

    function showFieldErrors(problems) {
      clearFieldErrors();
      problems.forEach(({ field }) => markFieldInvalid(fieldRow(field), true));
      if (problems.length) controlOf(fieldRow(problems[0].field)).focus();
    }

    function readMetadataForm() {
      return Object.fromEntries([...fieldRows()].map((row) => [row.dataset.field, controlOf(row).value]));
    }

    function renderMetadata(metadata) {
      fieldRows().forEach((row) => {
        const control = controlOf(row);
        const value = metadata[row.dataset.field] ?? "";
        if (control.value !== value) control.value = value;
      });
    }

    function onMetadataChange(handler) {
      fieldRows().forEach((row) => {
        row.addEventListener("input", () => handler(row.dataset.field, controlOf(row).value));
      });
    }

    function createLanguageOption({ code, name }) {
      const option = dom.createElement("option");
      option.value = code;
      option.label = name;
      return option;
    }

    function fillMangaLanguageOptions() {
      const locale = translator.language;
      const names = new Intl.DisplayNames([locale], { type: "language" });
      const collator = new Intl.Collator(locale);
      const capitalize = (name) => name.charAt(0).toLocaleUpperCase(locale) + name.slice(1);
      const options = ISO_639_1_CODES.map((code) => ({ code, name: capitalize(names.of(code)) }))
        .sort((a, b) => collator.compare(a.name, b.name))
        .map(createLanguageOption);
      elements.mangaLanguageList.replaceChildren(...options);
    }

    fieldRows().forEach((row) => row.addEventListener("input", () => markFieldInvalid(row, false)));

    return {
      renderFieldTags,
      showFieldErrors,
      clearFieldErrors,
      readMetadataForm,
      renderMetadata,
      onMetadataChange,
      fillMangaLanguageOptions,
    };
  }

  Tojiru.ui = Tojiru.ui || {};
  Tojiru.ui.createMetadataFormView = createMetadataFormView;
})((window.Tojiru = window.Tojiru || {}));
