import { Inject, Injectable, Optional } from '@nestjs/common';
import type { ClsStore } from 'nestjs-cls';
import { ClsService } from 'nestjs-cls';

/**
 * Read access to the current request's context.
 *
 * Injected as a singleton — it resolves the store per call, so nothing here needs request scope.
 * It exists so the two subtleties of reading CLS are written once:
 *
 * - `getId()` throws outside a context, and a startup task, a cron tick or a test driving a service
 *   directly legitimately has none. Every accessor returns `undefined` there instead of throwing.
 * - The context is optional. Without the module the application still runs, just uncorrelated.
 *
 * The store's shape is the application's own. Declare it and inject this typed to read it:
 *
 * ```ts
 * interface AppStore extends ClsStore { tenantId: string }
 * @Inject(RequestContext) private readonly ctx: RequestContext<AppStore>;
 * ```
 */
@Injectable()
export class RequestContext<TStore extends ClsStore = ClsStore> {
  constructor(@Optional() private readonly cls?: ClsService<TStore>) {}

  /** The correlation id, or `undefined` outside a request. */
  get id(): string | undefined {
    return this.cls?.isActive() ? this.cls.getId() : undefined;
  }

  /** Whether a context is active — a request, as opposed to boot or a scheduled task. */
  get active(): boolean {
    return this.cls?.isActive() ?? false;
  }

  /**
   * The whole store, typed by `TStore`. Read fields off it (`ctx.store?.tenantId`) rather than by
   * key: `nestjs-cls` keys are dot-paths whose types do not survive being passed through a wrapper,
   * and a plain object gives better inference than a key lookup would.
   */
  get store(): TStore | undefined {
    return this.cls?.isActive() ? this.cls.get() : undefined;
  }

  /**
   * Adds to the context of the request in flight — from a guard resolving the caller, say. Outside
   * a request this is a no-op rather than a throw.
   *
   * Top-level keys only. The cast is the one place the library's dot-path key types are given up,
   * in exchange for a signature an application can read.
   */
  set<TKey extends keyof TStore & string>(key: TKey, value: TStore[TKey]): void {
    if (this.cls?.isActive()) {
      this.cls.set(key as never, value as never);
    }
  }
}

export const InjectRequestContext = (): PropertyDecorator & ParameterDecorator =>
  Inject(RequestContext);
