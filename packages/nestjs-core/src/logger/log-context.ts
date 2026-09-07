/**
 * What the logger needs from a request context, and nothing else.
 *
 * Declared by the consumer rather than the provider: the logger never imports the context area,
 * and `Context` satisfies this structurally without importing the logger. The application wires
 * them together — `LoggerModule.forRoot({ instance, context: Context })` — so either area is
 * usable without the other.
 */
export type LogContext = {
  /** Fields to merge into every line, already assembled. */
  bindings: () => Record<string, unknown> | undefined;
};

export const LOG_CONTEXT = Symbol('LOG_CONTEXT');
