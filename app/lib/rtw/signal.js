export class Signal {
    constructor(initial) {
        this.listeners = new Set();
        this.current = initial;
    }
    get value() {
        return this.current;
    }
    set value(next) {
        if (Object.is(next, this.current))
            return;
        this.current = next;
        this.emit();
    }
    update(fn) {
        this.value = fn(this.current);
    }
    subscribe(fn) {
        this.listeners.add(fn);
        return () => {
            this.listeners.delete(fn);
        };
    }
    emit() {
        for (const fn of [...this.listeners])
            fn();
    }
}
export class Computed {
    constructor(compute, deps) {
        this.compute = compute;
        this.cleanups = [];
        this.listeners = new Set();
        const refresh = () => {
            const next = this.compute();
            if (Object.is(next, this.cached))
                return;
            this.cached = next;
            this.emit();
        };
        this.cleanups = deps.map((d) => d.subscribe(refresh));
        this.cached = compute();
    }
    get value() {
        return this.cached;
    }
    subscribe(fn) {
        this.listeners.add(fn);
        return () => {
            this.listeners.delete(fn);
        };
    }
    dispose() {
        for (const u of this.cleanups)
            u();
        this.cleanups = [];
        this.listeners.clear();
    }
    emit() {
        for (const fn of [...this.listeners])
            fn();
    }
}
export class Store {
    constructor(initial) {
        this.listeners = new Set();
        this.snap = { ...initial };
    }
    get state() {
        return this.snap;
    }
    set(patch) {
        let changed = false;
        for (const k of Object.keys(patch)) {
            if (!Object.is(patch[k], this.snap[k])) {
                changed = true;
                break;
            }
        }
        if (!changed)
            return;
        this.snap = { ...this.snap, ...patch };
        for (const fn of [...this.listeners])
            fn();
    }
    subscribe(fn) {
        this.listeners.add(fn);
        return () => {
            this.listeners.delete(fn);
        };
    }
}
