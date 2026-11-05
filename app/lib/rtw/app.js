import { Router } from "./router.js";
export class App {
    constructor(routes, opts = {}) {
        this.opts = opts;
        this.disposers = [];
        this.running = false;
        const el = this.resuelveOutlet(opts.outlet);
        this.outletEl = el;
        this.names = this.armaNombres(opts, routes);
        this.strategyKind = opts.strategy?.kind ?? "path";
        this.localeOn = !!opts.localePrefix && !!opts.i18n;
        this.router = Router.define(routes, this.armaOpcionesRouter(opts, el));
        this.i18n = opts.i18n;
    }
    resuelveOutlet(outlet) {
        const sel = outlet ?? "app";
        const el = typeof sel === "string" ? document.querySelector(sel) : sel;
        if (!el)
            throw new Error("Falta el contenedor <app> en el documento / Missing <app> container in the document");
        return el;
    }
    armaNombres(opts, routes) {
        return new Set(opts.names ?? routes.map((r) => r.name));
    }
    armaOpcionesRouter(opts, el) {
        const routerOpts = { outlet: el, fallback: opts.fallback };
        if (opts.strategy)
            routerOpts.strategy = opts.strategy;
        if (opts.localePrefix && opts.i18n)
            routerOpts.locale = opts.i18n;
        if (opts.i18n) {
            const i18n = opts.i18n;
            routerOpts.prepare = (view) => i18n.paint(view);
        }
        return routerOpts;
    }
    start() {
        this.stop();
        this.running = true;
        const stopRouter = this.router.start();
        const stopWatch = this.router.watch((r) => {
            window.dispatchEvent(new CustomEvent("rtw:route", { detail: r.name }));
            this.paintHrefs();
        });
        if (this.i18n) {
            const i18n = this.i18n;
            this.disposers.push(i18n.onLang(() => i18n.paint(this.outletEl)));
            if (this.localeOn) {
                this.disposers.push(i18n.onLang(() => {
                    const cur = this.router.route;
                    if (cur)
                        this.router.go(cur.name, true);
                }));
            }
        }
        const onGo = (e) => {
            const name = e.detail ?? "";
            if (this.names.has(name))
                this.router.go(name);
        };
        const onClick = (e) => {
            if (this.strategyKind === "path")
                return;
            const a = e.target?.closest?.("[data-go]");
            if (!a)
                return;
            e.preventDefault();
            const name = a.dataset["go"] ?? "";
            if (this.names.has(name))
                this.router.go(name);
        };
        document.addEventListener("rtw:go", onGo);
        document.addEventListener("click", onClick);
        this.disposers = [
            stopRouter,
            stopWatch,
            () => document.removeEventListener("rtw:go", onGo),
            () => document.removeEventListener("click", onClick),
        ];
        return () => this.stop();
    }
    stop() {
        for (const fn of this.disposers.splice(0))
            fn();
        this.running = false;
    }
    paintHrefs() {
        for (const a of document.querySelectorAll("a[data-go]")) {
            const name = a.dataset["go"] ?? "";
            if (!this.names.has(name))
                continue;
            const path = this.router.pathOf(name);
            a.href = this.strategyKind === "hash" ? `#${path}` : path;
        }
    }
    setStrategy(next) {
        this.strategyKind = next.kind;
        this.router.setStrategy(next);
    }
    get isRunning() {
        return this.running;
    }
}
