import { describe, expect, it } from "vitest";

import {
  chooseSpTargetingMaxDateStrategy,
  loadSpTargetingBaselineDateBounds,
} from "../apps/web/src/lib/logbook/aiPack/spTargetingBaselineBounds";

type QueryRecord = {
  table: string;
  selectColumns: string;
  eqs: Array<{ column: string; value: unknown }>;
  ins: Array<{ column: string; values: unknown[] }>;
  gtes: Array<{ column: string; value: unknown }>;
  ltes: Array<{ column: string; value: unknown }>;
  order?: { column: string; ascending: boolean };
  limit?: number;
};

const buildFakeSupabase = () => {
  const records: QueryRecord[] = [];

  const makeQuery = (record: QueryRecord) => {
    const query = {
      eq(column: string, value: unknown) {
        record.eqs.push({ column, value });
        return query;
      },
      in(column: string, values: unknown[]) {
        record.ins.push({ column, values });
        return query;
      },
      gte(column: string, value: unknown) {
        record.gtes.push({ column, value });
        return query;
      },
      lte(column: string, value: unknown) {
        record.ltes.push({ column, value });
        return query;
      },
      order(column: string, options: { ascending: boolean }) {
        record.order = { column, ascending: options.ascending };
        return query;
      },
      async limit(count: number) {
        record.limit = count;
        const date = record.order?.ascending ? "2026-01-01" : "2026-01-31";
        return { data: [{ date }], error: null };
      },
    };

    return query;
  };

  return {
    client: {
      from(table: string) {
        return {
          select(columns: string) {
            const record: QueryRecord = {
              table,
              selectColumns: columns,
              eqs: [],
              ins: [],
              gtes: [],
              ltes: [],
            };
            records.push(record);
            return makeQuery(record);
          },
        };
      },
    },
    records,
  };
};

describe("spTargetingBaselineBounds", () => {
  it("uses advertised-product fallback when campaign IDs are empty", async () => {
    expect(chooseSpTargetingMaxDateStrategy([])).toBe("advertised_fallback");

    const { client, records } = buildFakeSupabase();

    const result = await loadSpTargetingBaselineDateBounds({
      supabase: client,
      accountId: "sourbear",
      campaignIds: [],
      asinNorm: "B0TEST1234",
      startDate: "2026-01-01",
      endDate: "2026-01-31",
    });

    expect(result).toEqual({ minDate: "2026-01-01", maxDate: "2026-01-31" });
    expect(records).toHaveLength(2);
    expect(records.every((record) => record.table === "sp_advertised_product_daily_fact_latest")).toBe(true);
    expect(records.every((record) => record.selectColumns === "date")).toBe(true);
    expect(records.some((record) => record.order?.ascending === false && record.limit === 1)).toBe(true);
    expect(records.every((record) => record.ins.length === 0)).toBe(true);
  });

  it("uses campaign-scoped targeting query and order/limit strategy when campaign IDs are present", async () => {
    expect(chooseSpTargetingMaxDateStrategy([" c2 ", "c1", "c1"])).toBe("targeting");

    const { client, records } = buildFakeSupabase();

    const result = await loadSpTargetingBaselineDateBounds({
      supabase: client,
      accountId: "sourbear",
      campaignIds: [" c2 ", "c1", "c1"],
      asinNorm: "B0TEST1234",
      startDate: "2026-01-01",
      endDate: "2026-01-31",
    });

    expect(result).toEqual({ minDate: "2026-01-01", maxDate: "2026-01-31" });
    expect(records).toHaveLength(2);
    expect(records.every((record) => record.table === "sp_targeting_daily_fact_latest")).toBe(true);

    const maxRecord = records.find((record) => record.order?.ascending === false);
    expect(maxRecord).toBeDefined();
    expect(maxRecord?.selectColumns).toBe("date");
    expect(maxRecord?.selectColumns.includes("max(")).toBe(false);
    expect(maxRecord?.limit).toBe(1);
    expect(maxRecord?.ins).toEqual([{ column: "campaign_id", values: ["c1", "c2"] }]);
  });
});
