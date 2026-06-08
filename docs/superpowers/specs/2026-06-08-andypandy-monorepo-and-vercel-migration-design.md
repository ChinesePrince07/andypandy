# andypandy.org — Monorepo Consolidation + Railway→Vercel Migration

**Date:** 2026-06-08
**Author:** Andy Zhang
**Status:** Approved design (pending final spec review)

## Goal

Combine the four separate repositories that power `andypandy.org` into a single
monorepo (`ChinesePrince07/andypandy`) for easier management, treating the
sub-projects as parts of the personal website rather than standalone things. As
part of this, migrate the two Railway-hosted services (Desmos Bezier Renderer
and the TI-84 GPT API server) to Vercel, since Railway has no free tier.

## Current state (as explored)

Four independent git repos under the `ChinesePrince07` GitHub org, each
deployed separately:

| Repo | What it is | Domain | Host |
|------|-----------|--------|------|
| `personal-site` | Next.js 15 site (blog, projects, admin). Uses Cloudflare R2. The hub. | `andypandy.org` | Vercel |
| `afilmory-photos` | Fork of open-source `Afilmory/Afilmory` photo gallery. pnpm monorepo (`apps/ssr` + `apps/web` + `apps/docs` + ~10 `packages/*` + a `be/` backend). Uses R2. | `pics.andypandy.org` | Vercel |
| `DesmosBezierRenderer-mac` | Flask + OpenCV + **pypotrace** image→Desmos renderer. | `desmos.andypandy.org` | **Railway** |
| `TI-84-GPT-HACK` | Hardware project; `server/` is a Node/Express app proxying OpenAI + serving firmware OTA + programs. | `api.andypandy.org` | **Railway** |

Key facts that constrain the design:
- The ESP32 firmware (`TI-84-GPT-HACK/esp32/esp32.ino:24`) hardcodes
  `#define SERVER "https://api.andypandy.org"`. Devices in the field point at
  that domain, so it must be preserved on the new host.
- `personal-site` already uses Cloudflare R2 via `@aws-sdk/client-s3`
  (`lib/r2-storage.ts`) with env vars `R2_ENDPOINT`, `R2_ACCESS_KEY_ID`,
  `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME` (default `afilmory-photos`),
  `R2_PUBLIC_BASE_URL`, `region: "auto"`. afilmory uses the same R2 bucket.
- `personal-site/lib/projects.ts` lists many projects by `owner/name` and
  fetches each project's README from its standalone GitHub repo via the GitHub
  API. Only `TI-84-GPT-HACK` and `DesmosBezierRenderer-mac` overlap with this
  consolidation; the rest are unrelated repos.

## Decisions (from brainstorming)

1. **Scope:** All four repos go into one monorepo, including the Afilmory fork.
2. **Deploy model:** Separate Vercel projects, one repo — each app keeps its own
   Vercel project pointed at a subfolder (Root Directory). Subdomains preserved.
3. **Desmos engine:** Keep Python; replace native `pypotrace` with pure-Python
   `potracer` + `opencv-python-headless`; make the renderer stateless.
4. **Git history:** Preserve every repo's full history via `git subtree`.
5. **TI-84 state:** R2 only (reuse existing creds). Firmware binaries + chat
   history in R2; live request/serial monitors become best-effort on serverless.
6. **Old repos:** Archived as read-only mirrors on GitHub (not deleted).
7. **New repo name:** `ChinesePrince07/andypandy`. Working dir `/home/andy/andypandy`.
8. **DNS:** Cloudflare. Vercel changes driven via Vercel CLI/MCP where possible;
   the user applies Cloudflare DNS records and pastes secrets.

## Target repository structure

```
andypandy/
├── site/        ← personal-site         (Vercel project → andypandy.org)
├── photos/      ← afilmory-photos        (Vercel project → pics.andypandy.org)
├── desmos/      ← DesmosBezierRenderer   (Vercel project → desmos.andypandy.org)
├── ti84/        ← TI-84-GPT-HACK         (Vercel root = ti84/server → api.andypandy.org)
├── docs/superpowers/specs/…             ← design docs
└── README.md                            ← index of the four sub-projects
```

Flat top-level folders. Each sub-project stays fully self-contained (its own
`package.json` / `requirements.txt` / build config). **No shared root
workspace** — this keeps `photos/`'s internal pnpm workspace from colliding with
`site/`'s npm setup and lets each Vercel project build independently via its
own Root Directory.

