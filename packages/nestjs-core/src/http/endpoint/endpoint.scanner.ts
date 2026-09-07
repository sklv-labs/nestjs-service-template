import type { OnApplicationBootstrap } from '@nestjs/common';
import { Injectable } from '@nestjs/common';
import { DiscoveryService, MetadataScanner, Reflector } from '@nestjs/core';

import { declaredBusinessErrors } from '../../errors';
import type { Logger } from '../../logger';
import { InjectLogger } from '../../logger';

import { mapErrorContract, mappedErrorCodes } from '../errors';

import { ENDPOINT_METADATA } from './endpoint.constants';
import type { DocumentedEndpoint } from './endpoint.types';

/**
 * Builds the error code → HTTP status map at startup by walking every mounted controller method
 * and reading the endpoint each one declares.
 *
 * This replaces registration as an import side effect. The mapping now comes from what is actually
 * routed, in one deterministic pass, and it can be inspected and reset — none of which was true of
 * a module-level map mutated at import time.
 *
 * It also reports business errors the domain can raise that no endpoint documents. Those return a
 * 500 at runtime with a warning, which is the failure this check exists to surface before a user
 * finds it. It warns rather than throws because an error raised only by a queue consumer or an RMQ
 * handler legitimately has no HTTP status.
 */
@Injectable()
export class EndpointScanner implements OnApplicationBootstrap {
  @InjectLogger() private readonly logger: Logger;

  constructor(
    private readonly discovery: DiscoveryService,
    private readonly scanner: MetadataScanner,
    private readonly reflector: Reflector,
  ) {}

  onApplicationBootstrap(): void {
    let endpoints = 0;

    for (const wrapper of this.discovery.getControllers()) {
      const instance = wrapper.instance as Record<string, unknown> | undefined;

      if (!instance) {
        continue;
      }

      for (const method of this.scanner.getAllMethodNames(Object.getPrototypeOf(instance))) {
        const endpoint = this.reflector.get<DocumentedEndpoint | undefined>(
          ENDPOINT_METADATA,
          instance[method] as () => unknown,
        );

        if (!endpoint) {
          continue;
        }

        endpoints += 1;

        for (const response of endpoint.errors ?? []) {
          if (response.errorCode && response.schema) {
            mapErrorContract(response.errorCode, {
              status: response.status,
              schema: response.schema,
            });
          }
        }
      }
    }

    const mapped = new Set(mappedErrorCodes());
    const unmapped = declaredBusinessErrors().filter((code) => !mapped.has(code));

    this.logger.debug(
      { endpoints, mappedErrorCodes: mapped.size },
      'Endpoint contracts registered',
    );

    if (unmapped.length > 0) {
      this.logger.warn(
        { unmapped },
        `${unmapped.length} business error(s) have no HTTP status; they will return 500 if raised over HTTP`,
      );
    }
  }
}
