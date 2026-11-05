import {
  CLAVE_INTENTOS,
  CLAVE_SESION,
  ITERACIONES_MAX,
  ITERACIONES_MIN,
  RUTA_MODO,
  RUTA_PARAMS,
  RUTA_PUBLICO,
  RUTA_UNLOCK,
  TTL_SESION,
} from "../ajustes.js";
import type { Perfil, Sobre } from "./tipos.js";

/**
 * Acceso privado: parámetros KDF de la API, authHash derivado en local,
 * sobre cifrado AES-GCM y sesión de pestaña. La contraseña nunca sale
 * del navegador; el perfil en claro solo existe en memoria.
 * Private access: KDF parameters from the API, locally derived authHash,
 * AES-GCM envelope and tab session. The password never leaves the browser;
 * plaintext profile only exists in memory.
 */

/** Error de sesión ausente. / Missing-session error. */
export class SinSesion extends Error {
  constructor() {
    super("sin-sesion");
    this.name = "SinSesion";
  }
}

/** Error de red, timeout o respuesta no utilizable. / Network, timeout or unusable response. */
class ErrorRed extends Error {
  constructor() {
    super("red");
    this.name = "ErrorRed";
  }
}

/** Error HTTP tipado de la API. / Typed HTTP error from the API. */
class ErrorApi extends Error {
  readonly status: number;
  readonly code: string;
  readonly retryAfter: number;

  constructor(status: number, code: string, retryAfter = 0) {
    super(code || "api");
    this.name = "ErrorApi";
    this.status = status;
    this.code = code;
    this.retryAfter = retryAfter;
  }
}

/** Estado visible del acceso. / Visible access state. */
export const estadoAcceso: {
  error: "clave" | "red" | "crypto" | "espera" | "servicio" | null;
} = {
  error: null,
};

/** Parámetros KDF normalizados y cacheados en memoria. / Normalised KDF parameters cached in memory. */
interface ParametrosKdf {
  v: 1;
  kdf: { alg: "PBKDF2-SHA-256"; iter: number; salt: string };
  salt: Uint8Array;
}

/** Perfil descifrado en memoria. / Decrypted profile in memory. */
let perfilActual: Perfil | null = null;
/** Modo leído de modo.json (cacheado). / Mode read from modo.json (cached). */
let modoCache: "cifrado" | "publico" | null = null;
/** Parámetros de KDF cacheados durante la vida de la página. / KDF params cached for the page lifetime. */
let parametrosCache: ParametrosKdf | null = null;
/** Último toque de sesión (para no escribir en cada scroll). / Last session touch. */
let ultimoToque = 0;

/** Normaliza la clave igual que tools/lib/clave.mjs. / Normalises the key like tools/lib/clave.mjs. */
export function normalizarClave(valor: string): string {
  return String(valor)
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[\s\-_]+/g, " ")
    .trim();
}