## Git consolidation mechanics

The repo is initialized with this design doc as the genesis commit. Then each
original repo is merged in as a subtree (preserving history):

```sh
git remote add site-src   /home/andy/personal\ site/personal-site
git remote add photos-src  /home/andy/personal\ site/afilmory-photos
git remote add desmos-src  /home/andy/personal\ site/DesmosBezierRenderer-mac
git remote add ti84-src    /home/andy/personal\ site/TI-84-GPT-HACK
git fetch --all
git subtree add --prefix=site   site-src   main
git subtree add --prefix=photos photos-src main
git subtree add --prefix=desmos desmos-src main
git subtree add --prefix=ti84   ti84-src   master   # ti84 default branch is master
```

All historical commits remain reachable under their subfolder prefix. Afilmory
upstream updates remain possible later via `git subtree pull` against
`Afilmory/Afilmory` (accepted as higher-friction than a standalone fork).

## Deployment topology

| Vercel project | Root Directory | Domain | Action |
|---|---|---|---|
| personal-site (existing) | `site` | andypandy.org | Repoint Git source to `andypandy` + set Root Dir |
| afilmory (existing) | `photos` | pics.andypandy.org | Repoint Git source + set Root Dir |
| **desmos (new)** | `desmos` | desmos.andypandy.org | Create project; migrate domain off Railway |
| **ti84-api (new)** | `ti84/server` | api.andypandy.org | Create project; migrate domain off Railway |

## Desmos migration (Flask on Railway → Python on Vercel)

**Dependency swap** (`desmos/requirements.txt`):
- Remove `pypotrace` (needs native `libagg-dev`/`libpotrace-dev`, impossible on
  Vercel serverless Python).
- Add `potracer` (pure-Python potrace port; numpy-only; drop-in API:
  `from potrace import Bitmap, POTRACE_TURNPOLICY_MINORITY`, then
  `Bitmap(data).trace(turdsize=2, turnpolicy=POTRACE_TURNPOLICY_MINORITY, alphamax=1.0, opticurve=1, opttolerance=0.5)`).
- Keep `opencv-python-headless`, `numpy`, `Pillow`, `Flask`, `Flask-Cors`.
- Total bundle well under Vercel's 500 MB uncompressed Python limit.

**Code changes (`desmos/backend.py`):**
- Swap the import + `get_trace()` to potracer (the `curves` / `segments` /
  `is_corner` / `c` / `c1` / `c2` / `end_point` / `start_point` model is mirrored
  by potracer, so `get_latex()` stays nearly identical; verify exact attribute
  access during implementation).
- **Make stateless.** Replace the upload→disk→re-read flow with a single
  `POST /render` that accepts the image in the request body, decodes it in
  memory (`cv2.imdecode(np.frombuffer(...), ...)`), runs the pipeline, and
  returns the expressions JSON directly. Remove filesystem writes to `frames/`.
- Keep `/calculator` (serves the page) and `/health`.
- Drop the CLI/`getopt`/`webbrowser`/EULA `__main__` block (local-only cruft);
  keep a minimal `app.run()` guard for local dev.

**Frontend (`desmos/frontend/index.html`):**
- Update the upload panel to call `POST /render` and hold each frame's
  expressions client-side. Multi-frame animation still works (browser keeps the
  per-frame expression arrays and the `f` slider switches between them).

**Vercel config (`desmos/`):**
- Add `pyproject.toml` with `[tool.vercel] entrypoint = "backend:app"` (Vercel's
  Python runtime only auto-loads recognized entrypoint names; `backend.py` is
  not one) and `requires-python = ">=3.12"`.
- Remove `railway.toml`, `nixpacks.toml`, `Procfile`, `Dockerfile`.

## TI-84 server migration (Express on Railway → Express on Vercel)

**Express on Vercel** is zero-config (export the app). Refactor
`ti84/server/index.mjs`:
- Build the Express `app` at module load using top-level `await` (the package is
  already `type: module`) so `await chatgpt()` resolves before export.
- `export default app;` Keep an `if` guard around `app.listen(...)` for local dev.
- All routers (`/gpt`, `/firmware`, `/programs`, `/image`, `/logs`, `/requests`)
  unchanged in mounting.

