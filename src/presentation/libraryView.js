(function (Tojiru) {
  const { ALL_KINDS, isChapter, countPages, totalBytes, computeStartPages } = Tojiru.domain;
  const { defaultTitleOf } = Tojiru.usecases;

  function createLibraryView({ dom, elements, translate, labels }) {
    const { createElement, createOption } = dom;
    const pagesText = (items) => translate("count.pages", { n: countPages(items) });

    function createRowButton(text, className, onClick) {
      const button = createElement("button", className, text);
      button.tabIndex = -1;
      button.addEventListener("click", onClick);
      return button;
    }

    function createReorderControls(index, intents) {
      const controls = createElement("div", "ord");
      controls.append(
        createRowButton("▲", "", () => intents.onMove(index, -1)),
        createRowButton("▼", "", () => intents.onMove(index, 1)),
      );
      return controls;
    }

    function createFolderLabel(item, index, intents) {
      const text = labels.folderLabel(item);
      const label = createElement("div", item.manual ? "fn man" : "fn");
      label.title = text;
      label.append(createElement("span", "", text));
      if (item.manual) label.append(createRowButton(translate("item.undo"), "lnk", () => intents.onUndo(index)));
      return label;
    }

    function createTitleInput(item, index, items, intents) {
      const input = createElement("input");
      input.placeholder = defaultTitleOf(item, items, translate);
      input.value = item.title;
      input.addEventListener("input", () => intents.onRename(index, input.value));
      return input;
    }

    function createKindSelect(item, index, intents) {
      const select = createElement("select", "kd");
      select.setAttribute("aria-label", translate("item.kind"));
      select.append(...ALL_KINDS.map((kind) => createOption(kind, labels.kindLabel(kind))));
      select.value = item.kind;
      select.addEventListener("change", () => intents.onKindChange(index, select.value));
      return select;
    }

    function createStartPageLabel(item, startPage) {
      const label = createElement("div", "pg", translate("page.start", { n: startPage + 1 }));
      label.title = translate("count.pages", { n: item.pages.length });
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
      if (!items.length) return translate("summary.empty");
      const chapters = items.filter(isChapter).length;
      const extras = items.length - chapters;
      const parts = [translate("count.chapters", { n: chapters })];
      if (extras) parts.push(translate("count.extras", { n: extras }));
      parts.push(pagesText(items));
      const bytes = totalBytes(items);
      if (bytes > 0) parts.push(labels.sizeLabel(bytes));
      return parts.join(" · ");
    }

    function describeFolder(items, folderLoaded) {
      if (items.length) return `${translate("count.items", { n: items.length })}, ${pagesText(items)}.`;
      return translate(folderLoaded ? "folder.noImages" : "folder.hint");
    }

    function renderList(items, intents) {
      const startPages = computeStartPages(items);
      const rows = items.map((item, index) =>
        createItemRow({ item, index, items, startPage: startPages[index], intents }),
      );
      if (rows.length) elements.list.replaceChildren(...rows);
      else elements.list.textContent = translate("list.empty");
    }

    function renderLibrary({ manga: { items }, folderLoaded }, intents) {
      renderList(items, intents);
      elements.summary.textContent = describeSummary(items);
      elements.folderStatus.textContent = describeFolder(items, folderLoaded);
    }

    return { renderLibrary };
  }

  Tojiru.ui = Tojiru.ui || {};
  Tojiru.ui.createLibraryView = createLibraryView;
})((window.Tojiru = window.Tojiru || {}));
