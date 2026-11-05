import { mountLayout } from "../../lib/rtw/index.js";
import { montarComun } from "../../ui/comun.js";
export async function mountAccesoLayout(target) {
    await mountLayout(target, import.meta.url);
    montarComun(target);
}
