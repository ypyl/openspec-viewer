// tiny-context by jsebrech (https://github.com/jsebrech/tiny-context)
// Vendored as an ES module (plain vanilla web, no build step).
// Web components context protocol for cross-component state injection.
//
// Dormant in this app: state flows through a shared signals module
// (app/state.js), not through the component tree. Kept vendored for when a
// real tree-scoped need appears (see design.md).

export class ContextRequestEvent extends Event {
  constructor(context, callback, subscribe) {
    super('context-request', { bubbles: true, composed: true });
    this.context = context;
    this.callback = callback;
    this.subscribe = subscribe;
  }
}

export class ContextProvider extends EventTarget {
  #value; #context;
  get value() { return this.#value; }
  set value(v) { this.#value = v; this.dispatchEvent(new Event('change')); }
  get context() { return this.#context; }
  constructor(target, context, initialValue = undefined) {
    super();
    this.#context = context;
    this.#value = initialValue;
    if (target) this.attach(target);
  }
  attach(target) { target.addEventListener('context-request', this); }
  detach(target) { target.removeEventListener('context-request', this); }
  handleEvent(e) {
    if (e.context === this.context) {
      if (e.subscribe) {
        const unsubscribe = () => this.removeEventListener('change', update);
        const update = () => e.callback(this.value, unsubscribe);
        this.addEventListener('change', update);
        update();
      } else {
        e.callback(this.value);
      }
      e.stopPropagation();
    }
  }
}
