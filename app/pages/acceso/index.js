import { mountPage } from "../../lib/rtw/index.js";
import { i18n } from "../../lang/index.js";
import { abrirConClave, estadoAcceso, esperaRestante, haySesion, leerModo } from "../../datos/sesion.js";
let limpiar = null;
function mensajeError(tipo, segundos) {
    if (tipo === "red")
        return i18n.t("acceso.errorRed");
    if (tipo === "crypto")
        return i18n.t("acceso.errorCrypto");
    if (tipo === "espera")
        return i18n.t("acceso.espera", { s: segundos });
    if (tipo === "servicio")
        return i18n.t("acceso.errorServicio");
    return i18n.t("acceso.errorClave");
}
export async function mountAcceso(target) {
    limpiar?.();
    limpiar = null;
    if ((await leerModo()) === "publico") {
        location.replace(`${location.pathname}${location.search}#/perfil`);
        return;
    }
    if (haySesion()) {
        location.replace(`${location.pathname}${location.search}#/perfil`);
        return;
    }
    await mountPage(target, import.meta.url, []);
    const form = target.querySelector(".form-acceso");
    const input = target.querySelector("#clave");
    const boton = target.querySelector(".form-acceso button[type=submit]");
    const textoBoton = target.querySelector("[data-texto-boton]");
    const spinner = target.querySelector(".spinner");
    const error = target.querySelector("#clave-error");
    if (!form || !input || !boton || !textoBoton || !spinner || !error)
        return;
    let intervalo = 0;
    let ocupado = false;
    const pintarError = () => {
        const tipo = estadoAcceso.error;
        if (!tipo) {
            error.hidden = true;
            error.textContent = "";
            input.removeAttribute("aria-invalid");
            return;
        }
        const segundos = esperaRestante();
        error.hidden = false;
        error.textContent = mensajeError(tipo, segundos);
        input.setAttribute("aria-invalid", "true");
    };
    const arrancarEspera = () => {
        window.clearInterval(intervalo);
        const actualizar = () => {
            const segundos = esperaRestante();
            if (segundos <= 0) {
                window.clearInterval(intervalo);
                intervalo = 0;
                if (estadoAcceso.error === "espera")
                    estadoAcceso.error = null;
                boton.disabled = false;
                pintarError();
                return;
            }
            estadoAcceso.error = "espera";
            pintarError();
            boton.disabled = true;
        };
        actualizar();
        intervalo = window.setInterval(actualizar, 1000);
    };
    const ponerOcupado = (valor) => {
        ocupado = valor;
        boton.disabled = valor || esperaRestante() > 0;
        spinner.hidden = !valor;
        textoBoton.textContent = valor ? i18n.t("acceso.comprobando") : i18n.t("acceso.entrar");
    };
    const enviar = async () => {
        if (ocupado)
            return;
        const clave = input.value.trim();
        if (!clave) {
            estadoAcceso.error = "clave";
            pintarError();
            input.focus();
            return;
        }
        if (esperaRestante() > 0) {
            arrancarEspera();
            return;
        }
        estadoAcceso.error = null;
        pintarError();
        ponerOcupado(true);
        const ok = await abrirConClave(clave);
        if (ok) {
            location.replace(`${location.pathname}${location.search}#/perfil`);
            return;
        }
        ponerOcupado(false);
        pintarError();
        if (esperaRestante() > 0)
            arrancarEspera();
        input.focus();
        input.select();
    };
    form.addEventListener("submit", (e) => {
        e.preventDefault();
        void enviar();
    });
    input.addEventListener("input", () => {
        if (input.getAttribute("aria-invalid") === "true") {
            input.removeAttribute("aria-invalid");
            error.hidden = true;
        }
    });
    const desuscribir = i18n.onLang(() => {
        textoBoton.textContent = ocupado ? i18n.t("acceso.comprobando") : i18n.t("acceso.entrar");
        pintarError();
    });
    if (estadoAcceso.error) {
        pintarError();
        if (estadoAcceso.error === "espera" || esperaRestante() > 0)
            arrancarEspera();
    }
    requestAnimationFrame(() => input.focus());
    limpiar = () => {
        window.clearInterval(intervalo);
        desuscribir();
    };
}
