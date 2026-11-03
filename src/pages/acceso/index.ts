import { mountPage } from "../../lib/rtw/index.js";
import { i18n } from "../../lang/index.js";
import { abrirConClave, estadoAcceso, esperaRestante, haySesion, leerModo } from "../../datos/sesion.js";

/**
 * Página de acceso: formulario, error accesible y freno de intentos.
 * Access page: form, accessible error and attempt throttle.
 */

let limpiar: (() => void) | null = null;

/** Mensaje localizado para el estado actual. / Localised message for the current state. */
function mensajeError(tipo: NonNullable<typeof estadoAcceso.error>, segundos: number): string {
  if (tipo === "red") return i18n.t("acceso.errorRed");
  if (tipo === "crypto") return i18n.t("acceso.errorCrypto");
  if (tipo === "espera") return i18n.t("acceso.espera", { s: segundos });
  return i18n.t("acceso.errorClave");
}

/**
 * Monta la page de acceso dentro del <page> de su layout.
 * Mounts the access page inside its layout <page>.
 * @param target - Normalmente el <page>. / Usually the <page>.
 */
export async function mountAcceso(target: Element): Promise<void> {
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

  const form = target.querySelector<HTMLFormElement>(".form-acceso");
  const input = target.querySelector<HTMLInputElement>("#clave");
  const boton = target.querySelector<HTMLButtonElement>(".form-acceso button[type=submit]");
  const textoBoton = target.querySelector<HTMLElement>("[data-texto-boton]");
  const spinner = target.querySelector<HTMLElement>(".spinner");
  const error = target.querySelector<HTMLElement>("#clave-error");
  if (!form || !input || !boton || !textoBoton || !spinner || !error) return;

  let intervalo = 0;
  let ocupado = false;

  const pintarError = (): void => {
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

  const arrancarEspera = (): void => {
    window.clearInterval(intervalo);
    const actualizar = (): void => {
      const segundos = esperaRestante();
      if (segundos <= 0) {
        window.clearInterval(intervalo);
        intervalo = 0;
        if (estadoAcceso.error === "espera") estadoAcceso.error = null;
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

  const ponerOcupado = (valor: boolean): void => {
    ocupado = valor;
    boton.disabled = valor || esperaRestante() > 0;
    spinner.hidden = !valor;
    textoBoton.textContent = valor ? i18n.t("acceso.comprobando") : i18n.t("acceso.entrar");
  };

  const enviar = async (): Promise<void> => {
    if (ocupado) return;
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
    if (esperaRestante() > 0) arrancarEspera();
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
    if (estadoAcceso.error === "espera" || esperaRestante() > 0) arrancarEspera();
  }
  requestAnimationFrame(() => input.focus());

  limpiar = () => {
    window.clearInterval(intervalo);
    desuscribir();
  };
}
