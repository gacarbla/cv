# cv.gacarbla.es

Perfil profesional privado de **Gabriel Carro Blanco**: una versión web, interactiva y ampliada de su perfil de LinkedIn, construida con el framework propio **RTW** del portfolio [gacarbla.es](https://gacarbla.es).

El código es público. Los datos del perfil **no**: se publican desde la API privada, viajan cifrados y solo se descifran en el navegador con la clave que se entrega junto al CV impreso o mediante el QR.

---

## Acceso

- Puerta: `https://cv.gacarbla.es/#/login`
- QR del CV: `https://cv.gacarbla.es/#/login?key=<clave>`
- Perfil: `https://cv.gacarbla.es/#/perfil` (solo con sesión)
- API: `https://api.gacarbla.es`
- Panel de contenido y claves: `https://api.gacarbla.es/admin/panel`

La clave se crea y se revoca en el panel. No vive en el repositorio. La copia local para generar el QR se guarda en `privado/clave.txt` (ignorado por git) y en la tarjeta imprimible de `salida/`.

---

## Cómo funciona

1. El navegador pide los parámetros KDF a `GET /cv/v1/params`.
2. Normaliza la contraseña y deriva **localmente** `raw` con PBKDF2-HMAC-SHA-256.
3. Envía **solo** `authHash = base64url(raw)` a `POST /cv/v1/unlock`.
4. La API comprueba la clave, aplica límites por IP y devuelve el sobre cifrado.
5. El navegador valida el sobre contra los parámetros y lo descifra con AES-256-GCM.
6. La clave AES (`raw`, no la contraseña) se guarda en `sessionStorage` con 2 h de vida renovable por actividad. Nunca se usa `localStorage` para la clave, el `authHash` ni el perfil.
7. Al cerrar sesión se borra la sesión y se recarga la app.

La contraseña nunca sale del navegador. La API nunca la recibe.

### Lo que protege y lo que no

Protege frente a:

- scrapers, buscadores y visitantes casuales;
- lectura del repositorio, del HTML, del JS o de los assets;
- enlaces reenviados sin el fragmento `#...` (el fragmento no se envía al servidor);
- fuerza bruta online: la API limita intentos y bloquea por IP;
- peticiones a terceros: no hay analítica, CDN, fuentes externas ni imágenes remotas.

No protege frente a:

- quien tenga el CV impreso o una foto del QR: la clave es un secreto portador;
- un dispositivo comprometido, extensiones maliciosas o capturas de pantalla;
- un cambio futuro a modo público o una filtración de la clave;
- el sobre antiguo que ya se publicó en el historial de git y en la rama `web`.

El sobre estático antiguo (`assets/datos/perfil.cifrado.json`) se ha retirado del HEAD, pero **sigue en el historial de git y en la rama `web`**. Si la clave antigua era corta, ese sobre puede atacarse offline. La limpieza completa requiere purgar el historial (`git filter-repo`/BFG) y rotar la clave; es una operación destructiva y debe hacerse aparte, con confirmación expresa.

---

## Puesta en marcha

```bash
npm install
npm run clave        # genera una frase para crear la clave en el panel
npm run recomendacion # embebe privado/carta-recomendacion.pdf (opcional)
npm run qr           # genera salida/qr-cv.svg y salida/tarjeta-acceso.html
npm run dev          # http://localhost:8082
```

El contenido se publica desde el panel de la API. No hay `npm run cifrar`: el perfil ya no se cifra en este repositorio.

Para probar el acceso:

```text
http://localhost:8082/#/login?key=<clave-creada-en-el-panel>
```

La API solo permite CORS desde `https://cv.gacarbla.es`. En local, el navegador bloqueará `params`/`unlock` salvo que el operador de la API añada `http://localhost:8082` temporalmente. No se debe debilitar CORS ni usar `no-cors`.

La tarjeta de `salida/tarjeta-acceso.html` se abre en el navegador y se imprime o guarda como PDF. Es el único elemento pensado para imprimir: el perfil web no. El QR contiene la clave: **no la subas al repositorio**.

### Rotar la clave

La rotación se hace en el panel de la API: crea una clave nueva, revoca la anterior y vuelve a generar el QR:

```bash
# escribe la clave nueva en privado/clave.txt
npm run qr
```

Vuelve a imprimir el QR y la clave. La rotación protege los accesos futuros; no borra el sobre antiguo del historial de git.

### Publicar el perfil abierto

Cuando el perfil esté completo y quieras que sea visible sin clave:

```bash
npm run publicar -- --confirmar
```

Eso copia el JSON en claro a `assets/datos/perfil.publico.json` y pone `modo.json` en `publico`. **El perfil pasará a ser público y podrá indexarse.**

Para volver al modo cifrado, edita `assets/datos/modo.json` y deja `{"modo":"cifrado"}`. El modo público es una decisión explícita; el modo cifrado es el valor por defecto.

---

## Datos pendientes

El perfil público muestra solo lo confirmado. Para completarlo, edita el contenido desde el panel de la API:

- **3 aptitudes** de LinkedIn que no aparecen en la vista pública (solo se ven 2 de las 5).
- **Cuarto idioma** de LinkedIn: no se inventa; se añadirá cuando esté confirmado.
- **Publicaciones**: no hay; no se crean módulos vacíos. La recomendación del anterior responsable ya está integrada con su PDF protegido.
- Revisar fechas y el identificador del diploma si se quiere enlazar.

---

## Estructura

```text
src/
  index.ts                 entrada: consume la clave y arranca la app
  routes.ts                #/login y #/perfil
  ajustes.ts               API, rutas públicas y constantes de sesión
  datos/
    sesion.ts              params, authHash, sobre, sesión y limpieza de URL
    tipos.ts               tipos del perfil
    idioma.ts              lectura de textos ES/EN/GL
  lang/                    diccionarios de interfaz
  layouts/acceso/          puerta privada
  layouts/perfil/          cabecera, fondo de papel y salida
  pages/acceso/            formulario de clave
  pages/perfil/            perfil, filtros, traza de competencias y PDF
  ui/                      DOM seguro, iconos, formato y cableado común
  lib/rtw/                 framework propio (componentes, rutas, i18n)
assets/
  datos/modo.json             cifrado | público
  fonts/                      Space Grotesk autoalojada
  robots.txt                  Disallow: /
privado/                  IGNORADO: perfil.json, clave.txt, carta-recomendacion.pdf
salida/                   IGNORADO: QR y tarjeta de acceso
tools/                    clave, QR y publicación
```

### Build y despliegue

```bash
npm run typecheck
npm run build      # compila a app/, empaqueta web/ y verifica salidas
```

`npm run build` falla si aparece un sobre estático antiguo en `assets/` o en `web/`.

GitHub Actions publica `web/` en la rama `web` con CNAME `cv.gacarbla.es`. En local, `serve.json` añade `no-store`, `noindex` y cabeceras defensivas.

En GitHub: **Settings → Pages → Deploy from a branch → `web` / root**, y en DNS un `CNAME` para `cv` apuntando a `gacarbla.github.io` (o al host de Pages que corresponda).

La CSP permite `connect-src 'self' https://api.gacarbla.es`; el resto de directivas no cambia.

---

## Comprobaciones de privacidad

Antes de publicar:

```bash
git status --short
# privado/ y salida/ no deben aparecer

# no debe haber datos en claro en el bundle
# (patrones privados en privado/patrones-privacidad.txt, ignorado por git)
rg -f privado/patrones-privacidad.txt web/

# el sobre estático ya no debe existir
git grep -n "perfil.cifrado"
```

`git grep` solo debe encontrar la comprobación de `scripts/check-build.js` y la nota histórica de este README. El nombre, las empresas, las fechas, la recomendación y los identificadores no están en el bundle: llegan cifrados desde la API.

GitHub Pages no permite cabeceras HTTP personalizadas; `serve.json` las aplica en local. Para `frame-ancestors`, HSTS u otras cabeceras en producción haría falta un proxy equivalente. Si se usa Cloudflare como DNS, el registro `cv` debe ser **DNS only** (nube gris): con el proxy naranja, el reto de seguridad de Cloudflare choca con la CSP del CV y el dominio devuelve 403.

---

## Accesibilidad y detalle

- HTML semántico, un solo `h1`, enlaces de salto, foco visible, objetivos táctiles de 44 px.
- `prefers-reduced-motion` respetado en revelados, hover y transiciones.
- Sin impresión: se han retirado los botones y la maquetación de impresión; si se intenta imprimir, la web oculta el contenido y muestra un aviso. El CV físico ya existe.
- Selector ES/EN/GL con `lang` correcto.
- Iconos de Lucide (ISC) y marcas oficiales de LinkedIn/GitHub, vía iconer.app.
- Fondo exclusivo de CV: papel iluminado con lavados de arcilla, salvia y arena, grano fino y estático (sin malla, sin canvas), a viewport completo.
- Hero full-bleed al 100% del ancho y secciones separadas por espacio, no por líneas.
- Tema automático/claro/oscuro.
- Sin dependencias de runtime; solo `typescript` y `qrcode` en desarrollo.

---

## Créditos

Diseño y desarrollo: Gabriel Carro Blanco.
Framework: RTW, del portfolio [gacarbla.es](https://gacarbla.es).
Tipografía: Space Grotesk (SIL Open Font License), autoalojada.
