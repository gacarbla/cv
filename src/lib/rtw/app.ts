import { Router, type LocaleSource, type RouteDef, type RouterOptions, type StrategyKind, type StrategyOptions } from "./router.js";
import type { Unsubscribe } from "./signal.js";

/**
 * Opciones de la app. / App options.
 */
export interface AppOptions<N extends string> {
  /**
   * Contenedor de vistas: selector o elemento. Por defecto la etiqueta <app>.
   * View container: selector or element. Defaults to the <app> tag.
   */
  outlet?: string | Element;
  /** Estrategia de URL. / URL strategy. */
  strategy?: StrategyOptions;
  /** Nombre de ruta para URLs desconocidas. / Route name for unknown URLs. */
  fallback?: N;
  /** Nombres válidos para [data-go] y rtw:go (autocompletan en tu entrada). / Valid names for [data-go] and rtw:go. */
  names?: ReadonlyArray<N>;
  /**
   * I18n para pintar el outlet en cada ruta (sombras se pintan solas).
   * I18n to paint the outlet on each route (shadows paint themselves).
   */
  i18n?: LocaleSource;
  /**
   * Prefija la URL con el idioma (/es/*). Requiere i18n.
   * Prefixes the URL with the language (/es/*). Requires i18n.
   */
  localePrefix?: boolean;
}

/**
 * App: une rutas + router + outlet + puentes de navegación.
 * La entrada solo la configura y la arranca.
 * App: joins routes + router + outlet + navigation bridges.
 * The entry only configures and starts it.
 */
export class App<const N extends string> {
  /** Router interno (go, watch, route...). / Inner router (go, watch, route...). */
  readonly router: Router<N>;
  /** Nombres válidos para navegación por evento/atributo. / Valid names for event/attribute navigation. */
  private readonly names: Set<string>;
  /** Contenedor real. / Real container. */
  private readonly outletEl: Element;
  /** Limpiezas de start(). / start() cleanups. */
  private disposers: Unsubscribe[] = [];
  /** En marcha. / Running. */
  private running = false;
  /** kind activo (el router no lo expone). / Active kind (the router does not expose it). */
  private strategyKind: StrategyKind;
  /** I18n para el outlet o undefined. / I18n for the outlet or undefined. */
  private readonly i18n?: LocaleSource;
  /** Locale con prefijo URL activo. / URL-prefixed locale active. */
  private readonly localeOn: boolean;

  /**
   * Crea la app sin arrancar (para poder conmutar estrategia recreándola).
   * Creates the app without starting (so strategy can switch by recreating).
   * @param routes - Rutas declaradas (ver routes.ts). / Declared routes (see routes.ts).
   * @param opts - Outlet, estrategia y fallback. / Outlet, strategy and fallback.
   */
  constructor(
    routes: ReadonlyArray<RouteDef<N>>,
    private readonly opts: AppOptions<N> = {},
  ) {
    const el = this.resuelveOutlet(opts.outlet);
    this.outletEl = el;
    this.names = this.armaNombres(opts, routes);
    this.strategyKind = opts.strategy?.kind ?? "path";
    this.localeOn = !!opts.localePrefix && !!opts.i18n;
    this.router = Router.define(routes, this.armaOpcionesRouter(opts, el));
    this.i18n = opts.i18n;
  }

  /**
   * Resuelve el contenedor de vistas desde selector o elemento.
   * Resolves the view container from a selector or element.
   * @param outlet - Selector, elemento o undefined (usa <app>). / Selector, element or undefined (uses <app>).
   * @returns El contenedor real. / The real container.
   */
  private resuelveOutlet(outlet: string | Element | undefined): Element {
    const sel = outlet ?? "app";
    const el = typeof sel === "string" ? document.querySelector(sel) : sel;
    if (!el) throw new Error("Falta el contenedor <app> en el documento / Missing <app> container in the document");
    return el;
  }

