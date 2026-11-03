/**
 * Reactividad mínima: señales y stores con suscripción explícita.
 * Minimal reactivity: signals and stores with explicit subscription.
 */

/** Cancela una suscripción. / Undoes a subscription. */
export type Unsubscribe = () => void;
/** Oyente sin argumentos. / Argument-less listener. */
export type Listener = () => void;

/**
 * Valor observable. Emite a sus oyentes solo cuando cambia (Object.is).
 * Observable value. Notifies listeners only on actual change (Object.is).
 */
export class Signal<T> {
  /** Valor actual. / Current value. */
  private current: T;
  /** Oyentes suscritos. / Subscribed listeners. */
  private listeners = new Set<Listener>();

  /**
   * Crea la señal con su valor inicial.
   * Creates the signal with its initial value.
   * @param initial - Valor inicial. / Initial value.
   */
  constructor(initial: T) {
    this.current = initial;
  }

  /** Lee el valor actual. / Reads the current value. */
  get value(): T {
    return this.current;
  }

  /**
   * Escribe un valor nuevo; si es igual al anterior no emite.
   * Writes a new value; equal values do not notify.
   * @param next - Valor entrante. / Incoming value.
   */
  set value(next: T) {
    if (Object.is(next, this.current)) return;
    this.current = next;
    this.emit();
  }

  /**
   * Deriva el siguiente valor del anterior.
   * Derives the next value from the previous one.
   * @param fn - Función previo → siguiente. / Previous-to-next function.
   */
  update(fn: (prev: T) => T): void {
    this.value = fn(this.current);
  }

  /**
   * Suscribe un oyente a los cambios. Devuelve cómo desuscribirse.
   * Subscribes a listener to changes. Returns how to unsubscribe.
   * @param fn - Oyente a avisar. / Listener to notify.
   * @returns Desuscriptor. / Unsubscriber.
   */
  subscribe(fn: Listener): Unsubscribe {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  }

  /**
   * Avisa a los oyentes. Copia el set por si alguien se desuscribe a mitad.
   * Notifies listeners. Copies the set in case someone unsubscribes mid-flight.
   */
  protected emit(): void {
    for (const fn of [...this.listeners]) fn();
  }
}

/**
 * Valor derivado de una o más señales. Se recalcula cuando cambia
 * cualquiera de sus dependencias y avisa solo si el resultado cambia.
 * Value derived from signals. Recomputes when any dependency changes
 * and notifies only when the result changes.
 */
export class Computed<T> {
  /** Último valor calculado. / Last computed value. */
  private cached: T;
  /** Desuscriptores de las dependencias. / Dependency unsubscribers. */
  private cleanups: Unsubscribe[] = [];
  /** Oyentes propios. / Own listeners. */
  private listeners = new Set<Listener>();

  /**
   * Crea el derivado y lo calcula una vez.
   * Creates the derived value and computes it once.
   * @param compute - Función que calcula el valor. / Value computing function.
   * @param deps - Señales que lo invalidan. / Invalidating signals.
   */
  constructor(
    private readonly compute: () => T,
    deps: Array<Signal<unknown>>,
  ) {
    const refresh = (): void => {
      const next = this.compute();
      if (Object.is(next, this.cached)) return;
      this.cached = next;
      this.emit();
    };
    this.cleanups = deps.map((d) => d.subscribe(refresh));
    this.cached = compute();
  }

  /** Lee el valor cacheado (siempre vigente). / Reads the cached (always fresh) value. */
  get value(): T {
    return this.cached;
  }

  /**
   * Suscribe un oyente a los cambios del derivado.
   * Subscribes a listener to derived changes.
   * @param fn - Oyente a avisar. / Listener to notify.
   * @returns Desuscriptor. / Unsubscriber.
   */
  subscribe(fn: Listener): Unsubscribe {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  }

  /**
   * Rompe con las dependencias y olvida oyentes. Obliga tras desmontar.
   * Cuts dependency ties and drops listeners. Required after unmount.
   */
  dispose(): void {
    for (const u of this.cleanups) u();
    this.cleanups = [];
    this.listeners.clear();
  }

  /** Avisa a los oyentes del derivado. / Notifies derived listeners. */
  private emit(): void {
    for (const fn of [...this.listeners]) fn();
  }
}

/**
 * Estado compartido por objeto. set() fusiona el parche y emite
 * solo si alguna clave cambió de verdad.
 * Shared object state. set() merges the patch and notifies
 * only when some key actually changed.
 */
export class Store<S extends Record<string, unknown>> {
  /** Foto inmutable del estado. / Immutable state snapshot. */
  private snap: S;
  /** Oyentes suscritos. / Subscribed listeners. */
  private listeners = new Set<Listener>();

  /**
   * Crea el store copiando el objeto inicial (no guarda tu referencia).
   * Creates the store copying the initial object (your reference is not kept).
   * @param initial - Estado inicial. / Initial state.
   */
  constructor(initial: S) {
    this.snap = { ...initial };
  }

  /** Lee el estado actual (solo lectura). / Reads current state (read-only). */
  get state(): Readonly<S> {
    return this.snap;
  }

  /**
   * Fusiona el parche. Sin cambios reales no hay emisión.
   * Merges the patch. No real changes means no notification.
   * @param patch - Claves a actualizar. / Keys to update.
   */
  set(patch: Partial<S>): void {
    let changed = false;
    for (const k of Object.keys(patch) as Array<keyof S>) {
      if (!Object.is(patch[k], this.snap[k])) {
        changed = true;
        break;
      }
    }
    if (!changed) return;
    this.snap = { ...this.snap, ...patch };
    for (const fn of [...this.listeners]) fn();
  }

  /**
   * Suscribe un oyente a cualquier cambio del store.
   * Subscribes a listener to any store change.
   * @param fn - Oyente a avisar. / Listener to notify.
   * @returns Desuscriptor. / Unsubscriber.
   */
  subscribe(fn: Listener): Unsubscribe {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  }
}
