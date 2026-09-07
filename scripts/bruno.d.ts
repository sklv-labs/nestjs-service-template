/**
 * Bruno's packages ship no type declarations. Only the two functions used by the collection
 * generator are declared, so the rest of the surface cannot be reached untyped by accident.
 */

declare module '@usebruno/converters' {
  export type BrunoItem = {
    name: string;
    type?: string;
    seq?: number;
    request?: {
      url: string;
      method: string;
      docs?: string;
      headers?: { name: string; value: string; enabled: boolean }[];
      params?: {
        name: string;
        value: string;
        enabled: boolean;
        type: 'query' | 'path';
      }[];
      body?: { mode: string; json?: string | null };
    };
    items?: BrunoItem[];
  };

  export function openApiToBruno(spec: unknown): { name: string; items: BrunoItem[] };
}

declare module '@usebruno/lang' {
  export function jsonToBruV2(json: Record<string, unknown>): string;
  export function envJsonToBruV2(json: Record<string, unknown>): string;
}
