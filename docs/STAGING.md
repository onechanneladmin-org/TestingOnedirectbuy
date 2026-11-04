# Staging: URLs and how to use it

One reference for every staging environment. The same file is in each repo (Onedirectbuy, oneautobulkreport, onechanneladmin-latest, oneauto BFF, TestingOnedirectbuy). The Onedirectbuy copy is the master; update it there first. Last updated 2026-11-04.

## What staging is
- GKE namespace `staging` in project `gentle-epoch-277301`, on the same cluster as production.
- Pods are at 0 by default. Starting it scales each Deployment to its `staging.onechanneladmin.com/default-replicas`. It stops by itself after 60 min without use (CronJob `staging-autostop`).
- Staging pods run at priority `staging-low`: they never evict production and never add a node. When the cluster is full they stay Pending.
- **Data:** the shared ExtraProjects Mongo cluster only. A startup guard (`deploymentsAll/staging/guard/staging-guard.js`) refuses the production Mongo host and live Stripe keys.
- **Secrets:** GSM bundles `oneauto_staging` and `onedirectbuy_staging`.
- **What's off:** BigQuery; email, kitchen push, social and 3PL jobs; heavy lanes.
- **Indexing:** public, with no Cloudflare Access, but noindex header + `robots: Disallow`.

## URLs

### 1CA (OneChannelAdmin)
| What | Staging | Production |
|---|---|---|
| Admin v1 | https://staging-admin.onechanneladmin.com | https://admin.onechanneladmin.com |
| Admin v2 | https://staging-admin.onechanneladmin.com/v2 | https://admin.onechanneladmin.com/v2 |
| API (inventory) | https://staging-api.onechanneladmin.com | https://backend.onechanneladmin.com |
| API (marketplace) | https://staging-api.onechanneladmin.com/marketplace | https://backend.onechanneladmin.com/marketplace |
| API (queueworkload) | https://staging-api.onechanneladmin.com/queueworkload | (internal) |
| Storefront BFF (`oneautobackend`) | no public host: cluster-internal only (`kubectl -n staging port-forward deploy/oneautobackend 18081:80`) | client sites (e.g. nexustruckupgrades.com) |

Note: the production public API origin is **backend.onechanneladmin.com**. `api.onechanneladmin.com` has no DNS record.

### ODB (OneDirectBuy)
| What | Staging | Production |
|---|---|---|
| Storefront | https://staging.onedirectbuy.com (worker `onedirectbuy-storefront-staging`) | https://onedirectbuy.com |
| Admin / seller UI | https://staging-admin.onedirectbuy.com | https://admin.onedirectbuy.com |
| API | https://staging-api.onedirectbuy.com | https://api.onedirectbuy.com |
| marketplace-core | https://staging-api.onedirectbuy.com/marketplace-core | https://api.onedirectbuy.com/marketplace-core |

### Zuka (ZukaOngo)
**Live since 2026-11-04.** Started and smoke-tested by the 1CA session (API, DB, the four web hosts, customer browsing).

| What | Staging | Production |
|---|---|---|
| Customer web | https://staging.zukaongo.com | https://zukaongo.com |
| API | https://staging-api.zukaongo.com (GKE `staging/zuka-api`) | https://api.zukaongo.com |
| Restaurant partners | https://staging-partners.zukaongo.com | https://partners.zukaongo.com |
| Drivers app | https://staging-drivers.zukaongo.com | https://drivers.zukaongo.com |
| Zuka admin | https://staging-admin.zukaongo.com | https://admin.zukaongo.com |

- DB `zuka_staging` (copy of live taken 2026-11-04), test payments only, payouts off. The site shows a STAGING banner.
- Emails / texts / pushes go only to the allowlist (k8s secret `staging/zuka-staging-notify`, key `allowlist`). Ask the 1CA session to add a tester.
- Same Firebase project as live: testers use their normal test logins.
- The 1CA link points at 1CA staging and is OFF in the staging DB; turn it on in staging-admin → Settings → Integrations only to test Connect Zuka on staging.
- Orders and E2E for Zuka run on staging only.

## Start and stop
- **Superadmin:** https://admin.onechanneladmin.com/v2/superadmin/staging (Start / Stop / status). Two switches: **core** (1CA + ODB) and **Zuka**.
- **Testers (live 2026-11-04):**
  - The `staging:start` permission on a role in the oneauto or platform org lets a tester press Start with their own login.
  - Or a superadmin creates a time-limited start link with a QR code (1 h, 8 h, 24 h or 7 d, revocable) at /v2/superadmin/staging; the public page is /v2/s/staging. It can start core, Zuka or both, and can only start staging.
- **Auto-stop:** each group goes back to 0 pods after 60 min without use. A 503 "unconditional drop overload" on a staging host means it is stopped: start it again.
- **CLI** (onechanneladmin-latest `deploymentsAll/staging/`):
  - `./staging-up.sh [core|zuka|all]` (default core; `--check` for capacity only)
  - `./staging-status.sh`
  - `./staging-down.sh [core|zuka|all]` (default core)
  - Run them with `/bin/sh`; zsh doesn't split `K="kubectl -n staging"`.
- **Low memory:** if staging won't start, scale the pods you don't need to 0 (`onechannel-queueworkload`, `onechannel-marketplace`) and start only the services under test.

## Deploying to staging
- Push the exact SHA to `cicd-dev` in a repo. That builds a `dev-<sha>` image and sets the staging Deployment.
- When it passes, run the repo's `promote-to-prod.yml` with that SHA. It ships the same image digest to prod and fast-forwards `cicd-prod`.
- Pushing `cicd-prod` directly also works (it builds again).
- If the cicd-dev "Build + deploy to staging" step fails only with `exceeded its progress deadline` (usually queueworkload), the cluster is out of memory. The image was still built and set; start only the pods you need.

## Testing repo (TestingOnedirectbuy)
- **Default target is staging.** A target guard refuses live hosts unless `ALLOW_PROD_READONLY=1`, and then only read-only specs run.
- **ODB:** `ONEDIRECTBUY_BASE_URL` and `ONEDIRECTBUY_API_URL` must point at the same environment. Order placing needs `ODB_ALLOW_ORDERS=1` and Stripe test mode.
- **1CA:**
  - `PLAYWRIGHT_BASE_URL` and `E2E_BASE_URL` both point at staging-admin.
  - `E2E_ORG_ID` is the test org; Nexus is refused.
- **OneProductHub:** defaults to localhost (there is no OPH staging).
- **Zuka:** being moved to Zuka staging. Order E2E is for staging only.

## Related
- Runbook: Onedirectbuy `docs/plans/staging-environment-2026-10-23.md`
- Manifests and scripts: onechanneladmin-latest `deploymentsAll/staging/`; load balancer `infra/loadbalancer` (`staging-gateway`)
- Handoff and open items: Onedirectbuy `docs/PENDING.md`
