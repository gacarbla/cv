import { enqueueRender, mountComp, unmountTree } from "./render.js";
export class Component {
    constructor(props) {
        this._mounted = false;
        this._rendered = null;
        this.props = props;
        this.state = {};
    }
    setState(patch) {
        Object.assign(this.state, patch);
        if (this._mounted)
            enqueueRender(this);
    }
    forceUpdate() {
        if (this._mounted)
            enqueueRender(this);
    }
    onMount() { }
    onUpdate() { }
    onUnmount() { }
    _attach(m) {
        this._rendered = m;
        this._mounted = true;
    }
    _detach() {
        this._mounted = false;
        this._rendered = null;
    }
}
export function mount(ctor, target, props) {
    target.textContent = "";
    const m = mountComp({ ctor, props: (props ?? {}) });
    target.appendChild(m.node);
    return () => {
        unmountTree(m);
    };
}
