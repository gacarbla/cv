import type { Unsubscribe } from "./signal.js";

/**
 * Direccionamiento personalizable: tres estrategias (clásica por ruta,
 * solo-dominio con hash, o memoria con persistencia) + transiciones
 * entre layouts declaradas en el destino. Todo tipado para autocompletar.
 * Custom routing: three strategies (classic path, hash-only domain,
 * or memory with persistence) + destination-declared layout transitions.
 * Fully typed for autocomplete.
 */

/**
 * Estrategia clásica: dominio/ruta/a/la/pagina (History API).
 * Classic strategy: domain/path/to/page (History API).
 */
export interface PathStrategyOptions {
  /** Prefijo base si la web no vive en la raíz. Por defecto "". / Base prefix when not hosted at root. Defaults "". */
  base?: string;
}

/**
 * Estrategia de dominio base: la ruta vive en el hash (#/ruta).
 * Base-domain strategy: the route lives in the hash (#/route).
 */
export interface HashStrategyOptions {
  /** Prefijo del hash. Por defecto "#". / Hash prefix. Defaults "#". */
  prefix?: string;
}

/**
 * Estrategia en memoria: la URL nunca cambia. La ruta se guarda
 * donde elijas para sobrevivir recargas.
 * Memory strategy: the URL never changes. The route is stored
 * where you choose to survive reloads.
 */
export interface MemoryStrategyOptions {
  /** Dónde persistir la ruta actual. Por defecto false (solo memoria). / Where to persist. Defaults false (memory only). */
  persist?: false | "session" | "local";
  /** Clave de almacenamiento. Por defecto "rtw:route". / Storage key. Defaults "rtw:route". */
  key?: string;
}

/**
 * Estrategia elegida con solo sus opciones (unión discriminada).
 * Chosen strategy with only its options (discriminated union).
 */
export type StrategyOptions =
  | { kind: "path"; path?: PathStrategyOptions }
  | { kind: "hash"; hash?: HashStrategyOptions }
  | { kind: "memory"; memory?: MemoryStrategyOptions };

/** Nombre de estrategia. / Strategy name. */
export type StrategyKind = StrategyOptions["kind"];

/** Contrato que cumple toda estrategia. / Contract every strategy fulfills. */
export interface RouteStrategy {
  /** Su kind. / Its kind. */
  readonly kind: StrategyKind;
  /** Ruta actual normalizada (siempre empieza por "/"). / Normalized current route (always starts with "/"). */
  current(): string;
  /**
   * Navega a una ruta.
   * Navigates to a route.
   * @param to - Ruta destino. / Destination route.
   * @param replace - Sustituye el historial en vez de apilar. / Replaces history instead of pushing.
   */
  navigate(to: string, replace?: boolean): void;
  /**
   * Escucha cambios de ruta.
   * Listens to route changes.
   * @param fn - Oyente con la ruta nueva. / Listener with the new route.
   * @returns Desuscriptor. / Unsubscriber.
   */
  listen(fn: (path: string) => void): Unsubscribe;
}

/**
 * Fuente de idioma para el prefijo de locale (/es/*). Lo cumple I18n.
 * Language source for the locale prefix (/es/*). I18n fulfills it.
 */
export interface LocaleSource {
  /** Idiomas válidos. / Valid languages. */
  readonly languages: readonly string[];
  /** Idioma activo. / Active language. */
  currentLang(): string;
  /** Fija el idioma (ignora desconocidos). / Sets the language (ignores unknown). */
  useLang(lang: string): void;
  /**
   * Pinta i18n bajo root, sin suscribirse (para traducir antes de insertar).
   * Paints i18n under root, without subscribing (to translate before insert).
   * @param root - Raíz. / Root.
   */
  paint(root: ParentNode): void;
  /**
   * Escucha cambios de idioma.
   * Listens to language changes.
   * @param fn - Oyente. / Listener.
   * @returns Desuscriptor. / Unsubscriber.
   */
  onLang(fn: () => void): () => void;
  /**
   * Pinta i18n bajo root.
   * Paints i18n under root.
   * @param root - Raíz (document o shadow). / Root (document or shadow).
   * @returns Desuscriptor del repintado. / Repaint unsubscriber.
   */
  apply(root: ParentNode): () => void;
}

/**
 * Normaliza a "/ruta" (añade la barra si falta).
 * Normalizes to "/route" (adds the slash when missing).
 * @param path - Ruta cruda. / Raw route.
 * @returns Ruta normalizada. / Normalized route.
 */
function slash(path: string): string {
  return path.startsWith("/") ? path : `/${path}`;
}

/** Estrategia path: History API + popstate. / Path strategy: History API + popstate. */
class PathStrategy implements RouteStrategy {
  readonly kind = "path" as const;
  /** Prefijo base. / Base prefix. */
  private base: string;
  /** Oyentes vivos. / Live listeners. */
  private listeners = new Set<(path: string) => void>();
  /** Reemite al navegar atrás/adelante. / Re-emits on back/forward. */
  private onPop = (): void => this.emit();

  /**
   * @param opts - Opciones path. / Path options.
   */
  constructor(opts: PathStrategyOptions = {}) {
    this.base = opts.base ?? "";
  }

  current(): string {
    const p = location.pathname;
    const rel = this.base && p.startsWith(this.base) ? p.slice(this.base.length) : p;
    return slash(rel || "/");
  }

