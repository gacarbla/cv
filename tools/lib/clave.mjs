import { webcrypto as crypto } from "node:crypto";

/**
 * Normaliza una clave igual que el navegador.
 * Normalizes a key exactly like the browser does.
 *
 * Reglas / Rules:
 *  - NFKD y fuera marcas de acento / NFKD, strip combining marks.
 *  - minúsculas / lowercase.
 *  - espacios, guiones y guiones bajos -> un espacio / spaces, hyphens and underscores -> one space.
 */
export function normalizarClave(valor) {
  return String(valor)
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[\s\-_]+/g, " ")
    .trim();
}

/** Bytes -> base64url sin relleno. / Bytes -> base64url without padding. */
export function b64url(bytes) {
  return Buffer.from(bytes).toString("base64url");
}

/** base64url -> Uint8Array. */
export function bytesDeB64url(texto) {
  return new Uint8Array(Buffer.from(texto, "base64url"));
}

/** AAD canónico del sobre. / Canonical envelope AAD. */
export function aadDe(env) {
  return `cv|${env.v}|${env.kdf.alg}|${env.kdf.iter}|${env.kdf.salt}|${env.cipher.alg}`;
}

/** Deriva una clave AES-256-GCM con PBKDF2-SHA-256. / Derives an AES-256-GCM key. */
export async function derivarClave(clave, salt, iteraciones) {
  const material = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(normalizarClave(clave)),
    "PBKDF2",
    false,
    ["deriveKey"],
  );
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt, iterations: iteraciones, hash: "SHA-256" },
    material,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}
