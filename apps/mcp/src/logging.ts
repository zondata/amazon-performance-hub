export type Logger = Pick<Console, "info" | "warn" | "error">;

export const defaultLogger: Logger = console;
