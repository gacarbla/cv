import { mountPage } from "../../lib/rtw/index.js";
import { i18n } from "../../lang/index.js";
import { cargarPerfil } from "../../datos/sesion.js";
import { t, tl } from "../../datos/idioma.js";
import type { Certificacion, Perfil } from "../../datos/tipos.js";
import { crear, enlace, iconoSvg, normalizarTexto, vaciar } from "../../ui/dom.js";
import { fechaLarga } from "../../ui/formato.js";

/**
 * Perfil interactivo: pinta datos descifrados con nodos DOM seguros,
 * filtra experiencia y competencias y ofrece PDF.
 * Interactive profile: paints decrypted data with safe DOM nodes,
 * filters experience and skills, and offers the PDF.
 */

let limpiarPagina: (() => void) | null = null;
let datos: Perfil | null = null;

let filtroArea = "todas";
let filtroAptitud = "todas";
let busqueda = "";
const abiertos = new Set<string>();
let abiertosInicializado = false;
let temporizadorToast = 0;
const urlsCarta = new Set<string>();
let urlPdfActual: string | null = null;

/** Escribe un campo en todos sus destinos. / Writes a field to all its targets. */
function setCampo(raiz: ParentNode, campo: string, valor: string): void {
  for (const el of raiz.querySelectorAll<HTMLElement>(`[data-campo="${campo}"]`)) {
    el.textContent = valor;
  }
}

/** Escribe un href en todos sus destinos. / Writes an href to all its targets. */
function setUrl(raiz: ParentNode, clave: string, url: string): void {
  for (const el of raiz.querySelectorAll<HTMLAnchorElement>(`[data-url="${clave}"]`)) {
    if (url) el.href = url;
  }
}

/** Evidencias legibles de una competencia. / Readable evidence for a skill. */
function nombreEvidencia(ids: string[]): string {
  const d = datos;
  if (!d) return "";
  const vistos = new Set<string>();
  return ids
    .map((id) => {
      const exp = d.experiencia.find((e) => e.id === id);
      if (exp) return exp.empresa;
      const pro = d.proyectos.find((p) => p.id === id);
      if (pro) return pro.nombre;
      return "";
    })
    .filter((valor) => {
      if (!valor || vistos.has(valor)) return false;
      vistos.add(valor);
      return true;
    })
    .join("; ");
}

/** Pinta las redes y enlaces. / Paints social and contact links. */
function pintarRedes(raiz: ParentNode, d: Perfil): void {
  const caja = raiz.querySelector<HTMLElement>("[data-redes]");
  if (!caja) return;
  vaciar(caja);
  const email = d.perfil.contacto.email;
  const items: Array<{ texto: string; etiqueta: string; url: string; icono: "linkedin" | "github" | "web" | "mail" }> = [
    { texto: "LinkedIn", etiqueta: "LinkedIn", url: d.perfil.contacto.linkedin, icono: "linkedin" },
    { texto: "GitHub", etiqueta: "GitHub", url: d.perfil.contacto.github, icono: "github" },
    { texto: "gacarbla.es", etiqueta: "Web: gacarbla.es", url: d.perfil.contacto.web, icono: "web" },
    { texto: email, etiqueta: `${i18n.t("contacto.email")}: ${email}`, url: `mailto:${email}`, icono: "mail" },
  ];
  for (const item of items) {
    if (!item.url) continue;
    const a = crear("a", {
      class: "red",
      attrs: {
        href: item.url,
        "aria-label": item.etiqueta,
        title: item.etiqueta,
        ...(item.url.startsWith("http") ? { target: "_blank", rel: "noopener noreferrer" } : {}),
      },
    });
    a.append(iconoSvg(item.icono, 17), crear("span", { text: item.texto }));
    caja.append(a);
  }
}

