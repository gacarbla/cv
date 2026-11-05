import { Signal } from "./signal.js";
export class I18n {
    constructor(opts) {
        this.manual = false;
        this.stored = false;
        this.origin = "default";
        this.opts = opts;
        this.detectFlag = opts.detect ?? false;
        this.lang = new Signal(this.initial());
    }
    get languages() {
        return Object.keys(this.opts.dicts);
    }
    currentLang() {
        return this.lang.value;
    }
    useLang(lang) {
        if (this.languages.includes(lang))
            this.use(lang);
    }
    autodetectLang(on = true) {
        this.detectFlag = on;
        if (on && !this.manual && !this.stored) {
            const hit = this.detectNav();
            if (hit)
                this.activate(hit, "detected");
        }
        return this;
    }
    defaultLang(lang) {
        this.opts.defaultLang = lang;
        if (this.origin === "default")
            this.activate(lang, "default");
        return this;
    }
    leeGuardado(langs) {
        if (typeof this.opts.persist !== "string")
            return null;
        try {
            const saved = localStorage.getItem(this.opts.persist);
            if (saved && langs.includes(saved)) {
                this.stored = true;
                this.origin = "stored";
                return saved;
            }
        }
        catch {
        }
        return null;
    }
    detectaIdioma() {
        if (!(this.opts.detect ?? this.detectFlag))
            return null;
        const hit = this.detectNav();
        if (!hit)
            return null;
        this.origin = "detected";
        return hit;
    }
    initial() {
        const langs = this.languages;
        const first = (langs[0] ?? "es");
        const guardado = this.leeGuardado(langs);
        if (guardado)
            return guardado;
        const detectado = this.detectaIdioma();
        if (detectado)
            return detectado;
        this.origin = "default";
        return this.opts.defaultLang ?? first;
    }
    detectNav() {
        try {
            const nav = navigator.language.slice(0, 2).toLowerCase();
            return this.languages.find((l) => l.toLowerCase() === nav || l.toLowerCase().startsWith(`${nav}-`)) ?? null;
        }
        catch {
            return null;
        }
    }
    activate(lang, origin) {
        this.origin = origin;
        this.lang.value = lang;
        if (typeof this.opts.persist === "string") {
            try {
                localStorage.setItem(this.opts.persist, lang);
            }
            catch {
            }
        }
        try {
            document.documentElement.lang = lang;
        }
        catch {
        }
    }
    use(lang) {
        if (!this.opts.dicts[lang])
            return;
        this.manual = true;
        this.activate(lang, "manual");
    }
    t(key, vars) {
        const at = (l) => (l ? this.opts.dicts[l] : undefined) ?? {};
        const dict = at(this.lang.value);
        const back = at(this.opts.fallbackLang ?? this.opts.defaultLang);
        let out = dict[key] ?? back[key] ?? key;
        if (vars) {
            for (const [k, v] of Object.entries(vars))
                out = out.split(`{${k}}`).join(String(v));
        }
        return out;
    }
    onLang(fn) {
        return this.lang.subscribe(() => fn(this.lang.value));
    }
    paint(root) {
        const els = root instanceof Element ? [root] : [];
        for (const el of root.querySelectorAll("*"))
            els.push(el);
        for (const el of els) {
            if (el.hasAttribute("data-i18n") || el.getAttributeNames().some((n) => n.startsWith("data-i18n-"))) {
                this.paintOne(el);
            }
        }
    }
    apply(root) {
        this.paint(root);
        return this.lang.subscribe(() => this.paint(root));
    }
    paintOne(el) {
        const key = el.getAttribute("data-i18n");
        if (key)
            el.textContent = this.t(key, readVars(el));
        for (const name of el.getAttributeNames()) {
            if (!name.startsWith("data-i18n-") || name === "data-i18n-vars")
                continue;
            const target = name.slice("data-i18n-".length);
            const k = el.getAttribute(name);
            if (k)
                el.setAttribute(target, this.t(k, readVars(el)));
        }
    }
}
function readVars(el) {
    const raw = el.getAttribute("data-i18n-vars");
    if (!raw)
        return undefined;
    try {
        const v = JSON.parse(raw);
        if (typeof v === "object" && v !== null)
            return v;
    }
    catch {
    }
    return undefined;
}
