(function (Tojiru) {
  const { MANUAL_KINDS } = Tojiru.domain;

  function createPickerView({ dom, elements, translate, labels, previews }) {
    const { createElement, createOption } = dom;

    function fillPickerKinds() {
      const selected = elements.pickKind.value;
      elements.pickKind.replaceChildren(...MANUAL_KINDS.map((kind) => createOption(kind, labels.kindLabel(kind))));
      if (selected) elements.pickKind.value = selected;
    }

    function createThumbnail(page) {
      const image = createElement("img");
      image.loading = "lazy";
      image.decoding = "async";
      image.alt = page.name;
      image.src = previews.urlFor(page);
      return image;
    }

    function createPageOption(page, onToggle) {
      const label = createElement("label", "pk-thumb");
      const checkbox = createElement("input");
      checkbox.type = "checkbox";
      checkbox.addEventListener("change", () => onToggle(page, checkbox.checked));
      label.append(checkbox, createThumbnail(page), createElement("span", "", page.name));
      return label;
    }

    function createPageGroup(item, onToggle) {
      const group = createElement("div", "pk-group");
      const grid = createElement("div", "pk-grid");
      grid.append(...item.pages.map((page) => createPageOption(page, onToggle)));
      const title = `${labels.folderLabel(item)} · ${translate("count.pages", { n: item.pages.length })}`;
      group.append(createElement("div", "pk-title", title), grid);
      return group;
    }

    function openPicker(items, onToggle) {
      elements.pickName.value = "";
      elements.pickPages.replaceChildren(...items.map((item) => createPageGroup(item, onToggle)));
      elements.picker.showModal();
    }

    function updatePickerCount(count) {
      elements.pickOk.disabled = count === 0;
      elements.pickCount.textContent = translate("count.selectedPages", { n: count });
    }

    const readPickerChoice = () => ({ kind: elements.pickKind.value, title: elements.pickName.value });
    const closePicker = () => elements.picker.close();

    elements.pickCancel.addEventListener("click", closePicker);
    elements.picker.addEventListener("close", () => previews.releaseAll());

    return { fillPickerKinds, openPicker, updatePickerCount, readPickerChoice, closePicker };
  }

  Tojiru.ui = Tojiru.ui || {};
  Tojiru.ui.createPickerView = createPickerView;
})((window.Tojiru = window.Tojiru || {}));