/** Pinta la experiencia y sus filtros. / Paints experience and its filters. */
function pintarExperiencia(raiz: ParentNode, d: Perfil): void {
  const lista = raiz.querySelector<HTMLElement>("[data-lista='experiencia']");
  if (!lista) return;
  vaciar(lista);
  if (!abiertosInicializado && d.experiencia[0]) {
    abiertos.add(d.experiencia[0].id);
    abiertosInicializado = true;
  }

  for (const exp of d.experiencia) {
    const li = crear("li", {
      class: "rol",
      attrs: {
        "data-id": exp.id,
        "data-areas": exp.areas.join(" "),
        "data-aptitudes": exp.aptitudes.join(" "),
        style: `--logo-color: ${exp.color}`,
      },
    });
    const cuerpo = crear("div", { class: "rol-cuerpo" });
    const cab = crear("div", { class: "rol-cab" });
    const titulo = crear("h3", { class: "rol-puesto", text: t(exp.puesto) });
    cab.append(titulo);

    const empresa = exp.empresaUrl
      ? crear("a", {
          class: "rol-empresa",
          text: exp.empresa,
          attrs: { href: exp.empresaUrl, target: "_blank", rel: "noopener noreferrer" },
        })
      : crear("span", { class: "rol-empresa", text: exp.empresa });

    const meta = crear("p", { class: "rol-meta" });
    meta.append(
      crear("span", { text: t(exp.tipo) }),
      crear("span", { text: `${t(exp.fechas)} (${t(exp.duracion)})` }),
    );
    const ubicacion = crear("p", { class: "rol-ubicacion" });
    ubicacion.append(crear("span", { text: t(exp.ubicacion) }), crear("span", { text: t(exp.modalidad) }));
    const resumen = crear("p", { class: "rol-resumen", text: t(exp.resumen) });

    const abierto = abiertos.has(exp.id);
    const detalle = crear("details", {
      class: "rol-detalle",
      attrs: { open: abierto, "data-abierto": String(abierto) },
    });
    const summary = crear("summary");
    const summaryTexto = crear("span", {
      class: "desplegable-texto",
      text: abierto ? i18n.t("experiencia.verMenos") : i18n.t("experiencia.verDetalle"),
    });
    summary.append(
      crear("span", { class: "desplegable-icono", attrs: { "aria-hidden": "true" } }),
      summaryTexto,
    );
    const dentro = crear("div", { class: "detalle-in" });
    const contenido = crear("div", { class: "detalle-contenido" });
    const relleno = crear("div", { class: "detalle-padding" });
    const logros = crear("ul", { class: "lista-logros" });
    for (const logro of tl(exp.logros)) logros.append(crear("li", { text: logro }));
    const herramientas = crear("p", { class: "rol-herramientas" });
    herramientas.append(crear("strong", { text: `${i18n.t("experiencia.herramientas")}: ` }));
    herramientas.append(document.createTextNode(exp.herramientas.join(", ")));
    relleno.append(logros, herramientas);
    contenido.append(relleno);
    dentro.append(contenido);
    detalle.append(summary, dentro);
    detalle.addEventListener("toggle", () => {
      if (detalle.open) abiertos.add(exp.id);
      else abiertos.delete(exp.id);
      if (!detalle.hasAttribute("data-animando")) {
        detalle.dataset["abierto"] = String(detalle.open);
      }
      summaryTexto.textContent = detalle.open
        ? i18n.t("experiencia.verMenos")
        : i18n.t("experiencia.verDetalle");
    });

    cuerpo.append(cab, empresa, meta, ubicacion, resumen, detalle);
    li.append(cuerpo);
    lista.append(li);
  }

  const filtros = raiz.querySelector<HTMLElement>("[data-filtros-experiencia]");
  if (filtros) {
    vaciar(filtros);
    const areas = d.areas.filter((a) => d.experiencia.some((e) => e.areas.includes(a.id)));
    const opciones = [{ id: "todas", label: i18n.t("experiencia.todas") }].concat(
      areas.map((a) => ({ id: a.id, label: t(a.nombre) })),
    );
    for (const op of opciones) {
      const b = crear("button", {
        class: "filtro",
        text: op.label,
        attrs: { type: "button", "data-filtro-area": op.id, "aria-pressed": String(filtroArea === op.id) },
      });
      filtros.append(b);
    }
  }
}

