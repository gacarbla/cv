export class RouteBuilder {
    constructor(name) {
        this.name = name;
        this.path = "";
        this.general = null;
        this.specifics = [];
        this.last = null;
        this.layoutDef = null;
        this.pageLoader = null;
    }
    at(path) {
        this.path = path;
        return this;
    }
    fade(duration = 250) {
        return this.setGeneral({ from: "always", using: "fade", duration });
    }
    slide(duration = 250) {
        return this.setGeneral({ from: "always", using: "slide", duration });
    }
    none() {
        return this.setGeneral({ from: "always", using: "none", duration: 0 });
    }
    custom(fn, duration = 250) {
        return this.setGeneral({ from: "always", using: fn, duration });
    }
    fadeFrom(...names) {
        return this.addSpecific({ from: [...names], using: "fade", duration: 250 });
    }
    slideFrom(...names) {
        return this.addSpecific({ from: [...names], using: "slide", duration: 250 });
    }
    noneFrom(...names) {
        return this.addSpecific({ from: [...names], using: "none", duration: 0 });
    }
    customFrom(fn, ...names) {
        return this.addSpecific({ from: [...names], using: fn, duration: 250 });
    }
    onlyFrom(...names) {
        if (this.last) {
            this.last.from = [...names];
        }
        else {
            this.last = { from: [...names], using: "none", duration: 0 };
            this.specifics.push(this.last);
        }
        return this;
    }
    layout(name, fn) {
        this.layoutDef = { name, load: fn };
        return this;
    }
    page(fn) {
        if (!this.path)
            throw new Error(`Ruta "${this.name}" sin path: usa .at() / Route "${this.name}" without path: use .at()`);
        if (!this.layoutDef)
            throw new Error(`Ruta "${this.name}" sin layout: usa .layout() / Route "${this.name}" without layout: use .layout()`);
        this.pageLoader = fn;
        const rules = [...this.specifics, ...(this.general ? [this.general] : [])];
        return {
            name: this.name,
            path: this.path,
            layout: this.layoutDef,
            ...(rules.length > 0 ? { transition: rules.length === 1 ? rules[0] : rules } : {}),
            load: () => this.pageLoader(),
        };
    }
    load(fn) {
        return this.page(fn);
    }
    setGeneral(rule) {
        this.general = rule;
        this.last = rule;
        return this;
    }
    addSpecific(rule) {
        this.specifics.push(rule);
        this.last = rule;
        return this;
    }
}
export const Routes = {
    route(name) {
        return new RouteBuilder(name);
    },
};
