import { Signal, type Unsubscribe } from "./signal.js";

/**
 * Multidioma propio, sin dependencias: diccionarios por idioma, idioma
 * reactivo y pintado por atributos data-i18n. Las claves autocompletan.
 * Own dependency-free i18n: per-language dictionaries, reactive language
 * and data-i18n attribute painting. Keys autocomplete.
 */

/** Opciones del I18n. / I18n options. */
export interface I18nOptions<T extends Record<string, Record<string, string>>> {
  /** Idioma inicial si nada lo resuelve (por defecto el primero). / Initial language when nothing resolves (defaults to first). */
  defaultLang?: Extract<keyof T, string>;
  /** Idioma de respaldo si falta una clave. Por defecto defaultLang. / Fallback language for missing keys. Defaults defaultLang. */
  fallbackLang?: Extract<keyof T, string>;
  /** Un diccionario por idioma (misma forma en todos). / One dictionary per language (same shape everywhere). */
  dicts: T;
  /**
   * Usa navigator.language si está en los dicts.
   * Uses navigator.language when present in dicts.
   */
  detect?: boolean;
  /** Guarda el idioma en localStorage bajo esta clave (false = no). / Persists language in localStorage under this key (false = no). */
  persist?: string | false;
}

/** Idiomas de unos dicts. / Languages of some dicts. */
export type I18nLang<T extends Record<string, Record<string, string>>> = Extract<keyof T, string>;
/** Claves comunes a todos los dicts (autocompletan). / Keys common to every dict (autocomplete). */
export type I18nKey<T extends Record<string, Record<string, string>>> = Extract<keyof T[keyof T], string>;

/**
 * Gestor de idioma. Las claves de t() autocompletan desde los dicts.
 * Language manager. t() keys autocomplete from the dicts.
 */
export class I18n<const T extends Record<string, Record<string, string>>> {
  /** Idioma actual (reactivo). / Current language (reactive). */
  readonly lang: Signal<I18nLang<T>>;
  /** Opciones guardadas. / Stored options. */
  private readonly opts: I18nOptions<T>;
  /** Detección automática activa. / Automatic detection on. */
  private detectFlag: boolean;
  /** El usuario ya eligió a mano. / The user already chose manually. */
  private manual = false;
  /** Se restauró idioma guardado. / A stored language was restored. */
  private stored = false;
  /** De dónde salió el idioma vigente. / Where the current language came from. */
  private origin: "stored" | "detected" | "default" | "manual" = "default";

  /**
   * Crea el gestor: guardado > detectado (si detect) > default > primero.
   * Creates the manager: stored > detected (when detect) > default > first.
   * @param opts - Idiomas y dicts. / Languages and dicts.
   */
  constructor(opts: I18nOptions<T>) {
    this.opts = opts;
    this.detectFlag = opts.detect ?? false;
    this.lang = new Signal<I18nLang<T>>(this.initial());
  }

  /** Idiomas disponibles (claves de dicts). / Available languages (dict keys). */
  get languages(): Array<I18nLang<T>> {
    return Object.keys(this.opts.dicts) as Array<I18nLang<T>>;
  }

  /** Idioma activo como string (para LocaleSource). / Active language as string (for LocaleSource). */
  currentLang(): string {
    return this.lang.value;
  }

  /**
   * Fija el idioma validando (para LocaleSource).
   * Sets the language with validation (for LocaleSource).
   * @param lang - Idioma crudo. / Raw language.
   */
  useLang(lang: string): void {
    if ((this.languages as string[]).includes(lang)) this.use(lang as I18nLang<T>);
  }

  /**
   * Activa la detección automática (encadenable).
   * Enables automatic detection (chainable).
   * @param on - true la aplica ya salvo elección manual/guardada. / true applies it now unless manual/stored choice.
   * @returns this.
   */
  autodetectLang(on = true): this {
    this.detectFlag = on;
    if (on && !this.manual && !this.stored) {
      const hit = this.detectNav();
      if (hit) this.activate(hit, "detected");
    }
    return this;
  }