/** Pinta competencias, filtros y herramientas. / Paints skills, filters and tools. */
function pintarAptitudes(raiz: ParentNode, d: Perfil): void {
  const caja = raiz.querySelector<HTMLElement>("[data-lista='aptitudes']");
  if (caja) {
    vaciar(caja);
    for (const a of d.aptitudes) {
      const tarjeta = crear("article", {
        class: "aptitud",
        attrs: {
          "data-aptitud": a.id,
          "data-categoria": a.categoria,
          "data-fuente": a.fuente,
        },
      });
      const top = crear("span", { class: "aptitud-top" });
      top.append(crear("span", { class: "aptitud-nombre", text: t(a.nombre) }));
      tarjeta.append(top);
      tarjeta.append(crear("span", { class: "aptitud-desc", text: t(a.descripcion) }));
      const ev = nombreEvidencia(a.evidencia);
      if (ev) tarjeta.append(crear("span", { class: "aptitud-evidencia", text: ev }));
      caja.append(tarjeta);
    }
  }

  const filtros = raiz.querySelector<HTMLElement>("[data-filtros-aptitudes]");
  if (filtros) {
    vaciar(filtros);
    const categorias = d.areas.filter((a) => d.aptitudes.some((x) => x.categoria === a.id));
    const opciones = [{ id: "todas", label: i18n.t("aptitudes.todas") }].concat(
      categorias.map((a) => ({ id: a.id, label: t(a.nombre) })),
    );
    for (const op of opciones) {
      filtros.append(
        crear("button", {
          class: "filtro",
          text: op.label,
          attrs: {
            type: "button",
            "data-filtro-aptitud": op.id,
            "aria-pressed": String(filtroAptitud === op.id),
          },
        }),
      );
    }
  }

  const herramientas = raiz.querySelector<HTMLElement>("[data-lista='herramientas']");
  if (herramientas) {
    vaciar(herramientas);
    for (const h of d.herramientas) {
      const li = crear("li", { class: "herramienta" });
      li.append(crear("strong", { text: h.nombre }));
      li.append(crear("span", { class: "herramienta-contexto", text: t(h.contexto) }));
      herramientas.append(li);
    }
  }
}

/** Pinta proyectos. / Paints projects. */
function pintarProyectos(raiz: ParentNode, d: Perfil): void {
  const caja = raiz.querySelector<HTMLElement>("[data-lista='proyectos']");
  if (!caja) return;
  vaciar(caja);
  for (const p of d.proyectos) {
    const card = crear("article", {
      class: `proyecto${p.destacado ? " destacado" : ""}`,
    });
    const cuerpo = crear("div", { class: "proyecto-cuerpo" });
    cuerpo.append(crear("h3", { text: p.nombre }));
    cuerpo.append(crear("p", { class: "proyecto-desc", text: t(p.descripcion) }));
    cuerpo.append(crear("p", { class: "proyecto-stack", text: p.stack.join(", ") }));
    const estadoProyecto = t(p.estado);
    cuerpo.append(
      crear("p", {
        class: "proyecto-meta",
        text: `${p.anio}, ${estadoProyecto.charAt(0).toLocaleLowerCase()}${estadoProyecto.slice(1)}.`,
      }),
    );
    const acciones = crear("div", { class: "proyecto-acciones" });
    if (p.repo) acciones.append(enlace(i18n.t("proyectos.verRepo"), p.repo, "enlace-flecha"));
    if (p.demo) acciones.append(enlace(i18n.t("proyectos.verWeb"), p.demo, "enlace-flecha"));
    cuerpo.append(acciones);
    card.append(cuerpo);
    caja.append(card);
  }
}

/** Pinta formación y aprendizaje continuo. / Paints education and continuous learning. */
function pintarFormacion(raiz: ParentNode, d: Perfil): void {
  const caja = raiz.querySelector<HTMLElement>("[data-lista='formacion']");
  if (caja) {
    vaciar(caja);
    const f = d.formacion;
    const card = crear("article", { class: "formacion-card" });
    const cuerpo = crear("div", { class: "formacion-cuerpo" });
    cuerpo.append(crear("h3", { text: t(f.titulo) }));
    cuerpo.append(crear("p", { class: "formacion-centro", text: f.centro }));
    cuerpo.append(crear("p", { class: "formacion-meta", text: `${t(f.fechas)}, ${t(f.ubicacion)}.` }));
    cuerpo.append(crear("p", { class: "formacion-actividades", text: `${i18n.t("formacion.actividades")}: ${t(f.actividades)}` }));
    cuerpo.append(crear("p", { class: "formacion-diploma", text: `${i18n.t("formacion.diploma")}: ${t(f.diploma)}` }));
    card.append(cuerpo);
    caja.append(card);
  }

  const cajaA = raiz.querySelector<HTMLElement>("[data-lista='aprendizaje']");
  if (cajaA) {
    vaciar(cajaA);
    const a = d.aprendizaje;
    const card = crear("article", { class: "formacion-card aprendizaje" });
    const cuerpo = crear("div", { class: "formacion-cuerpo" });
    cuerpo.append(crear("h3", { text: t(a.titulo) }));
    cuerpo.append(crear("p", { class: "formacion-centro", text: `${a.desde}.` }));
    cuerpo.append(crear("p", { class: "formacion-actividades", text: t(a.descripcion) }));
    if (a.foco.length > 0) cuerpo.append(crear("p", { class: "formacion-foco", text: a.foco.join(", ") }));
    card.append(cuerpo);
    cajaA.append(card);
  }
}

