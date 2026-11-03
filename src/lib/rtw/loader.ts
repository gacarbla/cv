/**
 * Montaje por convención: cada componente/layout es una carpeta con
 * index.html + style.css + index.ts. El index.ts declara el componente
 * y el navegador sustituye su etiqueta en vivo (Custom Elements + Shadow DOM).
 * Convention-based mounting: each component/layout is a folder with
 * index.html + style.css + index.ts. The index.ts declares the component
 * and the browser swaps its tag live (Custom Elements + Shadow DOM).
 */

/**
 * Contexto que recibe setup() por cada instancia montada.
 * Context received by setup() for each mounted instance.
 */
export interface SetupCtx {
  /** Raíz sombra con el index.html ya estampado. / Shadow root with index.html already stamped. */
  shadow: ShadowRoot;
  /** La etiqueta original (<x-algo>) con sus atributos. / The original tag (<x-algo>) with its attributes. */
  host: HTMLElement;
  /** Lee un atributo del host. / Reads a host attribute. */
  attr(name: string): string | null;
  /** Registra limpieza al desmontar. / Registers cleanup on unmount. */
  onCleanup(fn: () => void): void;
}

/** Componente declarado y listo para usarse. / Declared component, ready to use. */
export interface ComponentDef {
  /** Etiqueta registrada (<x-algo>). / Registered tag (<x-algo>). */
  tag: string;
  /** Resuelve cuando su html+css están en caché. / Resolves once its html+css are cached. */
  loaded: Promise<void>;
}

/** Opciones de declaración. / Declaration options. */
export interface ComponentOpts {
  /** Lógica en vivo: eventos, estado, rtw. Corre por instancia. / Live logic: events, state, rtw. Runs per instance. */
  setup?: (ctx: SetupCtx) => void;
  /** Atributos observados: su cambio re-ejecuta setup. / Observed attributes: changing them re-runs setup. */
  attrs?: string[];
}

/** Textos ya descargados por URL (html+css se piden una vez). / Texts already fetched per URL (html+css requested once). */
const fileCache = new Map<string, Promise<string>>();

/**
 * Extrae el cuerpo útil de un html: si es un documento completo
 * (un fallback SPA devolvió otra página), se queda con su <body>.
 * Por regex acotada: dentro de <template> el parser ignora <body>.
 * Extracts the useful body of an html: when it is a full document
 * (an SPA fallback returned another page), keeps its <body>.
 * Via scoped regex: inside <template> the parser ignores <body>.
 * @param html - Texto recibido. / Received text.
 * @returns Cuerpo o el texto intacto. / Body or the untouched text.
 */
export function bodyOf(html: string): string {
  const m = /<\s*body[^>]*>([\s\S]*)<\/\s*body\s*>/i.exec(html);
  return m ? m[1] : html;
}

/**
 * Descarga texto con caché por URL. Los fallos NO se cachean:
 * la próxima vez se reintenta.
 * Fetches text with per-URL cache. Failures are NOT cached:
 * next time it retries.
 * @param url - URL absoluta. / Absolute URL.
 * @returns Texto de la respuesta. / Response text.
 */
function fetchText(url: string): Promise<string> {
  const hit = fileCache.get(url);
  if (hit) return hit;
  const req = fetch(url)
    .then((r) => {
      if (!r.ok) throw new Error(`No se pudo cargar ${url} / Could not load ${url}`);
      return r.text();
    })
    .catch((e: unknown) => {
      if (fileCache.get(url) === req) fileCache.delete(url);
      throw e;
    });
  fileCache.set(url, req);
  return req;
}

/**
 * Declara <tag> a partir de los hermanos index.html + style.css de `base`
 * (pásale import.meta.url). Se piden por nombre de fichero explícito para
 * no depender de redirecciones del servidor. Al renderizar, cada <tag> se
 * sustituye por su contenido con estilos encapsulados. Usar una vez por módulo.
 * Declares <tag> from the sibling index.html + style.css of `base`
 * (pass import.meta.url). Requested by explicit filename so they never
 * depend on server redirects. On render, each <tag> is swapped for its
 * content with encapsulated styles. Call once per module.
 * @param tag - Etiqueta con guion. / Dashed tag name.
 * @param base - Normalmente import.meta.url del index.ts. / Usually the index.ts import.meta.url.
 * @param opts - setup y attrs observados. / setup and observed attrs.
 * @returns Definición para dependencias de layout. / Definition for layout dependencies.
 */
