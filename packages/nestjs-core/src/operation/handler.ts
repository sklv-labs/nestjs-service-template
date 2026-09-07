/**
 * A handler executes one scenario. It knows nothing about transport: no headers, no status codes,
 * no message envelopes — only an input and an output.
 *
 * That is what lets the same scenario be driven by an HTTP controller, an RMQ consumer and a
 * queue worker without any of them duplicating the orchestration.
 *
 * Input and output are plain types rather than schemas. A handler runs inside the trust boundary:
 * whichever transport invoked it has already parsed its own contract, so re-validating here would
 * cost CPU to re-check what is already known.
 */
export interface Handler<Input, Output> {
  execute(input: Input): Promise<Output>;
}

/** A handler taking no input — a listing with no parameters, a health probe. */
export interface NullaryHandler<Output> {
  execute(): Promise<Output>;
}
