import { isVComponent, isVElement, keyOf, norm } from "./vdom.js";
function listenersOf(el) {
    const store = el.__live;
    if (store)
        return store;
    const fresh = new Map();
    el.__live = fresh;
    return fresh;
}
function setClass(el, v) {
    let out = "";
    if (typeof v === "string")
        out = v;
    else if (Array.isArray(v))
        out = v.filter(Boolean).join(" ");
    else if (typeof v === "object" && v !== null) {
        out = Object.entries(v)
            .filter(([, on]) => !!on)
            .map(([cls]) => cls)
            .join(" ");
    }
    el.setAttribute("class", out);
}
function setStyle(el, v) {
    if (typeof v === "string") {
        el.style.cssText = v;
        return;
    }
    if (typeof v === "object" && v !== null) {
        for (const [k, val] of Object.entries(v)) {
            el.style[k] = String(val);
        }
    }
}
function isEventAttr(k) {
    return k.length > 2 && k[0] === "o" && k[1] === "n";
}
function setEventAttr(el, k, v) {
    const type = k.slice(2).toLowerCase();
    const bag = listenersOf(el);
    const prev = bag.get(type);
    if (prev)
        el.removeEventListener(type, prev);
    if (typeof v === "function") {
        const fn = v;
        bag.set(type, fn);
        el.addEventListener(type, fn);
    }
    else {
        bag.delete(type);
    }
}
function esSoloDato(k) {
    return k === "key" || k === "ref";
}
function trySpecialAttr(el, k, v) {
    if (k === "class" || k === "className") {
        setClass(el, v);
        return true;
    }
    if (k === "style") {
        setStyle(el, v);
        return true;
    }
    if (esSoloDato(k))
        return true;
    if (isEventAttr(k)) {
        setEventAttr(el, k, v);
        return true;
    }
    return false;
}
function setPlainAttr(el, k, v) {
    if (typeof v === "boolean") {
        if (v)
            el.setAttribute(k, "");
        else
            el.removeAttribute(k);
        return;
    }
    if (v === null || v === undefined) {
        el.removeAttribute(k);
        return;
    }
    if (k in el) {
        el[k] = v;
    }
    else {
        el.setAttribute(k, String(v));
    }
}
function setAttr(el, k, v) {
    if (trySpecialAttr(el, k, v))
        return;
    setPlainAttr(el, k, v);
}
function removeStaleAttrs(el, oldA, newA) {
    for (const k of Object.keys(oldA)) {
        if (esSoloDato(k))
            continue;
        if (!(k in newA))
            setAttr(el, k, undefined);
    }
}
function applyChangedAttrs(el, oldA, newA) {
    for (const k of Object.keys(newA)) {
        if (esSoloDato(k))
            continue;
        if (!Object.is(oldA[k], newA[k]))
            setAttr(el, k, newA[k]);
    }
}
function syncAttrs(el, oldA, newA) {
    removeStaleAttrs(el, oldA, newA);
    applyChangedAttrs(el, oldA, newA);
}
function indexOldKids(oldKids) {
    const byKey = new Map();
    const noKey = [];
    for (const m of oldKids) {
        const k = keyOf(m.vnode);
        if (k === null)
            noKey.push(m);
        else if (!byKey.has(k))
            byKey.set(k, m);
        else
            noKey.push(m);
    }
    return { byKey, noKey };
}
function claimKid(byKey, noKey, j, k) {
    if (k !== null) {
        const m = byKey.get(k);
        if (m)
            byKey.delete(k);
        return { m, nextJ: j };
    }
    return { m: noKey[j], nextJ: j + 1 };
}
function drainLeftovers(byKey, noKey, j) {
    for (const m of byKey.values())
        unmountTree(m);
    for (; j < noKey.length; j++)
        unmountTree(noKey[j]);
}
function mountKids(el, vs) {
    const out = [];
    for (const v of vs) {
        const m = patchInto(el, null, v, null);
        out.push(m);
    }
    return out;
}
function patchKids(el, oldKids, vs) {
    const { byKey, noKey } = indexOldKids(oldKids);
    const out = [];
    let j = 0;
    const order = [];
    for (const raw of vs) {
        const v = norm(raw);
        const claimed = claimKid(byKey, noKey, j, keyOf(v));
        j = claimed.nextJ;
        const nm = patchInto(el, claimed.m ?? null, v, null);
        out.push(nm);
        order.push(nm.node);
    }
    for (const node of order)
        el.appendChild(node);
    drainLeftovers(byKey, noKey, j);
    return out;
}
function mountElement(v) {
    const el = document.createElement(v.tag);
    syncAttrs(el, {}, v.attrs);
    const kids = mountKids(el, v.children);
    const ref = v.attrs["ref"];
    if (typeof ref === "function") {
        ref(el);
    }
    return { node: el, kids };
}
export function mountComp(vc) {
    const comp = new vc.ctor(vc.props);
    const rendered = patchInto(null, null, comp.render(), null);
    comp._attach(rendered);
    const m = { node: rendered.node, vnode: { kind: "comp", ctor: vc.ctor, props: vc.props }, comp, rendered };
    comp.onMount();
    return m;
}
function updateComp(m, props) {
    const comp = m.comp;
    comp.props = props;
    const parent = m.node.parentNode;
    const next = patchInto(parent, m.rendered, comp.render(), null);
    m.rendered = next;
    m.node = next.node;
    comp._rendered = next;
    comp.onUpdate();
}
function unmountComp(m) {
    const comp = m.comp;
    comp.onUnmount();
    if (m.rendered)
        unmountTree(m.rendered);
    comp._detach();
}
function cleanupElementRef(m) {
    const v = m.vnode;
    if (!isVElement(v))
        return;
    const ref = v.attrs["ref"];
    if (typeof ref === "function") {
        ref(null);
    }
}
function cleanupListeners(node) {
    const bag = node.__live;
    if (!bag || !(node instanceof Element))
        return;
    for (const [type, fn] of bag)
        node.removeEventListener(type, fn);
    bag.clear();
}
export function unmountTree(m) {
    if (m.comp) {
        unmountComp(m);
        m.node.parentNode?.removeChild(m.node);
        return;
    }
    if (isVElement(m.vnode)) {
        cleanupElementRef(m);
        for (const k of m.kids ?? [])
            unmountTree(k);
        cleanupListeners(m.node);
    }
    m.node.parentNode?.removeChild(m.node);
}
function colocaSiFalta(parent, node, anchor) {
    if (parent && node.parentNode !== parent)
        parent.insertBefore(node, anchor);
}
function patchNullNode(parent, oldM, anchor) {
    const prev = oldM?.node;
    if (prev instanceof Text) {
        if (prev.textContent !== "")
            prev.textContent = "";
        colocaSiFalta(parent, prev, anchor);
        if (oldM && oldM.node !== prev)
            unmountTree(oldM);
        return { node: prev, vnode: null };
    }
    if (oldM)
        unmountTree(oldM);
    const node = document.createTextNode("");
    colocaSiFalta(parent, node, anchor);
    return { node, vnode: null };
}
function patchTextNode(parent, oldM, v, anchor) {
    if (oldM && oldM.node instanceof Text && typeof oldM.vnode === "string") {
        if (oldM.node.textContent !== v)
            oldM.node.textContent = v;
        oldM.vnode = v;
        return oldM;
    }
    if (oldM)
        unmountTree(oldM);
    const node = document.createTextNode(v);
    colocaSiFalta(parent, node, anchor);
    return { node, vnode: v };
}
function reuseElement(oldM, v) {
    const ov = oldM?.vnode;
    if (!oldM || !(oldM.node instanceof Element) || !isVElement(ov) || ov.tag.toLowerCase() !== v.tag.toLowerCase()) {
        return null;
    }
    const el = oldM.node;
    syncAttrs(el, ov.attrs, v.attrs);
    oldM.kids = patchKids(el, oldM.kids ?? [], v.children);
    oldM.vnode = v;
    return oldM;
}
function reuseComp(oldM, v) {
    if (!oldM || !oldM.comp)
        return null;
    const ov = oldM.vnode;
    if (!isVComponent(ov) || ov.ctor !== v.ctor || keyOf(ov) !== keyOf(v))
        return null;
    updateComp(oldM, v.props);
    oldM.vnode = v;
    return oldM;
}
function replaceMounted(parent, oldM, anchor, create) {
    const holder = oldM.node.parentNode ?? parent;
    const at = holder && oldM.node.parentNode === holder ? oldM.node.nextSibling : null;
    unmountTree(oldM);
    const m = create();
    if (holder)
        holder.insertBefore(m.node, at);
    else if (parent)
        parent.insertBefore(m.node, at);
    return m;
}
function patchElementNode(parent, oldM, v, anchor) {
    const reused = reuseElement(oldM, v);
    if (reused)
        return reused;
    if (oldM) {
        return replaceMounted(parent, oldM, anchor, () => {
            const built = mountElement(v);
            return { node: built.node, vnode: v, kids: built.kids };
        });
    }
    const built = mountElement(v);
    if (parent)
        parent.insertBefore(built.node, anchor);
    return { node: built.node, vnode: v, kids: built.kids };
}
function patchCompNode(parent, oldM, v, anchor) {
    const reused = reuseComp(oldM, v);
    if (reused)
        return reused;
    if (oldM)
        return replaceMounted(parent, oldM, anchor, () => mountComp(v));
    const m = mountComp(v);
    if (parent)
        parent.insertBefore(m.node, anchor);
    return m;
}
export function patchInto(parent, oldM, raw, anchor) {
    const v = norm(raw);
    if (v === null)
        return patchNullNode(parent, oldM, anchor);
    if (typeof v === "string")
        return patchTextNode(parent, oldM, v, anchor);
    if (isVElement(v))
        return patchElementNode(parent, oldM, v, anchor);
    return patchCompNode(parent, oldM, v, anchor);
}
const pending = new Set();
let queued = false;
function flush() {
    queued = false;
    const work = [...pending];
    pending.clear();
    for (const comp of work) {
        if (comp._mounted && comp._rendered) {
            const parent = comp._rendered.node.parentNode;
            if (!parent)
                continue;
            const next = patchInto(parent, comp._rendered, comp.render(), null);
            comp._rendered = next;
            comp.onUpdate();
        }
    }
}
export function enqueueRender(comp) {
    pending.add(comp);
    if (queued)
        return;
    queued = true;
    queueMicrotask(flush);
}
