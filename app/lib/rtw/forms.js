export const COLLECT_EVENT = "rtw:collect";
export function collectFrom(scope) {
    const detail = { data: {} };
    scope.dispatchEvent(new CustomEvent(COLLECT_EVENT, { detail, bubbles: true, composed: true }));
    return detail.data;
}
export function provideValue(name, get) {
    const onCollect = (e) => {
        (e.detail.data)[name] = get();
    };
    window.addEventListener(COLLECT_EVENT, onCollect);
    return () => window.removeEventListener(COLLECT_EVENT, onCollect);
}
