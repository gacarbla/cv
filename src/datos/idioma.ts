import { i18n } from "../lang/index.js";
import type { Texto, Textos } from "./tipos.js";

/**
 * Limpia separadores decorativos heredados del contenido.
 * Cleans decorative separators inherited from the content.
 */
function normalizar(texto: string): string {
  return texto.replace(/\s*[·•]\s*/g, ", ").replace(/\s+/g, " ").trim();
}

/**
 * Lee un texto localizable en el idioma activo, con español de respaldo.
 * Reads a localisable text in the active language, falling back to Spanish.
 */
export function t(campo: Texto | undefined): string {
  if (campo === undefined || campo === null) return "";
  if (typeof campo === "string") return normalizar(campo);
  const lang = i18n.lang.value as string;
  return normalizar(campo[lang] ?? campo.es ?? Object.values(campo)[0] ?? "");
}

/**
 * Lee una lista localizable en el idioma activo, con español de respaldo.
 * Reads a localisable list in the active language, falling back to Spanish.
 */
export function tl(campo: Textos | undefined): string[] {
  if (!campo) return [];
  if (Array.isArray(campo)) return campo.map(normalizar);
  const lang = i18n.lang.value as string;
  return (campo[lang] ?? campo.es ?? []).map(normalizar);
}
