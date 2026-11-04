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

/** Nombres de idioma en su propia lengua. / Language names in their own language. */
const NOMBRES_IDIOMA: Record<string, string> = { es: "Español", en: "English", gl: "Galego" };

/**
 * Dibuja una bandera vectorial con geometría y colores oficiales.
 * Draws a vector flag with official geometry and colours.
 * No emoji, no third-party assets.
 */
function crearBandera(lang: string): SVGSVGElement {
  const NS = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(NS, "svg");
  svg.setAttribute("viewBox", "0 0 24 16");
  svg.setAttribute("width", "23");
  svg.setAttribute("height", "15");
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("focusable", "false");
  const add = (tag: string, attrs: Record<string, string>): void => {
    const el = document.createElementNS(NS, tag);
    for (const [clave, valor] of Object.entries(attrs)) el.setAttribute(clave, valor);
    svg.append(el);
  };
  if (lang === "es") {
    add("rect", { width: "24", height: "16", fill: "#AA151B" });
    add("rect", { y: "4", width: "24", height: "8", fill: "#F1BF00" });
  } else if (lang === "gl") {
    add("rect", { width: "24", height: "16", fill: "#ffffff" });
    add("path", { d: "M0 0 L24 16 L24 10.5 L5.5 0 Z", fill: "#0055A4" });
  } else {
    add("rect", { width: "24", height: "16", fill: "#012169" });
    add("path", { d: "M0 0 L24 16 M24 0 L0 16", stroke: "#ffffff", "stroke-width": "3.2" });
    add("path", { d: "M0 0 L24 16 M24 0 L0 16", stroke: "#C8102E", "stroke-width": "1.6" });
    add("path", { d: "M12 0 V16 M0 8 H24", stroke: "#ffffff", "stroke-width": "5" });
    add("path", { d: "M12 0 V16 M0 8 H24", stroke: "#C8102E", "stroke-width": "3" });
  }
  return svg;
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

  const menusIdioma = [...raiz.querySelectorAll<HTMLElement>("[data-idioma-menu]")];

  const cerrarMenu = (menu: HTMLElement): void => {
    const boton = menu.querySelector<HTMLButtonElement>("[data-idioma-toggle]");
    const lista = menu.querySelector<HTMLElement>("[data-idioma-lista]");
    if (!boton || !lista) return;
    lista.hidden = true;
    boton.setAttribute("aria-expanded", "false");
    menu.removeAttribute("data-abierto");
  };

  const pintarIdiomas = (): void => {
    for (const menu of menusIdioma) {
      const boton = menu.querySelector<HTMLButtonElement>("[data-idioma-toggle]");
      const lista = menu.querySelector<HTMLElement>("[data-idioma-lista]");
      const bandera = menu.querySelector<HTMLElement>("[data-idioma-bandera]");
      const codigo = menu.querySelector<HTMLElement>("[data-idioma-codigo]");
      if (!boton || !lista || !bandera || !codigo) continue;
      if (!lista.id) lista.id = "idioma-lista";
      boton.setAttribute("aria-controls", lista.id);
      if (!lista.dataset["poblada"]) {
        for (const lang of i18n.languages) {
          const opcion = document.createElement("button");
          opcion.type = "button";
          opcion.className = "idioma-opcion";
          opcion.dataset["lang"] = lang;
          opcion.setAttribute("role", "option");
          opcion.setAttribute("aria-selected", "false");
          const icono = document.createElement("span");
          icono.className = "idioma-bandera";
          icono.setAttribute("aria-hidden", "true");
          icono.append(crearBandera(lang));
          const nombre = document.createElement("span");
          nombre.className = "idioma-nombre";
          nombre.textContent = NOMBRES_IDIOMA[lang] ?? lang.toUpperCase();
          const check = document.createElement("span");
          check.className = "idioma-check";
          check.setAttribute("aria-hidden", "true");
          check.textContent = "✓";
          opcion.append(icono, nombre, check);
          opcion.addEventListener("click", () => {
            i18n.useLang(lang);
            cerrarMenu(menu);
            boton.focus();
          });
          lista.append(opcion);
        }
        lista.dataset["poblada"] = "1";
      }
      const actual = i18n.lang.value;
      bandera.replaceChildren(crearBandera(actual));
      codigo.textContent = actual.toUpperCase();
      boton.setAttribute("aria-label", `${i18n.t("comun.idioma")}: ${NOMBRES_IDIOMA[actual] ?? actual.toUpperCase()}`);
      for (const opcion of lista.querySelectorAll<HTMLButtonElement>("[data-lang]")) {
        const on = opcion.dataset["lang"] === actual;
        opcion.classList.toggle("on", on);
        opcion.setAttribute("aria-selected", String(on));
      }
    }
  };

  for (const menu of menusIdioma) {
    const boton = menu.querySelector<HTMLButtonElement>("[data-idioma-toggle]");
    const lista = menu.querySelector<HTMLElement>("[data-idioma-lista]");
    if (!boton || !lista) continue;
    const alternar = (): void => {
      const abrir = lista.hidden;
      if (abrir) {
        for (const otro of menusIdioma) if (otro !== menu) cerrarMenu(otro);
      }
      lista.hidden = !abrir;
      boton.setAttribute("aria-expanded", String(abrir));
      menu.toggleAttribute("data-abierto", abrir);
      if (abrir) {
        const activa = lista.querySelector<HTMLButtonElement>('[aria-selected="true"]');
        (activa ?? lista.querySelector<HTMLButtonElement>("[data-lang]"))?.focus();
      }
    };
    const alPulsarFuera = (e: MouseEvent): void => {
      if (!menu.contains(e.target as Node)) cerrarMenu(menu);
    };
    const alTeclear = (e: KeyboardEvent): void => {
      if (lista.hidden) return;
      const opciones = [...lista.querySelectorAll<HTMLButtonElement>("[data-lang]")];
      const indice = opciones.indexOf(document.activeElement as HTMLButtonElement);
      if (e.key === "Escape") {
        e.preventDefault();
        cerrarMenu(menu);
        boton.focus();
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        opciones[(indice + 1) % opciones.length]?.focus();
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        opciones[(indice - 1 + opciones.length) % opciones.length]?.focus();
      } else if (e.key === "Home") {
        e.preventDefault();
        opciones[0]?.focus();
      } else if (e.key === "End") {
        e.preventDefault();
        opciones[opciones.length - 1]?.focus();
      }
    };
    const alSalir = (e: FocusEvent): void => {
      if (!menu.contains(e.relatedTarget as Node)) cerrarMenu(menu);
    };
    boton.addEventListener("click", alternar);
    document.addEventListener("pointerdown", alPulsarFuera);
    lista.addEventListener("keydown", alTeclear);
    menu.addEventListener("focusout", alSalir);
    desuscripciones.push(() => {
      boton.removeEventListener("click", alternar);
      document.removeEventListener("pointerdown", alPulsarFuera);
      lista.removeEventListener("keydown", alTeclear);
      menu.removeEventListener("focusout", alSalir);
    });
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
