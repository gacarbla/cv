import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { webcrypto as crypto } from "node:crypto";
import { aadDe, b64url, derivarClave, normalizarClave } from "./lib/clave.mjs";

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..");
const ENTRADA = join(RAIZ, "privado", "perfil.json");
const CLAVE = join(RAIZ, "privado", "clave.txt");
const SALIDA = join(RAIZ, "assets", "datos", "perfil.cifrado.json");
const MODO = join(RAIZ, "assets", "datos", "modo.json");
const PUBLICO = join(RAIZ, "assets", "datos", "perfil.publico.json");
const ITERACIONES = 600000;

if (!existsSync(ENTRADA)) {
  console.error(`Falta ${ENTRADA}. Crea el perfil en claro antes de cifrar.`);
  process.exit(1);
}
const clave = process.env.CV_CLAVE ?? (existsSync(CLAVE) ? readFileSync(CLAVE, "utf8") : "");
if (!normalizarClave(clave)) {
  console.error("Falta la clave. Usa privado/clave.txt o CV_CLAVE.");
  process.exit(1);
}

const texto = readFileSync(ENTRADA, "utf8");
let datos;
try {
  datos = JSON.parse(texto);
} catch (e) {
  console.error(`El perfil no es JSON válido: ${e.message}`);
  process.exit(1);
}

const salt = crypto.getRandomValues(new Uint8Array(16));
const iv = crypto.getRandomValues(new Uint8Array(12));
const env = {
  v: 1,
  kdf: { alg: "PBKDF2-SHA-256", iter: ITERACIONES, salt: b64url(salt) },
  cipher: { alg: "AES-256-GCM", iv: b64url(iv) },
  aad: "",
  ct: "",
  meta: {
    createdAt: new Date().toISOString(),
    perfilVersion: datos.version ?? 1,
    actualizado: datos.actualizado ?? "",
  },
};
env.aad = aadDe(env);

const llave = await derivarClave(clave, salt, ITERACIONES);
const cifrado = await crypto.subtle.encrypt(
  {
    name: "AES-GCM",
    iv,
    additionalData: new TextEncoder().encode(env.aad),
  },
  llave,
  new TextEncoder().encode(JSON.stringify(datos)),
);
env.ct = b64url(new Uint8Array(cifrado));

// Autocomprobación: descifra el sobre recién creado antes de escribirlo.
// Self-check: decrypt the fresh envelope before writing it.
const llave2 = await derivarClave(clave, salt, ITERACIONES);
const claro = await crypto.subtle.decrypt(
  {
    name: "AES-GCM",
    iv,
    additionalData: new TextEncoder().encode(env.aad),
  },
  llave2,
  new Uint8Array(Buffer.from(env.ct, "base64url")),
);
const vuelta = JSON.parse(new TextDecoder().decode(claro));
if (JSON.stringify(vuelta) !== JSON.stringify(datos)) {
  console.error("La autocomprobación de cifrado ha fallado. No se escribe nada.");
  process.exit(1);
}

mkdirSync(dirname(SALIDA), { recursive: true });
writeFileSync(SALIDA, `${JSON.stringify(env, null, 2)}\n`, "utf8");
writeFileSync(
  MODO,
  `${JSON.stringify({ modo: "cifrado", actualizado: datos.actualizado ?? "" }, null, 2)}\n`,
  "utf8",
);
if (existsSync(PUBLICO)) rmSync(PUBLICO, { force: true });

console.log(`Cifrado: ${ENTRADA}`);
console.log(`Sobre:   ${SALIDA}`);
console.log(`Modo:    cifrado`);
console.log(`Claro:   ${Buffer.byteLength(texto)} bytes / Cifrado: ${env.ct.length} chars`);
console.log(`KDF:     PBKDF2-SHA-256, ${ITERACIONES} iteraciones`);
console.log("No se ha escrito ningún dato en claro en assets/.");