export function component(tag: string, base: string, opts: ComponentOpts = {}): ComponentDef {
  if (!tag.includes("-")) {
    throw new Error(`La etiqueta <${tag}> necesita un guion (norma de Custom Elements) / Tag <${tag}> needs a dash (Custom Elements rule)`);
  }
  const htmlURL = new URL("./index.html", base).toString();
  const cssURL = new URL("./style.css", base).toString();
  // Precarga infalible: mountLayout reintenta de verdad al montar.
  // Fail-safe preload: mountLayout truly retries on mount.
  const loaded = Promise.all([fetchText(htmlURL), fetchText(cssURL)]).then(
    () => undefined,
    () => undefined,
  );

  if (!customElements.get(tag)) {
    const observed = opts.attrs ?? [];
    customElements.define(
      tag,
      class extends HTMLElement {
        static observedAttributes = observed;
        /** Limpiezas pendientes de esta instancia. / Pending cleanups of this instance. */
        private cleanups: Array<() => void> = [];
        /** Ya estampó su sombra. / Already stamped its shadow. */
        private booted = false;

        /**
         * Al entrar en el documento: estampa html+css y corre setup.
         * On entering the document: stamps html+css and runs setup.
         */
        connectedCallback(): void {
          void Promise.all([fetchText(htmlURL), fetchText(cssURL)])
            .then(([html, css]) => {
              if (!this.isConnected || this.booted) return;
              this.booted = true;
              const shadow = this.attachShadow({ mode: "open" });
              const style = document.createElement("style");
              style.textContent = css;
              const tpl = document.createElement("template");
              tpl.innerHTML = bodyOf(html);
              shadow.append(style, tpl.content.cloneNode(true));
              this.runSetup(shadow);
            })
            .catch((e: unknown) => {
              console.error(`[${tag}] sin montar hasta remontar / unmounted until remount:`, e);
            });
        }

        /**
         * Ante un attr observado: re-ejecuta setup con limpieza previa.
         * On observed attr change: re-runs setup with prior cleanup.
         */
        attributeChangedCallback(): void {
          const shadow = this.shadowRoot;
          if (shadow && this.booted) this.runSetup(shadow);
        }

        /**
         * Al salir del documento: limpia y permite re-arrancar si vuelve.
         * On leaving the document: cleans up and allows reboot on return.
         */
        disconnectedCallback(): void {
          for (const fn of this.cleanups.splice(0)) {
            try {
              fn();
            } catch {
              /* la limpieza no debe romper el desmontaje / cleanup must not break unmount */
            }
          }
          this.booted = false;
        }

        /**
         * Ejecuta setup tras limpiar el anterior.
         * Runs setup after cleaning the previous one.
         * @param shadow - Raíz sombra viva. / Live shadow root.
         */
        private runSetup(shadow: ShadowRoot): void {
          for (const fn of this.cleanups.splice(0)) {
            try {
              fn();
            } catch {
              /* re-setup limpio / clean re-setup */
            }
          }
          opts.setup?.({
            shadow,
            host: this,
            attr: (name) => this.getAttribute(name),
            onCleanup: (fn) => {
              this.cleanups.push(fn);
            },
          });
        }
      },
    );
  }
  return { tag, loaded };
}

/**
 * Monta un layout (su index.html + style.css globales) en `target`.
 * Espera a sus componentes: al estampar el html, sus etiquetas ya están
 * registradas y el navegador las sustituye en vivo, incluidas las anidadas.
 * Mounts a layout (its global index.html + style.css) into `target`.
 * Waits for its components: when stamping the html, their tags are already
 * registered and the browser swaps them live, nested ones included.
 * @param target - Contenedor real. / Real container.
 * @param base - import.meta.url del index.ts del layout. / The layout index.ts import.meta.url.
 * @param deps - Componentes que usa (para precargarlos). / Components it uses (to preload them).
 */
export async function mountLayout(
  target: Element,
  base: string,
  deps: ComponentDef[] = [],
): Promise<void> {
  await mountView(target, base, deps);
}

/**
 * Monta una page dentro del <page> de su layout. Mecánica idéntica a
 * mountLayout con nombre propio para distinguir capas.
 * Mounts a page inside its layout <page>. Same mechanics as
 * mountLayout with its own name to tell layers apart.
 * @param target - Contenedor real (normalmente el <page>). / Real container (usually the <page>).
 * @param base - import.meta.url del index.ts de la page. / The page index.ts import.meta.url.
 * @param deps - Componentes que usa (para precargarlos). / Components it uses (to preload them).
 */
export async function mountPage(
  target: Element,
  base: string,
  deps: ComponentDef[] = [],
): Promise<void> {
  await mountView(target, base, deps);
}

/**
 * Núcleo compartido de mountLayout/mountPage: precarga, inyecta el css
 * una vez y estampa el html.
 * Shared core of mountLayout/mountPage: preloads, injects css once
 * and stamps the html.
 * @param target - Contenedor real. / Real container.
 * @param base - URL base de la carpeta. / Folder base URL.
 * @param deps - Dependencias a precargar. / Dependencies to preload.
 */
async function mountView(target: Element, base: string, deps: ComponentDef[]): Promise<void> {
  await Promise.all(deps.map((d) => d.loaded));
  const [html, css] = await Promise.all([
    fetchText(new URL("./index.html", base).toString()),
    fetchText(new URL("./style.css", base).toString()),
  ]);
  const id = `layout-${Math.abs(hash(base))}`;
  if (!document.getElementById(id)) {
    const style = document.createElement("style");
    style.id = id;
    style.textContent = css;
    document.head.appendChild(style);
  }
  target.innerHTML = bodyOf(html);
}

/**
 * Hash entero para id de <style> por layout (evita duplicados).
 * Integer hash for per-layout <style> id (avoids duplicates).
 * @param s - Normalmente la URL base. / Usually the base URL.
 * @returns Entero de 32 bits. / 32-bit integer.
 */
function hash(s: string): number {
  let acc = 0;
  for (let i = 0; i < s.length; i++) acc = (acc * 31 + s.charCodeAt(i)) | 0;
  return acc;
}
