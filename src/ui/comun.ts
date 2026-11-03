import { i18n } from "../lang/index.js";
import { tocarSesion } from "../datos/sesion.js";
import { aplicarIconos, iconoSvg } from "./dom.js";

/**
 * Cableado común de layouts: tema, idioma, año y renovación de sesión.
 * Shared layout wiring: theme, language, year and session renewal.
 */

type Tema = "auto" | "claro" | "oscuro";
const CLAVE_TEMA = "cv:tema";
let limpiarAnterior: (() => void) | null = null;

/** Lee el tema guardado. / Reads the stored theme. */
function leerTema(): Tema {
  try {
    const raw = localStorage.getItem(CLAVE_TEMA);
    if (raw === "claro" || raw === "oscuro" || raw === "auto") return raw;
  } catch {
    /* sin almacenamiento / no storage */
  }
  return "auto";
}

/** Aplica el tema al documento. / Applies the theme to the document. */
function aplicarTema(tema: Tema): void {
  const raiz = document.documentElement;
  if (tema === "auto") raiz.removeAttribute("data-tema");
  else raiz.dataset["tema"] = tema;
  try {
    localStorage.setItem(CLAVE_TEMA, tema);
  } catch {
    /* opcional / optional */
  }
}

/** Icono del tema. / Theme icon. */
function iconoTema(tema: Tema): "sun" | "moon" | "monitor" {
  if (tema === "claro") return "sun";
  if (tema === "oscuro") return "moon";
  return "monitor";
}

/** Etiqueta del tema. / Theme label. */
function etiquetaTema(tema: Tema): string {
  if (tema === "claro") return i18n.t("comun.temaClaro");
  if (tema === "oscuro") return i18n.t("comun.temaOscuro");
  return i18n.t("comun.temaAuto");
}

/**
 * Monta el cableado común en un layout y limpia el anterior.
 * Mounts the shared wiring on a layout and cleans the previous one.
 * @param raiz - Layout ya estampado. / Stamped layout.
 */
export function montarComun(raiz: ParentNode): void {
  limpiarAnterior?.();
  const desuscripciones: Array<() => void> = [];
  let tema = leerTema();

  const botonesTema = [...raiz.querySelectorAll<HTMLButtonElement>('[data-accion="tema"]')];
  const pintarTema = (): void => {
    for (const b of botonesTema) {
      b.replaceChildren(iconoSvg(iconoTema(tema), 18));
      b.setAttribute("aria-label", etiquetaTema(tema));
      b.title = etiquetaTema(tema);
      b.dataset["temaActual"] = tema;
    }
  };
  for (const b of botonesTema) {
    b.addEventListener("click", () => {
      tema = tema === "auto" ? "claro" : tema === "claro" ? "oscuro" : "auto";
      aplicarTema(tema);
      pintarTema();
    });
  }
  aplicarTema(tema);
  pintarTema();

  const cajasIdioma = [...raiz.querySelectorAll<HTMLElement>("[data-idiomas]")];
  const selectsIdioma = [...raiz.querySelectorAll<HTMLSelectElement>("[data-idioma-select]")];
  const pintarIdiomas = (): void => {
    for (const caja of cajasIdioma) {
      caja.textContent = "";
      for (const lang of i18n.languages) {
        const b = document.createElement("button");
        b.type = "button";
        b.textContent = lang.toUpperCase();
        b.className = lang === i18n.lang.value ? "on" : "";
        b.setAttribute("aria-pressed", String(lang === i18n.lang.value));
        b.setAttribute("aria-label", `${i18n.t("comun.idioma")}: ${lang.toUpperCase()}`);
        b.addEventListener("click", () => i18n.use(lang));
        caja.appendChild(b);
      }
    }
    for (const sel of selectsIdioma) {
      if (sel.options.length === 0) {
        for (const lang of i18n.languages) sel.add(new Option(lang.toUpperCase(), lang));
      }
      sel.value = i18n.lang.value;
    }
  };
  for (const sel of selectsIdioma) {
    sel.addEventListener("change", () => i18n.useLang(sel.value));
  }
  pintarIdiomas();
  desuscripciones.push(i18n.onLang(pintarIdiomas));
  desuscripciones.push(
    i18n.onLang(() => {
      for (const b of botonesTema) {
        b.setAttribute("aria-label", etiquetaTema(tema));
        b.title = etiquetaTema(tema);
      }
    }),
  );

  desuscripciones.push(i18n.apply(raiz));
  aplicarIconos(raiz);

  // Ancho real del viewport sin la barra de scroll, para full-bleed exacto.
  // Real viewport width without the scrollbar, for exact full-bleed.
  const medirBarras = (): void => {
    const ancho = Math.max(0, window.innerWidth - document.documentElement.clientWidth);
    document.documentElement.style.setProperty("--sbw", `${ancho}px`);
  };
  medirBarras();
  requestAnimationFrame(medirBarras);
  window.addEventListener("resize", medirBarras);
  desuscripciones.push(() => window.removeEventListener("resize", medirBarras));

  for (const el of raiz.querySelectorAll<HTMLElement>("[data-anio]")) {
    el.textContent = String(new Date().getFullYear());
  }

  const actividad = (): void => tocarSesion();
  document.addEventListener("pointerdown", actividad, { passive: true });
  document.addEventListener("keydown", actividad);
  window.addEventListener("scroll", actividad, { passive: true });
  desuscripciones.push(() => {
    document.removeEventListener("pointerdown", actividad);
    document.removeEventListener("keydown", actividad);
    window.removeEventListener("scroll", actividad);
  });

  limpiarAnterior = () => {
    for (const fn of desuscripciones.splice(0)) {
      try {
        fn();
      } catch {
        /* limpieza defensiva / defensive cleanup */
      }
    }
  };
}