  navigate(to: string, replace = false): void {
    const url = this.base + slash(to);
    if (replace) history.replaceState(null, "", url);
    else history.pushState(null, "", url);
    this.emit();
  }

  listen(fn: (path: string) => void): Unsubscribe {
    if (this.listeners.size === 0) window.addEventListener("popstate", this.onPop);
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
      if (this.listeners.size === 0) window.removeEventListener("popstate", this.onPop);
    };
  }

  /** Emite la ruta actual a todos. / Emits the current route to all. */
  private emit(): void {
    const cur = this.current();
    for (const fn of [...this.listeners]) fn(cur);
  }
}

/** Estrategia hash: location.hash + hashchange. / Hash strategy: location.hash + hashchange. */
class HashStrategy implements RouteStrategy {
  readonly kind = "hash" as const;
  /** Prefijo del hash. / Hash prefix. */
  private prefix: string;
  /** Oyentes vivos. / Live listeners. */
  private listeners = new Set<(path: string) => void>();
  /** Reemite al cambiar el hash. / Re-emits on hash change. */
  private onHash = (): void => this.emit();

  /**
   * @param opts - Opciones hash. / Hash options.
   */
  constructor(opts: HashStrategyOptions = {}) {
    this.prefix = opts.prefix ?? "#";
  }

  current(): string {
    const h = location.hash;
    const rel = h.startsWith(this.prefix) ? h.slice(this.prefix.length) : h.replace(/^#/, "");
    return slash(rel || "/");
  }

  navigate(to: string, replace = false): void {
    const next = this.prefix + slash(to);
    if (replace) {
      location.replace(next);
    } else if (location.hash !== next) {
      location.hash = next;
    } else {
      this.emit();
    }
  }

  listen(fn: (path: string) => void): Unsubscribe {
    if (this.listeners.size === 0) window.addEventListener("hashchange", this.onHash);
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
      if (this.listeners.size === 0) window.removeEventListener("hashchange", this.onHash);
    };
  }

  /** Emite la ruta actual a todos. / Emits the current route to all. */
  private emit(): void {
    const cur = this.current();
    for (const fn of [...this.listeners]) fn(cur);
  }
}

/**
 * Elige dónde persistir la ruta o nada.
 * Picks where to persist the route or nothing.
 * @param persist - Modo pedido. / Requested mode.
 */
function eligeAlmacen(persist: MemoryStrategyOptions["persist"]): Storage | null {
  if (persist === "local") return safeStorage("local");
  if (persist === "session") return safeStorage("session");
  return null;
}

/**
 * Estrategia en memoria: estado local + persistencia opcional.
 * Memory strategy: local state + optional persistence.
 */
class MemoryStrategy implements RouteStrategy {
  readonly kind = "memory" as const;
  /** Ruta actual. / Current route. */
  private at: string;
  /** Almacén elegido o null. / Chosen storage or null. */
  private store: Storage | null;
  /** Clave de persistencia. / Persistence key. */
  private key: string;
  /** Oyentes vivos. / Live listeners. */
  private listeners = new Set<(path: string) => void>();

  /**
   * Restaura la ruta guardada si la hay.
   * Restores the saved route when present.
   * @param opts - Opciones memory. / Memory options.
   */
  constructor(opts: MemoryStrategyOptions = {}) {
    this.key = opts.key ?? "rtw:route";
    this.store = eligeAlmacen(opts.persist);
    let saved: string | null = null;
    try {
      saved = this.store?.getItem(this.key) ?? null;
    } catch {
      saved = null;
    }
    this.at = slash(saved || "/");
  }

  current(): string {
    return this.at;
  }

  navigate(to: string): void {
    const next = slash(to);
    if (next === this.at) return;
    this.at = next;
    try {
      this.store?.setItem(this.key, next);
    } catch {
      /* la persistencia es opcional / persistence is optional */
    }
    for (const fn of [...this.listeners]) fn(next);
  }

  listen(fn: (path: string) => void): Unsubscribe {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  }
}

/**
 * Accede al almacén sin romper en privado/SSR.
 * Accesses storage without breaking in private mode/SSR.
 * @param which - Cuál pedir. / Which one to get.
 * @returns El almacén o null. / The storage or null.
 */
function safeStorage(which: "local" | "session"): Storage | null {
  try {
    return which === "local" ? localStorage : sessionStorage;
  } catch {
    return null;
  }
}

/**
 * Crea la estrategia elegida. Autocompleta `kind` y sus opciones.
 * Creates the chosen strategy. Autocompletes `kind` and its options.
 * @param opts - Estrategia + opciones. / Strategy + options.
 * @returns Estrategia lista. / Ready strategy.
 */
export function createStrategy(opts: StrategyOptions): RouteStrategy {
  if (opts.kind === "path") return new PathStrategy(opts.path);
  if (opts.kind === "hash") return new HashStrategy(opts.hash);
  return new MemoryStrategy(opts.memory);
}

/**
 * Transiciones built-in (WAAPI, respetan reduced-motion).
 * Built-in transitions (WAAPI, honor reduced-motion).
 */
export type TransitionName = "fade" | "slide" | "none";

/**
 * Transición propia: anima entrante/saliente y resuelve al terminar.
 * Custom transition: animates incoming/outgoing, resolves when done.
 * @param incoming - Vista que entra (ya en el outlet). / Incoming view (already in outlet).
 * @param outgoing - Vista que sale o null en primera carga. / Outgoing view or null on first load.
 */
