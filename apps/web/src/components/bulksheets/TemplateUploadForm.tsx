'use client';

import { useActionState } from 'react';

import { uploadBulkgenTemplate } from '@/app/bulksheet-ops/templates/actions';
import type { TemplateKey } from '@/lib/bulksheets/templateStore';

type UploadState = {
  ok: boolean | null;
  message: string | null;
};

const INITIAL_STATE: UploadState = {
  ok: null,
  message: null,
};

export default function TemplateUploadForm(props: {
  templateKey: TemplateKey;
  label: string;
  uploadTarget: string;
}) {
  const [state, formAction, isPending] = useActionState(
    async (_prevState: UploadState, formData: FormData): Promise<UploadState> => {
      const result = await uploadBulkgenTemplate(props.templateKey, formData);
      return {
        ok: result.ok,
        message: result.message ?? null,
      };
    },
    INITIAL_STATE
  );

  return (
    <form action={formAction} className="mt-4 space-y-3">
      <input
        name="file"
        type="file"
        accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
        required
      />
      <button
        type="submit"
        disabled={isPending}
        className="w-full rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isPending ? 'Uploading...' : `Upload ${props.label}`}
      </button>
      <div className="text-xs text-slate-500">
        Upload target: <code>{props.uploadTarget}</code>
      </div>
      {state.message ? (
        <div
          className={`rounded-lg border p-2 text-xs ${
            state.ok
              ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
              : 'border-rose-200 bg-rose-50 text-rose-700'
          }`}
        >
          {state.message}
        </div>
      ) : null}
    </form>
  );
}
