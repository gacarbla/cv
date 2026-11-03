/**
 * Protocolo entre componentes de formulario: x-form lo pide, los campos
 * responden. Todo síncrono vía evento compuesto (atraviesa shadow).
 * Protocol across form components: x-form asks, fields answer.
 * All synchronous via composed event (crosses shadow).
 */

/** Nombre del evento recolector. / Collector event name. */
export const COLLECT_EVENT = "rtw:collect";

/** Carga que viaja en el evento. / Payload traveling in the event. */
export interface CollectDetail {
  /** Valores por nombre de campo. / Values by field name. */
  data: Record<string, string>;
}

/**
 * Pide valores a los campos bajo `scope` (p. ej. el <form>).
 * Recoge respuestas síncronas en un objeto nuevo.
 * Asks fields under `scope` for values (e.g. the <form>).
 * Gathers synchronous answers into a fresh object.
 * @param scope - Elemento desde el que burbujea. / Element it bubbles from.
 * @returns Valores por nombre. / Values by name.
 */
export function collectFrom(scope: Element): Record<string, string> {
  const detail: CollectDetail = { data: {} };
  scope.dispatchEvent(new CustomEvent<CollectDetail>(COLLECT_EVENT, { detail, bubbles: true, composed: true }));
  return detail.data;
}

/**
 * Registra un campo: en cada colecta aporta su valor actual.
 * Registers a field: on each collection it contributes its live value.
 * @param name - Nombre del campo. / Field name.
 * @param get - Lector del valor actual. / Current value reader.
 * @returns Desuscriptor. / Unsubscriber.
 */
export function provideValue(name: string, get: () => string): () => void {
  const onCollect = (e: Event): void => {
    ((e as CustomEvent<CollectDetail>).detail.data)[name] = get();
  };
  window.addEventListener(COLLECT_EVENT, onCollect);
  return () => window.removeEventListener(COLLECT_EVENT, onCollect);
}
