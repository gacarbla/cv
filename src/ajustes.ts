/** Rutas públicas y constantes de la sesión privada. / Public paths and private session constants. */
export const API_BASE = "https://api.gacarbla.es";
export const RUTA_PARAMS = `${API_BASE}/cv/v1/params`;
export const RUTA_UNLOCK = `${API_BASE}/cv/v1/unlock`;
export const RUTA_PUBLICO = "/assets/datos/perfil.publico.json";
export const RUTA_MODO = "/assets/datos/modo.json";

/** Clave de sessionStorage para la clave AES derivada. / sessionStorage key for the derived AES key. */
export const CLAVE_SESION = "cv:sesion";
/** Clave de localStorage para el freno de intentos. / localStorage key for attempt throttling. */
export const CLAVE_INTENTOS = "cv:intentos";

/** Vida de la sesión (se renueva con actividad). / Session lifetime (renewed on activity). */
export const TTL_SESION = 2 * 60 * 60 * 1000;
/** Límites de iteraciones aceptadas al descifrar. / Accepted iteration bounds when decrypting. */
export const ITERACIONES_MIN = 300000;
export const ITERACIONES_MAX = 2000000;