/** Pinta certificaciones. / Paints certifications. */
function pintarCertificaciones(raiz: ParentNode, d: Perfil): void {
  const caja = raiz.querySelector<HTMLElement>("[data-lista='certificaciones']");
  if (!caja) return;
  vaciar(caja);
  for (const c of d.certificaciones) {
    caja.append(certificado(c));
  }
}

/** Un certificado compacto y desplegable. / A compact, expandable certificate. */
function certificado(c: Certificacion): HTMLDetailsElement {
  const det = crear("details", {
    class: `certificado${c.destacado ? " destacado" : ""}`,
    attrs: { style: `--logo-color: ${c.color}`, "data-abierto": "false" },
  });
  const sum = crear("summary");
  sum.append(crear("span", { class: "cert-anio", text: t(c.fechas) }));
  sum.append(crear("span", { class: "cert-nombre", text: c.nombre }));
  sum.append(crear("span", { class: "cert-entidad", text: c.entidad }));
  sum.append(crear("span", { class: "desplegable-icono", attrs: { "aria-hidden": "true" } }));
  const dentro = crear("div", { class: "cert-detalle" });
  const contenido = crear("div", { class: "cert-detalle-contenido" });
  const relleno = crear("div", { class: "cert-detalle-padding" });
  relleno.append(crear("p", { text: `${i18n.t("formacion.credencial")}: ${c.credencial}` }));
  relleno.append(crear("p", { class: "cert-skill", text: t(c.skill) }));
  if (c.entidadUrl) relleno.append(enlace(c.entidad, c.entidadUrl, "enlace-flecha"));
  contenido.append(relleno);
  dentro.append(contenido);
  det.append(sum, dentro);
  det.addEventListener("toggle", () => {
    if (!det.hasAttribute("data-animando")) {
      det.dataset["abierto"] = String(det.open);
    }
  });
  return det;
}

/** Pinta idiomas. / Paints languages. */
function pintarIdiomas(raiz: ParentNode, d: Perfil): void {
  const caja = raiz.querySelector<HTMLElement>("[data-lista='idiomas']");
  if (!caja) return;
  vaciar(caja);
  for (const idioma of d.idiomas) {
    const fila = crear("div", { class: "idioma" });
    const cab = crear("div", { class: "idioma-cab" });
    cab.append(crear("h3", { text: t(idioma.nombre) }));
    fila.append(cab);
    fila.append(crear("p", { class: "idioma-nivel", text: t(idioma.nivel) }));
    fila.append(crear("p", { class: "idioma-evidencia", text: t(idioma.evidencia) }));
    caja.append(fila);
  }
}

/** Pinta voluntariado. / Paints volunteering. */
function pintarVoluntariado(raiz: ParentNode, d: Perfil): void {
  const caja = raiz.querySelector<HTMLElement>("[data-lista='voluntariado']");
  if (!caja) return;
  vaciar(caja);
  for (const v of d.voluntariado) {
    const card = crear("article", { class: "voluntariado-card" });
    const cuerpo = crear("div", { class: "voluntariado-cuerpo" });
    const cab = crear("div", { class: "rol-cab" });
    cab.append(crear("h3", { text: t(v.puesto) }));
    cuerpo.append(cab);
    const org = v.entidadUrl
      ? crear("a", {
          class: "rol-empresa",
          text: v.entidad,
          attrs: { href: v.entidadUrl, target: "_blank", rel: "noopener noreferrer" },
        })
      : crear("span", { class: "rol-empresa", text: v.entidad });
    cuerpo.append(org);
    cuerpo.append(crear("p", { class: "rol-meta", text: `${t(v.fechas)} (${t(v.duracion)}), ${t(v.ubicacion)}.` }));
    cuerpo.append(crear("p", { class: "rol-resumen", text: t(v.descripcion) }));
    const logros = crear("ul", { class: "lista-logros" });
    for (const logro of tl(v.logros)) logros.append(crear("li", { text: logro }));
    cuerpo.append(logros);
    card.append(cuerpo);
    caja.append(card);
  }
}

