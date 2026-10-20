# Deploy OneDirectBuy flow control (UI + backend)

| Role | URL |
|------|-----|
| **UI** | https://onetest.onechanneladmin.com |
| **Backend / API** | https://dev-onetest.onechanneladmin.com |

Both hosts hit the same GKE Deployment (`onetest`) — Express serves UI + `/api` + `/health`.

Image: `gcr.io/gentle-epoch-277301/onetest:latest`  
Cluster service: `onetest` (NEG on port 80 → container 8080)

## CI/CD (Cloud Build)

Single GKE Deployment (`onetest`) — UI + API share one pod. Deploy via `cicd-prod` only.

| Trigger | Branch | Config |
|---------|--------|--------|
| `onetest-prod` | `cicd-prod` | `cloudbuild.yaml` |

Push to `cicd-prod` → build `gcr.io/gentle-epoch-277301/onetest` → `kubectl rollout restart deployment/onetest`.

## 1. Build image (manual)

```bash
cd D:\TestingOnedirectbuy
gcloud builds submit --config=cloudbuild.yaml --project=gentle-epoch-277301 .
```

## 2. Create / update secret

```bash
kubectl create secret generic onetest-env \
  --from-literal=MONGODB_URI='mongodb+srv://USER:PASS@cluster.mongodb.net/' \
  --from-literal=MONGODB_DB='onedirectbuy-tests' \
  --from-literal=API_TOKEN='your-shared-token' \
  --from-literal=PUBLIC_UI_URL='https://onetest.onechanneladmin.com' \
  --from-literal=PUBLIC_API_URL='https://dev-onetest.onechanneladmin.com' \
  --from-literal=ONEDIRECTBUY_BASE_URL='https://dev.onedirectbuy.com' \
  --from-literal=ONEDIRECTBUY_BUYER_EMAIL='...' \
  --from-literal=ONEDIRECTBUY_BUYER_PASSWORD='...' \
  --from-literal=ONEDIRECTBUY_ADMIN_EMAIL='...' \
  --from-literal=ONEDIRECTBUY_ADMIN_PASSWORD='...' \
  --from-literal=ONEDIRECTBUY_SELLER_EMAIL='...' \
  --from-literal=ONEDIRECTBUY_SELLER_PASSWORD='...' \
  --dry-run=client -o yaml | kubectl apply -f -
```

`API_TOKEN` is required: without it every `/api` route answers 503 (only `/health` and
`GET /api/health` stay open). Clients send it as `Authorization: Bearer <token>` or
`x-api-token`; `?token=` is not accepted. Add `CORS_ORIGINS` (comma-separated) only if
another origin must call the API. Runs target dev by default; pointing
`ONEDIRECTBUY_BASE_URL` at production is refused unless `ALLOW_PROD=1`, which limits the
run to `ci-tests.config.json → productionReadOnly`.

In-pod Playwright still uses `STATUS_API_URL=http://127.0.0.1:8080` (set in the Deployment). External clients / docs use **`https://dev-onetest.onechanneladmin.com`**.

## 3. Apply Kubernetes Deployment

```bash
kubectl apply -f D:\onechanneladmin-latest\deploymentsAll\ui\deployment-onetest.yaml
kubectl rollout status deployment/onetest
```

## 4. Wire load balancer (after NEG exists)

```bash
gcloud compute network-endpoint-groups list \
  --project=gentle-epoch-277301 \
  --filter="name~onetest" \
  --format="table(name,zone)"
```

Put that `neg_id` into `infra/loadbalancer/terraform.tfvars` under `onetest`, then:

```bash
cd D:\onechanneladmin-latest\infra\loadbalancer
terraform plan
terraform apply
```

`lb-routing.yaml` routes both hosts → `gke-onetest`.  
SSL is covered by the existing `*.onechanneladmin.com` Cloudflare Origin CA wildcard.

## 5. DNS (Cloudflare zone `onechanneladmin.com`)

| Type | Name | Content | Proxy |
|------|------|---------|-------|
| A | onetest | `136.110.171.72` | Proxied or DNS-only |
| A | dev-onetest | `136.110.171.72` | Proxied or DNS-only |

Confirm LB IP:

```bash
gcloud compute addresses describe manual-vm-ip --global --project=gentle-epoch-277301 --format="value(address)"
```

## 6. Verify

```bash
curl -sS https://onetest.onechanneladmin.com/health
curl -sS https://dev-onetest.onechanneladmin.com/health
curl -sS https://dev-onetest.onechanneladmin.com/api/flows
# {"ok":true,"service":"onedirectbuy-flow-control"} on /health
```

Open https://onetest.onechanneladmin.com/ for the Flow Control UI.  
API base: https://dev-onetest.onechanneladmin.com/api/
