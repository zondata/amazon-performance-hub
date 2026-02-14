import { insertLogExperiment } from "./db";
import { LogExperimentRow } from "./types";
import { parseExperimentInput } from "./validate";

export async function createExperiment(params: {
  accountId: string;
  marketplace: string;
  raw: unknown;
}): Promise<LogExperimentRow> {
  const input = parseExperimentInput(params.raw);
  return insertLogExperiment({
    accountId: params.accountId,
    marketplace: params.marketplace,
    input,
  });
}
