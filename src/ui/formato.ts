import { i18n } from "../lang/index.js";

/**
 * Fecha larga localizada a partir de ISO (YYYY-MM-DD o YYYY-MM).
 * Localised long date from ISO (YYYY-MM-DD or YYYY-MM).
 */
export function fechaLarga(iso: string): string {
  if (!iso) return "";
  const completa = iso.length === 7 ? `${iso}-01` : iso;
  const fecha = new Date(`${completa}T12:00:00`);
  if (Number.isNaN(fecha.getTime())) return iso;
  const opciones: Intl.DateTimeFormatOptions =
    iso.length === 7
      ? { month: "long", year: "numeric" }
      : { day: "numeric", month: "long", year: "numeric" };
  try {
    return new Intl.DateTimeFormat(i18n.lang.value, opciones).format(fecha);
  } catch {
    return iso;
  }
}

/** Número localizado. / Localised number. */
export function numero(valor: number): string {
  try {
    return new Intl.NumberFormat(i18n.lang.value).format(valor);
  } catch {
    return String(valor);
  }
}
