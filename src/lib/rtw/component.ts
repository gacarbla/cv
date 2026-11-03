import { enqueueRender, mountComp, unmountTree, type Mounted } from "./render.js";
import type { VChild } from "./vdom.js";

/**
 * Componente base. Patrón React con render en vivo: props de entrada,
 * state propio y setState() que re-renderiza solo su subárbol
 * (agrupado por microtarea). Ciclo: onMount/onUpdate/onUnmount.
 * Base component. React-like pattern with live rendering: input props,
 * own state, and setState() re-rendering only its subtree
 * (batched per microtask). Lifecycle: onMount/onUpdate/onUnmount.
 */
export abstract class Component<
  P extends Record<string, unknown> = Record<string, unknown>,
  S extends Record<string, unknown> = Record<string, unknown>,
> {
  /** Props de entrada (inmutables por convención). / Input props (immutable by convention). */
  props: P;
  /** Estado propio: mutar solo vía setState(). / Own state: mutate only via setState(). */
  state: S;

  /** @internal Bandera del reconciliador; no tocar. / Reconciler flag; do not touch. */
  _mounted = false;
  /** @internal Subárbol montado actual. / Current mounted subtree. */
  _rendered: Mounted | null = null;

  /**
   * Crea el componente. El state nace vacío: fíjalo en el constructor hijo.
   * Creates the component. State starts empty: set it in the child constructor.
   * @param props - Props de entrada. / Input props.
   */
  constructor(props: P) {
    this.props = props;
    this.state = {} as S;
  }

  /**
   * Describe la vista. Se re-ejecuta en cada render.
   * Describes the view. Re-runs on every render.
   * @returns Hijo virtual raíz. / Root virtual child.
   */
  abstract render(): VChild;

  /**
   * Fusiona el parche en el state y programa un re-render agrupado.
   * Merges the patch into state and schedules a batched re-render.
   * @param patch - Claves de estado a actualizar. / State keys to update.
   */
  setState(patch: Partial<S>): void {
    Object.assign(this.state, patch);
    if (this._mounted) enqueueRender(this as Component);
  }

  /**
   * Re-renderiza sin tocar el state (para cambios externos).
   * Re-renders without touching state (for external changes).
   */
  forceUpdate(): void {
    if (this._mounted) enqueueRender(this as Component);
  }

  /**
   * Gancho tras insertarse en el DOM real.
   * Hook after insertion into the real DOM.
   */
  onMount(): void {}
  /**
   * Gancho tras cada re-render aplicado.
   * Hook after each applied re-render.
   */
  onUpdate(): void {}
  /**
   * Gancho antes de desmontarse: desuscribe aquí.
   * Hook before unmount: unsubscribe here.
   */
  onUnmount(): void {}

  /**
   * @internal Enlaza el subárbol montado. Lo llama el reconciliador.
   * Binds the mounted subtree. Called by the reconciler.
   * @param m - Subárbol montado. / Mounted subtree.
   */
  _attach(m: Mounted): void {
    this._rendered = m;
    this._mounted = true;
  }

  /**
   * @internal Rompe el enlace. Lo llama el reconciliador.
   * Breaks the link. Called by the reconciler.
   */
  _detach(): void {
    this._mounted = false;
    this._rendered = null;
  }
}

/**
 * Monta un componente en un elemento real (lo vacía antes).
 * Mounts a component into a real element (empties it first).
 * @param ctor - Clase del componente. / Component class.
 * @param target - Contenedor real. / Real container.
 * @param props - Props iniciales. / Initial props.
 * @returns Desmontador: limpia listeners y ciclo. / Unmount callback: cleans listeners and lifecycle.
 */
export function mount<P extends Record<string, unknown>>(
  ctor: new (props: P) => Component<P, any>,
  target: Element,
  props?: P,
): () => void {
  target.textContent = "";
  const m = mountComp({ ctor, props: (props ?? {}) as Record<string, unknown> });
  target.appendChild(m.node);
  return () => {
    unmountTree(m);
  };
}
