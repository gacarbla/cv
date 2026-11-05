function slash(path) {
    return path.startsWith("/") ? path : `/${path}`;
}
class PathStrategy {
    constructor(opts = {}) {
        this.kind = "path";
        this.listeners = new Set();
        this.onPop = () => this.emit();
        this.base = opts.base ?? "";
    }
    current() {
        const p = location.pathname;
        const rel = this.base && p.startsWith(this.base) ? p.slice(this.base.length) : p;
        return slash(rel || "/");
    }
    navigate(to, replace = false) {
        const url = this.base + slash(to);
        if (replace)
            history.replaceState(null, "", url);
        else
            history.pushState(null, "", url);
        this.emit();
    }
    listen(fn) {
        if (this.listeners.size === 0)
            window.addEventListener("popstate", this.onPop);
        this.listeners.add(fn);
        return () => {
            this.listeners.delete(fn);
            if (this.listeners.size === 0)
                window.removeEventListener("popstate", this.onPop);
        };
    }
    emit() {
        const cur = this.current();
        for (const fn of [...this.listeners])
            fn(cur);
    }
}
class HashStrategy {
    constructor(opts = {}) {
        this.kind = "hash";
        this.listeners = new Set();
        this.onHash = () => this.emit();
        this.prefix = opts.prefix ?? "#";
    }
    current() {
        const h = location.hash;
        const rel = h.startsWith(this.prefix) ? h.slice(this.prefix.length) : h.replace(/^#/, "");
        return slash(rel || "/");
    }
    navigate(to, replace = false) {
        const next = this.prefix + slash(to);
        if (replace) {
            location.replace(next);
        }
        else if (location.hash !== next) {
            location.hash = next;
        }
        else {
            this.emit();
        }
    }
    listen(fn) {
        if (this.listeners.size === 0)
            window.addEventListener("hashchange", this.onHash);
        this.listeners.add(fn);
        return () => {
            this.listeners.delete(fn);
            if (this.listeners.size === 0)
                window.removeEventListener("hashchange", this.onHash);
        };
    }
    emit() {
        const cur = this.current();
        for (const fn of [...this.listeners])
            fn(cur);
    }
}
function eligeAlmacen(persist) {
    if (persist === "local")
        return safeStorage("local");
    if (persist === "session")
        return safeStorage("session");
    return null;
}
class MemoryStrategy {
    constructor(opts = {}) {
        this.kind = "memory";
        this.listeners = new Set();
        this.key = opts.key ?? "rtw:route";
        this.store = eligeAlmacen(opts.persist);
        let saved = null;
        try {
            saved = this.store?.getItem(this.key) ?? null;
        }
        catch {
            saved = null;
        }
        this.at = slash(saved || "/");
    }
    current() {
        return this.at;
    }
    navigate(to) {
        const next = slash(to);
        if (next === this.at)
            return;
        this.at = next;
        try {
            this.store?.setItem(this.key, next);
        }
        catch {
        }
        for (const fn of [...this.listeners])
            fn(next);
    }
    listen(fn) {
        this.listeners.add(fn);
        return () => {
            this.listeners.delete(fn);
        };
    }
}
function safeStorage(which) {
    try {
        return which === "local" ? localStorage : sessionStorage;
    }
    catch {
        return null;
    }
}
export function createStrategy(opts) {
    if (opts.kind === "path")
        return new PathStrategy(opts.path);
    if (opts.kind === "hash")
        return new HashStrategy(opts.hash);
    return new MemoryStrategy(opts.memory);
}
function reducedMotion() {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}
function esEspecifica(d, from) {
    return d.from !== "always" && d.from.includes(from);
}
function comoLista(dest) {
    if (dest === undefined)
        return [];
    if (Array.isArray(dest))
        return dest;
    return [dest];
}
function buscaEspecifica(list, from) {
    return list.find((d) => esEspecifica(d, from));
}
function eligeGeneral(list, fallback) {
    const general = list.find((d) => d.from === "always");
    if (general)
        return general;
    return fallback;
}
function decide(def, fromName) {
    if (!def)
        return { apply: false, using: "none", duration: 0 };
    if (fromName === null)
        return { apply: def.from === "always", using: def.using, duration: def.duration ?? 250 };
    const ok = def.from === "always" || def.from.includes(fromName);
    return { apply: ok, using: def.using, duration: def.duration ?? 250 };
}
export function resolveTransition(dest, fallback, fromName) {
    const list = comoLista(dest);
    if (fromName !== null) {
        const hit = buscaEspecifica(list, fromName);
        if (hit)
            return { apply: true, using: hit.using, duration: hit.duration ?? 250 };
    }
    const def = eligeGeneral(list, fallback);
    return decide(def, fromName);
}
async function correFundido(incoming, outgoing, duration) {
    const anims = [];
    anims.push(incoming.animate([{ opacity: "0" }, { opacity: "1" }], { duration, easing: "ease-out" }));
    if (outgoing) {
        anims.push(outgoing.animate([{ opacity: "1" }, { opacity: "0" }], { duration, easing: "ease-out" }));
    }
    await esperaAnims(anims, duration);
}
async function correDesliz(incoming, outgoing, duration) {
    const anims = [];
    anims.push(incoming.animate([
        { opacity: "0", transform: "translateX(24px)" },
        { opacity: "1", transform: "translateX(0)" },
    ], { duration, easing: "ease-out" }));
    if (outgoing) {
        anims.push(outgoing.animate([
            { opacity: "1", transform: "translateX(0)" },
            { opacity: "0", transform: "translateX(-24px)" },
        ], { duration, easing: "ease-out" }));
    }
    await esperaAnims(anims, duration);
}
async function esperaAnims(anims, duration) {
    try {
        await Promise.race([
            Promise.all(anims.map((a) => a.finished)),
            new Promise((r) => setTimeout(r, duration + 250)),
        ]);
    }
    catch {
    }
}
async function runUsing(using, incoming, outgoing, duration) {
    if (reducedMotion() || using === "none")
        return;
    if (typeof using === "function") {
        await using(incoming, outgoing);
        return;
    }
    if (using === "fade") {
        await correFundido(incoming, outgoing, duration);
        return;
    }
    await correDesliz(incoming, outgoing, duration);
}
export function routeEvent(name) {
    return new CustomEvent("rtw:go", { detail: name, bubbles: true, composed: true });
}
function stackViews(outlet, outgoing, incoming) {
    const box = outlet;
    const prevDisplay = box.style.display;
    const prevOverflow = box.style.overflow;
    const prevArea = outgoing.style.gridArea;
    box.style.display = "grid";
    box.style.overflow = "hidden";
    outgoing.style.gridArea = "1/1";
    incoming.style.gridArea = "1/1";
    return () => {
        box.style.display = prevDisplay;
        box.style.overflow = prevOverflow;
        outgoing.style.gridArea = prevArea;
        incoming.style.removeProperty("grid-area");
    };
}
function esClicPlano(e) {
    return !e.defaultPrevented && e.button === 0 && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey;
}
function enlaceDe(e) {
    return e.target?.closest?.("a[href]") ?? null;
}
function urlDe(a) {
    try {
        return new URL(a.getAttribute("href") ?? "", location.href);
    }
    catch {
        return null;
    }
}
function esInterna(url) {
    return url.origin === location.origin;
}
export class Router {
    constructor(defs, opts) {
        this.byPath = new Map();
        this.byName = new Map();
        this.current = null;
        this.watchers = new Set();
        this.token = 0;
        this.stopListen = null;
        this.onDocClick = null;
        for (const d of defs) {
            this.byPath.set(slash(d.path), d);
            this.byName.set(d.name, d);
        }
        this.strategy = createStrategy(opts.strategy ?? { kind: "path" });
        this.outlet = opts.outlet;
        this.fallback = opts.fallback;
        this.defaultTransition = opts.defaultTransition;
        this.locale = opts.locale;
        this.prepare = opts.prepare;
    }
    static define(defs, opts) {
        return new Router(defs, opts);
    }
    get route() {
        return this.current;
    }
    watch(fn) {
        this.watchers.add(fn);
        if (this.current)
            fn(this.current);
        return () => {
            this.watchers.delete(fn);
        };
    }
    pathOf(name) {
        const def = this.byName.get(name);
        if (!def)
            throw new Error(`Ruta desconocida / Unknown route: ${name}`);
        const p = slash(def.path);
        if (!this.locale)
            return p;
        return `/${this.locale.currentLang()}${p === "/" ? "" : p}`;
    }
    go(name, replace = false) {
        this.strategy.navigate(this.pathOf(name), replace);
    }
    async prefetch(...names) {
        await Promise.all(names.map(async (name) => {
            const def = this.byName.get(name);
            if (!def)
                return;
            try {
                await def.load();
            }
            catch {
            }
        }));
    }
    start() {
        this.stop();
        this.attach();
        void this.render(this.strategy.current());
        return () => this.stop();
    }
    setStrategy(opts) {
        const carry = this.current?.path ?? this.strategy.current();
        this.stop();
        this.strategy = createStrategy(opts);
        this.strategy.navigate(carry, true);
        this.attach();
        void this.render(this.strategy.current());
    }
    desnudaDe(url) {
        const { path: bare } = this.splitLocale(slash(url.pathname));
        return bare;
    }
    attach() {
        this.stopListen = this.strategy.listen((path) => {
            void this.render(path);
        });
        if (this.strategy.kind === "path") {
            const onClick = (e) => {
                if (!esClicPlano(e))
                    return;
                const a = enlaceDe(e);
                if (!a)
                    return;
                const url = urlDe(a);
                if (!url || !esInterna(url))
                    return;
                if (!this.byPath.has(this.desnudaDe(url)))
                    return;
                e.preventDefault();
                this.strategy.navigate(slash(url.pathname));
            };
            this.onDocClick = onClick;
            document.addEventListener("click", onClick);
        }
    }
    stop() {
        this.stopListen?.();
        this.stopListen = null;
        if (this.onDocClick) {
            document.removeEventListener("click", this.onDocClick);
            this.onDocClick = null;
        }
    }
    splitLocale(clean) {
        if (!this.locale)
            return { lang: null, path: clean };
        const seg = clean.split("/");
        const cand = seg[1] ?? "";
        if (this.locale.languages.includes(cand)) {
            const rest = `/${seg.slice(2).join("/")}`;
            return { lang: cand, path: rest === "/" ? "/" : rest };
        }
        return { lang: null, path: clean };
    }
    parseRequest(clean) {
        const { lang, path: bare } = this.splitLocale(clean);
        const found = this.byPath.get(bare);
        if (found)
            return { lang, bare, def: found };
        if (!this.fallback)
            return { lang, bare, def: undefined };
        return { lang, bare, def: this.byName.get(this.fallback) };
    }
    sincronizarLocale(lang, bare) {
        if (!this.locale)
            return false;
        if (lang) {
            this.locale.useLang(lang);
            return false;
        }
        this.strategy.navigate(`/${this.locale.currentLang()}${bare === "/" ? "" : bare}`, true);
        return true;
    }
    actualizarMismaRuta(def, clean) {
        if (!this.current)
            return false;
        if (this.current.name !== def.name)
            return false;
        if (this.current.path !== clean)
            this.confirmarRuta(def, clean);
        return true;
    }
    confirmarRuta(def, clean) {
        this.current = { name: def.name, path: clean, layout: def.layout.name };
        for (const fn of [...this.watchers])
            fn(this.current);
    }
    async render(path) {
        const mine = ++this.token;
        const clean = slash(path);
        const { lang, bare, def } = this.parseRequest(clean);
        if (this.sincronizarLocale(lang, bare))
            return;
        if (!def)
            return;
        if (this.actualizarMismaRuta(def, clean))
            return;
        const from = this.current?.name ?? null;
        const { apply, using, duration } = resolveTransition(def.transition, this.defaultTransition, from);
        await this.mostrarRuta(def, mine, apply, using, duration);
        if (mine !== this.token)
            return;
        this.confirmarRuta(def, clean);
    }
    mostrarRuta(def, mine, apply, using, duration) {
        if (!this.current || this.current.layout !== def.layout.name) {
            return this.renderFull(def, mine, apply, using, duration);
        }
        return this.renderPage(def, mine, apply, using, duration);
    }
    async montarVista(carga, claseCss, mine, prepara) {
        const mod = await carga();
        if (mine !== this.token)
            return null;
        const view = document.createElement("div");
        view.className = claseCss;
        const maybe = mod.mount(view);
        if (maybe instanceof Promise)
            await maybe;
        if (mine !== this.token)
            return null;
        if (prepara)
            this.prepare?.(view);
        return view;
    }
    async permutar(host, entrante, saliente, apply, using, duration, mine) {
        host.appendChild(entrante);
        if (apply && saliente) {
            const restore = stackViews(host, saliente, entrante);
            await runUsing(using, entrante, saliente, duration);
            restore();
            if (mine !== this.token) {
                entrante.remove();
                return;
            }
        }
        if (saliente)
            saliente.remove();
    }
    async renderFull(def, mine, apply, using, duration) {
        const layoutView = await this.montarVista(def.layout.load, "rtw-view", mine, false);
        if (!layoutView)
            return;
        const pageHost = layoutView.querySelector("page");
        if (!pageHost)
            throw new Error(`El layout de "${def.name}" no tiene <page> / Layout of "${def.name}" lacks <page>`);
        const pageView = await this.montarVista(def.load, "rtw-page", mine, true);
        if (!pageView)
            return;
        pageHost.appendChild(pageView);
        const outgoing = this.outlet.firstElementChild;
        await this.permutar(this.outlet, layoutView, outgoing, apply, using, duration, mine);
    }
    async renderPage(def, mine, apply, using, duration) {
        const pageHost = this.outlet.querySelector("page");
        if (!pageHost) {
            await this.renderFull(def, mine, apply, using, duration);
            return;
        }
        const incoming = await this.montarVista(def.load, "rtw-page", mine, true);
        if (!incoming)
            return;
        const outgoing = pageHost.firstElementChild;
        await this.permutar(pageHost, incoming, outgoing, apply, using, duration, mine);
    }
}
