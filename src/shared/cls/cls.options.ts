import type { ClsService } from 'nestjs-cls';

export type ClsSetup = (cls: ClsService, req: unknown, res: unknown) => void | Promise<void>;

export type ClsModuleOptions = {
  /**
   * Header carrying an inbound correlation id. When present its value becomes the context id, so a
   * request traced through several services shares one id.
   */
  header?: string;
  /** Generates an id when the header is absent. */
  generateId?: () => string;
  /**
   * Runs after the context is created. Put tenant, user or anything else the app needs here —
   * the package deliberately puts nothing in the store beyond the id.
   */
  setup?: ClsSetup;
  /** Mount the context middleware on every route. Off only for tests that drive services directly. */
  mount?: boolean;
};

export const DEFAULT_REQUEST_ID_HEADER = 'x-request-id';
