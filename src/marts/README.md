# `src/marts`

Stage 4 canonical mart boundary for V2 read models.

Implemented marts:

- `productOverviewMart.ts` builds deterministic product overview rows from the
  FT-02 SP-API retail truth surface plus the verified SP advertised-product
  Ads-backed latest source.

Mart code should stay read-only and deterministic. Do not add ingestion,
writeback, scheduler, or UI behavior here.
