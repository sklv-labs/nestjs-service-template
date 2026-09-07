import type { z } from 'zod';

/**
 * What each business error looks like over HTTP: its status, and the contract its response body
 * must satisfy.
 *
 * Populated once at bootstrap by the endpoint scanner, from the endpoints actually mounted on
 * controllers. `httpError()` used to write here as an import side effect, which made the mapping
 * process-global and dependent on module evaluation order.
 */
type ErrorContract = { status: number; schema: z.ZodType };

const contracts = new Map<string, ErrorContract>();

export const mapErrorContract = (code: string, contract: ErrorContract): void => {
  contracts.set(code, contract);
};

export const statusForError = (code: string): number | undefined => contracts.get(code)?.status;

export const contractForError = (code: string): ErrorContract | undefined => contracts.get(code);

export const mappedErrorCodes = (): string[] => [...contracts.keys()];

export const resetErrorContracts = (): void => contracts.clear();
