const fileCache = new Map();
export function bodyOf(html) {
    const m = /<\s*body[^>]*>([\s\S]*)<\/\s*body\s*>/i.exec(html);
    return m ? m[1] : html;
}
function fetchText(url) {
    const hit = fileCache.get(url);
    if (hit)
        return hit;
    const req = fetch(url)
        .then((r) => {
        if (!r.ok)
            throw new Error(`No se pudo cargar ${url} / Could not load ${url}`);
        return r.text();
    })
        .catch((e) => {
        if (fileCache.get(url) === req)
            fileCache.delete(url);
        throw e;
    });
    fileCache.set(url, req);
    return req;
}
export function component(tag, base, opts = {}) {
    var _a;
    if (!tag.includes("-")) {
        throw new Error(`La etiqueta <${tag}> necesita un guion (norma de Custom Elements) / Tag <${tag}> needs a dash (Custom Elements rule)`);
    }
    const htmlURL = new URL("./index.html", base).toString();
    const cssURL = new URL("./style.css", base).toString();
    const loaded = Promise.all([fetchText(htmlURL), fetchText(cssURL)]).then(() => undefined, () => undefined);
    if (!customElements.get(tag)) {
        const observed = opts.attrs ?? [];
        customElements.define(tag, (_a = class extends HTMLElement {
                constructor() {
                    super(...arguments);
                    this.cleanups = [];
                    this.booted = false;
                }
                connectedCallback() {
                    void Promise.all([fetchText(htmlURL), fetchText(cssURL)])
                        .then(([html, css]) => {
                        if (!this.isConnected || this.booted)
                            return;
                        this.booted = true;
                        const shadow = this.attachShadow({ mode: "open" });
                        const style = document.createElement("style");
                        style.textContent = css;
                        const tpl = document.createElement("template");
                        tpl.innerHTML = bodyOf(html);
                        shadow.append(style, tpl.content.cloneNode(true));
                        this.runSetup(shadow);
                    })
                        .catch((e) => {
                        console.error(`[${tag}] sin montar hasta remontar / unmounted until remount:`, e);
                    });
                }
                attributeChangedCallback() {
                    const shadow = this.shadowRoot;
                    if (shadow && this.booted)
                        this.runSetup(shadow);
                }
                disconnectedCallback() {
                    for (const fn of this.cleanups.splice(0)) {
                        try {
                            fn();
                        }
                        catch {
                        }
                    }
                    this.booted = false;
                }
                runSetup(shadow) {
                    for (const fn of this.cleanups.splice(0)) {
                        try {
                            fn();
                        }
                        catch {
                        }
                    }
                    opts.setup?.({
                        shadow,
                        host: this,
                        attr: (name) => this.getAttribute(name),
                        onCleanup: (fn) => {
                            this.cleanups.push(fn);
                        },
                    });
                }
            },
            _a.observedAttributes = observed,
            _a));
    }
    return { tag, loaded };
}
export async function mountLayout(target, base, deps = []) {
    await mountView(target, base, deps);
}
export async function mountPage(target, base, deps = []) {
    await mountView(target, base, deps);
}
async function mountView(target, base, deps) {
    await Promise.all(deps.map((d) => d.loaded));
    const [html, css] = await Promise.all([
        fetchText(new URL("./index.html", base).toString()),
        fetchText(new URL("./style.css", base).toString()),
    ]);
    const id = `layout-${Math.abs(hash(base))}`;
    if (!document.getElementById(id)) {
        const style = document.createElement("style");
        style.id = id;
        style.textContent = css;
        document.head.appendChild(style);
    }
    target.innerHTML = bodyOf(html);
}
function hash(s) {
    let acc = 0;
    for (let i = 0; i < s.length; i++)
        acc = (acc * 31 + s.charCodeAt(i)) | 0;
    return acc;
}
