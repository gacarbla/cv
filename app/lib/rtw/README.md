# Real Time Web

Sin JSX, sin build web, sin dependencias. Componentes POO en TypeScript
que se renderizan y actualizan en tiempo real contra el DOM.

## Piezas

- `signal.ts` — `Signal<T>` (valor observable), `Computed<T>` (derivado),
  `Store<S>` (estado compartido por objeto). Todo con `subscribe()` explícito.
- `vdom.ts` — `h(tag | Componente, attrs, ...hijos)`. Nodos: elementos,
  componentes o texto. `null/false` no pintan (condicionales directos).
  Atributos propios: cualquier prop en componentes; en elementos `class`
  (string, array u objeto), `style` (string u objeto), booleanos, `data-*`,
  eventos `onClick/onInput/...`, `ref` y `key` para listas.
- `component.ts` — `Component<P, S>`: `props`, `state`, `setState()`,
  `forceUpdate()`, ciclo `onMount/onUpdate/onUnmount`. `mount(Ctor, el, props)`
  devuelve el desmontador.
- `render.ts` — reconciliador: parchea atributos, hijos (con `key`) y
  componentes; conserva focos y listeners; agrupa `setState` por microtarea.

## Ejemplo

```ts
import { Component, h, mount, Signal } from "./lib/index.js";

interface Pestaña { id: string; titulo: string }
interface Estado { activa: string }

class Tabs extends Component<{ items: Pestaña[] }, Estado> {
  constructor(props: { items: Pestaña[] }) {
    super(props);
    this.state = { activa: props.items[0]?.id ?? "" };
  }
  render() {
    return h("div", { class: "tabs" },
      h("nav", null, this.props.items.map((t) =>
        h("button", {
          key: t.id,
          class: { on: t.id === this.state.activa },
          onClick: () => this.setState({ activa: t.id }),
        }, t.titulo))),
      h("p", null, `Activa: ${this.state.activa}`));
  }
}

const ruta = new Signal<string>("#inicio");
ruta.subscribe(() => console.log("nueva ruta", ruta.value));

mount(Tabs, document.body, { items: [{ id: "a", titulo: "A" }] });
```

## Reglas

- Todo lo que cambia en pantalla vive en `state`, `Signal` o `Store`.
  Nada fuera de ellos se re-renderiza solo.
- Listas dinámicas: pon siempre `key` estable o el orden parpadeará.
- Limpieza: `onUnmount` desuscribe señales/stores creados en `onMount`.
- `setState` es barato y agrupado; llamar en bucle no re-renderiza en bucle.

## Sin node (solo lectura)

Node solo compila (`npm run build`: TS→`app/` + copia html/css al lado y
empaqueta `web/` con index.html, 404.html de fallback SPA, app/ y
assets/). La web servida son ficheros estáticos: cualquier servidor vale.
En este repo `app/` y `web/` están ignorados; CI construye en cada push
a `main` y sube el paquete a la raíz de la rama `web`.
El cargador no distingue TS de JS: un componente puede escribirse en
`index.js` plano y se monta igual (pierdes tipado, ganas cero herramientas).

## Rutas (router.ts)

Tres estrategias a elegir en `Router.define(defs, { outlet, strategy })`:

- `{ kind: "path" }` — clásica `dominio/ruta` (History API, con `base?`).
- `{ kind: "hash" }` — dominio base + `#/ruta` (con `prefix?`).
- `{ kind: "memory", memory: { persist } }` — la URL no cambia; la ruta
  se guarda en memoria, `session` o `local` (`key?`).

```ts
import { Router } from "./lib/rtw/index.js";
import { route as inicio } from "./layouts/main/index.js";

const router = Router.define(
  [{
    ...inicio, // { name, path, transition }
    load: async () => {
      const m = await import("./layouts/main/index.js");
      return { mount: (el) => m.mountMain(el) };
    },
  }],
  {
    outlet: document.getElementById("app")!,
    strategy: { kind: "hash" },
    fallback: "inicio",
  },
);
router.start();
router.go("inicio"); // <- autocompleta el nombre
```

Transición en destino (`TransitionDef`): `from: "always"` (desde
cualquiera) o `from: ["inicio", ...]` (solo desde esas); `using` es
`"fade" | "slide" | "none"` o una función propia
`(entrante, saliente) => Promise<void>`. Respeta `prefers-reduced-motion`.

