# cv.gacarbla.es

Perfil profesional privado de **Gabriel Carro Blanco**: una versión web, interactiva y ampliada de su perfil de LinkedIn, construida con el framework propio **RTW** del portfolio [gacarbla.es](https://gacarbla.es).

El código es público. Los datos del perfil **no**: viajan cifrados y solo se descifran en el navegador con la clave que se entrega junto al CV impreso o mediante el QR.

---

## Acceso

- Puerta: `https://cv.gacarbla.es/#/login`
- QR del CV: `https://cv.gacarbla.es/#/login?key=<clave>`
- Perfil: `https://cv.gacarbla.es/#/perfil` (solo con sesión)

La clave se guarda únicamente en `privado/clave.txt` (ignorado por git) y en la tarjeta imprimible de `salida/`. **No se escribe en el repositorio.**

---

## Cómo funciona

1. `privado/perfil.json` contiene el perfil en claro. Está ignorado por git.
2. `npm run cifrar` genera `assets/datos/perfil.cifrado.json`:
   - PBKDF2-HMAC-SHA-256, 600.000 iteraciones.
   - Salt aleatorio de 16 bytes por cifrado.
   - AES-256-GCM con IV aleatorio de 12 bytes.
   - AAD canónico para atar versión, algoritmos y salt.
3. El navegador pide el sobre, deriva la clave con la frase escrita/escaneada y descifra con WebCrypto.
4. La clave AES derivada se guarda en `sessionStorage` (no la frase), con 2 h de vida renovable por actividad. Nunca se usa `localStorage` para la clave ni para los datos.
5. Al cerrar sesión se borra la sesión y se recarga la app.
6. La fotografía se ha retirado de la web: no hay retrato en `assets/` ni dentro del sobre.

### Lo que protege y lo que no

Protege frente a:

- scrapers, buscadores y visitantes casuales;
- lectura del repositorio, del HTML, del JS o de los assets;
- enlaces reenviados sin el fragmento `#...` (el fragmento no se envía al servidor);
- peticiones a terceros: no hay analítica, CDN, fuentes externas ni imágenes remotas.

No protege frente a:

- quien tenga el CV impreso o una foto del QR: la clave es un secreto portador;
- fuerza bruta offline sobre el sobre (la defensa real es la entropía de la frase + PBKDF2);
- un dispositivo comprometido, extensiones maliciosas o capturas de pantalla;
- un cambio futuro a modo público o una filtración de la clave.

La clave actual es una clave corta elegida para el QR impreso. Eso prioriza comodidad, no resistencia a fuerza bruta offline: PBKDF2 con 600.000 iteraciones ayuda, pero una clave corta no es una barrera fuerte si el sobre cifrado se publica o se filtra. El modelo asumido es el de un CV privado con acceso físico: quien tiene el papel puede entrar; un bot o un visitante sin el QR no ve los datos. Si el CV se comparte mucho o el sobre se hace público, rota la clave.

---

## Puesta en marcha

```bash
npm install
npm run clave        # genera una clave larga; o escribe la tuya en privado/clave.txt
# crea/edita privado/perfil.json con tus datos
npm run recomendacion # embebe privado/carta-recomendacion.pdf (opcional)
npm run cifrar       # cifra y escribe assets/datos/perfil.cifrado.json
npm run qr           # genera salida/qr-cv.svg y salida/tarjeta-acceso.html
npm run dev          # http://localhost:8082
```

Para probar el acceso:

```text
http://localhost:8082/#/login?key=<clave-de-privado/clave.txt>
```

La tarjeta de `salida/tarjeta-acceso.html` se abre en el navegador y se imprime o guarda como PDF. Es el único elemento pensado para imprimir: el perfil web no. El QR contiene la clave: **no la subas al repositorio**.

Si actualizas la carta de recomendación: sustituye `privado/carta-recomendacion.pdf`, ejecuta `npm run recomendacion` y vuelve a cifrar con `npm run cifrar`.

### Rotar la clave

```bash
npm run clave -- --nueva
npm run cifrar
npm run qr
```

Vuelve a imprimir el QR y la clave. El sobre antiguo queda en el historial de git: la rotación protege las descargas futuras, no borra el pasado. Si la clave se filtra, considera los datos anteriores como revelados.

### Publicar el perfil abierto

Cuando el perfil esté completo y quieras que sea visible sin clave:

```bash
npm run publicar -- --confirmar
```

Eso copia el JSON en claro a `assets/datos/perfil.publico.json` y pone `modo.json` en `publico`. **El perfil pasará a ser público y podrá indexarse.** Para volver al modo cifrado:

```bash
npm run cifrar
```

El modo público es una decisión explícita; el modo cifrado es el valor por defecto.

---

## Datos pendientes

El perfil público muestra solo lo confirmado. Para completarlo, edita `privado/perfil.json`, vuelve a cifrar y regenera el QR si cambias la clave:

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
  ajustes.ts               rutas públicas y constantes de sesión
  datos/
    sesion.ts              WebCrypto, sobre, sesión y limpieza de URL
    tipos.ts               tipos del perfil
    idioma.ts              lectura de textos ES/EN/GL
  lang/                    diccionarios de interfaz
  layouts/acceso/          puerta privada
  layouts/perfil/          cabecera, progreso, fondo de papel y salida
  pages/acceso/            formulario de clave
  pages/perfil/            perfil, filtros, traza de competencias y diálogo
  ui/                      DOM seguro, iconos, formato y cableado común
  lib/rtw/                 framework propio (componentes, rutas, i18n)
assets/
  datos/perfil.cifrado.json   único artefacto con datos (cifrado)
  datos/modo.json             cifrado | público
  fonts/                      Space Grotesk autoalojada
  robots.txt                  Disallow: /
privado/                  IGNORADO: perfil.json, clave.txt, carta-recomendacion.pdf
salida/                   IGNORADO: QR y tarjeta de acceso
tools/                    clave, cifrado, QR y publicación
```

### Build y despliegue

```bash
npm run typecheck
npm run build      # compila a app/, empaqueta web/ y verifica salidas
```

GitHub Actions publica `web/` en la rama `web` con CNAME `cv.gacarbla.es`. En local, `serve.json` añade `no-store`, `noindex` y cabeceras defensivas.

En GitHub: **Settings → Pages → Deploy from a branch → `web` / root**, y en DNS un `CNAME` para `cv` apuntando a `gacarbla.github.io` (o al host de Pages que corresponda).

---

## Comprobaciones de privacidad

Antes de publicar:

```bash
git status --short
# privado/ y salida/ no deben aparecer

# no debe haber datos en claro en el bundle
# (patrones privados en privado/patrones-privacidad.txt, ignorado por git)
rg -f privado/patrones-privacidad.txt web/
```

El único resultado esperado es el correo público de solicitud de acceso. El nombre, las empresas, las fechas, la recomendación y los identificadores viven dentro del sobre cifrado.

GitHub Pages no permite cabeceras HTTP personalizadas; `serve.json` las aplica en local. Para `frame-ancestors`, HSTS u otras cabeceras en producción haría falta un proxy equivalente. Si se usa Cloudflare como DNS, el registro `cv` debe ser **DNS only** (nube gris): con el proxy naranja, el reto de seguridad de Cloudflare choca con la CSP del CV y el dominio devuelve 403.

---

## Accesibilidad y detalle

- HTML semántico, un solo `h1`, enlaces de salto, foco visible, objetivos táctiles de 44 px.
- `prefers-reduced-motion` respetado en revelados, malla, hover y transiciones.
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
