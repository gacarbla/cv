import { mountLayout } from "../../lib/rtw/index.js";
import { i18n } from "../../lang/index.js";
import { cargarPerfil, cerrarSesion } from "../../datos/sesion.js";
import { montarComun } from "../../ui/comun.js";
import { fechaLarga } from "../../ui/formato.js";

/**
 * Layout del perfil: cabecera, progreso de lectura y salida.
 * Profile layout: header, reading progress and sign-out.
 */

let limpiarLayout: (() => void) | null = null;

/** Escribe un campo en todos sus destinos. / Writes a field to all its targets. */
function setCampo(raiz: ParentNode, campo: string, valor: string): void {
  for (const el of raiz.querySelectorAll<HTMLElement>(`[data-campo="${campo}"]`)) {
    el.textContent = valor;
  }
}

/** Monta el layout del perfil. / Mounts the profile layout. */
export async function mountPerfilLayout(target: Element): Promise<void> {
  limpiarLayout?.();
  limpiarLayout = null;

  await mountLayout(target, import.meta.url);
  montarComun(target);

  const cabecera = target.querySelector<HTMLElement>("[data-cabecera]");
  const barra = target.querySelector<HTMLElement>("[data-progreso]");
  const limpiezas: Array<() => void> = [];

  // Datos del layout (nombre corto y fecha) tras recuperar la sesión.
  // Layout data (short name and date) after restoring the session.
  void cargarPerfil()
    .then((datos) => {
      const pintarFecha = (): void => {
        const texto = fechaLarga(datos.actualizado);
        setCampo(target, "nombreCorto", datos.perfil.nombreCorto);
        setCampo(target, "actualizado", texto);
        for (const time of target.querySelectorAll<HTMLTimeElement>("time[data-campo='actualizado']")) {
          time.dateTime = datos.actualizado;
        }
      };
      pintarFecha();
      limpiezas.push(i18n.onLang(pintarFecha));
    })
    .catch(() => {
      /* la page redirige si no hay sesión / the page redirects without a session */
    });

  const onClick = (e: MouseEvent): void => {
    const objetivo = e.target as Element | null;
    const accion = objetivo?.closest<HTMLElement>("[data-accion]")?.dataset["accion"] ?? "";
    if (accion === "salir") cerrarSesion();
  };
  target.addEventListener("click", onClick as EventListener);
  limpiezas.push(() => target.removeEventListener("click", onClick as EventListener));

  // El enlace de salto no debe cambiar el hash: el router lo leería como ruta.
  // The skip link must not change the hash: the router would read it as a route.
  const saltar = target.querySelector<HTMLAnchorElement>(".saltar");
  const alSaltar = (e: Event): void => {
    e.preventDefault();
    const principal = target.querySelector<HTMLElement>("#contenido-perfil");
    principal?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
    principal?.focus({ preventScroll: true });
  };
  saltar?.addEventListener("click", alSaltar);
  limpiezas.push(() => saltar?.removeEventListener("click", alSaltar));

  // Progreso de lectura y sombra de cabecera. / Reading progress and header shadow.
  let ticking = false;
  const actualizar = (): void => {
    ticking = false;
    if (!cabecera?.isConnected) return;
    const max = document.documentElement.scrollHeight - window.innerHeight;
    const progreso = max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0;
    if (barra) barra.style.width = `${progreso * 100}%`;
    cabecera.toggleAttribute("data-scrolled", window.scrollY > 8);
  };
  const onScroll = (): void => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(actualizar);
  };
  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", onScroll);
  limpiezas.push(() => {
    window.removeEventListener("scroll", onScroll);
    window.removeEventListener("resize", onScroll);
  });
  actualizar();

  let vigia: MutationObserver | null = null;
  const limpiar = (): void => {
    vigia?.disconnect();
    for (const fn of limpiezas.splice(0)) {
      try {
        fn();
      } catch {
        /* limpieza defensiva / defensive cleanup */
      }
    }
    limpiarLayout = null;
  };
  vigia = new MutationObserver(() => {
    if (!target.isConnected) limpiar();
  });
  vigia.observe(document.body, { childList: true, subtree: true });
  limpiarLayout = limpiar;
}
