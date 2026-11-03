import { isVComponent, isVElement, keyOf, norm, type AnyCtor, type Attrs, type Key, type VChild, type VComponent, type VElement, type VNorm } from "./vdom.js";
import type { Component } from "./component.js";

/**
 * Reconciliador DOM en vivo: parchea lo que cambia y conserva lo demás
 * (focos, scroll, listeners). Nada de re-render completo.
 * Live DOM reconciler: patches what changed and keeps the rest
 * (focus, scroll, listeners). No full re-renders.
 */

/**
 * Nodo ya insertado en el DOM real con su origen virtual.
 * Node already inserted into the real DOM with its virtual origin.
 */
export interface Mounted {
  /** Nodo real. / Real node. */
  node: Node;
  /** VNode que lo produjo (normalizado). / Producing vnode (normalized). */
  vnode: VNorm;
  /** Instancia si es componente. / Instance when it is a component. */
  comp?: Component;
  /** Subárbol renderizado si es componente. / Rendered subtree when a component. */
  rendered?: Mounted;
  /** Hijos montados si es elemento. / Mounted children when an element. */
  kids?: Mounted[];
}

/**
 * Mapa tipo→manejador guardado en el elemento para poder retirarlo.
 * Type→handler map stored on the element so it can be removed later.
 * @param el - Elemento real. / Real element.
 * @returns El mapa, creado si no existía. / The map, created when missing.
 */
function listenersOf(el: Element): Map<string, EventListener> {
  const store = (el as unknown as { __live?: Map<string, EventListener> }).__live;
  if (store) return store;
  const fresh = new Map<string, EventListener>();
  (el as unknown as { __live?: Map<string, EventListener> }).__live = fresh;
  return fresh;
}

/**
 * Aplica class desde string, array u objeto {clase: visible}.
 * Applies class from string, array or {class: visible} object.
 * @param el - Elemento real. / Real element.
 * @param v - Valor crudo del attr. / Raw attr value.
 */
function setClass(el: Element, v: unknown): void {
  let out = "";
  if (typeof v === "string") out = v;
  else if (Array.isArray(v)) out = v.filter(Boolean).join(" ");
  else if (typeof v === "object" && v !== null) {
    out = Object.entries(v as Record<string, unknown>)
      .filter(([, on]) => !!on)
      .map(([cls]) => cls)
      .join(" ");
  }
  el.setAttribute("class", out);
}

/**
 * Aplica style desde texto css o por propiedades.
 * Applies style from css text or per-property.
 * @param el - Elemento real. / Real element.
 * @param v - Valor crudo del attr. / Raw attr value.
 */
function setStyle(el: HTMLElement, v: unknown): void {
  if (typeof v === "string") {
    el.style.cssText = v;
    return;
  }
  if (typeof v === "object" && v !== null) {
    for (const [k, val] of Object.entries(v as Record<string, string | number>)) {
      (el.style as unknown as Record<string, string>)[k] = String(val);
    }
  }
}

/**
 * ¿Es un attr de evento on*? / Is it an on* event attr?
 * @param k - Nombre del attr. / Attr name.
 */
function isEventAttr(k: string): boolean {
  return k.length > 2 && k[0] === "o" && k[1] === "n";
}

/**
 * Aplica un attr de evento on* (registra, sustituye o retira).
 * Applies an on* event attr (registers, replaces or removes).
 * @param el - Elemento real. / Real element.
 * @param k - Nombre on*. / on* name.
 * @param v - Manejador o nada. / Handler or nothing.
 */
function setEventAttr(el: Element, k: string, v: unknown): void {
  const type = k.slice(2).toLowerCase();
  const bag = listenersOf(el);
  const prev = bag.get(type);
  if (prev) el.removeEventListener(type, prev);
  if (typeof v === "function") {
    const fn = v as EventListener;
    bag.set(type, fn);
    el.addEventListener(type, fn);
  } else {
    bag.delete(type);
  }
}

/**
 * ¿Es un attr solo-dato (nunca toca el DOM)? / Is it a data-only attr (never touches the DOM)?
 * @param k - Nombre del attr. / Attr name.
 */
function esSoloDato(k: string): boolean {
  return k === "key" || k === "ref";
}

/**
 * Intenta un attr especial (class, style, key/ref, evento).
 * Tries a special attr (class, style, key/ref, event).
 * @returns true si lo consumió. / true when consumed.
 */
