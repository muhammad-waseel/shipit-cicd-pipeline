# ShipIt: Automated CI/CD Deployment Pipeline

A complete **GitHub Actions CI/CD pipeline** that takes every push from code to a verified production deploy, with no manual steps.

The app it ships is **ShipIt**, a small status page that checks whether my live projects ([TaskFlow](https://github.com/muhammad-waseel/taskflow), [ShopO-AI](https://github.com/muhammad-waseel/ShopO-AI) and my [portfolio](https://muhammad-waseel.github.io)) are up.

![CI/CD pipeline](https://github.com/muhammad-waseel/shipit-cicd-pipeline/actions/workflows/pipeline.yml/badge.svg)

**Live demo:** https://shipit-waseel-ih30.onrender.com
*(Hosted on Render's free plan. The first visit after a quiet period can take about 50 seconds.)*

## The pipeline

```
push to main
   │
   ├─► 1. Lint & test ─────────┐   ESLint + Node test runner (18 tests, 100% line coverage)
   ├─► 2. Security scan ───────┤   npm audit + GitHub CodeQL (security-extended)
   │                           ▼
   │                  3. Build & smoke test   Docker image built, started and health-checked
   │                           ▼
   │                  4. Publish              Image pushed to GitHub Container Registry (sha + latest)
   │                           ▼
   │                  5. Deploy               Render deploy triggered by a secret deploy hook
   │                           ▼
   └──────────────────6. Verify               Waits until the live /api/health reports this exact commit,
                                              then runs a production smoke test
```

| Stage | What it does | Fails the build if… |
|---|---|---|
| **Lint & test** | `eslint` and `node --test` with coverage | Any lint error or failing test |
| **Security** | `npm audit --omit=dev --audit-level=high`, and CodeQL code scanning | A high or critical dependency vulnerability, or a CodeQL error |
| **Build** | Multi-stage Docker build (non-root, production dependencies only), container started, `/api/health` and `/` checked | The image fails to build, start or report the right commit |
| **Publish** | Pushes `ghcr.io/muhammad-waseel/shipit:<sha>` and `:latest` | Registry login or push fails |
| **Deploy** | Calls the Render deploy hook stored in GitHub Secrets | The hook is missing or rejected |
| **Verify** | Polls the live site until its commit equals `GITHUB_SHA`, then smoke-tests the live endpoints | The new version isn't live within 15 minutes, or a smoke check fails |

Pull requests run stages 1–3 only, so nothing deploys until code is merged to `main`. A `concurrency` group stops two deploys from overlapping.

## The app

| Endpoint | Purpose |
|---|---|
| `GET /` | Status page for my live projects |
| `GET /api/status` | JSON status of each service (cached 60 s; `?refresh=1` forces a re-check) |
| `GET /api/health` | Health check with version, branch and **deployed commit**, used by the verify stage |
| `GET /api/version` | Version and commit |

Each service is checked with an 8-second timeout. Results are **up**, **slow** (over 3 s), **sleeping** (timed out, usually a free instance waking up) or **down**. Checks only run when someone views the page, and results are cached, so the apps aren't hammered.

**Stack:** Node.js 22, Express 5, Helmet, vanilla JS, Docker, GitHub Actions, GHCR, Render.

## Run locally

```bash
git clone https://github.com/muhammad-waseel/shipit-cicd-pipeline.git
cd shipit-cicd-pipeline
npm install
npm run lint
npm test
npm start            # http://localhost:3000

# or with Docker
docker build -t shipit .
docker run -p 3000:3000 shipit
```

## Setting up the deploy

1. Create a Render **Web Service** from this repo (runtime: Docker).
2. Copy the service's **Deploy Hook** URL (Render → Settings → Deploy Hook).
3. Add it as a GitHub Actions secret named `RENDER_DEPLOY_HOOK_URL`.
4. Push to `main`. The pipeline handles the rest.

---

Built by **Muhammad Waseel**. [Portfolio](https://muhammad-waseel.github.io) · [LinkedIn](https://www.linkedin.com/in/muhammad-waseel-dev) · [GitHub](https://github.com/muhammad-waseel)
