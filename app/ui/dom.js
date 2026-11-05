export function crear(tag, opciones = {}, ...hijos) {
    const el = document.createElement(tag);
    if (opciones.class)
        el.className = opciones.class;
    if (opciones.text !== undefined)
        el.textContent = opciones.text;
    if (opciones.attrs) {
        for (const [clave, valor] of Object.entries(opciones.attrs)) {
            if (valor === null || valor === undefined || valor === false)
                continue;
            if (valor === true)
                el.setAttribute(clave, "");
            else
                el.setAttribute(clave, String(valor));
        }
    }
    if (opciones.style) {
        for (const [clave, valor] of Object.entries(opciones.style)) {
            el.style.setProperty(clave, valor);
        }
    }
    for (const hijo of hijos) {
        if (hijo === null || hijo === undefined || hijo === false)
            continue;
        el.append(hijo);
    }
    return el;
}
export function vaciar(el) {
    el.textContent = "";
}
const ICONOS = {
    linkedin: {
        viewBox: "0 0 34 34",
        fill: true,
        markup: '<path d="M34 2.5v29a2.5 2.5 0 0 1-2.5 2.5h-29A2.5 2.5 0 0 1 0 31.5v-29A2.5 2.5 0 0 1 2.5 0h29A2.5 2.5 0 0 1 34 2.5M10 13H5v16h5zm.45-5.5a2.88 2.88 0 0 0-2.86-2.9H7.5a2.9 2.9 0 0 0 0 5.8 2.88 2.88 0 0 0 2.95-2.81zM29 19.28c0-4.81-3.06-6.68-6.1-6.68a5.7 5.7 0 0 0-5.06 2.58h-.14V13H13v16h5v-8.51a3.32 3.32 0 0 1 3-3.58h.19c1.59 0 2.77 1 2.77 3.52V29h5z"></path>',
    },
    github: {
        fill: true,
        markup: '<path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12"></path>',
    },
    mail: {
        markup: '<path d="m22 7-8.991 5.727a2 2 0 0 1-2.009 0L2 7"></path><rect x="2" y="4" width="20" height="16" rx="2"></rect>',
    },
    web: {
        markup: '<circle cx="12" cy="12" r="10"></circle><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"></path><path d="M2 12h20"></path>',
    },
    check: {
        markup: '<path d="M20 6 9 17l-5-5"></path>',
    },
    arrow: {
        markup: '<path d="M7 7h10v10"></path><path d="M7 17 17 7"></path>',
    },
    lock: {
        markup: '<rect width="18" height="11" x="3" y="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path>',
    },
    x: {
        markup: '<path d="M18 6 6 18"></path><path d="m6 6 12 12"></path>',
    },
    sun: {
        markup: '<circle cx="12" cy="12" r="4"></circle><path d="M12 2v2"></path><path d="M12 20v2"></path><path d="m4.93 4.93 1.41 1.41"></path><path d="m17.66 17.66 1.41 1.41"></path><path d="M2 12h2"></path><path d="M20 12h2"></path><path d="m6.34 17.66-1.41 1.41"></path><path d="m19.07 4.93-1.41 1.41"></path>',
    },
    moon: {
        markup: '<path d="M20.985 12.486a9 9 0 1 1-9.473-9.472c.405-.022.617.46.402.803a6 6 0 0 0 8.268 8.268c.344-.215.825-.004.803.401"></path>',
    },
    monitor: {
        markup: '<rect width="20" height="14" x="2" y="3" rx="2"></rect><line x1="8" x2="16" y1="21" y2="21"></line><line x1="12" x2="12" y1="17" y2="21"></line>',
    },
    "log-out": {
        markup: '<path d="m16 17 5-5-5-5"></path><path d="M21 12H9"></path><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>',
    },
    "badge-check": {
        markup: '<path d="M3.85 8.62a4 4 0 0 1 4.78-4.77 4 4 0 0 1 6.74 0 4 4 0 0 1 4.78 4.78 4 4 0 0 1 0 6.74 4 4 0 0 1-4.77 4.78 4 4 0 0 1-6.75 0 4 4 0 0 1-4.78-4.77 4 4 0 0 1 0-6.76Z"></path><path d="m16 9-5.5 5.5L8 12"></path>',
    },
    quote: {
        markup: '<path d="M16 3a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2 1 1 0 0 1 1 1v1a2 2 0 0 1-2 2 1 1 0 0 0-1 1v2a1 1 0 0 0 1 1 6 6 0 0 0 6-6V5a2 2 0 0 0-2-2z"></path><path d="M5 3a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2 1 1 0 0 1 1 1v1a2 2 0 0 1-2 2 1 1 0 0 0-1 1v2a1 1 0 0 0 1 1 6 6 0 0 0 6-6V5a2 2 0 0 0-2-2z"></path>',
    },
    "file-text": {
        markup: '<path d="M6 22a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8a2.4 2.4 0 0 1 1.704.706l3.588 3.588A2.4 2.4 0 0 1 20 8v12a2 2 0 0 1-2 2z"></path><path d="M14 2v5a1 1 0 0 0 1 1h5"></path><path d="M10 9H8"></path><path d="M16 13H8"></path><path d="M16 17H8"></path>',
    },
    copy: {
        markup: '<rect width="14" height="14" x="8" y="8" rx="2" ry="2"></rect><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"></path>',
    },
};
export function iconoSvg(nombre, tamano = 16) {
    const icono = ICONOS[nombre] ?? ICONOS["check"];
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", icono.viewBox ?? "0 0 24 24");
    svg.setAttribute("width", String(tamano));
    svg.setAttribute("height", String(tamano));
    svg.setAttribute("aria-hidden", "true");
    svg.setAttribute("focusable", "false");
    if (icono.fill) {
        svg.setAttribute("fill", "currentColor");
    }
    else {
        svg.setAttribute("fill", "none");
        svg.setAttribute("stroke", "currentColor");
        svg.setAttribute("stroke-width", "2");
        svg.setAttribute("stroke-linecap", "round");
        svg.setAttribute("stroke-linejoin", "round");
    }
    svg.innerHTML = icono.markup;
    return svg;
}
export function aplicarIconos(raiz) {
    for (const el of raiz.querySelectorAll("[data-icono]")) {
        const nombre = el.dataset["icono"] ?? "";
        if (!nombre)
            continue;
        const tamano = Number(el.dataset["iconoSize"] ?? 18);
        el.replaceChildren(iconoSvg(nombre, Number.isFinite(tamano) ? tamano : 18));
    }
}
export function enlace(texto, href, clase = "") {
    const a = crear("a", {
        class: clase,
        text: texto,
        attrs: { href, target: "_blank", rel: "noopener noreferrer" },
    });
    if (clase.includes("enlace-flecha"))
        a.append(iconoSvg("arrow", 12));
    return a;
}
export function normalizarTexto(valor) {
    return valor
        .normalize("NFKD")
        .replace(/\p{M}/gu, "")
        .toLowerCase()
        .trim();
}