function trySpecialAttr(el: Element, k: string, v: unknown): boolean {
  if (k === "class" || k === "className") {
    setClass(el, v);
    return true;
  }
  if (k === "style") {
    setStyle(el as HTMLElement, v);
    return true;
  }
  if (esSoloDato(k)) return true;
  if (isEventAttr(k)) {
    setEventAttr(el, k, v);
    return true;
  }
  return false;
}

/**
 * Aplica un attr plano: booleano, null (retira) o propiedad nativa.
 * Applies a plain attr: boolean, null (removes) or native property.
 */
function setPlainAttr(el: Element, k: string, v: unknown): void {
  if (typeof v === "boolean") {
    if (v) el.setAttribute(k, "");
    else el.removeAttribute(k);
    return;
  }
  if (v === null || v === undefined) {
    el.removeAttribute(k);
    return;
  }
  if (k in el) {
    (el as unknown as Record<string, unknown>)[k] = v;
  } else {
    el.setAttribute(k, String(v as string | number));
  }
}

/**
 * Aplica un atributo: eventos on*, booleanos, null (retira), propiedad
 * nativa si existe en el elemento o setAttribute en otro caso.
 * Applies one attribute: on* events, booleans, null (removes), native
 * property when the element owns it, setAttribute otherwise.
 * @param el - Elemento real. / Real element.
 * @param k - Nombre del attr. / Attr name.
 * @param v - Valor crudo. / Raw value.
 */
function setAttr(el: Element, k: string, v: unknown): void {
  if (trySpecialAttr(el, k, v)) return;
  setPlainAttr(el, k, v);
}

/**
 * Retira los attrs que sobran. / Removes leftover attrs.
 */
function removeStaleAttrs(el: Element, oldA: Attrs, newA: Attrs): void {
  for (const k of Object.keys(oldA)) {
    if (esSoloDato(k)) continue;
    if (!(k in newA)) setAttr(el, k, undefined);
  }
}

/**
 * Escribe los attrs que cambian. / Writes changed attrs.
 */
function applyChangedAttrs(el: Element, oldA: Attrs, newA: Attrs): void {
  for (const k of Object.keys(newA)) {
    if (esSoloDato(k)) continue;
    if (!Object.is(oldA[k], newA[k])) setAttr(el, k, newA[k]);
  }
}

/**
 * Sincroniza atributos: retira los que sobran y escribe los que cambian.
 * Syncs attributes: removes leftovers and writes changed ones.
 * @param el - Elemento real. / Real element.
 * @param oldA - Attrs anteriores. / Previous attrs.
 * @param newA - Attrs nuevos. / New attrs.
 */
function syncAttrs(el: Element, oldA: Attrs, newA: Attrs): void {
  removeStaleAttrs(el, oldA, newA);
  applyChangedAttrs(el, oldA, newA);
}

/**
 * Indexa hijos previos por key (los repetidos van a sin-key).
 * Indexes previous children by key (duplicates go keyless).
 */
function indexOldKids(oldKids: Mounted[]): { byKey: Map<Key, Mounted>; noKey: Mounted[] } {
  const byKey = new Map<Key, Mounted>();
  const noKey: Mounted[] = [];
  for (const m of oldKids) {
    const k = keyOf(m.vnode);
    if (k === null) noKey.push(m);
    else if (!byKey.has(k)) byKey.set(k, m);
    else noKey.push(m);
  }
  return { byKey, noKey };
}

/**
 * Reclama un montado previo: por key explícita o por posición.
 * Claims a previous mount: by explicit key or by position.
 * @returns Montado reclamado y próximo índice sin-key. / Claimed mount and next keyless index.
 */
function claimKid(byKey: Map<Key, Mounted>, noKey: Mounted[], j: number, k: Key | null): { m?: Mounted; nextJ: number } {
  if (k !== null) {
    const m = byKey.get(k);
    if (m) byKey.delete(k);
    return { m, nextJ: j };
  }
  return { m: noKey[j], nextJ: j + 1 };
}

/**
 * Desmonta sobrantes: lo no reclamado por key y la cola sin-key.
 * Unmounts leftovers: what no key claimed and the keyless tail.
 */