export type TransitionFn = (incoming: Element, outgoing: Element | null) => Promise<void> | void;

/** Transición declarada en el layout destino. / Destination-declared transition. */
export interface TransitionDef {
  /**
   * Desde dónde aplica: "always" (cualquier layout) o solo desde esas rutas.
   * Where it applies from: "always" (any layout) or only from those routes.
   */
  from: "always" | readonly string[];
  /**
   * Efecto built-in o función propia.
   * Built-in effect or custom function.
   */
  using: TransitionName | TransitionFn;
  /** Duración en ms para los built-in. Por defecto 250. / Ms for built-ins. Defaults 250. */
  duration?: number;
}

/** Módulo que devuelve load(): algo montable en un elemento. / What load() returns: something mountable. */
export interface RouteModule {
  /** Monta el layout. Puede ser async. / Mounts the layout. May be async. */
  mount: (el: Element) => unknown;
}

/**
 * Definición de ruta. `name` autocompleta en go() y en `from`.
 * Route definition. `name` autocompletes in go() and in `from`.
 */
export interface RouteDef<N extends string = string> {
  /** Nombre único: autocompleta en go(), pathOf() y TransitionDef.from. / Unique name: autocompletes in go(), pathOf() and TransitionDef.from. */
  name: N;
  /** Ruta URL ("contacto" o "/contacto": se normaliza). / URL route ("contacto" or "/contacto": normalized). */
  path: string;
  /**
   * Layout contenedor: lo que NO cambia entre rutas (nav, pie...).
   * Container layout: what does NOT change across routes (nav, footer...).
   */
  layout: {
    /** Nombre para detectar cambio de layout. / Name to detect layout change. */
    name: string;
    /** Carga perezosa del módulo layout (exporta mountNombre). / Lazy layout load (exports mountNombre). */
    load: () => Promise<RouteModule>;
  };
  /** Carga perezosa del módulo page (exporta mountNombre). / Lazy page load (exports mountNombre). */
  load: () => Promise<RouteModule>;
  /**
   * Transición en destino: una regla o varias. Con varias, la específica
   * (from concreto) gana a la general. Usa el builder (Routes.route...).
   * Destination transition: one rule or several. With several, the specific
   * one (concrete from) beats the general. Use the builder (Routes.route...).
   */
  transition?: TransitionDef | TransitionDef[];
}

/** Opciones del router. / Router options. */
export interface RouterOptions {
  /** Dónde se estampa cada layout. / Where each layout is stamped. */
  outlet: Element;
  /** Estrategia de URL. Por defecto clásica por ruta. / URL strategy. Defaults to classic path. */
  strategy?: StrategyOptions;
  /** Nombre de ruta para URLs desconocidas. Sin ella se ignora la navegación. / Route name for unknown URLs. Without it navigation is ignored. */
  fallback?: string;
  /** Transición cuando el destino no declara ninguna. / Transition when destination declares none. */
  defaultTransition?: TransitionDef;
  /**
   * Fuente de idioma: activa el prefijo /:lang/* (/es/proyectos).
   * Sin ella las rutas van sin prefijo.
   * Language source: enables the /:lang/* prefix (/es/proyectos).
   * Without it routes carry no prefix.
   */
  locale?: LocaleSource;
  /**
   * Prepara cada vista tras montarla y antes de insertarla
   * (p. ej. traducirla para no pintar dos veces).
   * Prepares each view after mount and before insert
   * (e.g. translate it to avoid painting twice).
   */
  prepare?: (view: Element) => void;
}

/** Ruta resuelta. / Resolved route. */
export interface CurrentRoute<N extends string> {
  /** Nombre de la ruta. / Route name. */
  name: N;
  /** Path normalizado. / Normalized path. */
  path: string;
  /** Nombre del layout vigente. / Current layout name. */
  layout: string;
}

/**
 * ¿El usuario prefiere sin movimiento? Las transiciones lo respetan.
 * Does the user prefer no motion? Transitions honor it.
 * @returns true si hay que cortar directo. / true when cutting directly.
 */
function reducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * Dice si una regla es específica para el origen dado (from concreto que lo menciona).
 * Tells whether a rule is specific to the given source (concrete from naming it).
 * @param d - Regla a examinar. / Rule to inspect.
 * @param from - Nombre de la ruta origen. / Source route name.
 * @returns true si es específica para ese origen. / true when specific to that source.
 */
function esEspecifica(d: TransitionDef, from: string): boolean {
  return d.from !== "always" && (d.from as readonly string[]).includes(from);
}

/**
 * Normaliza la transición destino a lista (una regla o varias).
 * Normalizes the destination transition into a list (one rule or several).
 * @param dest - Transición declarada o ausente. / Declared transition or absent.
 * @returns Lista de reglas (vacía si no hay). / Rule list (empty when none).
 */
function comoLista(dest: TransitionDef | TransitionDef[] | undefined): TransitionDef[] {
  if (dest === undefined) return [];
  if (Array.isArray(dest)) return dest;
  return [dest];
}

/**
 * Busca la regla específica que mencione al origen.
 * Finds the specific rule naming the source.
 * @param list - Reglas destino. / Destination rules.
 * @param from - Nombre de la ruta origen. / Source route name.
 * @returns La regla específica o undefined. / The specific rule or undefined.
 */
function buscaEspecifica(list: TransitionDef[], from: string): TransitionDef | undefined {
  return list.find((d) => esEspecifica(d, from));
}

