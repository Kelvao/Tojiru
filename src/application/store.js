(function (Tojiru) {
  function createStore(initialState) {
    let state = initialState;
    const listeners = new Set();
    return {
      get: () => state,
      update(change, { quiet = false } = {}) {
        state = { ...state, ...change(state) };
        if (!quiet) listeners.forEach((listener) => listener(state));
      },
      subscribe(listener) {
        listeners.add(listener);
        return () => listeners.delete(listener);
      },
    };
  }

  Tojiru.usecases = { ...Tojiru.usecases, createStore };
})((window.Tojiru = window.Tojiru || {}));
