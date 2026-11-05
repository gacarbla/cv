/**
 * Normaliza una clave igual que el navegador y que la API.
 * Normalizes a key exactly like the browser and the API.
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