/** Uint8Array -> base64url sin relleno. / Uint8Array -> base64url without padding. */
function aB64url(bytes: Uint8Array): string {
  let bin = "";
  for (const byte of bytes) bin += String.fromCharCode(byte);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** base64url -> Uint8Array. */
function deB64url(texto: string): Uint8Array {
  const base = texto.replace(/-/g, "+").replace(/_/g, "/");
  const pad = base + "=".repeat((4 - (base.length % 4)) % 4);
  const bin = atob(pad);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/** base64 estándar -> Uint8Array. / Standard base64 -> Uint8Array. */
function deB64(texto: string): Uint8Array {
  const bin = atob(texto);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/** Copia a un ArrayBuffer propio para WebCrypto. / Copies to an owned ArrayBuffer for WebCrypto. */
function aBuffer(bytes: Uint8Array): ArrayBuffer {
  const out = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(out).set(bytes);
  return out;
}

/** ¿Hay WebCrypto disponible? / Is WebCrypto available? */
function hayCrypto(): boolean {
  return typeof crypto !== "undefined" && typeof crypto.subtle !== "undefined";
}

/** fetch con timeout; cualquier fallo de transporte se trata como red. / fetch with timeout; transport failures become network errors. */
async function fetchConTimeout(url: string, init: RequestInit, ms: number): Promise<Response> {
  const controlador = new AbortController();
  const temporizador = window.setTimeout(() => controlador.abort(), ms);
  try {
    return await fetch(url, { ...init, signal: controlador.signal });
  } catch {
    throw new ErrorRed();
  } finally {
    window.clearTimeout(temporizador);
  }
}

/** Sustituye el hash sin crear historial. / Replaces the hash without history. */
export function reemplazarHash(hash: string): void {
  try {
    history.replaceState(null, "", `${location.pathname}${location.search}${hash}`);
  } catch {
    location.hash = hash;
  }
}

/** Lee el modo de publicación; si falla, se queda en cifrado. / Reads the publication mode; defaults to encrypted. */
export async function leerModo(): Promise<"cifrado" | "publico"> {
  if (modoCache) return modoCache;
  try {
    const r = await fetch(RUTA_MODO, { cache: "no-store" });
    if (!r.ok) throw new Error("modo");
    const data = (await r.json()) as { modo?: string };
    modoCache = data.modo === "publico" ? "publico" : "cifrado";
  } catch {
    modoCache = "cifrado";
  }
  return modoCache;
}

/** Pide y valida los parámetros KDF globales. / Fetches and validates the global KDF parameters. */
async function leerParams(): Promise<ParametrosKdf> {
  if (parametrosCache) return parametrosCache;
  const r = await fetchConTimeout(
    RUTA_PARAMS,
    { cache: "no-store", credentials: "omit", mode: "cors" },
    10000,
  );
  if (!r.ok) throw new ErrorRed();
  let data: unknown;
  try {
    data = await r.json();
  } catch {
    throw new ErrorRed();
  }
  const obj = data as { v?: unknown; kdf?: { alg?: unknown; iter?: unknown; salt?: unknown } };
  const kdf = obj?.kdf;
  if (
    !obj ||
    obj.v !== 1 ||
    !kdf ||
    kdf.alg !== "PBKDF2-SHA-256" ||
    typeof kdf.salt !== "string" ||
    typeof kdf.iter !== "number" ||
    !Number.isInteger(kdf.iter) ||
    kdf.iter < ITERACIONES_MIN ||
    kdf.iter > ITERACIONES_MAX
  ) {
    throw new ErrorRed();
  }
  let salt: Uint8Array;
  try {
    salt = deB64(kdf.salt);
  } catch {
    throw new ErrorRed();
  }
  if (salt.length !== 16) throw new ErrorRed();
  parametrosCache = {
    v: 1,
    kdf: { alg: "PBKDF2-SHA-256", iter: kdf.iter, salt: kdf.salt },
    salt,
  };
  return parametrosCache;
}

/** Pide el sobre con el authHash. / Requests the envelope with the authHash. */
async function pedirSobre(authHash: string): Promise<Sobre> {
  const r = await fetchConTimeout(
    RUTA_UNLOCK,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ authHash }),
      cache: "no-store",
      credentials: "omit",
      mode: "cors",
    },
    10000,
  );
  if (r.ok) {
    try {
      return (await r.json()) as Sobre;
    } catch {
      throw new ErrorRed();
    }
  }
  let code = "";
  try {
    const data = (await r.json()) as { error?: { code?: string } };
    code = data?.error?.code ?? "";
  } catch {
    /* respuesta sin JSON / non-JSON response */
  }
  const retryAfter = Math.max(0, Number(r.headers.get("Retry-After") ?? "0") || 0);
  throw new ErrorApi(r.status, code, retryAfter);
}

/** Valida el sobre y lo ata a los parámetros globales. / Validates the envelope and binds it to global params. */
function validarSobre(env: Sobre, params: ParametrosKdf): { iv: Uint8Array; aad: string } {
  if (!env || env.v !== 1) throw new Error("version");
  if (env.kdf?.alg !== "PBKDF2-SHA-256" || env.cipher?.alg !== "AES-256-GCM") {
    throw new Error("algoritmo");
  }
  if (
    !Number.isInteger(env.kdf.iter) ||
    env.kdf.iter < ITERACIONES_MIN ||
    env.kdf.iter > ITERACIONES_MAX
  ) {
    throw new Error("iteraciones");
  }
  if (env.kdf.salt !== params.kdf.salt || env.kdf.iter !== params.kdf.iter) {
    throw new Error("kdf");
  }
  const salt = deB64(env.kdf.salt);
  const iv = deB64url(env.cipher.iv);
  if (salt.length !== 16 || iv.length !== 12 || !env.ct) throw new Error("sobre");
  const aad = `cv|${env.v}|${env.kdf.alg}|${env.kdf.iter}|${env.kdf.salt}|${env.cipher.alg}`;
  if (env.aad !== aad) throw new Error("aad");
  return { iv, aad };
}

/** Deriva la clave y la exporta para la sesión. / Derives the key and exports it for the session. */
async function derivarClave(
  clave: string,
  salt: Uint8Array,
  iteraciones: number,
): Promise<{ llave: CryptoKey; raw: Uint8Array }> {
  const material = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(normalizarClave(clave)),
    "PBKDF2",
    false,
    ["deriveKey"],
  );
  const llave = await crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: aBuffer(salt), iterations: iteraciones, hash: "SHA-256" },
    material,
    { name: "AES-GCM", length: 256 },
    true,
    ["decrypt"],
  );
  const raw = new Uint8Array(await crypto.subtle.exportKey("raw", llave));
  return { llave, raw };
}