  /**
   * Fija el idioma por defecto (encadenable). Solo activa si lo vigente
   * también venía de un default: nunca pisa detección, guardado ni elección.
   * Sets the default language (chainable). Activates only when the current
   * one also came from a default: never overrides detection, storage or choice.
   * @param lang - Idioma por defecto. / Default language.
   * @returns this.
   */
  defaultLang(lang: I18nLang<T>): this {
    this.opts.defaultLang = lang;
    if (this.origin === "default") this.activate(lang, "default");
    return this;
  }

  /**
   * Lee el idioma guardado en localStorage (si persist está activo y es válido).
   * Reads the language stored in localStorage (when persist is on and valid).
   * @param langs - Idiomas válidos. / Valid languages.
   * @returns El idioma guardado o null. / The stored language or null.
   */
  private leeGuardado(langs: Array<I18nLang<T>>): I18nLang<T> | null {
    if (typeof this.opts.persist !== "string") return null;
    try {
      const saved = localStorage.getItem(this.opts.persist);
      if (saved && (langs as string[]).includes(saved)) {
        this.stored = true;
        this.origin = "stored";
        return saved as I18nLang<T>;
      }
    } catch {
      /* sin almacenamiento / no storage */
    }
    return null;
  }

  /**
   * Detecta el idioma del navegador entre los dicts (si detect está activo).
   * Detects the browser language among the dicts (when detect is on).
   * @returns El idioma detectado o null. / The detected language or null.
   */
  private detectaIdioma(): I18nLang<T> | null {
    if (!(this.opts.detect ?? this.detectFlag)) return null;
    const hit = this.detectNav();
    if (!hit) return null;
    this.origin = "detected";
    return hit;
  }

  /**
   * Idioma inicial: guardado > detectado (si detect) > default > primero.
   * Initial language: stored > detected (when detect) > default > first.
   * @returns Idioma válido. / Valid language.
   */
  private initial(): I18nLang<T> {
    const langs = this.languages;
    const first = (langs[0] ?? "es") as I18nLang<T>;
    const guardado = this.leeGuardado(langs);
    if (guardado) return guardado;
    const detectado = this.detectaIdioma();
    if (detectado) return detectado;
    this.origin = "default";
    return this.opts.defaultLang ?? first;
  }

  /**
   * Detecta navigator.language entre los dicts.
   * Detects navigator.language among the dicts.
   * @returns Idioma o null. / Language or null.
   */
  private detectNav(): I18nLang<T> | null {
    try {
      const nav = navigator.language.slice(0, 2).toLowerCase();
      return this.languages.find((l) => l.toLowerCase() === nav || l.toLowerCase().startsWith(`${nav}-`)) ?? null;
    } catch {
      return null;
    }
  }

  /**
   * Activa un idioma con origen: emite, guarda y espeja <html lang>.
   * Activates a language with origin: emits, persists and mirrors <html lang>.
   * @param lang - Idioma válido. / Valid language.
   * @param origin - De dónde viene. / Where it comes from.
   */
  private activate(lang: I18nLang<T>, origin: "stored" | "detected" | "default" | "manual"): void {
    this.origin = origin;
    this.lang.value = lang;
    if (typeof this.opts.persist === "string") {
      try {
        localStorage.setItem(this.opts.persist, lang);
      } catch {
        /* persistencia opcional / optional persistence */
      }
    }
    try {
      document.documentElement.lang = lang;
    } catch {
      /* sin DOM no hay espejo / no mirror without DOM */
    }
  }

  /**
   * Cambia de idioma (ignora desconocidos), lo guarda y lo refleja en <html lang>.
   * Switches language (ignores unknown ones), persists it and mirrors on <html lang>.
   * @param lang - Idioma destino. / Target language.
   */
  use(lang: I18nLang<T>): void {
    if (!this.opts.dicts[lang]) return;
    this.manual = true;
    this.activate(lang, "manual");
  }

