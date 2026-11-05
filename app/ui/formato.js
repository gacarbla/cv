import { i18n } from "../lang/index.js";
export function fechaLarga(iso) {
    if (!iso)
        return "";
    const completa = iso.length === 7 ? `${iso}-01` : iso;
    const fecha = new Date(`${completa}T12:00:00`);
    if (Number.isNaN(fecha.getTime()))
        return iso;
    const opciones = iso.length === 7
        ? { month: "long", year: "numeric" }
        : { day: "numeric", month: "long", year: "numeric" };
    try {
        return new Intl.DateTimeFormat(i18n.lang.value, opciones).format(fecha);
    }
    catch {
        return iso;
    }
}
export function numero(valor) {
    try {
        return new Intl.NumberFormat(i18n.lang.value).format(valor);
    }
    catch {
        return String(valor);
    }
}
