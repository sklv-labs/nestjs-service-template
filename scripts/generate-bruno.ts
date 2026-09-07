import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

import type { BrunoItem } from '@usebruno/converters';
import { openApiToBruno } from '@usebruno/converters';
import { jsonToBruV2 } from '@usebruno/lang';

/**
 * Regenerates the Bruno collection from `openapi.json`.
 *
 * The collection is generated, never hand-edited: the contracts are the source of truth, and every
 * request arrives prefilled with the examples declared on the fields. Anything hand-written lives
 * in `collection.bru` and `environments/`, which this script does not touch — see the README.
 */

const ROOT = resolve(process.cwd(), 'bruno');

/** `Users` → `user`, so a captured id reads as `{{userId}}`. */
const singular = (folder: string): string => {
  const word = folder.replace(/[^A-Za-z]/g, '');
  const base = word.endsWith('s') ? word.slice(0, -1) : word;

  return base.charAt(0).toLowerCase() + base.slice(1);
};

const fileName = (name: string): string =>
  `${name
    .replace(/[^A-Za-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase()}.bru`;

const toBru = (item: BrunoItem, folder: string, seq: number): string => {
  const request = item.request!;
  const idVar = `${singular(folder)}Id`;
  const hasBody = request.body?.mode === 'json' && Boolean(request.body.json);

  // A path id points at the variable the create request captures, so `bru run` exercises a real
  // flow — create, then fetch what was created — instead of three unrelated calls.
  const params = (request.params ?? []).map((p) =>
    p.type === 'path' && p.name === 'id' ? { ...p, value: `{{${idVar}}}` } : p,
  );

  // Conversely, a create whose response carries an id publishes it for later requests.
  const capturesId = request.method.toUpperCase() === 'POST';

  return jsonToBruV2({
    meta: { name: item.name, type: 'http', seq },
    http: {
      method: request.method.toLowerCase(),
      url: request.url,
      body: hasBody ? 'json' : 'none',
      auth: 'inherit',
    },
    ...(params.length ? { params } : {}),
    ...(request.headers?.length ? { headers: request.headers } : {}),
    ...(hasBody ? { body: { mode: 'json', json: request.body!.json } } : {}),
    ...(capturesId
      ? { vars: { res: [{ name: idVar, value: 'res.body.id', enabled: true }] } }
      : {}),
    ...(request.docs ? { docs: request.docs } : {}),
  });
};

const spec: unknown = JSON.parse(readFileSync(resolve(process.cwd(), 'openapi.json'), 'utf8'));
const collection = openApiToBruno(spec);

let written = 0;

for (const folder of collection.items) {
  if (!folder.items?.length) {
    continue;
  }

  const dir = resolve(ROOT, folder.name);

  // Regenerated wholesale, so a renamed or deleted endpoint cannot leave a stale request behind.
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });

  folder.items.forEach((item, index) => {
    if (!item.request) {
      return;
    }

    writeFileSync(resolve(dir, fileName(item.name)), toBru(item, folder.name, index + 1));
    written += 1;
  });
}

process.stdout.write(`bruno collection regenerated (${written} requests)\n`);
