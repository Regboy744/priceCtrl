# PriceCtrl — Production Deploy Runbook

**The plan:** everything is a Docker image. Server runs only Docker containers.
Caddy handles TLS + routing automatically. No pnpm, no Node, no nginx install
on the server.

Domain: **pricectrl.com**
Docker Hub: **regboy**
VPS: Hetzner CCX23 (4 vCPU / 16 GB)

---

## One-time setup

### A. On your laptop

1. **Login to Docker Hub**

   ```bash
   docker login -u regboy
   ```

2. **Build + push all three images** (from the monorepo root)

   ```bash
   cd /home/regboy/coding/priceCtrl

   # Backend
   docker build \
     -f apps/backend/Dockerfile \
     -t regboy/pricectrl-backend:latest .
   docker push regboy/pricectrl-backend:latest

   # Price-mgmt
   docker build \
     -f apps/price-mgmt/Dockerfile \
     -t regboy/pricectrl-price-mgmt:latest .
   docker push regboy/pricectrl-price-mgmt:latest

   # Frontend — ALL VITE_* vars are baked in at build time.
   # Vite is a build-time bundler: vars are inlined into the JS bundle during
   # `pnpm build`, not read from .env at runtime. Rebuild + push whenever any
   # of these change.
   docker build \
     --build-arg VITE_API_URL=https://pricectrl.com/api/v1 \
     --build-arg VITE_SUPABASE_URL=https://uljnnybgvsxvzafunpri.supabase.co \
     --build-arg VITE_SUPABASE_KEY=<anon key from apps/frontend/.env> \
     --build-arg VITE_SB_PUBLISHABLE_KEY=<publishable key from apps/frontend/.env> \
     -f apps/frontend/Dockerfile \
     -t regboy/pricectrl-frontend:latest .
   docker push regboy/pricectrl-frontend:latest
   ```

   > **Why baked, not .env?** Once built, the frontend is static JS served by
   > nginx. There's no Node process reading env vars at container start — the
   > values must be inlined during `vite build`. The Supabase anon key + API
   > URL are already public (they ship in every browser), so baking them is
   > safe.

   First build: ~8–12 min total (Chromium + pnpm install). Subsequent builds
   with layer cache: ~1–2 min.

### B. On the VPS

Only needed once. Assumes you've already done steps 1–5 of the server-setup
runbook (provision CCX23, create `deploy` user, install Docker, configure
firewall).

1. **Set up working directory**

   ```bash
   ssh deploy@YOUR_SERVER_IP
   mkdir -p ~/pricectrl/outputs && cd ~/pricectrl
   ```

2. **Copy three files from the repo onto the server** (run from laptop)

   ```bash
   # From laptop
   cd /home/regboy/coding/priceCtrl
   scp docker-compose.prod.yml deploy@YOUR_SERVER_IP:~/pricectrl/docker-compose.yml
   scp deploy/Caddyfile         deploy@YOUR_SERVER_IP:~/pricectrl/Caddyfile
   ```

3. **Create env files on the server** — paste real values from your local
   `.env` files. Two important adjustments for prod:

   - `CURL_IMPERSONATE_PATH=/usr/local/bin/curl_chrome131` (container path)
   - `ALLOWED_ORIGINS=https://pricectrl.com,https://www.pricectrl.com`

   ```bash
   # On server
   nano ~/pricectrl/backend.env
   nano ~/pricectrl/price-mgmt.env
   chmod 600 ~/pricectrl/*.env
   ```

4. **Point DNS at the server** (at your domain registrar)

   Both apex AND `www` records are required — Caddy redirects `www` → apex,
   but only if `www` resolves to the VPS in the first place.

   ```
   A     pricectrl.com       YOUR_SERVER_IPV4
   AAAA  pricectrl.com       YOUR_SERVER_IPV6
   A     www.pricectrl.com   YOUR_SERVER_IPV4
   AAAA  www.pricectrl.com   YOUR_SERVER_IPV6
   ```

   Verify before continuing (both must return the VPS IP, not old host like
   Netlify):
   ```bash
   dig +short pricectrl.com
   dig +short www.pricectrl.com
   ```

   If a previous host (Netlify, Vercel, etc.) served this domain, also delete
   its old A/AAAA/CNAME records to avoid DNS ping-pong during propagation.

5. **Login to Docker Hub on the server** (only needed if any image is private;
   public images pull anonymously)

   ```bash
   docker login -u regboy
   ```

6. **Start everything**

   ```bash
   cd ~/pricectrl
   docker compose pull
   docker compose up -d
   docker compose ps
   ```

   Caddy fetches the Let's Encrypt cert on first start (~20 seconds). Watch:
   ```bash
   docker compose logs -f caddy
   ```
   Look for `certificate obtained successfully`.

7. **Verify**

   From your laptop:
   ```bash
   curl -I https://pricectrl.com/
   curl https://pricectrl.com/health/live
   curl -I https://www.pricectrl.com/        # should 301 → pricectrl.com
   ```

   Then open `https://pricectrl.com` in a browser and log in.

---

