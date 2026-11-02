/** Account field limits. The web form repeats them, and a web test checks they match. */
export const PASSWORD_MIN_LENGTH = 10;
/** scrypt hashes any length, but an unbounded password would let a request burn CPU. */
export const PASSWORD_MAX_LENGTH = 200;
export const NAME_MAX_LENGTH = 100;