/** Pinta la recomendación y su carta protegida. / Paints the recommendation and its protected letter. */
function pintarRecomendaciones(raiz: ParentNode, d: Perfil): void {
  const caja = raiz.querySelector<HTMLElement>("[data-lista='recomendaciones']");
  if (!caja) return;
  vaciar(caja);
  for (const r of d.recomendaciones) {
    const card = crear("article", {
      class: "recomendacion",
      attrs: { style: `--logo-color: ${r.color}` },
    });
    const cab = crear("div", { class: "recomendacion-cab" });
    cab.append(crear("blockquote", { text: t(r.extracto) }));

    const autor = crear("div", { class: "recomendacion-autor" });
    const datosAutor = crear("div", { class: "recomendacion-datos" });
    datosAutor.append(crear("p", { class: "recomendacion-nombre", text: r.autor }));
    datosAutor.append(crear("p", { class: "recomendacion-rol", text: `${t(r.puesto)}, ${r.empresa}.` }));
    datosAutor.append(crear("p", { class: "recomendacion-relacion", text: `${t(r.relacion)}, ${t(r.fechas)}.` }));
    autor.append(datosAutor);

    const acciones = crear("div", { class: "recomendacion-acciones" });
    const ver = crear("button", {
      class: "btn mini",
      attrs: {
        type: "button",
        "data-accion": "ver-carta",
        "data-carta-id": r.id,
        title: r.nombreArchivo,
      },
    });
    ver.append(iconoSvg("file-text", 14), crear("span", { text: i18n.t("recomendaciones.verCarta") }));
    acciones.append(ver);

    card.append(cab, autor, acciones);
    caja.append(card);
  }
}

/** Abre el PDF de una recomendación en el visor integrado. / Opens a recommendation PDF in the built-in viewer. */
function abrirCarta(raiz: ParentNode, id: string): void {
  const r = datos?.recomendaciones.find((x) => x.id === id);
  if (!r?.archivo) return;
  const dialogo = raiz.querySelector<HTMLDialogElement>("[data-dialogo-pdf]");
  const iframe = raiz.querySelector<HTMLIFrameElement>("[data-pdf-iframe]");
  const abrir = raiz.querySelector<HTMLAnchorElement>("[data-pdf-abrir]");
  if (!dialogo || !iframe) return;
  try {
    const match = /^data:([^;]+);base64,(.+)$/s.exec(r.archivo);
    if (!match) throw new Error("pdf");
    const mime = match[1] || "application/pdf";
    const bin = atob(match[2]);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    if (urlPdfActual) {
      URL.revokeObjectURL(urlPdfActual);
      urlsCarta.delete(urlPdfActual);
    }
    urlPdfActual = URL.createObjectURL(new Blob([bytes], { type: mime }));
    urlsCarta.add(urlPdfActual);
    iframe.src = urlPdfActual;
    if (abrir) abrir.href = urlPdfActual;
    if (!dialogo.open) dialogo.showModal();
    dialogo.querySelector<HTMLElement>("[data-accion='cerrar-pdf']")?.focus();
  } catch {
    mostrarToast(raiz, i18n.t("recomendaciones.error"));
  }
}

/** Cierra el visor y libera el PDF. / Closes the viewer and releases the PDF. */
function cerrarPdf(raiz: ParentNode): void {
  const dialogo = raiz.querySelector<HTMLDialogElement>("[data-dialogo-pdf]");
  const iframe = raiz.querySelector<HTMLIFrameElement>("[data-pdf-iframe]");
  if (dialogo?.open) dialogo.close();
  if (iframe) iframe.src = "about:blank";
  if (urlPdfActual) {
    URL.revokeObjectURL(urlPdfActual);
    urlsCarta.delete(urlPdfActual);
    urlPdfActual = null;
  }
}

/** Aplica el filtro de experiencia. / Applies the experience filter. */
function aplicarFiltroExperiencia(raiz: ParentNode): void {
  for (const b of raiz.querySelectorAll<HTMLElement>("[data-filtro-area]")) {
    const on = b.dataset["filtroArea"] === filtroArea;
    b.setAttribute("aria-pressed", String(on));
    b.classList.toggle("on", on);
  }
  let visibles = 0;
  for (const li of raiz.querySelectorAll<HTMLElement>(".linea > li")) {
    const areas = (li.dataset["areas"] ?? "").split(" ");
    const ok = filtroArea === "todas" || areas.includes(filtroArea);
    li.hidden = !ok;
    if (ok) visibles++;
  }
  const vacio = raiz.querySelector<HTMLElement>("[data-vacio-experiencia]");
  if (vacio) vacio.hidden = visibles > 0;
}

