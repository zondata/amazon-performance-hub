export type H10KeywordRankingUploadState = {
  ok: boolean;
  tone: 'success' | 'warning' | 'error' | null;
  message: string | null;
  summary: string | null;
  fileName: string | null;
  asin: string | null;
  rowCount: number | null;
  warningCount: number | null;
  coverageStart: string | null;
  coverageEnd: string | null;
  uploadId: string | null;
};

export const INITIAL_H10_KEYWORD_RANKING_UPLOAD_STATE: H10KeywordRankingUploadState = {
  ok: false,
  tone: null,
  message: null,
  summary: null,
  fileName: null,
  asin: null,
  rowCount: null,
  warningCount: null,
  coverageStart: null,
  coverageEnd: null,
  uploadId: null,
};
