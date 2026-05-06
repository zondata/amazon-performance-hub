export type RankKind = "exact" | "gte" | "missing";

export type Helium10KeywordTrackerRow = {
  marketplace_domain_raw: string | null;
  asin: string;
  title: string | null;
  keyword_raw: string;
  keyword_norm: string;
  keyword_sales: number | null;
  search_volume: number | null;
  organic_rank_raw: string | null;
  organic_rank_value: number | null;
  organic_rank_kind: RankKind;
  sponsored_pos_raw: string | null;
  sponsored_pos_value: number | null;
  sponsored_pos_kind: RankKind;
  observed_at: string;
  observed_date: string;
};

export type Helium10KeywordTrackerParseResult = {
  rows: Helium10KeywordTrackerRow[];
  coverageStart: string | null;
  coverageEnd: string | null;
  asin: string;
  marketplace_domain_raw: string | null;
};

export function parseHelium10KeywordTracker(
  input: string
): Helium10KeywordTrackerParseResult;
