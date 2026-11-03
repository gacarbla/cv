import type { RouteDef, TransitionDef, TransitionFn } from "./router.js";

/**
 * Constructor fluido de una ruta (patrón builder, POO).
 * Una regla general + N específicas por origen (gana la específica).
 * Uso: Routes.route("x").at("/x").fade().slideFrom("y").load(...).
 * Fluent single-route builder (builder pattern, OOP).
 * One general rule + N per-source specifics (specific wins).
 * Usage: Routes.route("x").at("/x").fade().slideFrom("y").load(...).
 */
export class RouteBuilder<const N extends string> {
  private path = "";
  private general: TransitionDef | null = null;
  private specifics: TransitionDef[] = [];
  private last: TransitionDef | null = null;
  private layoutDef: { name: string; load: () => Promise<{ mount: (el: Element) => unknown }> } | null = null;
  private pageLoader: (() => Promise<{ mount: (el: Element) => unknown }>) | null = null;

  /**
   * Nombra la ruta (fija su autocompletado).
   * Names the route (fixes its autocomplete).
   * @param name - Nombre único. / Unique name.
   */
  constructor(private readonly name: N) {}

  /**
   * Fija su path ("x" o "/x": se normaliza).
   * Sets its path ("x" or "/x": normalized).
   * @param path - Ruta URL. / URL route.
   * @returns this (encadenable). / this (chainable).
   */
  at(path: string): this {
    this.path = path;
    return this;
  }

  /**
   * Regla general con fundido (desde cualquier layout).
   * General rule with fade (from any layout).
   * @param duration - Ms. Por defecto 250. / Ms. Defaults 250.
   * @returns this (encadenable). / this (chainable).
   */
  fade(duration = 250): this {
    return this.setGeneral({ from: "always", using: "fade", duration });
  }

  /**
   * Regla general deslizante (desde cualquier layout).
   * General sliding rule (from any layout).
   * @param duration - Ms. Por defecto 250. / Ms. Defaults 250.
   * @returns this (encadenable). / this (chainable).
   */
  slide(duration = 250): this {
    return this.setGeneral({ from: "always", using: "slide", duration });
  }

  /**
   * Regla general sin transición (corte directo).
   * General rule without transition (hard cut).
   * @returns this (encadenable). / this (chainable).
   */
  none(): this {
    return this.setGeneral({ from: "always", using: "none", duration: 0 });
  }

  /**
   * Regla general con función WAAPI propia.
   * General rule with custom WAAPI function.
   * @param fn - (entrante, saliente) hasta terminar. / (incoming, outgoing) until done.
   * @param duration - Ms de referencia. / Reference ms.
   * @returns this (encadenable). / this (chainable).
   */
  custom(fn: TransitionFn, duration = 250): this {
    return this.setGeneral({ from: "always", using: fn, duration });
  }

  /**
   * Regla específica con fundido: solo desde esos orígenes.
   * Specific fade rule: only from those sources.
   * @param names - Rutas origen. / Source routes.
   * @returns this (encadenable). / this (chainable).
   */
  fadeFrom(...names: string[]): this {
    return this.addSpecific({ from: [...names], using: "fade", duration: 250 });
  }

  /**
   * Regla específica deslizante: solo desde esos orígenes.
   * Specific sliding rule: only from those sources.
   * @param names - Rutas origen. / Source routes.
   * @returns this (encadenable). / this (chainable).
   */
  slideFrom(...names: string[]): this {
    return this.addSpecific({ from: [...names], using: "slide", duration: 250 });
  }

  /**
   * Regla específica sin transición: solo desde esos orígenes.
   * Specific no-transition rule: only from those sources.
   * @param names - Rutas origen. / Source routes.
   * @returns this (encadenable). / this (chainable).
   */
  noneFrom(...names: string[]): this {
    return this.addSpecific({ from: [...names], using: "none", duration: 0 });
  }

  /**
   * Regla específica con función propia: solo desde esos orígenes.
   * Specific custom-function rule: only from those sources.
   * @param fn - (entrante, saliente) hasta terminar. / (incoming, outgoing) until done.
   * @param names - Rutas origen. / Source routes.
   * @returns this (encadenable). / this (chainable).
   */
  customFrom(fn: TransitionFn, ...names: string[]): this {
    return this.addSpecific({ from: [...names], using: fn, duration: 250 });
  }

