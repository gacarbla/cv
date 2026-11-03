/** Texto localizable: cadena simple o diccionario por idioma. */
export type Texto = string | Record<string, string>;
/** Lista de textos localizable. */
export type Textos = string[] | Record<string, string[]>;

export interface Area {
  id: string;
  nombre: Texto;
  descripcion: Texto;
}

export interface Experiencia {
  id: string;
  puesto: Texto;
  empresa: string;
  empresaUrl?: string;
  logo: string;
  color: string;
  tipo: Texto;
  inicio: string;
  fin: string;
  fechas: Texto;
  duracion: Texto;
  ubicacion: Texto;
  modalidad: Texto;
  insignia: Texto;
  resumen: Texto;
  logros: Textos;
  herramientas: string[];
  areas: string[];
  aptitudes: string[];
}

export interface Formacion {
  id: string;
  titulo: Texto;
  centro: string;
  fechas: Texto;
  ubicacion: Texto;
  logo: string;
  color: string;
  actividades: Texto;
  diploma: Texto;
}

export interface Aprendizaje {
  titulo: Texto;
  descripcion: Texto;
  foco: string[];
  desde: string;
}

export interface Certificacion {
  id: string;
  nombre: string;
  entidad: string;
  entidadUrl?: string;
  fecha: string;
  fechas: Texto;
  credencial: string;
  skill: Texto;
  logo: string;
  color: string;
  destacado: boolean;
}

export interface Aptitud {
  id: string;
  nombre: Texto;
  categoria: string;
  fuente: "linkedin" | "experiencia" | "proyecto";
  validaciones: number;
  evidencia: string[];
  descripcion: Texto;
}

export interface Herramienta {
  nombre: string;
  contexto: Texto;
  fuente: Texto;
}

export interface Idioma {
  id: string;
  nombre: Texto;
  nivel: Texto;
  badge: Texto;
  evidencia: Texto;
}

export interface Voluntariado {
  id: string;
  puesto: Texto;
  entidad: string;
  entidadUrl?: string;
  logo: string;
  color: string;
  fechas: Texto;
  duracion: Texto;
  ubicacion: Texto;
  descripcion: Texto;
  logros: Textos;
}

export interface Proyecto {
  id: string;
  nombre: string;
  descripcion: Texto;
  stack: string[];
  repo: string;
  demo: string;
  estado: Texto;
  anio: string;
  logo: string;
  color: string;
  destacado: boolean;
}

export interface Recomendacion {
  id: string;
  autor: string;
  puesto: Texto;
  empresa: string;
  relacion: Texto;
  fecha: string;
  fechas: Texto;
  extracto: Texto;
  puntos: Textos;
  archivo: string;
  nombreArchivo: string;
  logo: string;
  color: string;
}

export interface Perfil {
  version: number;
  actualizado: string;
  perfil: {
    nombre: string;
    nombreCorto: string;
    marca: string;
    pronombres: Texto;
    eyebrow: Texto;
    titular: Texto;
    resumenCorto: Texto;
    ubicacion: Texto;
    ubicacionCorta: Texto;
    estado: Texto;
    modalidad: Texto;
    disponibilidad: Texto;
    idiomasResumen: Texto;
    contactoNota: Texto;
    contacto: {
      email: string;
      telefono: string;
      linkedin: string;
      github: string;
      web: string;
      cv: string;
    };
    verificado: boolean;
    verificadoNota: Texto;
    linkedinPerfil: string;
  };
  sobreMi: Textos;
  resumen20: Textos;
  areas: Area[];
  experiencia: Experiencia[];
  formacion: Formacion;
  aprendizaje: Aprendizaje;
  certificaciones: Certificacion[];
  aptitudes: Aptitud[];
  herramientas: Herramienta[];
  idiomas: Idioma[];
  voluntariado: Voluntariado[];
  proyectos: Proyecto[];
  recomendaciones: Recomendacion[];
}

/** Sobre cifrado tal como se publica. / Encrypted envelope as published. */
export interface Sobre {
  v: number;
  kdf: { alg: string; iter: number; salt: string };
  cipher: { alg: string; iv: string };
  aad: string;
  ct: string;
  meta?: { createdAt?: string; perfilVersion?: number; actualizado?: string };
}
