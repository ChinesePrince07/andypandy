# andypandy

Umbrella repo for everything behind [andypandy.org](https://andypandy.org). Each
project is its **own standalone repository**, referenced here as a git submodule.
Each one builds and deploys independently (its own Vercel project), so a change in
one never rebuilds the others.

| Path | Repo | Deploys to | Visibility |
|------|------|-----------|-----------|
| [`site`](site)     | [andypandy-site](https://github.com/ChinesePrince07/andypandy-site)     | andypandy.org        | public  |
| [`photos`](photos) | [andypandy-photos](https://github.com/ChinesePrince07/andypandy-photos) | pics.andypandy.org   | private |
| [`desmos`](desmos) | [DesmosBezierRenderer-mac](https://github.com/ChinesePrince07/DesmosBezierRenderer-mac) | desmos.andypandy.org | public  |
| [`ti84`](ti84)     | [TI-84-GPT-HACK](https://github.com/ChinesePrince07/TI-84-GPT-HACK)     | api.andypandy.org    | public  |
| [`suffield-drive`](suffield-drive) | [andypandy-suffield-drive](https://github.com/ChinesePrince07/andypandy-suffield-drive) | study.andypandy.org | public |

See `docs/superpowers/` for the design and implementation plan behind this
structure.