  /**
   * Traduce una clave con respaldo e interpolación {var}.
   * Las claves literales autocompletan; se acepta string para claves
   * que llegan del DOM en runtime.
   * Translates a key with fallback and {var} interpolation.
   * Literal keys autocomplete; plain string is accepted for keys
   * arriving from the DOM at runtime.
   * @param key - Clave del dict (autocompleta). / Dict key (autocompletes).
   * @param vars - Valores para {var}. / Values for {var}.
   * @returns Texto final o la clave si falta en todo. / Final text or the key when missing everywhere.
   */
  t(key: I18nKey<T>, vars?: Record<string, string | number>): string;
  t(key: string, vars?: Record<string, string | number>): string;
  t(key: string, vars?: Record<string, string | number>): string {
    const at = (l: I18nLang<T> | undefined): Record<string, string> =>
      (l ? this.opts.dicts[l] : undefined) ?? {};
    const dict = at(this.lang.value);
    const back = at(this.opts.fallbackLang ?? this.opts.defaultLang);
    let out: string = dict[key] ?? back[key] ?? key;
    if (vars) {
      for (const [k, v] of Object.entries(vars)) out = out.split(`{${k}}`).join(String(v));
    }
    return out;
  }

  /**
   * Escucha cambios de idioma.
   * Listens to language changes.
   * @param fn - Oyente con el idioma nuevo. / Listener with the new language.
   * @returns Desuscriptor. / Unsubscriber.
   */
  onLang(fn: (lang: I18nLang<T>) => void): Unsubscribe {
    return this.lang.subscribe(() => fn(this.lang.value));
  }

  /**
   * Pinta textos y atributos i18n bajo root, sin suscribirse.
   * Útil para traducir antes de insertar (cero doble pintado).
   * Paints i18n texts and attributes under root, without subscribing.
   * Useful to translate before inserting (zero double paint).
   * @param root - Raíz donde buscar (document o shadow). / Root to scan (document or shadow).
   */
  paint(root: ParentNode): void {
    const els: Element[] = root instanceof Element ? [root] : [];
    for (const el of root.querySelectorAll("*")) els.push(el);
    for (const el of els) {
      if (el.hasAttribute("data-i18n") || el.getAttributeNames().some((n) => n.startsWith("data-i18n-"))) {
        this.paintOne(el);
      }
    }
  }

  /**
   * Pinta textos y atributos i18n bajo root, y repinta solo al cambiar
   * de idioma. Los elementos con data-i18n deben ser hojas
   * (su contenido se sustituye).
   * Paints i18n texts and attributes under root, repainting only on
   * language change. data-i18n elements must be leaves
   * (their content is replaced).
   * @param root - Raíz donde buscar (document o shadow). / Root to scan (document or shadow).
   * @returns Desuscriptor del repintado. / Repaint unsubscriber.
   */
  apply(root: ParentNode): Unsubscribe {
    this.paint(root);
    return this.lang.subscribe(() => this.paint(root));
  }

  /**
   * Pinta un solo elemento (texto + atributos).
   * Paints a single element (text + attributes).
   * @param el - Elemento. / Element.
   */
  private paintOne(el: Element): void {
    const key = el.getAttribute("data-i18n");
    if (key) el.textContent = this.t(key, readVars(el));
    for (const name of el.getAttributeNames()) {
      if (!name.startsWith("data-i18n-") || name === "data-i18n-vars") continue;
      const target = name.slice("data-i18n-".length);
      const k = el.getAttribute(name);
      if (k) el.setAttribute(target, this.t(k, readVars(el)));
    }
  }
}

/**
 * Lee vars de data-i18n-vars ('{"n":3}'). Silencioso si es inválido.
 * Reads vars from data-i18n-vars ('{"n":3}'). Silent when invalid.
 * @param el - Elemento. / Element.
 * @returns Vars o undefined. / Vars or undefined.
 */
function readVars(el: Element): Record<string, string | number> | undefined {
  const raw = el.getAttribute("data-i18n-vars");
  if (!raw) return undefined;
  try {
    const v = JSON.parse(raw) as unknown;
    if (typeof v === "object" && v !== null) return v as Record<string, string | number>;
  } catch {
    /* attr opcional / optional attr */
  }
  return undefined;
}
