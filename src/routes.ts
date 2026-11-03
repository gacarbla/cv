import { Routes } from "./lib/rtw/index.js";

/**
 * Única fuente de rutas: acceso privado y perfil.
 * Single source of routes: private access and profile.
 */
const layoutAcceso = async (): Promise<{ mount: (el: Element) => unknown }> => {
  const m = await import("./layouts/acceso/index.js");
  return { mount: (el: Element) => m.mountAccesoLayout(el) };
};

const layoutPerfil = async (): Promise<{ mount: (el: Element) => unknown }> => {
  const m = await import("./layouts/perfil/index.js");
  return { mount: (el: Element) => m.mountPerfilLayout(el) };
};

export const routes = [
  Routes.route("acceso")
    .at("/login")
    .layout("acceso", layoutAcceso)
    .none()
    .page(async () => {
      const m = await import("./pages/acceso/index.js");
      return { mount: (el: Element) => m.mountAcceso(el) };
    }),
  Routes.route("perfil")
    .at("/perfil")
    .layout("perfil", layoutPerfil)
    .fade()
    .page(async () => {
      const m = await import("./pages/perfil/index.js");
      return { mount: (el: Element) => m.mountPerfil(el) };
    }),
] as const;
