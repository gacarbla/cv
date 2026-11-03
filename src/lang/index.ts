import { I18n } from "../lib/rtw/index.js";
import { en } from "./en.js";
import { es } from "./es.js";
import { gl } from "./gl.js";

/**
 * Instancia compartida ES/EN/GL: intenta el idioma del navegador
 * y si no, queda en español. Recuerda la elección.
 * Shared ES/EN/GL instance: tries the browser language,
 * else stays in Spanish. Remembers the choice.
 */
export const i18n = new I18n({ dicts: { es, en, gl }, persist: "cv:idioma" })
  .autodetectLang(true)
  .defaultLang("es");

/** Idiomas disponibles. / Available languages. */
export type Lang = "es" | "en" | "gl";
