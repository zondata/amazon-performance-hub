export type SaveSpDraftActionState = {
  ok: boolean;
  error: string | null;
  message: string | null;
  changeSetId: string | null;
  changeSetName: string | null;
  queueCount: number;
  createdItemCount: number;
  createdPreset: { id: string; name: string } | null;
};

export const INITIAL_SAVE_SP_DRAFT_ACTION_STATE: SaveSpDraftActionState = {
  ok: false,
  error: null,
  message: null,
  changeSetId: null,
  changeSetName: null,
  queueCount: 0,
  createdItemCount: 0,
  createdPreset: null,
};
