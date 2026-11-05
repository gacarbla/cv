import { I18n } from "../lib/rtw/index.js";
import { en } from "./en.js";
import { es } from "./es.js";
import { gl } from "./gl.js";
export const i18n = new I18n({ dicts: { es, en, gl }, persist: "cv:idioma" })
    .autodetectLang(true)
    .defaultLang("es");