/** Aplica búsqueda y categoría de competencias. / Applies skill search and category. */
function aplicarFiltroAptitudes(raiz: ParentNode): void {
  for (const b of raiz.querySelectorAll<HTMLElement>("[data-filtro-aptitud]")) {
    const on = b.dataset["filtroAptitud"] === filtroAptitud;
    b.setAttribute("aria-pressed", String(on));
    b.classList.toggle("on", on);
  }
  const q = normalizarTexto(busqueda);
  let visibles = 0;
  for (const tile of raiz.querySelectorAll<HTMLElement>("[data-aptitud]")) {
    const categoria = tile.dataset["categoria"] ?? "";
    const texto = normalizarTexto(tile.textContent ?? "");
    const ok = (filtroAptitud === "todas" || categoria === filtroAptitud) && (!q || texto.includes(q));
    tile.hidden = !ok;
    if (ok) visibles++;
  }
  const contador = raiz.querySelector<HTMLElement>("[data-contador-aptitudes]");
  if (contador) {
    contador.textContent =
      visibles === 1 ? i18n.t("aptitudes.resultado1") : i18n.t("aptitudes.resultados", { n: visibles });
  }
  const vacio = raiz.querySelector<HTMLElement>("[data-vacio-aptitudes]");
  if (vacio) vacio.hidden = visibles > 0;
}

/** Pinta todo el contenido dinámico. / Paints all dynamic content. */
function pintarTodo(raiz: ParentNode): void {
  const d = datos;
  if (!d) return;

  document.title = `${d.perfil.nombre} — ${i18n.t("comun.cv")}`;
  setCampo(raiz, "nombre", d.perfil.nombre);
  setCampo(raiz, "titular", t(d.perfil.titular).replace(/,\s+/g, ". "));
  setCampo(raiz, "resumenCorto", t(d.perfil.resumenCorto));
  setCampo(raiz, "contactoNota", t(d.perfil.contactoNota));
  setCampo(raiz, "email", d.perfil.contacto.email);
  const estadoLinea = [t(d.perfil.estado), t(d.perfil.modalidad), t(d.perfil.disponibilidad)]
    .filter(Boolean)
    .join(". ");
  setCampo(raiz, "estadoLinea", estadoLinea ? `${estadoLinea}.` : "");
  const actualizado = fechaLarga(d.actualizado);
  setCampo(raiz, "actualizado", actualizado);
  for (const time of raiz.querySelectorAll<HTMLTimeElement>("time[data-campo='actualizado']")) {
    time.dateTime = d.actualizado;
  }
  for (const a of raiz.querySelectorAll<HTMLAnchorElement>("a[data-campo='email']")) {
    a.href = `mailto:${d.perfil.contacto.email}`;
  }
  setUrl(raiz, "linkedin", d.perfil.contacto.linkedin);
  setUrl(raiz, "github", d.perfil.contacto.github);
  setUrl(raiz, "web", d.perfil.contacto.web);
  const prosa = raiz.querySelector<HTMLElement>("[data-campo='sobreMi']");
  if (prosa) {
    vaciar(prosa);
    for (const parrafo of tl(d.sobreMi)) prosa.append(crear("p", { text: parrafo }));
  }

  pintarRedes(raiz, d);
  pintarExperiencia(raiz, d);
  pintarRecomendaciones(raiz, d);
  pintarAptitudes(raiz, d);
  pintarProyectos(raiz, d);
  pintarFormacion(raiz, d);
  pintarCertificaciones(raiz, d);
  pintarIdiomas(raiz, d);
  pintarVoluntariado(raiz, d);

  aplicarFiltroExperiencia(raiz);
  aplicarFiltroAptitudes(raiz);
}

/** Muestra un aviso breve. / Shows a brief toast. */
function mostrarToast(raiz: ParentNode, texto: string): void {
  const toast = raiz.querySelector<HTMLElement>("[data-toast]");
  if (!toast) return;
  window.clearTimeout(temporizadorToast);
  toast.textContent = texto;
  toast.hidden = false;
  requestAnimationFrame(() => toast.classList.add("visible"));
  temporizadorToast = window.setTimeout(() => {
    toast.classList.remove("visible");
    window.setTimeout(() => {
      toast.hidden = true;
    }, 200);
  }, 2400);
}

/** Copia el correo. / Copies the email. */
async function copiarEmail(raiz: ParentNode): Promise<void> {
  const email = datos?.perfil.contacto.email ?? "";
  if (!email) return;
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(email);
    } else {
      const ta = document.createElement("textarea");
      ta.value = email;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.append(ta);
      ta.select();
      document.execCommand("copy");
      ta.remove();
    }
    mostrarToast(raiz, i18n.t("comun.copiado"));
  } catch {
    mostrarToast(raiz, i18n.t("comun.errorCopia"));
  }
}

