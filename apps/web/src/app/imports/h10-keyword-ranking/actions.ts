'use server';

import { revalidatePath } from 'next/cache';

import {
  importH10KeywordRankingUpload,
} from '@/lib/imports/h10KeywordRankingUpload';
import {
  INITIAL_H10_KEYWORD_RANKING_UPLOAD_STATE,
  type H10KeywordRankingUploadState,
} from '@/lib/imports/h10KeywordRankingUploadShared';

export async function uploadH10KeywordRankingAction(
  _prevState: H10KeywordRankingUploadState,
  formData: FormData
): Promise<H10KeywordRankingUploadState> {
  const file = formData.get('file');
  if (!(file instanceof File) || file.size === 0) {
    return {
      ...INITIAL_H10_KEYWORD_RANKING_UPLOAD_STATE,
      tone: 'error',
      message: 'Select a Helium 10 Keyword Tracker CSV before uploading.',
    };
  }

  const result = await importH10KeywordRankingUpload(file);
  if (result.ok) {
    revalidatePath('/imports/h10-keyword-ranking');
    revalidatePath('/imports-health');
  }
  return result;
}
