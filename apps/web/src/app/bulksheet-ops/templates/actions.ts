'use server';

import { revalidatePath } from 'next/cache';

import {
  getTemplateObjectInfo,
  type TemplateKey,
  uploadTemplate,
} from '@/lib/bulksheets/templateStore';

export type UploadBulkgenTemplateResult = {
  ok: boolean;
  message?: string;
};

export async function uploadBulkgenTemplate(
  templateKey: TemplateKey,
  formData: FormData
): Promise<UploadBulkgenTemplateResult> {
  const info = getTemplateObjectInfo(templateKey);
  const file = formData.get('file');
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, message: 'Please choose a template .xlsx file before uploading.' };
  }

  if (!file.name.toLowerCase().endsWith('.xlsx')) {
    return { ok: false, message: 'Only .xlsx files are supported.' };
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const uploaded = await uploadTemplate(templateKey, buffer);
    revalidatePath('/bulksheet-ops/templates');
    return {
      ok: true,
      message: `Uploaded to ${uploaded.bucket}/${uploaded.objectPath}`,
    };
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : `Failed to upload template to ${info.bucket}/${info.objectPath}.`;
    return { ok: false, message };
  }
}
