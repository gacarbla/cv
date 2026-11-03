import { copyFileSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..");
const ENTRADA = join(RAIZ, "privado", "perfil.json");
const SALIDA = join(RAIZ, "assets", "datos", "perfil.publico.json");
const MODO = join(RAIZ, "assets", "datos", "modo.json");

if (!process.argv.includes("--confirmar")) {
  console.error("Esto publica el perfil EN CLARO en el repositorio. Repite con --confirmar.");
  process.exit(1);
}
if (!existsSync(ENTRADA)) {
  console.error(`Falta ${ENTRADA}.`);
  process.exit(1);
}

mkdirSync(dirname(SALIDA), { recursive: true });
copyFileSync(ENTRADA, SALIDA);
writeFileSync(MODO, `${JSON.stringify({ modo: "publico", actualizado: new Date().toISOString().slice(0, 10) }, null, 2)}\n`, "utf8");

console.log(`Publicado en claro: ${SALIDA}`);
console.log("A partir de ahora el perfil es visible sin clave y puede indexarse.");
console.log("Para volver al modo cifrado: npm run cifrar");