Enlaces dentro de Shadow DOM: el clic llega al documento re-objetivado
y el router no ve el `<a>`. El componente despacha `routeEvent(nombre)`
(compuesto, atraviesa la sombra) y la app lo convierte en `go()`:

```ts
// en el setup del componente
a.addEventListener("click", (e) => {
  e.preventDefault();
  a.dispatchEvent(routeEvent("experiencia"));
});
// en la entrada
document.addEventListener("rtw:go", (e) => router.go(e.detail));
```

## App, rutas e i18n

La entrada (`src/index.ts`) solo configura y arranca; la lógica vive aquí:

```ts
// src/routes.ts: única fuente de rutas y transiciones (layouts/pages no declaran)
import { Routes } from "./lib/rtw/index.js";
const mainLayout = async () => {
  const m = await import("./layouts/main/index.js");
  return { mount: (el: Element) => m.mountMain(el) };
};
export const routes = [
  Routes.route("inicio").at("/").layout("main", mainLayout).fade().page(...),
  // general fundido + específica deslizante solo desde proyectos
  Routes.route("contacto").at("/contacto").layout("main", mainLayout).fade().slideFrom("experiencia").page(...),
] as const;

// src/index.ts
import { App } from "./lib/rtw/index.js";
import { routes } from "./routes.js";
new App(routes, { strategy: { kind: "path" }, fallback: "inicio" }).start();
```

`App` une rutas + router + etiqueta `<app>` + puentes (`rtw:go`,
`[data-go]`, evento `rtw:route`). Métodos: `start()` / `stop()`,
`setStrategy()` en caliente, `router` expuesto para `go()`, `watch()`,
`pathOf()` o `prefetch()` (carga layouts sin montar, ideal en idle).

## Layouts y pages

El layout es lo que NO cambia (nav, pie): persiste entre rutas y nunca
se anima. La page vive en su `<page>` y sí permuta con transición:

```html
<!-- src/layouts/main/index.html -->
<x-navigation></x-navigation>
<main id="contenido"><page></page></main>
<x-footer></x-footer>
```

```ts
// src/routes.ts: el router referencia layout Y page
Routes.route("ficha").at("/ficha")
  .layout("main", async () => {
    const m = await import("./layouts/main/index.js");
    return { mount: (el: Element) => m.mountMain(el) };
  })
  .fade()
  .page(async () => {
    const m = await import("./pages/ficha/index.js");
    return { mount: (el: Element) => m.mountFicha(el) };
  });
```

Las pages se montan con `mountPage()` (misma mecánica que layouts,
nombre propio). Si el layout cambia, todo permuta; si no, solo la page.

## Componentes con estado compartido (formularios)

Los shadow DOM no se ven entre sí: `x-form` pide y los campos responden
por evento compuesto y síncrono (sin lib externa, en `forms.ts`):

```html
<x-form para="yo@dom.io" asunto="Hola" data-i18n-enviar="f.enviar">
  <x-txt etiqueta="Nombre" nombre="nombre" data-i18n-etiqueta="f.nombre"></x-txt>
  <x-sel etiqueta="Motivo" nombre="motivo" traducir opciones='["f.m1","f.m2"]'></x-sel>
</x-form>
```

- `collectFrom(form)` recoge `{nombre: valor}` al enviar.
- `provideValue(nombre, lector)` registra un campo (con cleanup).
- Textos de campos: `data-i18n-*` con claves + `i18n.apply(shadow)`
  (sin reconstruir: no pierde foco ni valores). Con `traducir`, las
  opciones del `x-sel` son claves i18n y sobreviven al idioma.

Multidioma propio (`i18n.ts`, cero dependencias):

```ts
const i18n = new I18n({
  defaultLang: "es",
  detect: true, // navigator.language si existe
  persist: "rtw:lang", // recuerda en localStorage
  dicts: {
    es: { hola: "Hola {nombre}" },
    en: { hola: "Hello {nombre}" },
    gl: { hola: "Ola {nombre}" },
  } as const,
});
i18n.t("hola", { nombre: "Gabe" }); // claves autocompletan
i18n.use("en");
i18n.languages; // ["es", "en", "gl"] para pintar conmutadores
i18n.apply(document); // pinta [data-i18n] y [data-i18n-<attr>], repinta al cambiar
```

En componentes con Shadow DOM: `i18n.apply(shadow)` en `setup()` y
`onCleanup(desuscribir)`. Sin `data-i18n-vars='{"n":3}'` no hay interpolación
en DOM. Clave ausente: prueba fallback y si no, devuelve la clave.
