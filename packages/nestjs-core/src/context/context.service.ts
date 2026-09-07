import { Inject, Injectable, Optional } from '@nestjs/common';
import { ClsService } from 'nestjs-cls';

import type { ContextFields, ContextRegistry, StoreOf } from './registry';

export const CONTEXT_REGISTRY = Symbol('CONTEXT_REGISTRY');

/** Store key for the precomputed log bindings. A symbol, so it cannot collide with a field. */
export const CONTEXT_BINDINGS = Symbol('CONTEXT_BINDINGS');

/**
 * The unit of work in flight — a request, a consumed message, a job, a cron tick.
 *
 * A singleton that resolves the store per call, so nothing here needs request scope. It exists so
 * the two subtleties of reading async-local state are written once:
 *
 * - `getId()` throws outside a context, and a startup task, a scheduled job or a test driving a
 *   service directly legitimately has none. Every accessor returns `undefined` there.
 * - The context is optional altogether. Without the module the service still runs, uncorrelated.
 *
 * Log bindings are computed once when the context is created, not per line — `bindings()` returns
 * a stored object, which is what keeps the logger's cost to a single property merge.
 */
@Injectable()
export class Context<F extends ContextFields = ContextFields> {
  constructor(
    @Optional() private readonly cls?: ClsService<StoreOf<F> & Record<symbol, unknown>>,
    @Optional() @Inject(CONTEXT_REGISTRY) private readonly registry?: ContextRegistry<F>,
  ) {}

  /** Whether a context is active — a unit of work, as opposed to boot or a detached task. */
  get active(): boolean {
    return this.cls?.isActive() ?? false;
  }

  /** The context id, or `undefined` outside a unit of work. */
  get id(): string | undefined {
    return this.active ? this.cls?.getId() : undefined;
  }

  /**
   * The whole store, typed by the field declaration. Read fields off it (`ctx.store?.tenantId`)
   * rather than by key: `nestjs-cls` keys are dot-paths whose types do not survive a wrapper.
   */
  get store(): StoreOf<F> | undefined {
    return this.active ? (this.cls?.get() as StoreOf<F>) : undefined;
  }

  /**
   * Adds to the context in flight — a guard resolving the caller, say. Outside a unit of work this
   * is a no-op rather than a throw.
   *
   * Writability is declared per field, and a violation throws: a rewritten tenant id is a security
   * bug, and a correlation id that changes mid-request makes the logs a lie.
   */
  set<TKey extends keyof StoreOf<F> & string>(key: TKey, value: StoreOf<F>[TKey]): void {
    if (!this.active || !this.cls) {
      return;
    }

    const field = this.registry?.fields[key];

    if (field?.writable === 'setup') {
      throw new Error(`Context field "${key}" is fixed when the context is created`);
    }

    if (field?.writable === 'once' && this.cls.get(key as never) !== undefined) {
      throw new Error(`Context field "${key}" is already set and may only be written once`);
    }

    this.cls.set(key as never, value as never);

    // The snapshot is what the logger reads, so a late write has to be reflected in it.
    if (field !== undefined && field.log !== false) {
      this.refreshBindings();
    }
  }

  /**
   * Log bindings for the current context. Satisfies the logger's `LogContext` structurally — the
   * two areas are wired together by the application, not by importing each other.
   */
  bindings(): Record<string, unknown> | undefined {
    return this.active
      ? (this.cls?.get(CONTEXT_BINDINGS as never) as Record<string, unknown> | undefined)
      : undefined;
  }

  /** Outbound propagation: the headers a downstream call should carry. */
  headers(): Record<string, string> {
    const store = this.store;

    return store === undefined ? {} : (this.registry?.headers(store) ?? {});
  }

  /** Outbound propagation into any carrier — message properties, job data, request headers. */
  inject(writer: { set: (name: string, value: string) => void }): void {
    const store = this.store;

    if (store !== undefined) {
      this.registry?.inject(store, writer);
    }
  }

  private refreshBindings(): void {
    const store = this.cls?.get() as StoreOf<F> | undefined;

    if (store !== undefined && this.registry !== undefined) {
      this.cls?.set(CONTEXT_BINDINGS as never, this.registry.bindings(store) as never);
    }
  }
}

export const InjectContext = (): PropertyDecorator & ParameterDecorator => Inject(Context);
