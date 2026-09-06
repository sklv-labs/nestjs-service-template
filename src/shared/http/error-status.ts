/**
 * Which HTTP status each business error maps to.
 *
 * Populated by `httpError()` while documenting a response, so the documented status and the one the
 * filter returns are the same by construction. The cost is that an error no endpoint documents has
 * no status, and the filter falls back to 500 — loudly, but at runtime.
 *
 * Module-level state is a known limitation: it is process-wide, so two Nest applications in one
 * process share it and import order decides conflicts. `reset()` exists so tests are not at the
 * mercy of that.
 */
const statusByCode = new Map<string, number>();

export const mapErrorStatus = (code: string, status: number): void => {
  statusByCode.set(code, status);
};

export const statusForError = (code: string): number | undefined => statusByCode.get(code);

export const resetErrorStatuses = (): void => statusByCode.clear();
