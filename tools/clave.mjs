import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { webcrypto as crypto } from "node:crypto";
import { normalizarClave } from "./lib/clave.mjs";

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..");
const LISTA = join(RAIZ, "tools", "bip39_english.txt");
const SALIDA = join(RAIZ, "privado", "clave.txt");
const nueva = process.argv.includes("--nueva");

mkdirSync(join(RAIZ, "privado"), { recursive: true });

if (existsSync(SALIDA) && !nueva) {
  console.log(`Ya existe ${SALIDA}. Usa "npm run clave -- --nueva" para rotar la clave.`);
  process.exit(0);
}

const palabras = readFileSync(LISTA, "utf8")
  .split(/\r?\n/)
  .map((linea) => linea.trim())
  .filter((p) => /^[a-z]+$/.test(p));

if (palabras.length !== 2048) {
  console.error("La lista BIP39 no parece completa (se esperan 2048 palabras).");
  process.exit(1);
}

/** Elige n palabras al azar sin repetir. / Picks n unique random words. */
function elegir(n) {
  const usadas = new Set();
  const out = [];
  while (out.length < n) {
    const i = crypto.getRandomValues(new Uint32Array(1))[0] % palabras.length;
    const p = palabras[i];
    if (!usadas.has(p)) {
      usadas.add(p);
      out.push(p);
    }
  }
  return out;
}

const digitos = Array.from(crypto.getRandomValues(new Uint8Array(3)), (n) => String(n % 10)).join("");
const clave = `${elegir(4).join("-")}-${digitos}`;
writeFileSync(SALIDA, `${clave}\n`, { encoding: "utf8", mode: 0o600 });

// Entropía aproximada: 4 palabras BIP39 (11 bits) + 3 dígitos.
// Approximate entropy: 4 BIP39 words (11 bits) + 3 digits.
const bits = 4 * Math.log2(palabras.length) + Math.log2(1000);

console.log(`Clave creada: ${clave}`);
console.log(`Guardada en: ${SALIDA}`);
console.log(`Normalizada: ${normalizarClave(clave)}`);
console.log(`Entropía aproximada: ${bits.toFixed(1)} bits`);
console.log("No la subas al repositorio. Imprímela junto al CV / QR.");
