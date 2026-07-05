# Observability & Alerting

## Structured logging

Set `LOG_FORMAT=json` to emit one JSON object per log line (great for Loki,
Datadog, CloudWatch, etc.):

```json
{"ts":"2026-01-01T00:00:00.000Z","level":"log","context":"HTTP","msg":"POST /v1/payouts 200 42ms req_id=..."}
```

Leave `LOG_FORMAT` unset for compact human-readable logs. `LOG_LEVEL` controls
verbosity: `error | warn | log | debug | verbose` (default `log`).

## Request IDs

Every request gets an `X-Request-Id` (honoring an incoming one if present). It
is echoed on the response and attached to each request's log line as
`req_id=...`, so you can trace a single request end to end.

## Metrics

`GET /v1/metrics` exposes Prometheus text format. If `METRICS_PUBLIC` is unset,
local development is public by default. The provided `.env.example` sets
`METRICS_PUBLIC=false`, which requires a token and matches the production-safe
default. In production, metrics require a token unless `METRICS_PUBLIC=true` is
set explicitly:

```bash
curl http://localhost:3333/v1/metrics \
  -H "Authorization: Bearer $METRICS_TOKEN"
```

```
phosop_http_requests_total 128
phosop_http_errors_total 3
phosop_payouts_paid_total 40
phosop_payouts_failed_total 1
phosop_payouts_pending_total 2
phosop_usdc_balance_devnet 1000
```

Metrics are **per-instance** (in-process). For multi-instance deployments,
scrape each instance or push to a real Prometheus/OpenTelemetry pipeline.

## Alerting

Alerts always hit the logs. To also forward them to Slack (or a Slack-compatible
incoming webhook such as Mattermost), set these env vars:

```
SLACK_WEBHOOK_URL=<your-slack-incoming-webhook-url>
ALERT_MIN_INTERVAL_SECONDS=300   # de-dupe window per alert key
```

Alerts fire on:

- **Low USDC balance** on the platform wallet (`warning`).
- **Low fee-payer SOL** — payouts may start failing (`critical`).
- **Webhook dead-lettered** after exhausting retries (`warning`).

Alerts are de-duplicated by key within `ALERT_MIN_INTERVAL_SECONDS` so a
recurring condition doesn't spam the channel. Swapping Slack for
PagerDuty/email is a matter of adding another `Notifier` in `alert.service.ts`.
