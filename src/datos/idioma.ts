import { i18n } from "../lang/index.js";
import type { Texto, Textos } from "./tipos.js";

/**
 * Lee un texto localizable en el idioma activo, con español de respaldo.
 * Reads a localisable text in the active language, falling back to Spanish.
 */
export function t(campo: Texto | undefined): string {
  if (campo === undefined || campo === null) return "";
  if (typeof campo === "string") return campo;
  const lang = i18n.lang.value as string;
  return campo[lang] ?? campo.es ?? Object.values(campo)[0] ?? "";
}

/**
 * Lee una lista localizable en el idioma activo, con español de respaldo.
 * Reads a localisable list in the active language, falling back to Spanish.
 */
export function tl(campo: Textos | undefined): string[] {
  if (!campo) return [];
  if (Array.isArray(campo)) return campo;
  const lang = i18n.lang.value as string;
  return campo[lang] ?? campo.es ?? [];
}
