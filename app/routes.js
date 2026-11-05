import { Routes } from "./lib/rtw/index.js";
const layoutAcceso = async () => {
    const m = await import("./layouts/acceso/index.js");
    return { mount: (el) => m.mountAccesoLayout(el) };
};
const layoutPerfil = async () => {
    const m = await import("./layouts/perfil/index.js");
    return { mount: (el) => m.mountPerfilLayout(el) };
};
export const routes = [
    Routes.route("acceso")
        .at("/login")
        .layout("acceso", layoutAcceso)
        .none()
        .page(async () => {
        const m = await import("./pages/acceso/index.js");
        return { mount: (el) => m.mountAcceso(el) };
    }),
    Routes.route("perfil")
        .at("/perfil")
        .layout("perfil", layoutPerfil)
        .fade()
        .page(async () => {
        const m = await import("./pages/perfil/index.js");
        return { mount: (el) => m.mountPerfil(el) };
    }),
];
