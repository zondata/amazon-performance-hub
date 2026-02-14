import { insertLogChange, insertLogChangeEntities } from "./db";
import { LogChangeRow } from "./types";
import { parseChangeInput } from "./validate";

export async function createChange(params: {
  accountId: string;
  marketplace: string;
  raw: unknown;
}): Promise<LogChangeRow> {
  const input = parseChangeInput(params.raw);
  const change = await insertLogChange({
    accountId: params.accountId,
    marketplace: params.marketplace,
    input,
  });

  await insertLogChangeEntities({
    changeId: change.change_id,
    entities: input.entities,
  });

  return change;
}
