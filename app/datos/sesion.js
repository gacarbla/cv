import { CLAVE_INTENTOS, CLAVE_SESION, ITERACIONES_MAX, ITERACIONES_MIN, RUTA_MODO, RUTA_PARAMS, RUTA_PUBLICO, RUTA_UNLOCK, TTL_SESION, } from "../ajustes.js";
export class SinSesion extends Error {
    constructor() {
        super("sin-sesion");
        this.name = "SinSesion";
    }
}
class ErrorRed extends Error {
    constructor() {
        super("red");
        this.name = "ErrorRed";
    }
}
class ErrorApi extends Error {
    constructor(status, code, retryAfter = 0) {
        super(code || "api");
        this.name = "ErrorApi";
        this.status = status;
        this.code = code;
        this.retryAfter = retryAfter;
    }
}
export const estadoAcceso = {
    error: null,
};
let perfilActual = null;
let modoCache = null;
let parametrosCache = null;
let ultimoToque = 0;
export function normalizarClave(valor) {
    return String(valor)
        .normalize("NFKD")
        .replace(/\p{M}/gu, "")
        .toLowerCase()
        .replace(/[\s\-_]+/g, " ")
        .trim();
}
function aB64url(bytes) {
    let bin = "";
    for (const byte of bytes)
        bin += String.fromCharCode(byte);
    return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function deB64url(texto) {
    const base = texto.replace(/-/g, "+").replace(/_/g, "/");
    const pad = base + "=".repeat((4 - (base.length % 4)) % 4);
    const bin = atob(pad);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++)
        out[i] = bin.charCodeAt(i);
    return out;
}
function deB64(texto) {
    const bin = atob(texto);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++)
        out[i] = bin.charCodeAt(i);
    return out;
}
function aBuffer(bytes) {
    const out = new ArrayBuffer(bytes.byteLength);
    new Uint8Array(out).set(bytes);
    return out;
}
function hayCrypto() {
    return typeof crypto !== "undefined" && typeof crypto.subtle !== "undefined";
}
async function fetchConTimeout(url, init, ms) {
    const controlador = new AbortController();
    const temporizador = window.setTimeout(() => controlador.abort(), ms);
    try {
        return await fetch(url, { ...init, signal: controlador.signal });
    }
    catch {
        throw new ErrorRed();
    }
    finally {
        window.clearTimeout(temporizador);
    }
}
export function reemplazarHash(hash) {
    try {
        history.replaceState(null, "", `${location.pathname}${location.search}${hash}`);
    }
    catch {
        location.hash = hash;
    }
}
export async function leerModo() {
    if (modoCache)
        return modoCache;
    try {
        const r = await fetch(RUTA_MODO, { cache: "no-store" });
        if (!r.ok)
            throw new Error("modo");
        const data = (await r.json());
        modoCache = data.modo === "publico" ? "publico" : "cifrado";
    }
    catch {
        modoCache = "cifrado";
    }
    return modoCache;
}
async function leerParams() {
    if (parametrosCache)
        return parametrosCache;
    const r = await fetchConTimeout(RUTA_PARAMS, { cache: "no-store", credentials: "omit", mode: "cors" }, 10000);
    if (!r.ok)
        throw new ErrorRed();
    let data;
    try {
        data = await r.json();
    }
    catch {
        throw new ErrorRed();
    }
    const obj = data;
    const kdf = obj?.kdf;
    if (!obj ||
        obj.v !== 1 ||
        !kdf ||
        kdf.alg !== "PBKDF2-SHA-256" ||
        typeof kdf.salt !== "string" ||
        typeof kdf.iter !== "number" ||
        !Number.isInteger(kdf.iter) ||
        kdf.iter < ITERACIONES_MIN ||
        kdf.iter > ITERACIONES_MAX) {
        throw new ErrorRed();
    }
    let salt;
    try {
        salt = deB64(kdf.salt);
    }
    catch {
        throw new ErrorRed();
    }
    if (salt.length !== 16)
        throw new ErrorRed();
    parametrosCache = {
        v: 1,
        kdf: { alg: "PBKDF2-SHA-256", iter: kdf.iter, salt: kdf.salt },
        salt,
    };
    return parametrosCache;
}
async function pedirSobre(authHash) {
    const r = await fetchConTimeout(RUTA_UNLOCK, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ authHash }),
        cache: "no-store",
        credentials: "omit",
        mode: "cors",
    }, 10000);
    if (r.ok) {
        try {
            return (await r.json());
        }
        catch {
            throw new ErrorRed();
        }
    }
    let code = "";
    try {
        const data = (await r.json());
        code = data?.error?.code ?? "";
    }
    catch {
    }
    const retryAfter = Math.max(0, Number(r.headers.get("Retry-After") ?? "0") || 0);
    throw new ErrorApi(r.status, code, retryAfter);
}
function validarSobre(env, params) {
    if (!env || env.v !== 1)
        throw new Error("version");
    if (env.kdf?.alg !== "PBKDF2-SHA-256" || env.cipher?.alg !== "AES-256-GCM") {
        throw new Error("algoritmo");
    }
    if (!Number.isInteger(env.kdf.iter) ||
        env.kdf.iter < ITERACIONES_MIN ||
        env.kdf.iter > ITERACIONES_MAX) {
        throw new Error("iteraciones");
    }
    if (env.kdf.salt !== params.kdf.salt || env.kdf.iter !== params.kdf.iter) {
        throw new Error("kdf");
    }
    const salt = deB64(env.kdf.salt);
    const iv = deB64url(env.cipher.iv);
    if (salt.length !== 16 || iv.length !== 12 || !env.ct)
        throw new Error("sobre");
    const aad = `cv|${env.v}|${env.kdf.alg}|${env.kdf.iter}|${env.kdf.salt}|${env.cipher.alg}`;
    if (env.aad !== aad)
        throw new Error("aad");
    return { iv, aad };
}
async function derivarClave(clave, salt, iteraciones) {
    const material = await crypto.subtle.importKey("raw", new TextEncoder().encode(normalizarClave(clave)), "PBKDF2", false, ["deriveKey"]);
    const llave = await crypto.subtle.deriveKey({ name: "PBKDF2", salt: aBuffer(salt), iterations: iteraciones, hash: "SHA-256" }, material, { name: "AES-GCM", length: 256 }, true, ["decrypt"]);
    const raw = new Uint8Array(await crypto.subtle.exportKey("raw", llave));
    return { llave, raw };
}
async function descifrarConLlave(env, llave, params) {
    const claro = await crypto.subtle.decrypt({
        name: "AES-GCM",
        iv: aBuffer(params.iv),
        additionalData: new TextEncoder().encode(params.aad),
    }, llave, aBuffer(deB64url(env.ct)));
    return JSON.parse(new TextDecoder().decode(claro));
}
async function importarRaw(raw) {
    return crypto.subtle.importKey("raw", aBuffer(raw), { name: "AES-GCM" }, false, ["decrypt"]);
}
function guardarSesion(raw) {
    try {
        sessionStorage.setItem(CLAVE_SESION, JSON.stringify({ v: 1, k: aB64url(raw), exp: Date.now() + TTL_SESION }));
    }
    catch {
    }
}
function leerSesion() {
    try {
        const raw = sessionStorage.getItem(CLAVE_SESION);
        if (!raw)
            return null;
        const data = JSON.parse(raw);
        if (data.v !== 1 || typeof data.k !== "string" || typeof data.exp !== "number") {
            sessionStorage.removeItem(CLAVE_SESION);
            return null;
        }
        if (data.exp <= Date.now()) {
            sessionStorage.removeItem(CLAVE_SESION);
            return null;
        }
        const bytes = deB64url(data.k);
        if (bytes.length !== 32) {
            sessionStorage.removeItem(CLAVE_SESION);
            return null;
        }
        return { raw: bytes, exp: data.exp };
    }
    catch {
        return null;
    }
}
function borrarSesion() {
    try {
        sessionStorage.removeItem(CLAVE_SESION);
    }
    catch {
    }
    perfilActual = null;
}
export function haySesion() {
    return perfilActual !== null || leerSesion() !== null;
}
export function tocarSesion() {
    const ahora = Date.now();
    if (ahora - ultimoToque < 60000)
        return;
    ultimoToque = ahora;
    const sesion = leerSesion();
    if (!sesion)
        return;
    try {
        sessionStorage.setItem(CLAVE_SESION, JSON.stringify({ v: 1, k: aB64url(sesion.raw), exp: ahora + TTL_SESION }));
    }
    catch {
    }
}
export function esperaRestante() {
    try {
        const raw = localStorage.getItem(CLAVE_INTENTOS);
        if (!raw)
            return 0;
        const data = JSON.parse(raw);
        const restante = (data.hasta ?? 0) - Date.now();
        return restante > 0 ? Math.ceil(restante / 1000) : 0;
    }
    catch {
        return 0;
    }
}
function registrarFallo() {
    let n = 1;
    try {
        const raw = localStorage.getItem(CLAVE_INTENTOS);
        const data = raw ? JSON.parse(raw) : null;
        n = Math.max(1, (data?.n ?? 0) + 1);
        const segundos = n < 3 ? 0 : Math.min(30, 2 ** (n - 2));
        localStorage.setItem(CLAVE_INTENTOS, JSON.stringify({ n, hasta: Date.now() + segundos * 1000 }));
        return segundos;
    }
    catch {
        return 0;
    }
}
function bloquearPorApi(segundos) {
    const espera = Math.max(1, Math.ceil(segundos || 30));
    let n = 1;
    try {
        const raw = localStorage.getItem(CLAVE_INTENTOS);
        const data = raw ? JSON.parse(raw) : null;
        n = Math.max(1, (data?.n ?? 0) + 1);
        localStorage.setItem(CLAVE_INTENTOS, JSON.stringify({ n, hasta: Date.now() + espera * 1000 }));
    }
    catch {
    }
}
function limpiarIntentos() {
    try {
        localStorage.removeItem(CLAVE_INTENTOS);
    }
    catch {
    }
}
async function cargarPublico() {
    let r;
    try {
        r = await fetch(RUTA_PUBLICO, { cache: "no-store" });
    }
    catch {
        throw new ErrorRed();
    }
    if (!r.ok)
        throw new ErrorRed();
    return (await r.json());
}
export async function abrirConClave(clave) {
    estadoAcceso.error = null;
    if (!normalizarClave(clave))
        return false;
    if (!hayCrypto()) {
        estadoAcceso.error = "crypto";
        return false;
    }
    const espera = esperaRestante();
    if (espera > 0) {
        estadoAcceso.error = "espera";
        return false;
    }
    try {
        const params = await leerParams();
        const { llave, raw } = await derivarClave(clave, params.salt, params.kdf.iter);
        const env = await pedirSobre(aB64url(raw));
        const { iv, aad } = validarSobre(env, params);
        perfilActual = await descifrarConLlave(env, llave, { iv, aad });
        guardarSesion(raw);
        limpiarIntentos();
        return true;
    }
    catch (e) {
        if (e instanceof ErrorApi) {
            if (e.status === 429) {
                bloquearPorApi(e.retryAfter);
                estadoAcceso.error = "espera";
            }
            else if (e.status === 503 &&
                (e.code === "CV_UNAVAILABLE" || e.code === "CV_NOT_CONFIGURED")) {
                estadoAcceso.error = "servicio";
            }
            else if (e.status === 400 || e.status === 401) {
                registrarFallo();
                estadoAcceso.error = "clave";
            }
            else {
                estadoAcceso.error = "red";
            }
        }
        else if (e instanceof ErrorRed) {
            estadoAcceso.error = "red";
        }
        else if (e.name === "OperationError") {
            registrarFallo();
            estadoAcceso.error = "clave";
        }
        else {
            estadoAcceso.error = "red";
        }
        return false;
    }
}
export async function recuperarSesion() {
    if (perfilActual)
        return true;
    if (!hayCrypto())
        return false;
    const sesion = leerSesion();
    if (!sesion)
        return false;
    try {
        const params = await leerParams();
        const env = await pedirSobre(aB64url(sesion.raw));
        const { iv, aad } = validarSobre(env, params);
        const llave = await importarRaw(sesion.raw);
        perfilActual = await descifrarConLlave(env, llave, { iv, aad });
        return true;
    }
    catch {
        borrarSesion();
        return false;
    }
}
export async function cargarPerfil() {
    if (perfilActual)
        return perfilActual;
    if ((await leerModo()) === "publico") {
        perfilActual = await cargarPublico();
        return perfilActual;
    }
    if (await recuperarSesion()) {
        if (perfilActual)
            return perfilActual;
    }
    throw new SinSesion();
}
export function cerrarSesion() {
    borrarSesion();
    estadoAcceso.error = null;
    try {
        sessionStorage.removeItem(CLAVE_SESION);
    }
    catch {
    }
    const url = `${location.pathname}${location.search}#/login`;
    try {
        location.replace(url);
    }
    finally {
        location.reload();
    }
}
export async function procesarEntrada() {
    const modo = await leerModo();
    if (modo === "publico") {
        if (!location.hash.startsWith("#/perfil"))
            reemplazarHash("#/perfil");
        return;
    }
    const raw = location.hash.replace(/^#/, "");
    const [ruta = "", query = ""] = raw.split("?");
    const params = new URLSearchParams(query);
    const clave = params.get("key") ?? params.get("k") ?? "";
    if (ruta === "/login" && clave) {
        reemplazarHash("#/login");
        const ok = await abrirConClave(clave);
        if (ok)
            reemplazarHash("#/perfil");
        return;
    }
    if (clave)
        reemplazarHash(`#${ruta || "/login"}`);
    const sesion = await recuperarSesion();
    if (sesion) {
        if (ruta === "/login" || ruta === "" || ruta === "/")
            reemplazarHash("#/perfil");
        return;
    }
    if (ruta === "/perfil" || ruta === "" || ruta === "/")
        reemplazarHash("#/login");
}