function drainLeftovers(byKey: Map<Key, Mounted>, noKey: Mounted[], j: number): void {
  for (const m of byKey.values()) unmountTree(m);
  for (; j < noKey.length; j++) unmountTree(noKey[j]);
}

/**
 * Monta una lista de hijos desde cero.
 * Mounts a child list from scratch.
 * @param el - Padre real. / Real parent.
 * @param vs - Hijos crudos. / Raw children.
 * @returns Hijos montados en orden. / Mounted children in order.
 */
function mountKids(el: Element, vs: VChild[]): Mounted[] {
  const out: Mounted[] = [];
  for (const v of vs) {
    const m = patchInto(el, null, v, null);
    out.push(m);
  }
  return out;
}

/**
 * Reconcilia hijos: reutiliza por key explícita o por posición, reordena
 * con appendChild y desmonta sobrantes.
 * Reconciles children: reuses by explicit key or position, reorders
 * via appendChild, unmounts leftovers.
 * @param el - Padre real. / Real parent.
 * @param oldKids - Hijos montados previos. / Previously mounted children.
 * @param vs - Hijos nuevos crudos. / New raw children.
 * @returns Hijos montados en orden nuevo. / Mounted children in new order.
 */
function patchKids(el: Element, oldKids: Mounted[], vs: VChild[]): Mounted[] {
  const { byKey, noKey } = indexOldKids(oldKids);
  const out: Mounted[] = [];
  let j = 0;
  const order: Node[] = [];
  for (const raw of vs) {
    const v = norm(raw);
    const claimed = claimKid(byKey, noKey, j, keyOf(v));
    j = claimed.nextJ;
    const nm = patchInto(el, claimed.m ?? null, v, null);
    out.push(nm);
    order.push(nm.node);
  }
  for (const node of order) el.appendChild(node);
  drainLeftovers(byKey, noKey, j);
  return out;
}

/**
 * Crea un elemento real con attrs, hijos y ref inicial.
 * Creates a real element with attrs, children and initial ref.
 * @param v - Nodo virtual. / Virtual node.
 * @returns Nodo e hijos montados. / Node and mounted children.
 */
function mountElement(v: VElement): { node: Element; kids: Mounted[] } {
  const el = document.createElement(v.tag);
  syncAttrs(el, {}, v.attrs);
  const kids = mountKids(el, v.children);
  const ref = v.attrs["ref"];
  if (typeof ref === "function") {
    (ref as (el: Element | null) => void)(el);
  }
  return { node: el, kids };
}

/**
 * Instancia un componente, renderiza y dispara onMount.
 * Instantiates a component, renders and fires onMount.
 * @param vc - Constructor y props. / Constructor and props.
 * @returns Raíz montada del componente. / Mounted component root.
 */
export function mountComp(vc: { ctor: AnyCtor; props: Record<string, unknown> }): Mounted {
  const comp = new vc.ctor(vc.props);
  const rendered = patchInto(null, null, comp.render(), null);
  comp._attach(rendered);
  const m: Mounted = { node: rendered.node, vnode: { kind: "comp", ctor: vc.ctor, props: vc.props }, comp, rendered };
  comp.onMount();
  return m;
}

/**
 * Actualiza un componente vivo con nuevas props y dispara onUpdate.
 * Updates a live component with new props and fires onUpdate.
 * @param m - Montado del componente. / Component mount.
 * @param props - Props nuevas. / New props.
 */
function updateComp(m: Mounted, props: Record<string, unknown>): void {
  const comp = m.comp as Component;
  comp.props = props;
  const parent = m.node.parentNode;
  const next = patchInto(parent, m.rendered as Mounted, comp.render(), null);
  m.rendered = next;
  m.node = next.node;
  comp._rendered = next;
  comp.onUpdate();
}

/**
 * Desmonta la rama componente: onUnmount + subárbol + detach.
 * Unmounts the component branch: onUnmount + subtree + detach.
 * @param m - Montado con comp. / Mount with comp.
 */
function unmountComp(m: Mounted): void {
  const comp = m.comp as Component;
  comp.onUnmount();
  if (m.rendered) unmountTree(m.rendered);
  comp._detach();
}

/**
 * Limpia el ref de un elemento (ref(null)).
 * Cleans an element ref (ref(null)).
 * @param m - Montado de elemento. / Element mount.
 */
