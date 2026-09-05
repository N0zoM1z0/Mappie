# Cloudflare Pages deployment

Mappie's production web bundle is deployed to Cloudflare Pages by the existing GitHub Actions workflow in `.github/workflows/ci.yml`. Cloudflare receives only the static Expo export. The app has no production server or server-side data store.

## Pipeline

A push to `main` runs the following sequence:

1. Install the locked npm dependency tree.
2. Check formatting and TypeScript types.
3. Run the core test suite with coverage thresholds.
4. Export the static web bundle to `dist`.
5. Run the Chromium and Firefox end-to-end suite.
6. Create the `mappie` Cloudflare Pages project if it does not exist.
7. Deploy the exact bundle produced by the successful verification job.

Pull requests run every verification step but never receive Cloudflare credentials and never deploy. The uploaded production artifact is retained for one day.

The workflow uses Cloudflare's Direct Upload model. GitHub Actions owns the deployment, so the Pages project must not also be configured for Cloudflare's Git integration. Cloudflare does not support converting an existing Direct Upload project to Git integration later; create a separate project if that deployment model is ever required.

## Repository secrets

Configure these GitHub Actions repository secrets:

| Secret                  | Purpose                                                     |
| ----------------------- | ----------------------------------------------------------- |
| `CLOUDFLARE_ACCOUNT_ID` | Selects the Cloudflare account that owns the Pages project. |
| `CLOUDFLARE_API_TOKEN`  | Authenticates project creation and deployment.              |

Create a narrowly scoped API token with `Account > Cloudflare Pages > Edit` for the target account. Do not put either value in source files, workflow variables, issues, or logs. If a token is exposed, revoke it, create a replacement, and update the GitHub secret before the next deployment.

The workflow's built-in `GITHUB_TOKEN` receives `contents: read` and `deployments: write` only in the deployment job. Cloudflare credentials are referenced only in that job.

## Local build

Produce the same static bundle without deploying it:

```bash
npm ci
npm run build:web
```

The output is written to `dist`. Browser geolocation requires HTTPS outside localhost, which Cloudflare Pages provides automatically. Browser recording remains foreground-only; background location collection still requires a native iOS or Android development build.

## Operations

The GitHub `cloudflare-pages` environment records each deployment and links to the URL returned by Wrangler. A failed verification job leaves the current production deployment unchanged. A failed deployment can be retried from the GitHub Actions run after checking token scope, account selection, and the Cloudflare Pages service status.

To roll back, open the `mappie` project in the Cloudflare dashboard, select a known-good production deployment, and use **Rollback to this deployment**. The following successful push to `main` becomes the new production deployment.
