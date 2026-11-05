import { mountLayout } from "../../lib/rtw/index.js";
import { i18n } from "../../lang/index.js";
import { cargarPerfil, cerrarSesion } from "../../datos/sesion.js";
import { montarComun } from "../../ui/comun.js";
import { fechaLarga } from "../../ui/formato.js";
let limpiarLayout = null;
function setCampo(raiz, campo, valor) {
    for (const el of raiz.querySelectorAll(`[data-campo="${campo}"]`)) {
        el.textContent = valor;
    }
}
export async function mountPerfilLayout(target) {
    limpiarLayout?.();
    limpiarLayout = null;
    await mountLayout(target, import.meta.url);
    montarComun(target);
    const cabecera = target.querySelector("[data-cabecera]");
    const limpiezas = [];
    void cargarPerfil()
        .then((datos) => {
        const pintarFecha = () => {
            const texto = fechaLarga(datos.actualizado);
            setCampo(target, "nombreCorto", datos.perfil.nombreCorto);
            setCampo(target, "actualizado", texto);
            for (const time of target.querySelectorAll("time[data-campo='actualizado']")) {
                time.dateTime = datos.actualizado;
            }
        };
        pintarFecha();
        limpiezas.push(i18n.onLang(pintarFecha));
    })
        .catch(() => {
    });
    const onClick = (e) => {
        const objetivo = e.target;
        const accion = objetivo?.closest("[data-accion]")?.dataset["accion"] ?? "";
        if (accion === "salir")
            cerrarSesion();
    };
    target.addEventListener("click", onClick);
    limpiezas.push(() => target.removeEventListener("click", onClick));
    const saltar = target.querySelector(".saltar");
    const alSaltar = (e) => {
        e.preventDefault();
        const principal = target.querySelector("#contenido-perfil");
        principal?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
        principal?.focus({ preventScroll: true });
    };
    saltar?.addEventListener("click", alSaltar);
    limpiezas.push(() => saltar?.removeEventListener("click", alSaltar));
    let ticking = false;
    const actualizar = () => {
        ticking = false;
        if (!cabecera?.isConnected)
            return;
        cabecera.toggleAttribute("data-scrolled", window.scrollY > 8);
    };
    const onScroll = () => {
        if (ticking)
            return;
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
    let vigia = null;
    const limpiar = () => {
        vigia?.disconnect();
        for (const fn of limpiezas.splice(0)) {
            try {
                fn();
            }
            catch {
            }
        }
        limpiarLayout = null;
    };
    vigia = new MutationObserver(() => {
        if (!target.isConnected)
            limpiar();
    });
    vigia.observe(document.body, { childList: true, subtree: true });
    limpiarLayout = limpiar;
}