function cleanupElementRef(m: Mounted): void {
  const v = m.vnode;
  if (!isVElement(v)) return;
  const ref = v.attrs["ref"];
  if (typeof ref === "function") {
    (ref as (el: Element | null) => void)(null);
  }
}

/**
 * Retira los listeners guardados en el elemento.
 * Removes the listeners stored on the element.
 * @param node - Nodo real. / Real node.
 */
function cleanupListeners(node: Node): void {
  const bag = (node as unknown as { __live?: Map<string, EventListener> }).__live;
  if (!bag || !(node instanceof Element)) return;
  for (const [type, fn] of bag) node.removeEventListener(type, fn);
  bag.clear();
}

/**
 * Desmonta un subárbol: onUnmount, ref(null), retira listeners y el nodo.
 * Unmounts a subtree: onUnmount, ref(null), removes listeners and the node.
 * @param m - Subárbol montado. / Mounted subtree.
 */
export function unmountTree(m: Mounted): void {
  if (m.comp) {
    unmountComp(m);
    m.node.parentNode?.removeChild(m.node);
    return;
  }
  if (isVElement(m.vnode)) {
    cleanupElementRef(m);
    for (const k of m.kids ?? []) unmountTree(k);
    cleanupListeners(m.node);
  }
  m.node.parentNode?.removeChild(m.node);
}

/**
 * Inserta el nodo si aún no cuelga de ese padre.
 * Inserts the node when not hanging from that parent yet.
 * @param parent - Padre real o null. / Real parent or null.
 * @param node - Nodo a colocar. / Node to place.
 * @param anchor - Punto de inserción. / Insertion point.
 */
function colocaSiFalta(parent: Node | null, node: Node, anchor: Node | null): void {
  if (parent && node.parentNode !== parent) parent.insertBefore(node, anchor);
}

/**
 * Parchea un nulo: reutiliza el Text vacío o lo crea.
 * Patches a null: reuses the empty Text or creates it.
 */
function patchNullNode(parent: Node | null, oldM: Mounted | null, anchor: Node | null): Mounted {
  const prev = oldM?.node;
  if (prev instanceof Text) {
    if (prev.textContent !== "") prev.textContent = "";
    colocaSiFalta(parent, prev, anchor);
    if (oldM && oldM.node !== prev) unmountTree(oldM);
    return { node: prev, vnode: null };
  }
  if (oldM) unmountTree(oldM);
  const node = document.createTextNode("");
  colocaSiFalta(parent, node, anchor);
  return { node, vnode: null };
}

/**
 * Parchea texto: reutiliza el Text o lo sustituye.
 * Patches text: reuses the Text or replaces it.
 */
function patchTextNode(parent: Node | null, oldM: Mounted | null, v: string, anchor: Node | null): Mounted {
  if (oldM && oldM.node instanceof Text && typeof oldM.vnode === "string") {
    if (oldM.node.textContent !== v) oldM.node.textContent = v;
    oldM.vnode = v;
    return oldM;
  }
  if (oldM) unmountTree(oldM);
  const node = document.createTextNode(v);
  colocaSiFalta(parent, node, anchor);
  return { node, vnode: v };
}

/**
 * Reutiliza el elemento si coincide la etiqueta (parchea en sitio).
 * Reuses the element on matching tag (patches in place).
 * @returns Montado reutilizado o null. / Reused mount or null.
 */
function reuseElement(oldM: Mounted | null, v: VElement): Mounted | null {
  const ov = oldM?.vnode;
  if (!oldM || !(oldM.node instanceof Element) || !isVElement(ov) || ov.tag.toLowerCase() !== v.tag.toLowerCase()) {
    return null;
  }
  const el = oldM.node;
  syncAttrs(el, ov.attrs, v.attrs);
  oldM.kids = patchKids(el, oldM.kids ?? [], v.children);
  oldM.vnode = v;
  return oldM;
}

/**
 * Reutiliza el componente si coincide clase y key (actualiza props).
 * Reuses the component on matching class and key (updates props).
 * @returns Montado reutilizado o null. / Reused mount or null.
 */
function reuseComp(oldM: Mounted | null, v: VComponent): Mounted | null {
  if (!oldM || !oldM.comp) return null;
  const ov = oldM.vnode;
  if (!isVComponent(ov) || ov.ctor !== v.ctor || keyOf(ov) !== keyOf(v)) return null;
  updateComp(oldM, v.props);
  oldM.vnode = v;
  return oldM;
}

