import { i18n } from "../lang/index.js";
function normalizar(texto) {
    return texto.replace(/\s*[·•]\s*/g, ", ").replace(/\s+/g, " ").trim();
}
export function t(campo) {
    if (campo === undefined || campo === null)
        return "";
    if (typeof campo === "string")
        return normalizar(campo);
    const lang = i18n.lang.value;
    return normalizar(campo[lang] ?? campo.es ?? Object.values(campo)[0] ?? "");
}
export function tl(campo) {
    if (!campo)
        return [];
    if (Array.isArray(campo))
        return campo.map(normalizar);
    const lang = i18n.lang.value;
    return (campo[lang] ?? campo.es ?? []).map(normalizar);
}
