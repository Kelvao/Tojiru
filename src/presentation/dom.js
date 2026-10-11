(function (Tojiru) {
  function createDom(documentRef) {
    function createElement(tag, className = "", text = "") {
      const element = documentRef.createElement(tag);
      element.className = className;
      element.textContent = text;
      return element;
    }

    function createOption(value, text) {
      const option = createElement("option", "", text);
      option.value = value;
      return option;
    }

    return {
      root: documentRef,
      byId: (id) => documentRef.getElementById(id),
      one: (selector) => documentRef.querySelector(selector),
      all: (selector) => documentRef.querySelectorAll(selector),
      createElement,
      createOption,
    };
  }

  Tojiru.ui = Tojiru.ui || {};
  Tojiru.ui.createDom = createDom;
})((window.Tojiru = window.Tojiru || {}));
