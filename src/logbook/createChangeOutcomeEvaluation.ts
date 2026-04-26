import { insertChangeOutcomeEvaluation } from "./db";
import { ChangeOutcomeEvaluationRow } from "./types";
import { parseChangeOutcomeEvaluationInput } from "./validate";

export async function createChangeOutcomeEvaluation(params: {
  accountId: string;
  marketplace: string;
  raw: unknown;
}): Promise<ChangeOutcomeEvaluationRow> {
  const input = parseChangeOutcomeEvaluationInput(params.raw);
  return insertChangeOutcomeEvaluation({
    accountId: params.accountId,
    marketplace: params.marketplace,
    input,
  });
}