**State → R2** (reuse `R2_*` env vars + the `afilmory-photos` bucket, namespaced
under a `ti84/` key prefix). Add `@aws-sdk/client-s3` to
`ti84/server/package.json` and a small R2 helper mirroring `lib/r2-storage.ts`'s
`envTrim` defensive trimming:
- **Chat history** (`routes/chatgpt.mjs`): replace `lowdb`/`db.json` with R2
  JSON object `ti84/chat/db.json` (get → modify → put). Low concurrency (single
  user's calculator), so read-modify-write is acceptable.
- **Firmware OTA** (`routes/firmware.mjs`): read/write `firmware.bin`,
  `launcher.bin`, `version.txt` to R2 keys `ti84/firmware/*` instead of disk.
  Seed R2 with the currently committed `firmware/firmware.bin` + `version.txt`.
- **`/solve`** (`routes/chatgpt.mjs`): stop writing `./to_solve.jpg`; base64-
  encode the incoming jpg buffer in memory and pass to the vision model.
- **Programs/images** (`routes/programs.mjs`, `routes/images.mjs`): these read
  committed files from the bundle — no change (reads work on Vercel).
- **Live monitors** (`routes/requests.mjs`, `routes/logs.mjs`): in-memory
  buffers stay; documented as best-effort on serverless (entries may be missed
  across cold starts). No crash, just reduced fidelity.

**Vercel config (`ti84/server/`):**
- Remove `railway.json`.
- Env on Vercel project: `OPENAI_API_KEY` + the five `R2_*` vars.
- Models (`gpt-5.4`, `gpt-5.4-nano`) preserved as-is.

**Domain continuity:** `api.andypandy.org` is moved from Railway to the new
Vercel project, so the ESP32 firmware needs no change.

## Projects page / README mirrors

Because the four originals are **archived, not deleted**,
`site/lib/projects.ts`'s GitHub README fetches keep working unchanged — no code
change required. (If a mirror is later deleted, repoint that entry to the
monorepo subpath via the GitHub contents API.)

## Tasks requiring the user (access not available to the agent)

The agent does all code / config / git. These require the user's
Vercel / Cloudflare / secret access (agent prepares exact steps or drives via
Vercel CLI/MCP after authentication):
- Create + push GitHub `andypandy` repo; archive the 4 originals.
- Repoint the 2 existing Vercel projects to the new repo + set Root Directory.
- Create the 2 new Vercel projects; add env vars (`OPENAI_API_KEY`, `R2_*`).
- Cloudflare DNS: move `desmos.` and `api.` CNAMEs from Railway → Vercel.
- Delete the two Railway services once Vercel is verified.

## Implementation sequence (verify each phase before the next)

1. **Scaffold + merge:** subtree-merge all 4 into `andypandy` (history intact);
   add root README + `.gitignore`; push to GitHub.
2. **Repoint existing:** point `site` + `photos` Vercel projects at the new repo
   with Root Directory set; confirm `andypandy.org` + `pics.andypandy.org`
   deploy green.
3. **Desmos:** apply code/config changes; deploy new Vercel project on its
   `*.vercel.app` URL; verify render end-to-end; migrate `desmos.` domain;
   delete Railway service.
4. **TI-84:** apply R2 + export-app changes; deploy on `*.vercel.app`; verify
   `/gpt/ask` (stateless + chat), `/gpt/solve`, `/firmware/*`, `/programs/*`;
   migrate `api.` domain; verify the physical calculator still works; delete
   Railway service.
5. **Cleanup:** archive originals; finalize root README; remove leftover
   Railway/Docker config from each subfolder.

## Risks & mitigations

- **potracer attribute parity:** the curve/segment attribute names may differ
  slightly from pypotrace. Mitigation: verify against a known image during
  Desmos implementation; `get_latex()` is the only consumer.
- **opencv on Vercel:** `opencv-python-headless` ships manylinux wheels and
  avoids `libGL`; expected to import cleanly. Mitigation: smoke-test `/health`
  + one render on the preview URL before moving the domain.
- **R2 read-modify-write races (chat history):** acceptable at single-user
  concurrency; revisit with Upstash Redis only if it ever becomes multi-user.
- **Firmware in R2 before cutover:** seed R2 with the current firmware/version
  first so `/firmware/version` + `/download` work the moment the domain moves.
- **DNS cutover gap:** verify each new deployment on its `*.vercel.app` URL
  before repointing DNS; keep Railway running until Vercel is confirmed.