## Re-deploying (future updates)

**Laptop** — rebuild + push whichever images changed, e.g.:
```bash
docker build -f apps/backend/Dockerfile -t regboy/pricectrl-backend:latest .
docker push regboy/pricectrl-backend:latest
```

**Server** — one command:
```bash
ssh deploy@YOUR_SERVER_IP 'cd ~/pricectrl && docker compose pull && docker compose up -d'
```

---

## Versioning (recommended)

`:latest` is convenient but makes rollbacks hard. When you want safety:

```bash
VERSION=$(git rev-parse --short HEAD)
docker build -f apps/backend/Dockerfile \
  -t regboy/pricectrl-backend:$VERSION \
  -t regboy/pricectrl-backend:latest .
docker push regboy/pricectrl-backend:$VERSION
docker push regboy/pricectrl-backend:latest
```

Rollback = edit `docker-compose.yml` on the server to pin `:SHA` of the last
known good build, then `docker compose up -d`.

---

## Troubleshooting

| Symptom | Check |
|---|---|
| `docker compose pull` says unauthorized | `docker login -u regboy` on the server |
| `docker compose up` fails with "port 80 already allocated" | Another service (often `nginx`) is using port 80. `sudo systemctl stop nginx && sudo systemctl disable nginx`, then retry. |
| Caddy stuck "retrying" cert, logs show `lookup ... on 127.0.0.53:53: connection refused` | Ubuntu systemd-resolved stub is leaking into the container. Ensure `caddy:` service in compose has `dns: [1.1.1.1, 8.8.8.8]` and run `docker compose up -d --force-recreate caddy`. Verify with `docker exec pricectrl-caddy cat /etc/resolv.conf` — should mention ExtServers `1.1.1.1 8.8.8.8`. |
| Caddy cert still fails after DNS fix | `dig +short pricectrl.com` must return the Hetzner VPS IP. If it returns an old host (e.g. Netlify), update A records at registrar and wait for propagation. |
| Browser shows blank page, console: `supabaseUrl is required` | Frontend was built without `VITE_SUPABASE_URL` baked in. Rebuild with all `--build-arg VITE_*` flags, push, `docker compose pull frontend && docker compose up -d frontend`. |
| `502 Bad Gateway` | `docker compose logs backend` — usually env var missing |
| Backend exits immediately | `CURL_IMPERSONATE_PATH` wrong — must be `/usr/local/bin/curl_chrome131` inside the container |
| Frontend loads but API calls fail | Check `VITE_API_URL` was baked with `https://pricectrl.com/api/v1` |
| CORS errors in browser console | `ALLOWED_ORIGINS` in backend.env must include `https://pricectrl.com` |
| `www.pricectrl.com` doesn't resolve | Missing `www` A/AAAA record at registrar. Caddy only redirects `www` → apex if `www` reaches it first. |

View any service's logs:
```bash
docker compose logs -f backend
docker compose logs -f caddy
docker compose logs -f frontend
docker compose logs -f price-mgmt
```

---

## Scale up later

Hetzner console → Server → Rescale → CCX33 (8/32) or CCX43 (16/64) → reboot.
Two minutes downtime, no config change.

---

## Deploy history

A running log of what was deployed and any issues hit during the bring-up.
Append new entries at the top.

### 2026-04-19 — initial production bring-up

**Server:** Hetzner CCX23 `ubuntu-8gb-fsn1-1`, IPv4 `46.224.162.19`,
IPv6 `2a01:4f8:c013:b880::/64`. Region Falkenstein.

**Images pushed (laptop → Docker Hub):**
- `regboy/pricectrl-backend:latest`
- `regboy/pricectrl-price-mgmt:latest`
- `regboy/pricectrl-frontend:latest` (rebuilt with full `VITE_*` build args)

**Issues hit and fixes:**
1. Host `nginx` was running on port 80, blocking Caddy.
   → `sudo systemctl stop nginx && sudo systemctl disable nginx`.
2. Caddy could not fetch Let's Encrypt cert — DNS lookups inside the
   container failed with `lookup ... on 127.0.0.53:53: connection refused`
   (systemd-resolved stub leaking in).
   → Added `dns: [1.1.1.1, 8.8.8.8]` to the `caddy:` service in
   `docker-compose.yml`, then `docker compose up -d --force-recreate caddy`.
   Cert obtained ~20s later.
3. DNS A records still pointed at old Netlify host.
   → Updated A/AAAA at registrar to VPS IPs. Verified with
   `dig +short pricectrl.com` returning `46.224.162.19`.
4. Browser showed blank page; console `Uncaught Error: supabaseUrl is required`.
   → Frontend Dockerfile only accepted `VITE_API_URL` as build-arg. Added
   `VITE_SUPABASE_URL`, `VITE_SUPABASE_KEY`, `VITE_SB_PUBLISHABLE_KEY` as
   additional `ARG`/`ENV` entries. Rebuilt + pushed + pulled on server.
5. `www.pricectrl.com` still does not resolve — need to add the `www` A/AAAA
   record at the registrar (apex alone is not enough).
