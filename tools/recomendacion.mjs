import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..");
const PERFIL = join(RAIZ, "privado", "perfil.json");
const PDF = join(RAIZ, "privado", "carta-recomendacion.pdf");

if (!existsSync(PERFIL) || !existsSync(PDF)) {
  console.error("Faltan privado/perfil.json o privado/carta-recomendacion.pdf.");
  process.exit(1);
}

const datos = JSON.parse(readFileSync(PERFIL, "utf8"));
const recomendacion = datos.recomendaciones?.[0];
if (!recomendacion) {
  console.error("No hay ninguna recomendación en privado/perfil.json.");
  process.exit(1);
}

const base64 = readFileSync(PDF).toString("base64");
recomendacion.archivo = `data:application/pdf;base64,${base64}`;
writeFileSync(PERFIL, `${JSON.stringify(datos, null, 2)}\n`, "utf8");

console.log("Carta embebida en privado/perfil.json.");
console.log("Ahora publica el contenido desde el panel de la API.");