/**
 * Elige la regla general (from always) o el fallback por defecto.
 * Picks the general rule (from always) or the default fallback.
 * @param list - Reglas destino. / Destination rules.
 * @param fallback - Transición por defecto. / Default transition.
 * @returns La regla general/fallback o undefined. / The general/fallback rule or undefined.
 */
function eligeGeneral(list: TransitionDef[], fallback: TransitionDef | undefined): TransitionDef | undefined {
  const general = list.find((d) => d.from === "always");
  if (general) return general;
  return fallback;
}

/**
 * Decide el veredicto final desde la regla elegida y el origen.
 * Decides the final verdict from the chosen rule and the source.
 * @param def - Regla elegida o undefined. / Chosen rule or undefined.
 * @param fromName - Ruta origen o null en primera carga. / Source route or null on first load.
 * @returns Si aplica + efecto + duración. / Whether it applies + effect + duration.
 */
function decide(def: TransitionDef | undefined, fromName: string | null): {
  apply: boolean;
  using: TransitionName | TransitionFn;
  duration: number;
} {
  if (!def) return { apply: false, using: "none", duration: 0 };
  if (fromName === null) return { apply: def.from === "always", using: def.using, duration: def.duration ?? 250 };
  const ok = def.from === "always" || (def.from as readonly string[]).includes(fromName);
  return { apply: ok, using: def.using, duration: def.duration ?? 250 };
}

/**
 * Resuelve si la transición aplica desde `fromName` (null = primera carga).
 * Con varias reglas: primero la específica que mencione el origen,
 * luego la general (from always), luego el fallback.
 * Resolves whether the transition applies from `fromName` (null = first load).
 * With several rules: first the specific one naming the source,
 * then the general (from always), then the fallback.
 * @param dest - Transición del destino (una o varias). / Destination transition (one or several).
 * @param fallback - Transición por defecto. / Default transition.
 * @param fromName - Ruta origen o null. / Source route or null.
 * @returns Si aplica + efecto + duración. / Whether it applies + effect + duration.
 */
export function resolveTransition(
  dest: TransitionDef | TransitionDef[] | undefined,
  fallback: TransitionDef | undefined,
  fromName: string | null,
): { apply: boolean; using: TransitionName | TransitionFn; duration: number } {
  const list = comoLista(dest);
  if (fromName !== null) {
    const hit = buscaEspecifica(list, fromName);
    if (hit) return { apply: true, using: hit.using, duration: hit.duration ?? 250 };
  }
  const def = eligeGeneral(list, fallback);
  return decide(def, fromName);
}

/**
 * Corre el fundido de entrada/salida por WAAPI.
 * Runs the incoming/outgoing fade via WAAPI.
 * @param incoming - Vista que entra. / Incoming view.
 * @param outgoing - Vista que sale o null. / Outgoing view or null.
 * @param duration - Ms del efecto. / Effect ms.
 * @returns Se resuelve al terminar o cortarse. / Resolves on finish or cut.
 */
async function correFundido(incoming: Element, outgoing: Element | null, duration: number): Promise<void> {
  const anims: Animation[] = [];
  anims.push(incoming.animate([{ opacity: "0" }, { opacity: "1" }], { duration, easing: "ease-out" }));
  if (outgoing) {
    anims.push(outgoing.animate([{ opacity: "1" }, { opacity: "0" }], { duration, easing: "ease-out" }));
  }
  await esperaAnims(anims, duration);
}

/**
 * Corre el deslizamiento de entrada/salida por WAAPI.
 * Runs the incoming/outgoing slide via WAAPI.
 * @param incoming - Vista que entra. / Incoming view.
 * @param outgoing - Vista que sale o null. / Outgoing view or null.
 * @param duration - Ms del efecto. / Effect ms.
 * @returns Se resuelve al terminar o cortarse. / Resolves on finish or cut.
 */
async function correDesliz(incoming: Element, outgoing: Element | null, duration: number): Promise<void> {
  const anims: Animation[] = [];
  anims.push(
    incoming.animate(
      [
        { opacity: "0", transform: "translateX(24px)" },
        { opacity: "1", transform: "translateX(0)" },
      ],
      { duration, easing: "ease-out" },
    ),
  );
  if (outgoing) {
    anims.push(
      outgoing.animate(
        [
          { opacity: "1", transform: "translateX(0)" },
          { opacity: "0", transform: "translateX(-24px)" },
        ],
        { duration, easing: "ease-out" },
      ),
    );
  }
  await esperaAnims(anims, duration);
}

/**
 * Espera las animaciones con red de seguridad (carrera + timeout).
 * Waits for the animations with a safety net (race + timeout).
 * @param anims - Animaciones lanzadas. / Started animations.
 * @param duration - Ms de referencia para el timeout. / Reference ms for the timeout.
 */
async function esperaAnims(anims: Animation[], duration: number): Promise<void> {
  try {
    await Promise.race([
      Promise.all(anims.map((a) => a.finished)),
      new Promise((r) => setTimeout(r, duration + 250)),
    ]);
  } catch {
    /* animación interrumpida por otra navegación / animation interrupted by another navigation */
  }
}

/**
 * Ejecuta el efecto (built-in o propio) sobre las dos vistas.
 * Runs the effect (built-in or custom) over both views.
 * @param using - Efecto a ejecutar. / Effect to run.
 * @param incoming - Vista que entra. / Incoming view.
 * @param outgoing - Vista que sale o null. / Outgoing view or null.
 * @param duration - Ms para built-in. / Ms for built-ins.
 */
