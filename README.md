# andypandy

Umbrella repo for everything behind [andypandy.org](https://andypandy.org). Each
project is its **own standalone repository**, referenced here as a git submodule.
Each one builds and deploys independently (its own Vercel project), so a change in
one never rebuilds the others.

| Path | Repo | Deploys to | Visibility |
|------|------|-----------|-----------|
| [`site`](site)     | [andypandy-site](https://github.com/ChinesePrince07/andypandy-site)     | andypandy.org        | public  |
| [`photos`](photos) | [andypandy-photos](https://github.com/ChinesePrince07/andypandy-photos) | pics.andypandy.org   | private |
| [`desmos`](desmos) | [andypandy-desmos](https://github.com/ChinesePrince07/andypandy-desmos) | desmos.andypandy.org | public  |
| [`ti84`](ti84)     | [andypandy-ti84](https://github.com/ChinesePrince07/andypandy-ti84)     | api.andypandy.org    | public  |
| [`suffield-drive`](suffield-drive) | [andypandy-suffield-drive](https://github.com/ChinesePrince07/andypandy-suffield-drive) | study.andypandy.org | public |

## Working with the submodules

```bash
# Clone everything at once (the private `photos` submodule is skipped if you
# lack access to it):
git clone --recurse-submodules https://github.com/ChinesePrince07/andypandy.git

# In an existing clone, fetch/populate the submodules:
git submodule update --init --recursive

# Pull the latest commit of each project:
git submodule update --remote
```

Develop inside each submodule like a normal repo (commit and push within
`site/`, `photos/`, etc.). To record a new project version in this umbrella,
commit the updated submodule pointer here after pushing the submodule.

See `docs/superpowers/` for the design and implementation plan behind this
structure.
