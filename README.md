# andypandy

Monorepo for everything behind [andypandy.org](https://andypandy.org).

| Folder | Project | Deploys to |
|--------|---------|-----------|
| [`site/`](site) | Personal site & blog (Next.js) | andypandy.org |
| [`photos/`](photos) | Afilmory photo gallery (Next.js) | pics.andypandy.org |
| [`desmos/`](desmos) | Image → Desmos Bezier renderer (Flask) | desmos.andypandy.org |
| [`ti84/`](ti84) | TI-84 GPT hardware mod + API server (Express) | api.andypandy.org |

Each folder is a self-contained project with its own build and its own Vercel
project (Root Directory = the folder). See `docs/superpowers/` for the design
and implementation plan.