  /**
   * Arma el conjunto de nombres válidos para [data-go] y rtw:go.
   * Builds the valid name set for [data-go] and rtw:go.
   * @param opts - Opciones de la app. / App options.
   * @param routes - Rutas declaradas. / Declared routes.
   * @returns Nombres válidos. / Valid names.
   */
  private armaNombres(opts: AppOptions<N>, routes: ReadonlyArray<RouteDef<N>>): Set<string> {
    return new Set<string>(opts.names ?? routes.map((r) => r.name));
  }

  /**
   * Arma las opciones del router (estrategia, locale y prepare de i18n).
   * Builds the router options (strategy, locale and i18n prepare).
   * @param opts - Opciones de la app. / App options.
   * @param el - Contenedor real. / Real container.
   * @returns Opciones listas para el router. / Router-ready options.
   */
  private armaOpcionesRouter(opts: AppOptions<N>, el: Element): RouterOptions {
    const routerOpts: RouterOptions = { outlet: el, fallback: opts.fallback };
    if (opts.strategy) routerOpts.strategy = opts.strategy;
    if (opts.localePrefix && opts.i18n) routerOpts.locale = opts.i18n;
    if (opts.i18n) {
      const i18n = opts.i18n;
      routerOpts.prepare = (view) => i18n.paint(view);
    }
    return routerOpts;
  }

  /**
   * Arranca router + puentes. Idempotente tras stop().
   * Starts router + bridges. Idempotent after stop().
   * @returns Cómo parar. / How to stop.
   */
  start(): Unsubscribe {
    this.stop();
    this.running = true;
    const stopRouter = this.router.start();
    const stopWatch = this.router.watch((r) => {
      window.dispatchEvent(new CustomEvent("rtw:route", { detail: r.name }));
      this.paintHrefs();
    });
    if (this.i18n) {
      const i18n = this.i18n;
      this.disposers.push(i18n.onLang(() => i18n.paint(this.outletEl)));
      if (this.localeOn) {
        this.disposers.push(
          i18n.onLang(() => {
            const cur = this.router.route;
            if (cur) this.router.go(cur.name, true);
          }),
        );
      }
    }
    const onGo = (e: Event): void => {
      const name = (e as CustomEvent<string>).detail ?? "";
      if (this.names.has(name)) this.router.go(name as N);
    };
    const onClick = (e: MouseEvent): void => {
      if (this.strategyKind === "path") return;
      const a = (e.target as Element | null)?.closest?.("[data-go]");
      if (!a) return;
      e.preventDefault();
      const name = (a as HTMLElement).dataset["go"] ?? "";
      if (this.names.has(name)) this.router.go(name as N);
    };
    document.addEventListener("rtw:go", onGo);
    document.addEventListener("click", onClick);
    this.disposers = [
      stopRouter,
      stopWatch,
      () => document.removeEventListener("rtw:go", onGo),
      () => document.removeEventListener("click", onClick),
    ];
    return () => this.stop();
  }

  /**
   * Para router y puentes. La app puede rearrancar con start().
   * Stops router and bridges. The app may restart via start().
   */
  stop(): void {
    for (const fn of this.disposers.splice(0)) fn();
    this.running = false;
  }

  /**
   * Reescribe los href de [data-go] con la ruta vigente (con prefijo locale).
   * Rewrites [data-go] hrefs with the current route (with locale prefix).
   */
  private paintHrefs(): void {
    for (const a of document.querySelectorAll<HTMLAnchorElement>("a[data-go]")) {
      const name = a.dataset["go"] ?? "";
      if (!this.names.has(name)) continue;
      const path = this.router.pathOf(name as N);
      // En hash la ruta navegable lleva "#"; en path, no. / In hash the navigable route carries "#"; in path it does not.
      a.href = this.strategyKind === "hash" ? `#${path}` : path;
    }
  }

  /**
   * Cambia la estrategia del router en caliente (misma ruta).
   * Switches the router strategy live (same route).
   * @param next - Nueva estrategia. / New strategy.
   */
  setStrategy(next: StrategyOptions): void {
    this.strategyKind = next.kind;
    this.router.setStrategy(next);
  }

  /** ¿En marcha? / Running? */
  get isRunning(): boolean {
    return this.running;
  }
}
