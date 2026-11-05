import { App } from "./lib/rtw/index.js";
import { routes } from "./routes.js";
import { i18n } from "./lang/index.js";
import { procesarEntrada } from "./datos/sesion.js";
async function arrancar() {
    if (!document.querySelector("app"))
        return;
    await procesarEntrada();
    const app = new App(routes, {
        strategy: { kind: "hash" },
        fallback: "acceso",
        i18n,
    });
    app.start();
    document.documentElement.dataset["listo"] = "";
    const idle = window.requestIdleCallback ?? ((cb) => window.setTimeout(cb, 1500));
    idle(() => {
        void app.router.prefetch("perfil");
    });
}
void arrancar();