/** Descifra con una clave AES ya derivada. / Decrypts with an already derived AES key. */
async function descifrarConLlave(
  env: Sobre,
  llave: CryptoKey,
  params: { iv: Uint8Array; aad: string },
): Promise<Perfil> {
  const claro = await crypto.subtle.decrypt(
    {
      name: "AES-GCM",
      iv: aBuffer(params.iv),
      additionalData: new TextEncoder().encode(params.aad),
    },
    llave,
    aBuffer(deB64url(env.ct)),
  );
  return JSON.parse(new TextDecoder().decode(claro)) as Perfil;
}

/** Importa la clave cruda guardada en la sesión. / Imports the raw key stored in the session. */
async function importarRaw(raw: Uint8Array): Promise<CryptoKey> {
  return crypto.subtle.importKey("raw", aBuffer(raw), { name: "AES-GCM" }, false, ["decrypt"]);
}

/** Guarda la clave derivada, no la frase. / Stores the derived key, not the passphrase. */
function guardarSesion(raw: Uint8Array): void {
  try {
    sessionStorage.setItem(
      CLAVE_SESION,
      JSON.stringify({ v: 1, k: aB64url(raw), exp: Date.now() + TTL_SESION }),
    );
  } catch {
    /* la sesión es opcional / session is optional */
  }
}

/** Lee la sesión válida o null. / Reads a valid session or null. */
function leerSesion(): { raw: Uint8Array; exp: number } | null {
  try {
    const raw = sessionStorage.getItem(CLAVE_SESION);
    if (!raw) return null;
    const data = JSON.parse(raw) as { v?: number; k?: string; exp?: number };
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
  } catch {
    return null;
  }
}

/** Borra la sesión y el perfil en memoria. / Clears the session and in-memory profile. */
function borrarSesion(): void {
  try {
    sessionStorage.removeItem(CLAVE_SESION);
  } catch {
    /* sin almacenamiento / no storage */
  }
  perfilActual = null;
}

/** ¿Hay una sesión utilizable? / Is there a usable session? */
export function haySesion(): boolean {
  return perfilActual !== null || leerSesion() !== null;
}

/** Extiende la vida de la sesión con actividad, sin escribir en cada evento. / Extends the session on activity. */
export function tocarSesion(): void {
  const ahora = Date.now();
  if (ahora - ultimoToque < 60000) return;
  ultimoToque = ahora;
  const sesion = leerSesion();
  if (!sesion) return;
  try {
    sessionStorage.setItem(
      CLAVE_SESION,
      JSON.stringify({ v: 1, k: aB64url(sesion.raw), exp: ahora + TTL_SESION }),
    );
  } catch {
    /* opcional / optional */
  }
}

/** Segundos de espera por intentos fallidos. / Seconds to wait after failed attempts. */
export function esperaRestante(): number {
  try {
    const raw = localStorage.getItem(CLAVE_INTENTOS);
    if (!raw) return 0;
    const data = JSON.parse(raw) as { hasta?: number };
    const restante = (data.hasta ?? 0) - Date.now();
    return restante > 0 ? Math.ceil(restante / 1000) : 0;
  } catch {
    return 0;
  }
}

/** Registra un fallo y devuelve la espera aplicada. / Records a failure and returns the applied wait. */
function registrarFallo(): number {
  let n = 1;
  try {
    const raw = localStorage.getItem(CLAVE_INTENTOS);
    const data = raw ? (JSON.parse(raw) as { n?: number }) : null;
    n = Math.max(1, (data?.n ?? 0) + 1);
    const segundos = n < 3 ? 0 : Math.min(30, 2 ** (n - 2));
    localStorage.setItem(
      CLAVE_INTENTOS,
      JSON.stringify({ n, hasta: Date.now() + segundos * 1000 }),
    );
    return segundos;
  } catch {
    return 0;
  }
}

/** Aplica el Retry-After de la API. / Applies the API Retry-After. */
function bloquearPorApi(segundos: number): void {
  const espera = Math.max(1, Math.ceil(segundos || 30));
  let n = 1;
  try {
    const raw = localStorage.getItem(CLAVE_INTENTOS);
    const data = raw ? (JSON.parse(raw) as { n?: number }) : null;
    n = Math.max(1, (data?.n ?? 0) + 1);
    localStorage.setItem(
      CLAVE_INTENTOS,
      JSON.stringify({ n, hasta: Date.now() + espera * 1000 }),
    );
  } catch {
    /* opcional / optional */
  }
}

