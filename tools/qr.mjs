import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import QRCode from "qrcode";

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..");
const CLAVE = join(RAIZ, "privado", "clave.txt");
const SALIDA = join(RAIZ, "salida");
const URL_BASE = "https://cv.gacarbla.es/#/login?key=";

if (!existsSync(CLAVE)) {
  console.error("Falta privado/clave.txt. Ejecuta antes: npm run clave");
  process.exit(1);
}
const clave = readFileSync(CLAVE, "utf8").trim();
const url = `${URL_BASE}${encodeURIComponent(clave)}`;
mkdirSync(SALIDA, { recursive: true });

const svg = await QRCode.toString(url, {
  type: "svg",
  errorCorrectionLevel: "M",
  margin: 1,
  width: 512,
  color: { dark: "#17150f", light: "#faf8f4" },
});
writeFileSync(join(SALIDA, "qr-cv.svg"), svg, "utf8");

const html = `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Tarjeta de acceso — Gabriel Carro Blanco</title>
<style>
  @font-face{font-family:"Space Grotesk";src:url("../assets/fonts/space-grotesk-latin.woff2") format("woff2");font-weight:300 700;font-display:swap}
  :root{--paper:#faf8f4;--ink:#17150f;--muted:#6b6455;--line:#e5ded2;--accent:#b3541e}
  *{box-sizing:border-box}
  body{margin:0;background:#e9e3d8;color:var(--ink);font-family:system-ui,-apple-system,"Segoe UI",sans-serif;display:grid;place-items:center;min-height:100vh;padding:24px}
  .tarjeta{width:148mm;min-height:105mm;background:var(--paper);border:1px solid var(--line);border-radius:6mm;padding:10mm;display:grid;grid-template-columns:42mm 1fr;gap:8mm;align-items:center}
  .qr{width:42mm;height:42mm;border:1px solid var(--line);border-radius:4mm;padding:3mm;background:#fff}
  .qr svg{display:block;width:100%;height:100%}
  .eyebrow{font-family:ui-monospace,monospace;font-size:8pt;letter-spacing:.2em;text-transform:uppercase;color:var(--accent);margin:0 0 3mm}
  h1{font-family:"Space Grotesk",system-ui,sans-serif;font-size:20pt;line-height:1;letter-spacing:-.03em;margin:0 0 2mm}
  p{font-size:9pt;line-height:1.45;color:var(--muted);margin:0 0 3mm}
  .clave{font-family:ui-monospace,monospace;font-size:12pt;font-weight:700;letter-spacing:.02em;color:var(--ink);background:#fff;border:1px dashed var(--line);border-radius:3mm;padding:3mm 4mm;display:inline-block;margin:0 0 3mm}
  .pie{font-family:ui-monospace,monospace;font-size:7pt;letter-spacing:.12em;text-transform:uppercase;color:var(--muted);margin:0}
  @media print{body{background:#fff;padding:0;min-height:0}.tarjeta{border:0;width:148mm;min-height:105mm}}
</style>
</head>
<body>
  <article class="tarjeta">
    <div class="qr">${svg}</div>
    <div>
      <p class="eyebrow">Perfil profesional privado</p>
      <h1>Gabriel Carro Blanco</h1>
      <p>Escanea el QR o introduce la clave en <strong>cv.gacarbla.es</strong>.</p>
      <p class="clave">${clave}</p>
      <p class="pie">Acceso personal · No compartir</p>
    </div>
  </article>
</body>
</html>`;
writeFileSync(join(SALIDA, "tarjeta-acceso.html"), html, "utf8");

console.log(`QR:     ${join(SALIDA, "qr-cv.svg")}`);
console.log(`Tarjeta:${join(SALIDA, "tarjeta-acceso.html")}`);
console.log("Abre la tarjeta en el navegador y usa Imprimir / Guardar como PDF.");
console.log("El QR contiene la clave: no lo subas al repositorio.");