  /**
   * Restringe la ÚLTIMA regla declarada a esos orígenes.
   * (Compat: .slide().onlyFrom("x") equivale a .slideFrom("x").)
   * Restricts the LAST declared rule to those sources.
   * (Compat: .slide().onlyFrom("x") equals .slideFrom("x").)
   * @param names - Rutas origen. / Source routes.
   * @returns this (encadenable). / this (chainable).
   */
  onlyFrom(...names: string[]): this {
    if (this.last) {
      this.last.from = [...names];
    } else {
      this.last = { from: [...names], using: "none", duration: 0 };
      this.specifics.push(this.last);
    }
    return this;
  }

  /**
   * Fija el layout contenedor (lo que NO cambia entre rutas).
   * Sets the container layout (what does NOT change across routes).
   * @param name - Nombre del layout (p. ej. "main"). / Layout name (e.g. "main").
   * @param fn - Import dinámico del módulo layout. / Layout dynamic import.
   * @returns this (encadenable). / this (chainable).
   */
  layout(name: string, fn: () => Promise<{ mount: (el: Element) => unknown }>): this {
    this.layoutDef = { name, load: fn };
    return this;
  }

  /**
   * Cierra la ruta con su página perezosa. Exige at() y page().
   * Sin reglas declaradas no hay transition (vale defaultTransition).
   * Closes the route with its lazy page. Requires at() and page().
   * Without declared rules there is no transition (defaultTransition applies).
   * @param fn - Import dinámico del módulo page (exporta mountNombre). / Page dynamic import (exports mountNombre).
   * @returns Definición lista para el router. / Router-ready definition.
   */
  page(fn: () => Promise<{ mount: (el: Element) => unknown }>): RouteDef<N> {
    if (!this.path) throw new Error(`Ruta "${this.name}" sin path: usa .at() / Route "${this.name}" without path: use .at()`);
    if (!this.layoutDef) throw new Error(`Ruta "${this.name}" sin layout: usa .layout() / Route "${this.name}" without layout: use .layout()`);
    this.pageLoader = fn;
    const rules = [...this.specifics, ...(this.general ? [this.general] : [])];
    return {
      name: this.name,
      path: this.path,
      layout: this.layoutDef,
      ...(rules.length > 0 ? { transition: rules.length === 1 ? rules[0] : rules } : {}),
      load: () => (this.pageLoader as () => Promise<{ mount: (el: Element) => unknown }>)(),
    };
  }

  /**
   * Versión anterior de page(). Se mantiene para no romper código.
   * Previous name of page(). Kept to avoid breaking code.
   * @param fn - Import dinámico. / Dynamic import.
   * @returns Definición lista. / Ready definition.
   * @deprecated Usa page(). / Use page().
   */
  load(fn: () => Promise<{ mount: (el: Element) => unknown }>): RouteDef<N> {
    return this.page(fn);
  }

  /**
   * Guarda la regla general y la marca como última.
   * Stores the general rule and marks it as last.
   * @param rule - Regla completa. / Full rule.
   * @returns this (encadenable). / this (chainable).
   */
  private setGeneral(rule: TransitionDef): this {
    this.general = rule;
    this.last = rule;
    return this;
  }

  /**
   * Añade una regla específica y la marca como última.
   * Appends a specific rule and marks it as last.
   * @param rule - Regla completa. / Full rule.
   * @returns this (encadenable). / this (chainable).
   */
  private addSpecific(rule: TransitionDef): this {
    this.specifics.push(rule);
    this.last = rule;
    return this;
  }
}

/** Fábrica de builders. / Builder factory. */
export const Routes = {
  /**
   * Empieza una ruta con autocompletado de su nombre.
   * Starts a route with name autocomplete.
   * @param name - Nombre único. / Unique name.
   * @returns Builder encadenable. / Chainable builder.
   */
  route<N extends string>(name: N): RouteBuilder<N> {
    return new RouteBuilder(name);
  },
};