async function runUsing(using: TransitionName | TransitionFn, incoming: Element, outgoing: Element | null, duration: number): Promise<void> {
  if (reducedMotion() || using === "none") return;
  if (typeof using === "function") {
    await using(incoming, outgoing);
    return;
  }
  if (using === "fade") {
    await correFundido(incoming, outgoing, duration);
    return;
  }
  await correDesliz(incoming, outgoing, duration);
}

/**
 * Crea el evento de navegación para enlaces dentro de Shadow DOM.
 * Los clics en sombra llegan al documento re-objetivados al host,
 * así que el router no puede ver el <a>: el componente despacha
 * esto (burbujea y COMPOSTO, atraviesa la sombra) y quien tenga
 * el router llama a go() con el nombre.
 * Creates the navigation event for links inside Shadow DOM.
 * Shadow clicks reach the document retargeted at the host,
 * so the router cannot see the <a>: the component dispatches
 * this (bubbling and COMPOSED, crosses shadow) and whoever owns
 * the router calls go() with the name.
 * @param name - Nombre de ruta destino. / Destination route name.
 * @returns Evento listo para dispatchEvent. / Ready-to-dispatch event.
 */
export function routeEvent(name: string): CustomEvent<string> {
  return new CustomEvent<string>("rtw:go", { detail: name, bubbles: true, composed: true });
}

/**
 * Apila entrante/saliente en la misma celda durante la transición para
 * que no empujen el flujo (ese era el "salto"). Devuelve restaurar.
 * Stacks incoming/outgoing in the same cell during the transition so
 * they never push layout around (that was the "jump"). Returns restore.
 * @param outlet - Contenedor de vistas. / View container.
 * @param outgoing - Vista que sale. / Outgoing view.
 * @param incoming - Vista que entra. / Incoming view.
 * @returns Restaura los estilos previos. / Restores previous styles.
 */
function stackViews(outlet: Element, outgoing: HTMLElement, incoming: HTMLElement): () => void {
  const box = outlet as HTMLElement;
  const prevDisplay = box.style.display;
  const prevOverflow = box.style.overflow;
  const prevArea = outgoing.style.gridArea;
  box.style.display = "grid";
  box.style.overflow = "hidden";
  outgoing.style.gridArea = "1/1";
  incoming.style.gridArea = "1/1";
  return () => {
    box.style.display = prevDisplay;
    box.style.overflow = prevOverflow;
    outgoing.style.gridArea = prevArea;
    incoming.style.removeProperty("grid-area");
  };
}

/**
 * Dice si el clic es plano (botón izquierdo sin modificadores ni prevent).
 * Tells whether the click is plain (left button, no modifiers, no prevent).
 * @param e - Evento de ratón. / Mouse event.
 * @returns true si el router puede interceptarlo. / true when the router may intercept it.
 */
function esClicPlano(e: MouseEvent): boolean {
  return !e.defaultPrevented && e.button === 0 && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey;
}

/**
 * Extrae el enlace <a href> bajo el punto del clic.
 * Extracts the <a href> link under the click point.
 * @param e - Evento de ratón. / Mouse event.
 * @returns El ancla o null. / The anchor or null.
 */