/** Activa el índice lateral y el enlace activo. / Activates the side index and active link. */
function configurarIndice(raiz: Element): () => void {
  const enlaces = [...raiz.querySelectorAll<HTMLAnchorElement>("[data-seccion]")];
  if (enlaces.length === 0) return () => {};
  const secciones = [...raiz.querySelectorAll<HTMLElement>("section[id]")];
  const indice = raiz.querySelector<HTMLElement>(".indice");
  const riel = raiz.querySelector<HTMLElement>(".riel");
  const primerCabecera = raiz.querySelector<HTMLElement>(".perfil-contenido .seccion:first-child .seccion-cab");
  let activaPrevia = "";
  let ticking = false;
  const centrar = (a: HTMLAnchorElement): void => {
    if (!indice || indice.scrollWidth <= indice.clientWidth + 1) return;
    const izquierda = a.offsetLeft - (indice.clientWidth - a.offsetWidth) / 2;
    indice.scrollTo({
      left: Math.max(0, izquierda),
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
    });
  };
  const actualizar = (): void => {
    ticking = false;
    if (!raiz.isConnected) return;
    const cabecera = document.querySelector<HTMLElement>("[data-cabecera]");
    const alturaCabecera = cabecera?.getBoundingClientRect().height ?? 64;
    const margen = alturaCabecera + 120;
    if (riel && primerCabecera) {
      const limite = alturaCabecera + riel.offsetHeight + 24;
      riel.toggleAttribute("data-visible", primerCabecera.getBoundingClientRect().bottom <= limite);
    }
    let activa = secciones[0]?.id ?? "";
    for (const s of secciones) {
      if (s.getBoundingClientRect().top <= margen) activa = s.id;
    }
    // En el fondo de la página, la última sección manda. / At the page bottom, the last section wins.
    if (window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 8) {
      activa = secciones[secciones.length - 1]?.id ?? activa;
    }
    for (const a of enlaces) {
      const on = a.dataset["seccion"] === activa;
      a.classList.toggle("activo", on);
      if (on) a.setAttribute("aria-current", "true");
      else a.removeAttribute("aria-current");
    }
    if (activa !== activaPrevia) {
      const enlaceActivo = enlaces.find((a) => a.dataset["seccion"] === activa);
      if (enlaceActivo) centrar(enlaceActivo);
      activaPrevia = activa;
    }
  };
  const onScroll = (): void => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(actualizar);
  };
  const alPulsar = (e: Event): void => {
    const a = e.currentTarget as HTMLAnchorElement;
    const id = a.dataset["seccion"] ?? "";
    const destino = document.getElementById(id);
    if (!destino) return;
    e.preventDefault();
    destino.scrollIntoView({
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
      block: "start",
    });
    destino.setAttribute("tabindex", "-1");
    destino.focus({ preventScroll: true });
    for (const b of enlaces) {
      const on = b === a;
      b.classList.toggle("activo", on);
      if (on) b.setAttribute("aria-current", "true");
      else b.removeAttribute("aria-current");
    }
    centrar(a);
  };
  for (const a of enlaces) a.addEventListener("click", alPulsar);
  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", onScroll);
  requestAnimationFrame(actualizar);
  return () => {
    for (const a of enlaces) a.removeEventListener("click", alPulsar);
    window.removeEventListener("scroll", onScroll);
    window.removeEventListener("resize", onScroll);
  };
}

/** Revela secciones al entrar en pantalla. / Reveals sections as they enter the viewport. */
function configurarRevelado(raiz: ParentNode): () => void {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return () => {};
  const obs = new IntersectionObserver(
    (entradas) => {
      for (const e of entradas) {
        if (!e.isIntersecting) continue;
        e.target.classList.add("visible");
        obs.unobserve(e.target);
      }
    },
    { threshold: 0.08 },
  );
  for (const seccion of raiz.querySelectorAll<HTMLElement>(".seccion")) {
    seccion.classList.add("revelar");
    obs.observe(seccion);
  }
  return () => obs.disconnect();
}

/** Abre o cierra un bloque con animación de fila de grid. / Opens or closes a block with a grid-row animation. */
function alternarDetalle(det: HTMLDetailsElement): void {
  const contenido = det.querySelector<HTMLElement>(".detalle-in, .cert-detalle");
  if (!contenido || det.hasAttribute("data-animando")) return;
  det.setAttribute("data-animando", "");
  const abrir = !det.open;
  const etiqueta = det.querySelector<HTMLElement>(".desplegable-texto");
  if (etiqueta) {
    etiqueta.textContent = abrir ? i18n.t("experiencia.verMenos") : i18n.t("experiencia.verDetalle");
  }
  let temporizador = 0;

  const limpiar = (): void => {
    window.clearTimeout(temporizador);
    contenido.removeEventListener("transitionend", fin);
    det.removeAttribute("data-animando");
  };
  const fin = (ev: TransitionEvent): void => {
    if (ev.propertyName !== "grid-template-rows") return;
    if (!abrir) det.open = false;
    limpiar();
  };

  if (abrir) {
    det.dataset["abierto"] = "false";
    det.open = true;
    void det.offsetHeight;
    requestAnimationFrame(() => {
      det.dataset["abierto"] = "true";
    });
  } else {
    det.dataset["abierto"] = "false";
  }

  contenido.addEventListener("transitionend", fin);
  temporizador = window.setTimeout(
    () => fin({ propertyName: "grid-template-rows" } as TransitionEvent),
    320,
  );
}

