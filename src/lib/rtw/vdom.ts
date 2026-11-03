import type { Component } from "./component.js";

/**
 * Nodos virtuales: elementos, componentes o texto. Sin JSX, todo en vivo.
 * Virtual nodes: elements, components or text. No JSX, everything live.
 */

/** Clave estable para reconciliar listas. / Stable key for list reconciliation. */
export type Key = string | number;
/** Valor admitido en un atributo. / Allowed attribute value. */
export type AttrValue = string | number | boolean | null | undefined | EventHandler | StyleValue | RefFn;
/** Manejador de evento DOM. / DOM event handler. */
export type EventHandler = (e: Event) => void;
/** Callback de referencia: recibe el elemento al montar y null al desmontar. / Ref callback: element on mount, null on unmount. */
export type RefFn = (el: Element | null) => void;
/** Estilo en texto o por propiedades. / Style as text or per-property. */
export type StyleValue = string | Record<string, string | number>;
/** Mapa de atributos de un elemento. / Element attribute map. */
export type Attrs = Record<string, AttrValue>;

/** Nodo de elemento HTML. / HTML element node. */
export interface VElement {
  /** Discriminante: siempre "el". / Discriminant: always "el". */
  kind: "el";
  /** Etiqueta (div, span...). / Tag name (div, span...). */
  tag: string;
  /** Atributos sin key. / Attributes without key. */
  attrs: Attrs;
  /** Hijos sin normalizar. / Unnormalized children. */
  children: VChild[];
  /** Clave opcional para listas. / Optional list key. */
  key?: Key;
}

/** Nodo de componente. / Component node. */
export interface VComponent {
  /** Discriminante: siempre "comp". / Discriminant: always "comp". */
  kind: "comp";
  /** Clase a instanciar. / Class to instantiate. */
  ctor: AnyCtor;
  /** Props de entrada (incluye children). / Input props (includes children). */
  props: Record<string, unknown>;
  /** Clave opcional para listas. / Optional list key. */
  key?: Key;
}

/**
 * Constructor aceptado en h() y mount(): las props las fija el llamador.
 * Accepted constructor in h() and mount(): the caller fixes props.
 */
export type AnyCtor = new (props: any) => Component<any, any>;

/** Nodo virtual completo. / Full virtual node. */
export type VNode = VElement | VComponent;
/**
 * Hijo declarativo. null/undefined/false no pintan nada (condicionales directos).
 * Declarative child. null/undefined/false render nothing (inline conditionals).
 */
export type VChild = VNode | string | number | null | undefined | false;
/**
 * Forma normalizada: elemento, componente, texto o nada.
 * Normalized form: element, component, text or nothing.
 */
export type VNorm = VElement | VComponent | string | null;

/**
 * Comprueba si el nodo es un elemento (undefined nunca lo es).
 * Checks whether the node is an element (undefined never is).
 * @param v - Nodo normalizado o ausente. / Normalized or missing node.
 * @returns true si es VElement. / true when it is a VElement.
 */
export function isVElement(v: VNorm | undefined): v is VElement {
  return typeof v === "object" && v !== null && v.kind === "el";
}

/**
 * Comprueba si el nodo es un componente (undefined nunca lo es).
 * Checks whether the node is a component (undefined never is).
 * @param v - Nodo normalizado o ausente. / Normalized or missing node.
 * @returns true si es VComponent. / true when it is a VComponent.
 */
export function isVComponent(v: VNorm | undefined): v is VComponent {
  return typeof v === "object" && v !== null && v.kind === "comp";
}

/**
 * Normaliza un hijo: null/false a null, números a texto.
 * Normalizes a child: null/false to null, numbers to text.
 * @param c - Hijo crudo. / Raw child.
 * @returns Forma lista para el reconciliador. / Reconciler-ready form.
 */
export function norm(c: VChild): VNorm {
  if (c === null || c === undefined || c === false) return null;
  if (typeof c === "number") return String(c);
  return c;
}

/**
 * Extrae la key de reconciliación o null si no hay (o si falta el nodo).
 * Extracts the reconciliation key, null when absent (or node missing).
 * @param v - Nodo normalizado o ausente. / Normalized or missing node.
 * @returns La key o null. / The key or null.
 */
export function keyOf(v: VNorm | undefined): Key | null {
  if (typeof v === "object" && v !== null && v.key !== undefined) return v.key;
  return null;
}

/**
 * Aplana arrays de hijos recursivamente en `out` (h() acepta anidados).
 * Flattens nested child arrays into `out` (h() accepts nesting).
 * @param out - Acumulador. / Accumulator.
 * @param c - Hijo o lista de hijos. / Child or child list.
 */
function flat(out: VChild[], c: VChild | VChild[]): void {
  if (Array.isArray(c)) {
    for (const i of c) flat(out, i);
    return;
  }
  out.push(c);
}

/** h("div", { class: "x", onClick }, ...hijos). key/ref van en attrs. / key/ref go in attrs. */
export function h(tag: string, attrs?: Attrs | null, ...children: Array<VChild | VChild[]>): VElement;
/** h(MiComp, { titulo }, ...hijos). Los hijos llegan como props.children. / Children arrive as props.children. */
export function h<P extends Record<string, unknown>>(
  ctor: new (props: P) => Component<P, any>,
  props?: P | null,
  ...children: Array<VChild | VChild[]>
): VComponent;
export function h(
  tag: string | AnyCtor,
  attrs?: Attrs | null,
  ...children: Array<VChild | VChild[]>
): VElement | VComponent {
  const kids: VChild[] = [];
  for (const c of children) flat(kids, c);
  if (typeof tag === "string") {
    const { key, ...rest } = attrs ?? {};
    return { kind: "el", tag, attrs: rest, children: kids, key: key as Key | undefined };
  }
  const { key, ...rest } = (attrs ?? {}) as Record<string, unknown>;
  return {
    kind: "comp",
    ctor: tag as AnyCtor,
    props: { ...rest, children: kids },
    key: key as Key | undefined,
  };
}

/**
 * Azúcar para texto explícito (evita mezclar tipos en arrays).
 * Sugar for explicit text (avoids mixing types in arrays).
 * @param value - Texto o número. / Text or number.
 * @returns Siempre string. / Always a string.
 */
export function tx(value: string | number): string {
  return String(value);
}