/** Limpia el freno de intentos. / Clears the attempt throttle. */
function limpiarIntentos(): void {
  try {
    localStorage.removeItem(CLAVE_INTENTOS);
  } catch {
    /* opcional / optional */
  }
}

/** Descarga el perfil público (modo abierto). / Fetches the public profile (open mode). */
async function cargarPublico(): Promise<Perfil> {
  let r: Response;
  try {
    r = await fetch(RUTA_PUBLICO, { cache: "no-store" });
  } catch {
    throw new ErrorRed();
  }
  if (!r.ok) throw new ErrorRed();
  return (await r.json()) as Perfil;
}

/**
 * Abre la sesión con una clave. Devuelve true si el perfil queda descifrado.
 * Opens the session with a key. Returns true when the profile is decrypted.
 */
export async function abrirConClave(clave: string): Promise<boolean> {
  estadoAcceso.error = null;
  if (!normalizarClave(clave)) return false;
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
  } catch (e) {
    if (e instanceof ErrorApi) {
      if (e.status === 429) {
        bloquearPorApi(e.retryAfter);
        estadoAcceso.error = "espera";
      } else if (
        e.status === 503 &&
        (e.code === "CV_UNAVAILABLE" || e.code === "CV_NOT_CONFIGURED")
      ) {
        estadoAcceso.error = "servicio";
      } else if (e.status === 400 || e.status === 401) {
        registrarFallo();
        estadoAcceso.error = "clave";
      } else {
        estadoAcceso.error = "red";
      }
    } else if (e instanceof ErrorRed) {
      estadoAcceso.error = "red";
    } else if ((e as { name?: string }).name === "OperationError") {
      registrarFallo();
      estadoAcceso.error = "clave";
    } else {
      estadoAcceso.error = "red";
    }
    return false;
  }
}

/**
 * Recupera la sesión de la pestaña (clave AES, no la frase).
 * Restores the tab session (AES key, not the passphrase).
 */
export async function recuperarSesion(): Promise<boolean> {
  if (perfilActual) return true;
  if (!hayCrypto()) return false;
  const sesion = leerSesion();
  if (!sesion) return false;
  try {
    const params = await leerParams();
    const env = await pedirSobre(aB64url(sesion.raw));
    const { iv, aad } = validarSobre(env, params);
    const llave = await importarRaw(sesion.raw);
    perfilActual = await descifrarConLlave(env, llave, { iv, aad });
    return true;
  } catch {
    borrarSesion();
    return false;
  }
}

/** Devuelve el perfil descifrado o lanza SinSesion. / Returns the decrypted profile or throws SinSesion. */
export async function cargarPerfil(): Promise<Perfil> {
  if (perfilActual) return perfilActual;
  if ((await leerModo()) === "publico") {
    perfilActual = await cargarPublico();
    return perfilActual;
  }
  if (await recuperarSesion()) {
    if (perfilActual) return perfilActual;
  }
  throw new SinSesion();
}

/** Cierra la sesión y vuelve al acceso. / Closes the session and returns to the gate. */
export function cerrarSesion(): void {
  borrarSesion();
  estadoAcceso.error = null;
  try {
    sessionStorage.removeItem(CLAVE_SESION);
  } catch {
    /* opcional / optional */
  }
  const url = `${location.pathname}${location.search}#/login`;
  try {
    location.replace(url);
  } finally {
    location.reload();
  }
}

/**
 * Prepara la entrada: consume `#/login?key=...`, la borra del historial
 * y deja la URL en la ruta correcta antes de arrancar el router.
 * Prepares the entry: consumes `#/login?key=...`, removes it from history
 * and leaves the URL on the right route before the router starts.
 */
export async function procesarEntrada(): Promise<void> {
  const modo = await leerModo();
  if (modo === "publico") {
    if (!location.hash.startsWith("#/perfil")) reemplazarHash("#/perfil");
    return;
  }

  const raw = location.hash.replace(/^#/, "");
  const [ruta = "", query = ""] = raw.split("?");
  const params = new URLSearchParams(query);
  const clave = params.get("key") ?? params.get("k") ?? "";

  if (ruta === "/login" && clave) {
    // La clave desaparece de la barra y del historial ANTES de esperar.
    // The key leaves the address bar and history BEFORE any await.
    reemplazarHash("#/login");
    const ok = await abrirConClave(clave);
    if (ok) reemplazarHash("#/perfil");
    return;
  }

  // Cualquier clave residual se elimina también. / Any leftover key is stripped too.
  if (clave) reemplazarHash(`#${ruta || "/login"}`);

  const sesion = await recuperarSesion();
  if (sesion) {
    if (ruta === "/login" || ruta === "" || ruta === "/") reemplazarHash("#/perfil");
    return;
  }
  if (ruta === "/perfil" || ruta === "" || ruta === "/") reemplazarHash("#/login");
}