function enlaceDe(e: MouseEvent): HTMLAnchorElement | null {
  return ((e.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null) ?? null;
}

/**
 * Construye la URL absoluta del href del ancla (null si es inválida).
 * Builds the absolute URL of the anchor href (null when invalid).
 * @param a - Ancla clicada. / Clicked anchor.
 * @returns URL absoluta o null. / Absolute URL or null.
 */
function urlDe(a: HTMLAnchorElement): URL | null {
  try {
    return new URL(a.getAttribute("href") ?? "", location.href);
  } catch {
    return null;
  }
}

/**
 * Dice si la URL comparte origen con la página (navegable por el router).
 * Tells whether the URL shares origin with the page (router-navigable).
 * @param url - URL candidata. / Candidate URL.
 * @returns true si es interna. / true when internal.
 */
function esInterna(url: URL): boolean {
  return url.origin === location.origin;
}

/**
 * Router tipado por los nombres de tus rutas: go() y `from` autocompletan.
 * Uso: Router.define([...], { outlet }) y start().
 * Router typed by your route names: go() and `from` autocomplete.
 * Usage: Router.define([...], { outlet }) then start().
 */
export class Router<const N extends string = string> {
  /** Estrategia de URL activa. / Active URL strategy. */
  private strategy: RouteStrategy;
  /** Contenedor de vistas. / View container. */
  private outlet: Element;
  /** Índice path→def. / path→def index. */
  private byPath = new Map<string, RouteDef<N>>();
  /** Índice name→def. / name→def index. */
  private byName = new Map<N, RouteDef<N>>();
  /** Nombre fallback. / Fallback name. */
  private fallback?: string;
  /** Transición por defecto. / Default transition. */
  private defaultTransition?: TransitionDef;
  /** Fuente de locale o undefined (sin prefijo). / Locale source or undefined (no prefix). */
  private locale?: LocaleSource;
  /** Ruta pintada o null. / Painted route or null. */
  private current: CurrentRoute<N> | null = null;
  /** Observadores de ruta. / Route watchers. */
  private watchers = new Set<(route: CurrentRoute<N>) => void>();
  /** Token anti-carreras entre navegaciones. / Anti-race token across navigations. */
  private token = 0;
  /** Desuscriptor de la estrategia. / Strategy unsubscriber. */
  private stopListen: Unsubscribe | null = null;
  /** Click global (solo path). / Global click (path only). */
  private onDocClick: ((e: MouseEvent) => void) | null = null;
  /** Prepara vistas antes de insertar. / Prepares views before insert. */
  private prepare?: (view: Element) => void;

  /**
   * Constructor privado: usa define().
   * Private constructor: use define().
   * @param defs - Rutas. / Routes.
   * @param opts - Opciones. / Options.
   */
  private constructor(
    defs: ReadonlyArray<RouteDef<N>>,
    opts: RouterOptions,
  ) {
    for (const d of defs) {
      this.byPath.set(slash(d.path), d);
      this.byName.set(d.name, d);
    }
    this.strategy = createStrategy(opts.strategy ?? { kind: "path" });
    this.outlet = opts.outlet;
    this.fallback = opts.fallback;
    this.defaultTransition = opts.defaultTransition;
    this.locale = opts.locale;
    this.prepare = opts.prepare;
  }

  /**
   * Define el mapa de rutas. Los names literales autocompletan.
   * Defines the route map. Literal names autocomplete.
   * @param defs - Definiciones. / Definitions.
   * @param opts - Opciones. / Options.
   * @returns Router listo para start(). / Router ready for start().
   */
  static define<const M extends string>(defs: ReadonlyArray<RouteDef<M>>, opts: RouterOptions): Router<M> {
    return new Router<M>(defs, opts);
  }

  /** Ruta actual (nombre + path) o null antes de start(). / Current route (name + path) or null before start(). */
  get route(): CurrentRoute<N> | null {
    return this.current;
  }

  /**
   * Observa cada cambio de ruta ya resuelto. Emite la actual al suscribirse.
   * Watches each resolved route change. Emits current on subscribe.
   * @param fn - Oyente. / Listener.
   * @returns Desuscriptor. / Unsubscriber.
   */
  watch(fn: (route: CurrentRoute<N>) => void): Unsubscribe {
    this.watchers.add(fn);
    if (this.current) fn(this.current);
    return () => {
      this.watchers.delete(fn);
    };
  }

  /**
   * Path de una ruta por su nombre (autocompleta). Con locale lleva
   * el prefijo del idioma activo (/es/proyectos).
   * Path of a route by name (autocompletes). With locale it carries
   * the active language prefix (/es/proyectos).
   * @param name - Nombre de ruta. / Route name.
   * @returns Path normalizado. / Normalized path.
   */
  pathOf(name: N): string {
    const def = this.byName.get(name);
    if (!def) throw new Error(`Ruta desconocida / Unknown route: ${name}`);
    const p = slash(def.path);
    if (!this.locale) return p;
    return `/${this.locale.currentLang()}${p === "/" ? "" : p}`;
  }

  /**
   * Navega a una ruta por su nombre (autocompleta).
   * Navigates to a route by name (autocompletes).
   * @param name - Nombre de ruta. / Route name.
   * @param replace - Sustituir historial. / Replace history.
   */
  go(name: N, replace = false): void {
    this.strategy.navigate(this.pathOf(name), replace);
  }

  /**
   * Precarga layouts sin montarlos (guerra contra la latencia de navegar).
   * Los fallos se ignoran: se reintenta al navegar de verdad.
   * Preloads layouts without mounting (war on navigation latency).
   * Failures are ignored: retried on real navigation.
   * @param names - Rutas a precargar (autocompletan). / Routes to preload (autocomplete).
   */
  async prefetch(...names: N[]): Promise<void> {
    await Promise.all(
      names.map(async (name) => {
        const def = this.byName.get(name);
        if (!def) return;
        try {
          await def.load();
        } catch {
          /* reintentará al navegar / retries on navigate */
        }
      }),
    );
  }

  /**
   * Arranca: pinta la ruta actual y escucha cambios. Devuelve stop().
   * Starts: paints current route and listens. Returns stop().
   * @returns Cómo parar. / How to stop.
   */
  start(): Unsubscribe {
    this.stop();
    this.attach();
    void this.render(this.strategy.current());
    return () => this.stop();
  }

  /**
   * Cambia de estrategia en caliente conservando la ruta actual.
   * Switches strategy live while keeping the current route.
   * @param opts - Nueva estrategia. / New strategy.
   */
  setStrategy(opts: StrategyOptions): void {
    const carry = this.current?.path ?? this.strategy.current();
    this.stop();
    this.strategy = createStrategy(opts);
    this.strategy.navigate(carry, true);
    this.attach();
    void this.render(this.strategy.current());
  }

  /**
   * Quita el prefijo /:lang/ de una URL ya absoluta para buscarla en el índice.
   * Strips the /:lang/ prefix from an already absolute URL to look it up in the index.
   * @param url - URL absoluta interna. / Internal absolute URL.
   * @returns Path sin prefijo de idioma. / Path without the language prefix.
   */
  private desnudaDe(url: URL): string {
    const { path: bare } = this.splitLocale(slash(url.pathname));
    return bare;
  }

  /**
   * Engancha escucha + clics según la estrategia activa.
   * Attaches listening + clicks for the active strategy.
   */
  private attach(): void {
    this.stopListen = this.strategy.listen((path) => {
      void this.render(path);
    });
    if (this.strategy.kind === "path") {
      const onClick = (e: MouseEvent): void => {
        if (!esClicPlano(e)) return;
        const a = enlaceDe(e);
        if (!a) return;
        const url = urlDe(a);
        if (!url || !esInterna(url)) return;
        if (!this.byPath.has(this.desnudaDe(url))) return;
        e.preventDefault();
        this.strategy.navigate(slash(url.pathname));
      };
      this.onDocClick = onClick;
      document.addEventListener("click", onClick);
    }
  }

  /**
   * Para listeners y clicks. Reutilizable vía start().
   * Stops listeners and clicks. Reusable via start().
   */
  stop(): void {
    this.stopListen?.();
    this.stopListen = null;
    if (this.onDocClick) {
      document.removeEventListener("click", this.onDocClick);
      this.onDocClick = null;
    }
  }

  /**
   * Separa el prefijo /:lang/ si hay locale y el primer segmento es idioma.
   * Splits the /:lang/ prefix when locale is on and the first segment is a language.
   * @param clean - Path normalizado. / Normalized path.
   * @returns Idioma (o null) y path sin prefijo. / Language (or null) and unprefixed path.
   */
  private splitLocale(clean: string): { lang: string | null; path: string } {
    if (!this.locale) return { lang: null, path: clean };
    const seg = clean.split("/");
    const cand = seg[1] ?? "";
    if (this.locale.languages.includes(cand)) {
      const rest = `/${seg.slice(2).join("/")}`;
      return { lang: cand, path: rest === "/" ? "/" : rest };
    }
    return { lang: null, path: clean };
  }

  /**
   * Petición ya separada: idioma del prefijo, path desnudo y definición.
   * Parsed request: prefix language, bare path and definition.
   */
  private parseRequest(clean: string): { lang: string | null; bare: string; def: RouteDef<N> | undefined } {
    const { lang, path: bare } = this.splitLocale(clean);
    const found = this.byPath.get(bare);
    if (found) return { lang, bare, def: found };
    if (!this.fallback) return { lang, bare, def: undefined };
    return { lang, bare, def: this.byName.get(this.fallback as N) };
  }

  /**
   * Sincroniza el idioma con el prefijo /:lang/ (o redirige a él si falta).
   * Syncs the language with the /:lang/ prefix (or redirects to it when missing).
   * @param lang - Idioma del prefijo o null. / Prefix language or null.
   * @param bare - Path sin prefijo. / Unprefixed path.
   * @returns true si redirigió (no seguir pintando). / true when redirected (stop painting).
   */
  private sincronizarLocale(lang: string | null, bare: string): boolean {
    if (!this.locale) return false;
    if (lang) {
      this.locale.useLang(lang);
      return false;
    }
    this.strategy.navigate(`/${this.locale.currentLang()}${bare === "/" ? "" : bare}`, true);
    return true;
  }

  /**
   * Actualiza el estado cuando solo cambió el path limpio de la misma ruta
   * (p. ej. el prefijo de idioma): sin remontar ni animar.
   * Updates state when only the clean path of the same route changed
   * (e.g. the language prefix): no remount, no animation.
   * @param def - Definición destino. / Destination definition.
   * @param clean - Path normalizado con prefijo. / Normalized path with prefix.
   * @returns true si ya era la misma ruta (nada más que hacer). / true when already the same route (nothing else to do).
   */
  private actualizarMismaRuta(def: RouteDef<N>, clean: string): boolean {
    if (!this.current) return false;
    if (this.current.name !== def.name) return false;
    // Misma ruta (p. ej. cambió solo el prefijo de idioma): actualiza
    // estado sin remontar ni animar; los observadores repintan.
    // Same route (e.g. only the language prefix changed): update
    // state without remounting or animating; watchers repaint.
    if (this.current.path !== clean) this.confirmarRuta(def, clean);
    return true;
  }

  /**
   * Fija la ruta vigente y avisa a los observadores.
   * Sets the current route and notifies watchers.
   * @param def - Definición destino. / Destination definition.
   * @param clean - Path normalizado con prefijo. / Normalized path with prefix.
   */
  private confirmarRuta(def: RouteDef<N>, clean: string): void {
    this.current = { name: def.name, path: clean, layout: def.layout.name };
    for (const fn of [...this.watchers]) fn(this.current);
  }

  /**
   * Pinta una ruta. Mismo layout: solo cambia la page dentro de <page>
   * (el layout ni se toca ni se anima). Distinto layout: cambio completo.
   * Token ignora navegaciones viejas.
   * Paints a route. Same layout: only swaps the page inside <page>
   * (layout untouched and unanimated). Different layout: full swap.
   * Token drops stale navigations.
   * Con locale, el prefijo fija el idioma y su ausencia redirige a él.
   * With locale, the prefix sets the language and its absence redirects to it.
   * @param path - Ruta cruda. / Raw route.
   */
  private async render(path: string): Promise<void> {
    const mine = ++this.token;
    const clean = slash(path);
    const { lang, bare, def } = this.parseRequest(clean);
    if (this.sincronizarLocale(lang, bare)) return;
    if (!def) return;
    if (this.actualizarMismaRuta(def, clean)) return;
    const from = this.current?.name ?? null;
    const { apply, using, duration } = resolveTransition(def.transition, this.defaultTransition, from);
    await this.mostrarRuta(def, mine, apply, using, duration);
    if (mine !== this.token) return;
    this.confirmarRuta(def, clean);
  }

  /**
   * Muestra la ruta con su transición: layout completo o solo page.
   * Shows the route with its transition: full layout or just the page.
   */
  private mostrarRuta(
    def: RouteDef<N>,
    mine: number,
    apply: boolean,
    using: TransitionName | TransitionFn,
    duration: number,
  ): Promise<void> {
    if (!this.current || this.current.layout !== def.layout.name) {
      return this.renderFull(def, mine, apply, using, duration);
    }
    return this.renderPage(def, mine, apply, using, duration);
  }

  /**
   * Monta una vista con su módulo: carga, chequeo anti-carreras, montaje,
   * espera de async, chequeo de nuevo y preparación antes de insertar.
   * Mounts a view with its module: load, anti-race check, mount,
   * async wait, check again and prepare before insert.
   * @param carga - Cargador perezoso del módulo. / Lazy module loader.
   * @param claseCss - Clase del contenedor ("rtw-view" o "rtw-page"). / Container class ("rtw-view" or "rtw-page").
   * @param mine - Token vigente de la navegación. / Current navigation token.
   * @param prepara - Si aplica prepare antes de devolver. / Whether to apply prepare before returning.
   * @returns La vista lista o null si la navegación caducó. / The ready view or null when navigation went stale.
   */
  private async montarVista(
    carga: () => Promise<RouteModule>,
    claseCss: string,
    mine: number,
    prepara: boolean,
  ): Promise<Element | null> {
    const mod = await carga();
    if (mine !== this.token) return null;
    const view = document.createElement("div");
    view.className = claseCss;
    const maybe = mod.mount(view);
    if (maybe instanceof Promise) await maybe;
    if (mine !== this.token) return null;
    if (prepara) this.prepare?.(view);
    return view;
  }

  /**
   * Permuta entrante/saliente dentro del host con transición opcional:
   * inserta, apila en la misma celda, anima, restaura y retira la saliente.
   * Swaps incoming/outgoing inside the host with optional transition:
   * inserts, stacks in the same cell, animates, restores and drops outgoing.
   * @param host - Contenedor (outlet o <page>). / Container (outlet or <page>).
   * @param entrante - Vista que entra (ya montada y preparada). / Incoming view (mounted and prepared).
   * @param saliente - Vista que sale o null en primera carga. / Outgoing view or null on first load.
   * @param apply - Si anima. / Whether it animates.
   * @param using - Efecto. / Effect.
   * @param duration - Ms. / Ms.
   * @param mine - Token vigente de la navegación. / Current navigation token.
   */
  private async permutar(
    host: Element,
    entrante: Element,
    saliente: Element | null,
    apply: boolean,
    using: TransitionName | TransitionFn,
    duration: number,
    mine: number,
  ): Promise<void> {
    host.appendChild(entrante);
    if (apply && saliente) {
      const restore = stackViews(host as HTMLElement, saliente as HTMLElement, entrante as HTMLElement);
      await runUsing(using, entrante, saliente, duration);
      restore();
      if (mine !== this.token) {
        entrante.remove();
        return;
      }
    }
    if (saliente) saliente.remove();
  }

  /**
   * Cambio completo: monta layout en el outlet y page en su <page>.
   * La transición anima el conjunto (solo hay saliente si ya había layout).
   * Full swap: mounts layout into the outlet and the page into its <page>.
   * The transition animates the whole (outgoing only when a layout existed).
   * @param def - Ruta destino. / Destination route.
   * @param mine - Token vigente. / Current token.
   * @param apply - Si anima. / Whether it animates.
   * @param using - Efecto. / Effect.
   * @param duration - Ms. / Ms.
   */
  private async renderFull(
    def: RouteDef<N>,
    mine: number,
    apply: boolean,
    using: TransitionName | TransitionFn,
    duration: number,
  ): Promise<void> {
    const layoutView = await this.montarVista(def.layout.load, "rtw-view", mine, false);
    if (!layoutView) return;
    const pageHost = layoutView.querySelector("page");
    if (!pageHost) throw new Error(`El layout de "${def.name}" no tiene <page> / Layout of "${def.name}" lacks <page>`);
    const pageView = await this.montarVista(def.load, "rtw-page", mine, true);
    if (!pageView) return;
    pageHost.appendChild(pageView);
    const outgoing = this.outlet.firstElementChild;
    await this.permutar(this.outlet, layoutView, outgoing, apply, using, duration, mine);
  }

  /**
   * Cambio de page: el layout persiste; solo su <page> permuta vistas.
   * Page swap: the layout persists; only its <page> swaps views.
   * @param def - Ruta destino. / Destination route.
   * @param mine - Token vigente. / Current token.
   * @param apply - Si anima. / Whether it animates.
   * @param using - Efecto. / Effect.
   * @param duration - Ms. / Ms.
   */
  private async renderPage(
    def: RouteDef<N>,
    mine: number,
    apply: boolean,
    using: TransitionName | TransitionFn,
    duration: number,
  ): Promise<void> {
    const pageHost = this.outlet.querySelector("page");
    if (!pageHost) {
      await this.renderFull(def, mine, apply, using, duration);
      return;
    }
    const incoming = await this.montarVista(def.load, "rtw-page", mine, true);
    if (!incoming) return;
    const outgoing = pageHost.firstElementChild;
    await this.permutar(pageHost, incoming, outgoing, apply, using, duration, mine);
  }
}
