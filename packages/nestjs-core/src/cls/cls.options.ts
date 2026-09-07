import type { ClsService, ClsStore } from 'nestjs-cls';

import type { Correlation } from './correlation-id';

export type ClsSetup<TStore extends ClsStore = ClsStore> = (
  cls: ClsService<TStore>,
  req: unknown,
  res: unknown,
) => void | Promise<void>;

export type ClsModuleOptions<TStore extends ClsStore = ClsStore> = {
  /**
   * The correlation id policy — which header carries an inbound id, and which values are trusted.
   * Defaults to the shared one, which is also what the HTTP edge uses, so the two cannot disagree
   * unless an application deliberately passes a different policy to both.
   */
  correlation?: Correlation;
  /**
   * Runs after the context is created. Put tenant, user or anything else the app needs here —
   * the package deliberately puts nothing in the store beyond the id. Typed by `TStore`, so
   * `ClsModule.forRoot<AppStore>({ setup })` type-checks what it writes.
   */
  setup?: ClsSetup<TStore>;
  /** Mount the context middleware on every route. Off only for tests that drive services directly. */
  mount?: boolean;
};
