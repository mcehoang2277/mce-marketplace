# Performance Report — Initial

**Measurement status:** Not measured. No local runtime or production telemetry was available during this review.

## Current architecture risks

- PostgreSQL is the authoritative store; Prisma connection pool sizing and deployment connection limits need explicit configuration.
- Public job discovery returns a bounded 50 jobs, but lacks a cursor pagination contract and query-plan evidence.
- Some admin dispute/payment listing paths need consistent pagination and bounded payloads.
- Matching currently calculates per-candidate scores in application code and may fall back to a default distance when worker coordinates are absent; relevance and fairness need product validation.
- Redis is included in Compose without a current consumer; it is now an optional profile on the engineering branch.
- No baseline exists for bundle size, first contentful paint, API p50/p95, DB query latency, memory, CPU or concurrent webhook throughput.

## Optimization sequence

1. Add request ID, structured logs and API latency/error metrics.
2. Measure slow queries and use EXPLAIN ANALYZE with representative synthetic data.
3. Add composite indexes only after query plans identify a need.
4. Introduce cursor pagination for high-volume feeds.
5. Configure DB pool limits and connection reuse for the actual hosting platform.
6. Cache public discovery only if database load justifies it; never cache balances, authorization or payment state.
7. Add transactional outbox for notifications.
8. Load-test concurrent application, payment webhook and settlement operations.
9. Measure mobile startup, screen rendering and network payloads on representative Android/iOS devices.

## Proposed pilot SLOs (not yet measured)

- API availability: ≥ 99.5% during pilot.
- Normal API p95: < 500 ms, excluding third-party provider callback time.
- Webhook acknowledgement: p95 < 1 s after signature and payload validation, with durable event recording.
- No duplicate ledger posting under replay or concurrency.
- Recovery point and recovery time objectives must be approved by the owner and demonstrated by restore drill.

Do not claim performance improvements until before/after measurements are attached.
