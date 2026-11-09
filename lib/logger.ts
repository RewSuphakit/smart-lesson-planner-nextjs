/**
 * Minimal logger wrapper.
 *
 * - `debug` / `info` are suppressed in production.
 * - `warn` / `error` are always emitted.
 *
 * NEVER pass secrets, tokens, passwords or full request bodies to the logger.
 */

const isProduction = () => process.env.NODE_ENV === 'production';

export const logger = {
  debug(...args: unknown[]): void {
    if (!isProduction()) console.log(...args);
  },
  info(...args: unknown[]): void {
    if (!isProduction()) console.info(...args);
  },
  warn(...args: unknown[]): void {
    console.warn(...args);
  },
  error(...args: unknown[]): void {
    console.error(...args);
  },
};

export default logger;