/**
 * Sustituye un montado por uno nuevo conservando su posición.
 * Replaces a mount with a new one keeping its position.
 * @param create - Construye el sustituto (ya con su vnode). / Builds the replacement (with its vnode already).
 */
function replaceMounted(parent: Node | null, oldM: Mounted, anchor: Node | null, create: () => Mounted): Mounted {
  const holder = oldM.node.parentNode ?? parent;
  const at = holder && oldM.node.parentNode === holder ? oldM.node.nextSibling : null;
  unmountTree(oldM);
  const m = create();
  if (holder) holder.insertBefore(m.node, at);
  else if (parent) parent.insertBefore(m.node, at);
  return m;
}

/**
 * Parchea un elemento: reutiliza o sustituye.
 * Patches an element: reuses or replaces it.
 */
function patchElementNode(parent: Node | null, oldM: Mounted | null, v: VElement, anchor: Node | null): Mounted {
  const reused = reuseElement(oldM, v);
  if (reused) return reused;
  if (oldM) {
    return replaceMounted(parent, oldM, anchor, () => {
      const built = mountElement(v);
      return { node: built.node, vnode: v, kids: built.kids };
    });
  }
  const built = mountElement(v);
  if (parent) parent.insertBefore(built.node, anchor);
  return { node: built.node, vnode: v, kids: built.kids };
}

/**
 * Parchea un componente: reutiliza o sustituye.
 * Patches a component: reuses or replaces it.
 */
function patchCompNode(parent: Node | null, oldM: Mounted | null, v: VComponent, anchor: Node | null): Mounted {
  const reused = reuseComp(oldM, v);
  if (reused) return reused;
  if (oldM) return replaceMounted(parent, oldM, anchor, () => mountComp(v));
  const m = mountComp(v);
  if (parent) parent.insertBefore(m.node, anchor);
  return m;
}

/**
 * Parchea oldM con v dentro de parent (null = crear suelto).
 * El reemplazo conserva la posición: el nodo nuevo entra donde estaba el viejo.
 * Patches oldM with v inside parent (null = detached create).
 * Replacement keeps position: the new node lands where the old one was.
 * @param parent - Padre real o null. / Real container or null.
 * @param oldM - Montado previo o null. / Previous mount or null.
 * @param raw - Hijo nuevo crudo. / New raw child.
 * @param anchor - Punto de inserción al crear. / Insertion point on create.
 * @returns Montado resultante. / Resulting mount.
 */
export function patchInto(parent: Node | null, oldM: Mounted | null, raw: VChild, anchor: Node | null): Mounted {
  const v = norm(raw);
  if (v === null) return patchNullNode(parent, oldM, anchor);
  if (typeof v === "string") return patchTextNode(parent, oldM, v, anchor);
  // Componente: se reutiliza si coincide clase y key; si no, se sustituye.
  // Component: reused on matching class and key; replaced otherwise.
  if (isVElement(v)) return patchElementNode(parent, oldM, v, anchor);
  return patchCompNode(parent, oldM, v, anchor);
}

// ---- Cola de render: setState agrupa por microtarea ----
// ---- Render queue: setState batches per microtask ----

/** Componentes pendientes de re-render. / Components awaiting re-render. */
const pending = new Set<Component>();
/** Hay un flush programado. / A flush is scheduled. */
let queued = false;

/**
 * Vacía la cola: re-renderiza cada pendiente que siga montado.
 * Drains the queue: re-renders each still-mounted pending component.
 */
function flush(): void {
  queued = false;
  const work = [...pending];
  pending.clear();
  for (const comp of work) {
    if (comp._mounted && comp._rendered) {
      const parent = comp._rendered.node.parentNode;
      if (!parent) continue;
      const next = patchInto(parent, comp._rendered, comp.render(), null);
      comp._rendered = next;
      comp.onUpdate();
    }
  }
}

/**
 * @internal Encola un re-render agrupado. Lo llama setState/forceUpdate.
 * Enqueues a batched re-render. Called by setState/forceUpdate.
 * @param comp - Componente a actualizar. / Component to update.
 */
export function enqueueRender(comp: Component): void {
  pending.add(comp);
  if (queued) return;
  queued = true;
  queueMicrotask(flush);
}
