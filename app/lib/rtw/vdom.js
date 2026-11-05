export function isVElement(v) {
    return typeof v === "object" && v !== null && v.kind === "el";
}
export function isVComponent(v) {
    return typeof v === "object" && v !== null && v.kind === "comp";
}
export function norm(c) {
    if (c === null || c === undefined || c === false)
        return null;
    if (typeof c === "number")
        return String(c);
    return c;
}
export function keyOf(v) {
    if (typeof v === "object" && v !== null && v.key !== undefined)
        return v.key;
    return null;
}
function flat(out, c) {
    if (Array.isArray(c)) {
        for (const i of c)
            flat(out, i);
        return;
    }
    out.push(c);
}
export function h(tag, attrs, ...children) {
    const kids = [];
    for (const c of children)
        flat(kids, c);
    if (typeof tag === "string") {
        const { key, ...rest } = attrs ?? {};
        return { kind: "el", tag, attrs: rest, children: kids, key: key };
    }
    const { key, ...rest } = (attrs ?? {});
    return {
        kind: "comp",
        ctor: tag,
        props: { ...rest, children: kids },
        key: key,
    };
}
export function tx(value) {
    return String(value);
}