/** Cablea todas las interacciones. / Wires all interactions. */
function configurarInteracciones(raiz: Element): () => void {
  const dialogoPdf = raiz.querySelector<HTMLDialogElement>("[data-dialogo-pdf]");

  const onClick = (e: MouseEvent): void => {
    const objetivo = e.target as Element | null;
    if (!objetivo) return;

    const resumen = objetivo.closest("summary");
    const detalle = resumen?.parentElement;
    if (
      resumen &&
      detalle instanceof HTMLDetailsElement &&
      (detalle.classList.contains("rol-detalle") || detalle.classList.contains("certificado"))
    ) {
      if (
        !window.matchMedia("(prefers-reduced-motion: reduce)").matches &&
        detalle.querySelector(".detalle-in, .cert-detalle")
      ) {
        e.preventDefault();
        alternarDetalle(detalle);
      }
      return;
    }

    const filtroAreaEl = objetivo.closest<HTMLElement>("[data-filtro-area]");
    if (filtroAreaEl) {
      filtroArea = filtroAreaEl.dataset["filtroArea"] ?? "todas";
      aplicarFiltroExperiencia(raiz);
      return;
    }

    const filtroAptitudEl = objetivo.closest<HTMLElement>("[data-filtro-aptitud]");
    if (filtroAptitudEl) {
      filtroAptitud = filtroAptitudEl.dataset["filtroAptitud"] ?? "todas";
      aplicarFiltroAptitudes(raiz);
      return;
    }

    const accionEl = objetivo.closest<HTMLElement>("[data-accion]");
    const accion = accionEl?.dataset["accion"] ?? "";
    if (!accion) return;
    if (accion === "cerrar-pdf") cerrarPdf(raiz);
    else if (accion === "copiar-email") void copiarEmail(raiz);
    else if (accion === "ver-carta") abrirCarta(raiz, accionEl?.dataset["cartaId"] ?? "");
  };
  raiz.addEventListener("click", onClick as EventListener);

  const onDialogo = (e: MouseEvent): void => {
    if (e.target === dialogoPdf) cerrarPdf(raiz);
  };
  dialogoPdf?.addEventListener("click", onDialogo);

  const buscar = raiz.querySelector<HTMLInputElement>("#buscar-aptitud");
  const onBuscar = (): void => {
    busqueda = buscar?.value ?? "";
    aplicarFiltroAptitudes(raiz);
  };
  buscar?.addEventListener("input", onBuscar);

  return () => {
    raiz.removeEventListener("click", onClick as EventListener);
    dialogoPdf?.removeEventListener("click", onDialogo);
    buscar?.removeEventListener("input", onBuscar);
  };
}

/** Monta la page de perfil dentro del <page> de su layout. / Mounts the profile page. */
export async function mountPerfil(target: Element): Promise<void> {
  limpiarPagina?.();
  limpiarPagina = null;

  try {
    datos = await cargarPerfil();
  } catch {
    location.replace(`${location.pathname}${location.search}#/login`);
    return;
  }

  await mountPage(target, import.meta.url, []);
  pintarTodo(target);

  const limpiezas: Array<() => void> = [];
  limpiezas.push(configurarInteracciones(target));
  limpiezas.push(configurarIndice(target));
  limpiezas.push(configurarRevelado(target));
  limpiezas.push(
    i18n.onLang(() => {
      i18n.paint(target);
      pintarTodo(target);
    }),
  );

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
    window.clearTimeout(temporizadorToast);
    for (const url of urlsCarta) URL.revokeObjectURL(url);
    urlsCarta.clear();
    urlPdfActual = null;
    limpiarPagina = null;
  };
  vigia = new MutationObserver(() => {
    if (!target.isConnected) limpiar();
  });
  vigia.observe(document.body, { childList: true, subtree: true });
  limpiarPagina = limpiar;
}
