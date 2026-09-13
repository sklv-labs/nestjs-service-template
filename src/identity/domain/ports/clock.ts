/**
 * Time as a dependency.
 *
 * Entities never read the clock — `now` is an argument — so this exists for the handlers that
 * supply it. A test sets it; production reads the system.
 */
export abstract class Clock {
  abstract now(): Date;
}
