/** Base of the engine's errors: `code` is stable for callers and translations, the message is English. */
export class EngineError<Code extends string> extends Error {
  readonly code: Code;
  constructor(code: Code, message: string) {
    super(`${code}: ${message}`);
    this.name = new.target.name;
    this.code = code;
  }
}
