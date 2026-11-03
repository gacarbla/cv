import { mountLayout } from "../../lib/rtw/index.js";
import { montarComun } from "../../ui/comun.js";

/**
 * Layout mínimo del acceso: marca, tema e idioma, sin distracciones.
 * Minimal access layout: brand, theme and language, no distractions.
 * @param target - Contenedor real. / Real container.
 */
export async function mountAccesoLayout(target: Element): Promise<void> {
  await mountLayout(target, import.meta.url);
  montarComun(target);
}
