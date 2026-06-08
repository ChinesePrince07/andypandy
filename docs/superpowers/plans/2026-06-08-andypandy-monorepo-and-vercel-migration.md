# andypandy Monorepo + Railway→Vercel Migration — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Combine four repos (`personal-site`, `afilmory-photos`, `DesmosBezierRenderer-mac`, `TI-84-GPT-HACK`) into one monorepo `ChinesePrince07/andypandy` with history preserved, and migrate the two Railway-hosted services (Desmos renderer, TI-84 GPT API) to Vercel's free tier.

**Architecture:** Flat top-level folders (`site/`, `photos/`, `desmos/`, `ti84/`), each self-contained with its own build. Four separate Vercel projects, each pointed at its subfolder via Root Directory, preserving the existing subdomains. Desmos becomes a stateless Flask function using pure-Python `potracer`; the TI-84 Express server becomes a Vercel Function with state moved to Cloudflare R2.

**Tech Stack:** git subtree, Vercel CLI, GitHub CLI (`gh`); Next.js (site/photos, unchanged); Python 3.12 + Flask + opencv-python-headless + potracer (desmos); Node 18+ + Express + `@aws-sdk/client-s3` (ti84); Cloudflare R2 (S3-compatible) for state.

**Source repos (local):** under `/home/andy/personal site/`:
- `personal-site` (branch `main`)
- `afilmory-photos` (branch `main`)
- `DesmosBezierRenderer-mac` (branch `main`)
- `TI-84-GPT-HACK` (branch `master`)

**Monorepo working dir:** `/home/andy/andypandy` (already `git init`'d on `main`, genesis commit = the design spec).

**Verified facts (do not re-litigate):**
- `potracer` 0.0.4 installs as the `potrace` module; `Bitmap(np_array_0_1)` + `bmp.trace(2, POTRACE_TURNPOLICY_MINORITY, 1.0, 1, 0.5)` matches pypotrace positionally. Points are `_Point` with `.x`/`.y` and are NOT iterable.
- Vercel Python runtime: WSGI `app` auto-loaded from a recognized entrypoint name (`app.py`/`index.py`/`server.py`/`main.py`/`wsgi.py`, optionally under `api/`/`src/`/`app/`) OR via `[tool.vercel] entrypoint` in `pyproject.toml`. 500 MB uncompressed bundle limit. cwd at runtime = project base.
- Vercel Express: export the app as default from `index.{js,mjs}` (or `app`/`server`); zero-config; 250 MB bundle limit; `express.static()` is ignored (not used here); in-memory state does not persist across invocations.
- R2 env vars (already used by `personal-site`): `R2_ENDPOINT`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME` (default `afilmory-photos`), `R2_PUBLIC_BASE_URL`; `region: "auto"`.
- ESP32 firmware hardcodes `https://api.andypandy.org`; the `/gpt/ask` response contract is `sid|answer` (chat) — must be preserved byte-for-byte.

---

## PHASE 0 — Monorepo scaffold + history merge

### Task 0.1: Confirm clean source repos

**Files:** none (verification only)

- [ ] **Step 1: Verify all four source repos are clean and on the expected branch**

Run:
```bash
cd "/home/andy/personal site"
for r in personal-site afilmory-photos DesmosBezierRenderer-mac TI-84-GPT-HACK; do
  echo "== $r =="; git -C "$r" status -s; git -C "$r" rev-parse --abbrev-ref HEAD
done
```
Expected: no output under each `== $r ==` for status (clean trees); branches `main`, `main`, `main`, `master`.

If any repo is dirty, STOP and commit/stash in that repo first.

### Task 0.2: Subtree-merge the four repos into the monorepo

**Files:**
- Modify (git history): `/home/andy/andypandy` — adds `site/`, `photos/`, `desmos/`, `ti84/`

- [ ] **Step 1: Add the four local repos as remotes and fetch**

Run:
```bash
cd /home/andy/andypandy
git remote add site-src   "/home/andy/personal site/personal-site"
git remote add photos-src "/home/andy/personal site/afilmory-photos"
git remote add desmos-src "/home/andy/personal site/DesmosBezierRenderer-mac"
git remote add ti84-src   "/home/andy/personal site/TI-84-GPT-HACK"
git fetch site-src && git fetch photos-src && git fetch desmos-src && git fetch ti84-src
```
Expected: four successful fetches listing branches.

- [ ] **Step 2: Subtree-add each repo under its prefix (history preserved)**

Run:
```bash
cd /home/andy/andypandy
git subtree add --prefix=site   site-src   main
git subtree add --prefix=photos photos-src main
git subtree add --prefix=desmos desmos-src main
git subtree add --prefix=ti84   ti84-src   master
```
Expected: each prints "Added dir '<prefix>'" and creates a merge commit.

- [ ] **Step 3: Verify structure and history preserved**

Run:
```bash
cd /home/andy/andypandy
ls -1
echo "--- total commits (genesis + 4 merges + all original history) ---"
git log --oneline | wc -l
echo "--- original desmos subject present? ---"
git log --oneline | grep -i "Rewrite README" | head -1
echo "--- original ti84 subject present? ---"
git log --oneline | grep -i "requests endpoint" | head -1
```
Expected: top-level shows `desmos photos site ti84 docs`; the commit count is well over 100 (all four histories preserved); each `grep` prints the original commit line. NOTE: `git subtree add` is non-squash, but the original commits touched ROOT-relative paths, so a path-filtered `git log -- <prefix>` shows only the synthetic "Add '<prefix>/' from commit …" line — that is expected, NOT a failed merge. Use plain `git log --oneline` (no `-- <prefix>`) to see the real original subjects.

- [ ] **Step 4: Detach the temporary remotes (keep the merged commits)**

Run:
```bash
cd /home/andy/andypandy
git remote remove site-src; git remote remove photos-src; git remote remove desmos-src; git remote remove ti84-src
git remote -v
```
Expected: no remotes listed (origin added later in Task 0.4).

### Task 0.3: Add root README and .gitignore

**Files:**
- Create: `/home/andy/andypandy/README.md`
- Create: `/home/andy/andypandy/.gitignore`

- [ ] **Step 1: Write the root README**

Create `/home/andy/andypandy/README.md`:
```markdown
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
```

- [ ] **Step 2: Write a minimal root .gitignore**

Create `/home/andy/andypandy/.gitignore`:
```gitignore
# Dependencies / build output live inside each subproject's own ignore rules.
.DS_Store
*.log
.vercel
.env
.env.local
```

- [ ] **Step 3: Commit**

Run:
```bash
cd /home/andy/andypandy
git add README.md .gitignore
git commit -m "chore: root README and gitignore for the monorepo"
```

### Task 0.4: Create the GitHub repo and push

**Files:** none (remote)

- [ ] **Step 1: Create the repo on GitHub and push (user must be `gh`-authenticated)**

Run:
```bash
cd /home/andy/andypandy
gh repo create ChinesePrince07/andypandy --private --source=. --remote=origin --push
```
Expected: repo created; `main` pushed. (Use `--public` instead of `--private` if preferred.)

- [ ] **Step 2: Verify**

Run:
```bash
git -C /home/andy/andypandy remote -v
gh repo view ChinesePrince07/andypandy --json name,visibility,defaultBranchRef
```
Expected: `origin` points at the new repo; default branch `main`.

---

## PHASE 1 — Repoint the two existing Vercel projects

> These steps use the Vercel CLI; the user must run `vercel login` (or authenticate the Vercel MCP) first. The goal: the existing `personal-site` and `afilmory` Vercel projects now build from the `andypandy` repo with Root Directory set, WITHOUT changing their domains.

### Task 1.1: Repoint the personal-site project to `site/`

**Files:** none (Vercel dashboard/CLI)

- [ ] **Step 1: In the Vercel dashboard for the personal-site project → Settings → Git, disconnect the old `personal-site` repo and connect `ChinesePrince07/andypandy`. Settings → General → Root Directory = `site`.**

(Equivalent CLI: there is no stable CLI command to re-link an existing project's Git repo; do this in the dashboard. Confirm Root Directory = `site` and Framework Preset = Next.js.)

- [ ] **Step 2: Trigger a deploy and verify**

Run:
```bash
gh api repos/ChinesePrince07/andypandy/commits/main --jq '.sha'   # note current sha
```
Then in the dashboard, redeploy from `main`. Verify the deployment is **Ready** and `https://andypandy.org` loads with the blog/projects intact.
Expected: green deployment; site unchanged from before.

### Task 1.2: Repoint the afilmory project to `photos/`

**Files:** none (Vercel dashboard/CLI)

- [ ] **Step 1: In the Vercel dashboard for the afilmory project → Settings → Git, connect `ChinesePrince07/andypandy`; Root Directory = `photos`.**

The existing `photos/vercel.json` already sets `buildCommand: pnpm run build`, `outputDirectory: apps/ssr/.next`, `installCommand: pnpm install --no-frozen-lockfile`, `framework: nextjs` — these are relative to Root Directory `photos`, so they keep working.

- [ ] **Step 2: Redeploy and verify**

Verify the deployment is **Ready** and `https://pics.andypandy.org` loads the gallery.
Expected: green deployment; gallery unchanged.

> CHECKPOINT: Do not proceed to Phase 2 until both andypandy.org and pics.andypandy.org are confirmed green from the monorepo.

---

## PHASE 2 — Desmos migration (Railway Flask → Vercel Python)

All paths in this phase are under `/home/andy/andypandy/desmos/`.

### Task 2.1: Swap pypotrace → potracer in requirements

**Files:**
- Modify: `desmos/requirements.txt`

- [ ] **Step 1: Replace requirements.txt contents**

Overwrite `desmos/requirements.txt` with:
```
Flask>=2.2.0
Flask-Cors>=3.0.0
numpy>=1.23.0
opencv-python-headless>=4.6.0
Pillow>=9.5.0
potracer>=0.0.4
```

- [ ] **Step 2: Commit**

Run:
```bash
cd /home/andy/andypandy
git add desmos/requirements.txt
git commit -m "desmos: swap native pypotrace for pure-python potracer"
```

### Task 2.2: Rewrite backend.py as a stateless Flask app

**Files:**
- Modify (full rewrite): `desmos/backend.py`
- Test: `desmos/test_backend.py`

- [ ] **Step 1: Write the failing test**

Create `desmos/test_backend.py`:
```python
import io
import numpy as np
import cv2
from backend import app


def _square_png_bytes():
    img = np.zeros((60, 60, 3), dtype=np.uint8)
    cv2.rectangle(img, (15, 15), (45, 45), (255, 255, 255), 2)
    ok, buf = cv2.imencode('.png', img)
    assert ok
    return buf.tobytes()


def test_health():
    client = app.test_client()
    res = client.get('/health')
    assert res.status_code == 200
    assert res.get_json() == {'status': 'ok'}


def test_render_returns_expressions():
    client = app.test_client()
    data = {'file': (io.BytesIO(_square_png_bytes()), 'frame.png')}
    res = client.post('/render', data=data, content_type='multipart/form-data')
    assert res.status_code == 200
    payload = res.get_json()
    assert isinstance(payload['result'], list)
    # raw Canny trace of the test rectangle yields ~37 expressions; a clamped/
    # blanked trace (the pypotrace→potracer regression) would give only ~8.
    assert len(payload['result']) > 15
    first = payload['result'][0]
    assert set(first.keys()) == {'id', 'latex', 'color', 'secret'}
    assert payload['width'] == 60 and payload['height'] == 60


def test_render_rejects_missing_file():
    client = app.test_client()
    res = client.post('/render', data={}, content_type='multipart/form-data')
    assert res.status_code == 400
```

- [ ] **Step 2: Run the test to verify it fails**

Run:
```bash
cd /home/andy/andypandy/desmos
python3 -m venv .venv && . .venv/bin/activate
pip install -q -r requirements.txt pytest
pytest test_backend.py -q
```
Expected: FAIL — the current `backend.py` imports `potrace` (native) and has no `/render` route / `app` importable cleanly.

- [ ] **Step 3: Replace backend.py with the stateless implementation**

Overwrite `desmos/backend.py` with:
```python
import os

from flask import Flask, jsonify, request, render_template, redirect
from flask_cors import CORS
import numpy as np
import cv2
from potrace import Bitmap, POTRACE_TURNPOLICY_MINORITY

app = Flask(__name__, template_folder='frontend')
CORS(app)

COLOUR = '#2464b4'             # Hex colour for graph output
SHOW_GRID = True              # Show the Desmos grid/axes
SCREENSHOT_SIZE = [None, None]  # [width, height] for client-side downloads
SCREENSHOT_FORMAT = 'png'      # 'png' or 'svg'
DOWNLOAD_IMAGES = False        # Auto-download each rendered frame in the browser
# Development-only Desmos API key (public, see Desmos API docs on API keys).
DESMOS_API_KEY = 'dcb31709b452b1cf9dc26972add0fda6'


def get_contours(image):
    """BGR image (numpy array) -> Canny edge bitmap, y-flipped for Desmos."""
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    edged = cv2.Canny(gray, 30, 200)
    return edged[::-1]


def get_trace(data):
    # potracer thresholds the array internally at >127.5, so pass the raw
    # 0/255 Canny output directly. Do NOT clamp to 0/1 — that blanks the
    # bitmap and the trace collapses to just the frame's bounding box.
    bmp = Bitmap(data)
    return bmp.trace(2, POTRACE_TURNPOLICY_MINORITY, 1.0, 1, 0.5)


def get_latex(image):
    latex = []
    path = get_trace(get_contours(image))
    for curve in path.curves:
        start = curve.start_point
        for segment in curve.segments:
            x0, y0 = start.x, start.y
            if segment.is_corner:
                x1, y1 = segment.c.x, segment.c.y
                x2, y2 = segment.end_point.x, segment.end_point.y
                latex.append('((1-t)%f+t%f,(1-t)%f+t%f)' % (x0, x1, y0, y1))
                latex.append('((1-t)%f+t%f,(1-t)%f+t%f)' % (x1, x2, y1, y2))
            else:
                x1, y1 = segment.c1.x, segment.c1.y
                x2, y2 = segment.c2.x, segment.c2.y
                x3, y3 = segment.end_point.x, segment.end_point.y
                latex.append('((1-t)((1-t)((1-t)%f+t%f)+t((1-t)%f+t%f))+t((1-t)((1-t)%f+t%f)+t((1-t)%f+t%f)),\
                (1-t)((1-t)((1-t)%f+t%f)+t((1-t)%f+t%f))+t((1-t)((1-t)%f+t%f)+t((1-t)%f+t%f)))' % \
                (x0, x1, x1, x2, x1, x2, x2, x3, y0, y1, y1, y2, y1, y2, y2, y3))
            start = segment.end_point
    return latex


def expressions_for(image):
    return [
        {'id': 'expr-' + str(i), 'latex': expr, 'color': COLOUR, 'secret': True}
        for i, expr in enumerate(get_latex(image), start=1)
    ]


@app.route('/health')
def health():
    return jsonify({'status': 'ok'})


@app.route('/')
def index():
    return redirect('/calculator')


@app.route('/calculator')
def client():
    return render_template(
        'index.html',
        api_key=DESMOS_API_KEY,
        show_grid=SHOW_GRID,
        download_images=DOWNLOAD_IMAGES,
        screenshot_size=SCREENSHOT_SIZE,
        screenshot_format=SCREENSHOT_FORMAT,
    )


@app.route('/render', methods=['POST'])
def render():
    if 'file' not in request.files:
        return jsonify({'error': 'No file provided'}), 400
    file = request.files['file']
    if file.filename == '':
        return jsonify({'error': 'No file selected'}), 400

    raw = np.frombuffer(file.read(), np.uint8)
    image = cv2.imdecode(raw, cv2.IMREAD_COLOR)
    if image is None:
        return jsonify({'error': 'Could not decode image'}), 400

    try:
        exprs = expressions_for(image)
        h, w = int(image.shape[0]), int(image.shape[1])
        return jsonify({'result': exprs, 'width': w, 'height': h})
    except Exception as e:  # surface trace failures to the client
        return jsonify({'error': str(e)}), 500


if __name__ == '__main__':
    app.run(host='127.0.0.1', port=int(os.environ.get('PORT', 5001)), debug=True)
```

- [ ] **Step 4: Run the test to verify it passes**

Run:
```bash
cd /home/andy/andypandy/desmos && . .venv/bin/activate
pytest test_backend.py -q
```
Expected: 3 passed.

- [ ] **Step 5: Commit**

Run:
```bash
cd /home/andy/andypandy
git add desmos/backend.py desmos/test_backend.py
git commit -m "desmos: stateless /render endpoint using potracer; add tests"
```

### Task 2.3: Update the frontend to drive rendering from /render

**Files:**
- Modify: `desmos/frontend/index.html` (replace the final `<script>` block, lines 156–442)

- [ ] **Step 1: Replace the `<script>` block**

In `desmos/frontend/index.html`, replace everything between `<script>` (the one at line ~156, the first line inside `<body>` after `#toggle-panel`) and its closing `</script>` (line ~442) with:
```html
      <script>
         // ---- Upload panel wiring ----
         const dropZone = document.getElementById('drop-zone');
         const fileInput = document.getElementById('file-input');
         const uploadStatus = document.getElementById('upload-status');
         const renderBtn = document.getElementById('render-btn');
         const uploadPanel = document.getElementById('upload-panel');
         const togglePanel = document.getElementById('toggle-panel');
         const closePanel = document.getElementById('close-panel');

         // framesData[i] = { exprs: [...], width, height } for frame i+1
         let framesData = [];

         function hideUploadPanel() { uploadPanel.style.display = 'none'; togglePanel.style.display = 'block'; }
         function showUploadPanel() { uploadPanel.style.display = 'block'; togglePanel.style.display = 'none'; }
         function showStatus(msg, type) { uploadStatus.textContent = msg; uploadStatus.className = type; }

         closePanel.addEventListener('click', hideUploadPanel);
         togglePanel.addEventListener('click', showUploadPanel);
         dropZone.addEventListener('click', () => fileInput.click());
         dropZone.addEventListener('dragover', (e) => { e.preventDefault(); dropZone.classList.add('dragover'); });
         dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragover'));
         dropZone.addEventListener('drop', (e) => {
            e.preventDefault();
            dropZone.classList.remove('dragover');
            const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/'));
            if (files.length > 0) processFiles(files);
            else showStatus('Please drop image file(s)', 'error');
         });
         fileInput.addEventListener('change', (e) => {
            if (e.target.files.length > 0) processFiles(Array.from(e.target.files));
         });
         document.addEventListener('keydown', (e) => { if (e.key === 'Escape') hideUploadPanel(); });

         // Upload each image to /render; the server returns Bezier expressions.
         async function processFiles(files) {
            files.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
            showStatus(`Rendering ${files.length} file(s)...`, '');
            renderBtn.disabled = true;
            framesData = [];

            for (let i = 0; i < files.length; i++) {
               const file = files[i];
               const formData = new FormData();
               formData.append('file', file);
               try {
                  const controller = new AbortController();
                  const timeoutId = setTimeout(() => controller.abort(), 60000);
                  const response = await fetch('/render', { method: 'POST', body: formData, signal: controller.signal });
                  clearTimeout(timeoutId);
                  const data = await response.json();
                  if (response.ok && data.result) {
                     framesData.push({ exprs: data.result, width: data.width, height: data.height });
                     showStatus(`Rendered ${framesData.length}/${files.length}: ${file.name}`, '');
                  } else {
                     showStatus(`Failed: ${file.name} - ${data.error || response.status}`, 'error');
                  }
               } catch (err) {
                  showStatus(`Failed: ${file.name} - ${err.message}`, 'error');
               }
            }

            if (framesData.length > 0) {
               showStatus(`Ready: ${framesData.length} frame(s)`, 'success');
               // size the frame slider to the number of frames
               calculator.setExpression({ id: 'frame', latex: 'f=0', color: '#2464b4',
                  sliderBounds: { step: 1, max: framesData.length, min: 0 } });
               renderBtn.disabled = false;
               renderBtn.textContent = framesData.length > 1 ? `Show ${framesData.length} Frames` : 'Show Image';
            }
         }

         renderBtn.addEventListener('click', () => {
            if (framesData.length > 0) calculator.setExpression({ id: 'frame', latex: 'f=1' });
         });

         // ---- Desmos calculator ----
         var elt = document.getElementById('calculator');
         var calculator = Desmos.GraphingCalculator(elt);
         var hiddenGraph;

         function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

         async function changeGraph(exprs) {
            var defaults = hiddenGraph.expressions.list.slice();
            for (var expr of exprs) {
               hiddenGraph.expressions.list.push({ color: expr.color, id: expr.id, latex: expr.latex, type: 'expression' });
            }
            calculator.setState(hiddenGraph, { allowUndo: false });
            hiddenGraph.expressions.list = defaults;
            if (exprs.length < 3000) await sleep(500);
         }

         calculator.updateSettings({
            showGrid: {{ show_grid|tojson }},
            showXAxis: {{ show_grid|tojson }},
            showYAxis: {{ show_grid|tojson }}
         });

         calculator.setExpression({ id: 'frame', latex: 'f=0', color: '#2464b4', sliderBounds: { step: 1, max: 0, min: 0 } });
         calculator.setExpression({ id: 'lines', latex: 'L=0', color: '#2464b4', sliderBounds: { step: 1, min: 0 } });
         hiddenGraph = calculator.getState();

         var tmpState = calculator.getState();
         tmpState.expressions.list.push({ type: 'text', id: 'info',
            text: 'Welcome to Desmos Bezier Renderer!\n\nUpload image(s) with the panel (bottom right),\nthen press the button or set f=1.\n\nf = current frame, L = number of Bezier curves.' });
         calculator.setState(tmpState);

         // Render whichever frame f points at (1-based), from client-held data.
         function renderCurrentFrame(frame) {
            const data = framesData[frame - 1];
            if (!data) return;
            calculator.setMathBounds({ left: 0, right: data.width, bottom: 0, top: data.height });
            hiddenGraph.expressions.list[0].latex = 'f=' + frame;
            hiddenGraph.expressions.list[1].latex = 'L=' + data.exprs.length;
            changeGraph(data.exprs);
            handleScreenshotMaybe(frame);
         }

         // Observe the f slider and (re)render on change.
         const fHelper = calculator.HelperExpression({ latex: 'f' });
         let lastFrame = -1;
         fHelper.observe('numericValue', () => {
            const f = fHelper.numericValue;
            if (Number.isNaN(f) || f <= 0) return;
            const frame = Math.round(f);
            if (frame === lastFrame) return;
            lastFrame = frame;
            renderCurrentFrame(frame);
         });

         // Optional client-side screenshot/download (off by default).
         const imgcont = document.createElement('a');
         document.body.appendChild(imgcont);
         function handleScreenshotMaybe(frame) {
            if (!{{ download_images|tojson }}) return;
            const data = framesData[frame - 1];
            const params = {
               mode: 'contain',
               mathBounds: { left: 0, bottom: 0, right: data.width, top: data.height },
               width: {{ screenshot_size|tojson }}[0] || window.screen.width,
               height: {{ screenshot_size|tojson }}[1] || window.screen.height,
               targetPixelRatio: 1,
               format: {{ screenshot_format|tojson }}
            };
            setTimeout(() => {
               calculator.asyncScreenshot(params, (screenshot) => {
                  let uri = {{ screenshot_format|tojson }} === 'svg'
                     ? 'data:image/svg+xml;base64,' + window.btoa(screenshot)
                     : screenshot;
                  imgcont.href = uri;
                  imgcont.download = 'frame-' + String(frame).padStart(5, '0');
                  imgcont.click();
               });
            }, 1500);
         }
      </script>
```

- [ ] **Step 2: Manual smoke test locally**

Run:
```bash
cd /home/andy/andypandy/desmos && . .venv/bin/activate
PORT=5001 python backend.py &
sleep 2
curl -s localhost:5001/health
curl -s -F "file=@frames/frame1.png" localhost:5001/render | head -c 300
kill %1
```
Expected: `{"status":"ok"}`; the `/render` response begins `{"result":[{"color":"#2464b4","id":"expr-1",...`, plus `"width"` and `"height"`. Then open `http://localhost:5001/calculator` in a browser, upload `frames/frame1.png` via the panel, press the button — the image renders as Bezier curves.

- [ ] **Step 3: Commit**

Run:
```bash
cd /home/andy/andypandy
git add desmos/frontend/index.html
git commit -m "desmos: drive rendering client-side from /render (stateless)"
```

### Task 2.4: Add Vercel config; remove Railway/Docker config

**Files:**
- Create: `desmos/pyproject.toml`
- Create: `desmos/.python-version`
- Delete: `desmos/railway.toml`, `desmos/nixpacks.toml`, `desmos/Procfile`, `desmos/Dockerfile`

- [ ] **Step 1: Create pyproject.toml pointing Vercel at `backend:app`**

Create `desmos/pyproject.toml`:
```toml
[project]
name = "desmos-bezier-renderer"
version = "1.0.0"
requires-python = ">=3.12"
dependencies = [
    "Flask>=2.2.0",
    "Flask-Cors>=3.0.0",
    "numpy>=1.23.0",
    "opencv-python-headless>=4.6.0",
    "Pillow>=9.5.0",
    "potracer>=0.0.4",
]

[tool.vercel]
entrypoint = "backend:app"
```

- [ ] **Step 2: Pin the Python version**

Create `desmos/.python-version`:
```
3.12
```

- [ ] **Step 3: Remove Railway/Docker config**

Run:
```bash
cd /home/andy/andypandy/desmos
git rm railway.toml nixpacks.toml Procfile Dockerfile
```

- [ ] **Step 4: Commit**

Run:
```bash
cd /home/andy/andypandy
git add desmos/pyproject.toml desmos/.python-version
git commit -m "desmos: vercel python config; drop railway/docker"
```

### Task 2.5: Deploy Desmos to a new Vercel project and verify on *.vercel.app

**Files:** none (Vercel)

- [ ] **Step 1: Link and deploy a new project from the `desmos/` directory**

Run (user authenticated with `vercel login`):
```bash
cd /home/andy/andypandy/desmos
vercel link --yes --project desmos-renderer       # creates/links a NEW project named desmos-renderer
git -C /home/andy/andypandy push                  # ensure GitHub has latest
vercel deploy                                     # builds on Vercel; prints the preview *.vercel.app URL
```
Note the preview URL printed (e.g. `https://desmos-renderer-xxxx.vercel.app`).

> Important: in the Vercel dashboard for this new project, set Root Directory = `desmos` and connect the `ChinesePrince07/andypandy` repo so Git pushes auto-deploy. (CLI `vercel link` from the subdir handles the local link; the Git connection + Root Directory is set in the dashboard.)

- [ ] **Step 2: Verify health and render on the preview URL**

Run (replace URL):
```bash
URL=https://desmos-renderer-xxxx.vercel.app
curl -s $URL/health
curl -s -F "file=@/home/andy/andypandy/desmos/frames/frame1.png" $URL/render | head -c 200
```
Expected: `{"status":"ok"}` and a `{"result":[...],"width":...,"height":...}` payload. Then open `$URL/calculator`, upload an image, confirm it renders.

If `opencv` import fails in the build logs, confirm `opencv-python-headless` (not `opencv-python`) is in requirements and Python is 3.12.

### Task 2.6: Migrate the domain and retire Railway

**Files:** none (Vercel + Cloudflare + Railway)

- [ ] **Step 1: Add the domain to the new Vercel project**

Run:
```bash
cd /home/andy/andypandy/desmos
vercel domains add desmos.andypandy.org   # from the linked project dir, assigns the domain to this project
```
Read the exact CNAME target Vercel assigns — do NOT assume a fixed value (it is
often a project-specific target, today typically `cname.vercel-dns-0.com` or a
`*.vercel-dns-NNN.com` hostname):
```bash
vercel domains inspect desmos.andypandy.org
```

- [ ] **Step 2: Update Cloudflare DNS (user action)**

In Cloudflare DNS for `andypandy.org`: change the `desmos` record from the Railway target to the Vercel CNAME target shown in Step 1. Set proxy status as Vercel recommends (typically DNS-only / grey cloud for verification, then per preference).

- [ ] **Step 3: Verify the live domain**

Run:
```bash
curl -s https://desmos.andypandy.org/health
```
Expected: `{"status":"ok"}`. Open `https://desmos.andypandy.org/calculator` and render an image.

- [ ] **Step 4: Delete the Railway service**

In Railway, delete the DesmosBezierRenderer service/project (only after the Vercel domain is confirmed working).

---

## PHASE 3 — TI-84 server migration (Railway Express → Vercel Function)

All paths in this phase are under `/home/andy/andypandy/ti84/server/`. Preserve every endpoint's request/response contract exactly (the ESP32 in the field depends on it).

### Task 3.1: Add the S3 SDK and an R2 helper

**Files:**
- Modify: `ti84/server/package.json` (add `@aws-sdk/client-s3`)
- Create: `ti84/server/lib/r2.mjs`

- [ ] **Step 1: Add the dependency**

Run:
```bash
cd /home/andy/andypandy/ti84/server
npm install @aws-sdk/client-s3@^3.990.0
```
Expected: `@aws-sdk/client-s3` added to `dependencies` and `package-lock.json` updated.

- [ ] **Step 2: Create the R2 helper**

Create `ti84/server/lib/r2.mjs`:
```js
import { S3Client, GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";

// Vercel env vars sometimes carry stray newlines/whitespace when pasted.
function envTrim(name) {
  return (process.env[name] || "").trim();
}

const s3 = new S3Client({
  region: "auto",
  endpoint: envTrim("R2_ENDPOINT") || undefined,
  credentials: {
    accessKeyId: envTrim("R2_ACCESS_KEY_ID"),
    secretAccessKey: envTrim("R2_SECRET_ACCESS_KEY"),
  },
});

const BUCKET = envTrim("R2_BUCKET_NAME") || "afilmory-photos";

function isNotFound(err) {
  return err?.$metadata?.httpStatusCode === 404 || err?.name === "NoSuchKey";
}

export async function r2GetBuffer(key) {
  try {
    const res = await s3.send(new GetObjectCommand({ Bucket: BUCKET, Key: key }));
    if (!res.Body) return null;
    const bytes = await res.Body.transformToByteArray();
    return Buffer.from(bytes);
  } catch (err) {
    if (isNotFound(err)) return null;
    throw err;
  }
}

export async function r2GetText(key) {
  const buf = await r2GetBuffer(key);
  return buf ? buf.toString("utf8") : null;
}

export async function r2GetJson(key, fallback) {
  const txt = await r2GetText(key);
  if (txt === null) return fallback;
  try {
    return JSON.parse(txt);
  } catch {
    return fallback;
  }
}

export async function r2PutBuffer(key, body, contentType = "application/octet-stream") {
  await s3.send(new PutObjectCommand({ Bucket: BUCKET, Key: key, Body: body, ContentType: contentType }));
}

export async function r2PutText(key, text, contentType = "text/plain") {
  await r2PutBuffer(key, Buffer.from(text, "utf8"), contentType);
}

export async function r2PutJson(key, obj) {
  await r2PutBuffer(key, Buffer.from(JSON.stringify(obj)), "application/json");
}
```

- [ ] **Step 3: Commit**

Run:
```bash
cd /home/andy/andypandy
git add ti84/server/package.json ti84/server/package-lock.json ti84/server/lib/r2.mjs
git commit -m "ti84: add S3 SDK and R2 helper"
```

### Task 3.2: Move chat history to R2 and make /solve in-memory

**Files:**
- Modify (full rewrite): `ti84/server/routes/chatgpt.mjs`

- [ ] **Step 1: Replace chatgpt.mjs**

Overwrite `ti84/server/routes/chatgpt.mjs` with (logic identical to today, only storage changed — lowdb→R2, and `/solve` no longer writes to disk; the added early `return` on a bad `/solve` content-type also fixes a latent double-send bug in the original):
```js
import express from "express";
import openai from "openai";
import jimp from "jimp";
import crypto from "crypto";
import { r2GetJson, r2PutJson } from "../lib/r2.mjs";

const CHAT_KEY = "ti84/chat/db.json";
const DAY_MS = 24 * 60 * 60 * 1000;

async function readDb() {
  return await r2GetJson(CHAT_KEY, { conversations: {} });
}
async function writeDb(data) {
  await r2PutJson(CHAT_KEY, data);
}

export async function chatgpt() {
  const routes = express.Router();
  const gpt = new openai.OpenAI();

  routes.get("/ask", async (req, res) => {
    const question = req.query.question ?? "";
    if (Array.isArray(question)) {
      res.sendStatus(400);
      return;
    }

    const hasSid = "sid" in req.query;

    try {
      // Stateless mode (derivative, translate, etc.)
      if (!hasSid) {
        const isMath = "math" in req.query;
        const systemPrompt = isMath
          ? "You are a precise math solver for a TI-84 calculator. Compute the EXACT answer. Show ONLY the final numerical result or simplified expression. Use UPPERCASE. NEVER use LaTeX, backslashes, or curly braces. Write fractions as A/B, exponents as X^N, pi as PI, sqrt as SQRT(). Keep under 200 characters."
          : "You are answering questions on a TI-84 calculator. Keep responses under 100 characters, use UPPERCASE letters only. NEVER use LaTeX, backslashes, or curly braces. Write fractions as A/B, exponents as X^N, pi as PI, sqrt as SQRT().";
        const result = await gpt.chat.completions.create({
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: question },
          ],
          model: isMath ? "gpt-5.4" : "gpt-5.4-nano",
        });
        res.send(result.choices[0]?.message?.content ?? "no response");
        return;
      }

      // Chat mode with session
      const data = await readDb();

      // Cleanup old conversations
      const now = Date.now();
      for (const [id, conv] of Object.entries(data.conversations)) {
        if (now - conv.created > DAY_MS) delete data.conversations[id];
      }

      let sessionId = req.query.sid;
      let history = [];

      if (sessionId && data.conversations[sessionId]) {
        history = data.conversations[sessionId].messages;
      } else {
        sessionId = crypto.randomBytes(4).toString("hex");
        data.conversations[sessionId] = { created: now, messages: [] };
      }

      const messages = [
        {
          role: "system",
          content:
            "You are answering questions on a TI-84 calculator. Keep responses under 100 characters, use UPPERCASE letters only. NEVER use LaTeX, backslashes, or curly braces. Write fractions as A/B, exponents as X^N, pi as PI, sqrt as SQRT().",
        },
        ...history.slice(-10),
        { role: "user", content: question },
      ];

      const result = await gpt.chat.completions.create({ messages, model: "gpt-5.4-nano" });
      const answer = result.choices[0]?.message?.content ?? "NO RESPONSE";

      data.conversations[sessionId].messages.push(
        { role: "user", content: question },
        { role: "assistant", content: answer }
      );
      await writeDb(data);

      res.send(`${sessionId}|${answer}`);
    } catch (e) {
      console.error(e);
      res.sendStatus(500);
    }
  });

  routes.get("/history", async (req, res) => {
    const sid = req.query.sid ?? "";
    const page = parseInt(req.query.p ?? "0");

    if (!sid) {
      res.status(400).send("NO SESSION");
      return;
    }

    const data = await readDb();
    const conv = data.conversations[sid];
    if (!conv) {
      res.send("0/0|NO HISTORY");
      return;
    }

    const totalPairs = Math.floor(conv.messages.length / 2);
    if (page < 0 || page >= totalPairs) {
      res.send(`${page}/${totalPairs}|NO MORE`);
      return;
    }

    const q = conv.messages[page * 2].content.substring(0, 80);
    const a = conv.messages[page * 2 + 1].content.substring(0, 150);
    res.send(`${page}/${totalPairs}|Q:${q} A:${a}`);
  });

  // Solve a math equation from an uploaded image (in-memory, no disk write).
  routes.post("/solve", async (req, res) => {
    try {
      const contentType = req.headers["content-type"];
      if (contentType !== "image/jpg") {
        res.status(400).send(`bad content-type: ${contentType}`);
        return;
      }

      const image = await jimp.read(req.body);
      const jpegBuffer = await image.getBufferAsync(jimp.MIME_JPEG);
      const encoded_image = jpegBuffer.toString("base64");

      const question_number = req.query.n;
      const question = question_number
        ? `What is the answer to question ${question_number}?`
        : "What is the answer to this question?";

      const result = await gpt.chat.completions.create({
        messages: [
          {
            role: "system",
            content:
              "You are a helpful math tutor, specifically designed to help with basic arithmetic, but also can answer a broad range of math questions from uploaded images. You should provide answers as succinctly as possible, and always under 100 characters. Be as accurate as possible.",
          },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: `${question} Do not explain how you found the answer. If the question is multiple-choice, give the letter answer.`,
              },
              { type: "image_url", image_url: { url: `data:image/jpeg;base64,${encoded_image}`, detail: "high" } },
            ],
          },
        ],
        model: "gpt-5.4-nano",
      });

      res.send(result.choices[0]?.message?.content ?? "no response");
    } catch (e) {
      console.error(e);
      res.sendStatus(500);
    }
  });

  return routes;
}
```

- [ ] **Step 2: Commit**

Run:
```bash
cd /home/andy/andypandy
git add ti84/server/routes/chatgpt.mjs
git commit -m "ti84: chat history in R2; /solve fully in-memory"
```

### Task 3.3: Back firmware OTA with R2

**Files:**
- Modify (full rewrite): `ti84/server/routes/firmware.mjs`

- [ ] **Step 1: Replace firmware.mjs**

Overwrite `ti84/server/routes/firmware.mjs` with (same endpoints/behaviour; storage = R2 keys under `ti84/firmware/`). NOTE (added during execution after the local smoke test): every handler is wrapped in `try/catch` returning 500 — without it, an R2 error in an async handler is an unhandled rejection that crashes the function (Node ≥15). The committed version below reflects this:
```js
import express from "express";
import { r2GetBuffer, r2GetText, r2PutBuffer, r2PutText } from "../lib/r2.mjs";

const VERSION_KEY = "ti84/firmware/version.txt";
const FIRMWARE_KEY = "ti84/firmware/firmware.bin";
const LAUNCHER_KEY = "ti84/firmware/launcher.bin";

export function firmware() {
  const router = express.Router();

  // Debug endpoint
  router.get("/debug", async (req, res) => {
    const version = await r2GetText(VERSION_KEY);
    const fw = await r2GetBuffer(FIRMWARE_KEY);
    const launcher = await r2GetBuffer(LAUNCHER_KEY);
    res.json({
      store: "r2",
      versionExists: version !== null,
      firmwareExists: fw !== null,
      launcherExists: launcher !== null,
      version: version ?? "N/A",
      firmwareBytes: fw ? fw.length : 0,
      launcherBytes: launcher ? launcher.length : 0,
    });
  });

  // Current firmware version (defaults to 1.0.0 if none stored)
  router.get("/version", async (req, res) => {
    const version = await r2GetText(VERSION_KEY);
    res.send(version ? version.trim() : "1.0.0");
  });

  // Download launcher binary (for calculator OTA)
  router.get("/launcher", async (req, res) => {
    const buf = await r2GetBuffer(LAUNCHER_KEY);
    if (!buf) {
      res.status(404).send("No launcher available");
      return;
    }
    res.setHeader("Content-Type", "application/octet-stream");
    res.send(buf);
  });

  // Upload launcher (.8xp): strip header, prepend size word, store in R2
  router.post("/upload_launcher", express.raw({ type: "application/octet-stream", limit: "1mb" }), async (req, res) => {
    const version = req.query.version;
    if (!version) {
      res.status(400).send("version required");
      return;
    }
    const bytes = new Uint8Array(req.body);
    const programBytes = bytes.subarray(74, bytes.length - 2);
    const varBytes = Buffer.from([programBytes.length & 0xff, (programBytes.length >> 8) & 0xff, ...programBytes]);

    await r2PutBuffer(LAUNCHER_KEY, varBytes);
    await r2PutText(VERSION_KEY, String(version));
    res.send("OK");
  });

  // Download firmware binary (for ESP32 OTA)
  router.get("/download", async (req, res) => {
    const buf = await r2GetBuffer(FIRMWARE_KEY);
    if (!buf) {
      res.status(404).send("No firmware available");
      return;
    }
    res.setHeader("Content-Type", "application/octet-stream");
    res.setHeader("Content-Disposition", "attachment; filename=firmware.bin");
    res.send(buf);
  });

  // Upload firmware
  router.post("/upload", express.raw({ type: "application/octet-stream", limit: "4mb" }), async (req, res) => {
    const version = req.query.version;
    if (!version) {
      res.status(400).send("version required");
      return;
    }
    await r2PutBuffer(FIRMWARE_KEY, Buffer.from(req.body));
    await r2PutText(VERSION_KEY, String(version));
    res.send("OK");
  });

  return router;
}
```

- [ ] **Step 2: Commit**

Run:
```bash
cd /home/andy/andypandy
git add ti84/server/routes/firmware.mjs
git commit -m "ti84: firmware OTA backed by R2"
```

### Task 3.4: Keep `process.cwd()` for program/image reads (no code change)

`routes/programs.mjs` and `routes/images.mjs` read their asset directories with
`path.join(process.cwd(), "programs")` / `"images"`. On Vercel, `process.cwd()`
is the project base = the project's Root Directory (`ti84/server`), so these
already resolve to `ti84/server/programs` and `ti84/server/images`. Vercel's own
guidance recommends `process.cwd()` over `__dirname` for reading bundled files,
and the original code already uses it — so **leave both files unchanged**. The
files still must be *included* in the function bundle (their names are read
dynamically, which the bundler can't trace) — that is handled by `includeFiles`
in Task 3.6.

**Files:** none (no code change).

- [ ] **Step 1: Confirm both files use `process.cwd()`; nothing else needed here**

Run:
```bash
cd /home/andy/andypandy
grep -n "process.cwd()" ti84/server/routes/programs.mjs ti84/server/routes/images.mjs
```
Expected: each file shows its existing `process.cwd()`-based directory line. No edits in this task — bundling is ensured by Task 3.6 and verified by the Task 3.9 `/programs/list` smoke test.

### Task 3.5: Export the Express app for Vercel

**Files:**
- Modify: `ti84/server/index.mjs`

- [ ] **Step 1: Rewrite index.mjs to build the app at module load and export it**

Overwrite `ti84/server/index.mjs` with:
```js
import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import morgan from "morgan";
import dot from "dotenv";
import { chatgpt } from "./routes/chatgpt.mjs";
import { images } from "./routes/images.mjs";
import { programs } from "./routes/programs.mjs";
import { firmware } from "./routes/firmware.mjs";
import { logs } from "./routes/logs.mjs";
import { requests, captureMiddleware } from "./routes/requests.mjs";

dot.config();

const app = express();
app.use(morgan("dev"));
app.use(cors("*"));
app.use(bodyParser.raw({ type: "image/jpg", limit: "10mb" }));
app.use((req, res, next) => {
  console.log(req.headers.authorization);
  next();
});

// Capture inbound requests (before route handlers so res.on('finish') fires)
app.use(captureMiddleware());

app.use("/requests", requests());
app.use("/programs", programs());
app.use("/gpt", await chatgpt());
app.use("/image", images());
app.use("/firmware", firmware());
app.use("/logs", logs());

// Vercel imports this module and uses the default export as the handler.
export default app;

// Local dev: only listen when run directly (node index.mjs), not on Vercel.
if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  const port = +(process.env.PORT ?? 8080);
  app.listen(port, () => console.log(`listening on ${port}`));
}
```

- [ ] **Step 2: Commit**

Run:
```bash
cd /home/andy/andypandy
git add ti84/server/index.mjs
git commit -m "ti84: export Express app for Vercel; guard local listen"
```

### Task 3.6: Vercel config for the Express function; drop Railway

**Files:**
- Create: `ti84/server/vercel.json`
- Delete: `ti84/server/railway.json`

- [ ] **Step 1: Create vercel.json to bundle the static program/image assets**

Create `ti84/server/vercel.json`:
```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "functions": {
    "index.mjs": {
      "includeFiles": "{programs,images}/**"
    }
  }
}
```

- [ ] **Step 2: Remove Railway config**

Run:
```bash
cd /home/andy/andypandy/ti84/server
git rm railway.json
```

- [ ] **Step 3: Commit**

Run:
```bash
cd /home/andy/andypandy
git add ti84/server/vercel.json
git commit -m "ti84: vercel config (bundle programs/images); drop railway.json"
```

### Task 3.7: Seed R2 with the current firmware/version

**Files:**
- Create (temporary, not committed): `ti84/server/scripts/seed-firmware.mjs`

- [ ] **Step 1: Write a one-off seed script**

Create `ti84/server/scripts/seed-firmware.mjs`:
```js
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { r2PutBuffer, r2PutText } from "../lib/r2.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fwDir = path.join(__dirname, "..", "firmware");

const fw = fs.readFileSync(path.join(fwDir, "firmware.bin"));
const version = fs.readFileSync(path.join(fwDir, "version.txt"), "utf8").trim();

await r2PutBuffer("ti84/firmware/firmware.bin", fw);
await r2PutText("ti84/firmware/version.txt", version);
console.log(`Seeded R2: firmware.bin (${fw.length} bytes), version ${version}`);
```

- [ ] **Step 2: Run it with R2 creds in the environment (user provides creds)**

Run:
```bash
cd /home/andy/andypandy/ti84/server
# Export R2_ENDPOINT, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME first
node scripts/seed-firmware.mjs
```
Expected: `Seeded R2: firmware.bin (1159728 bytes), version 1.0.0`.

- [ ] **Step 3: Remove the seed script (one-off) and commit the removal note**

Run:
```bash
cd /home/andy/andypandy/ti84/server
rm scripts/seed-firmware.mjs
rmdir scripts 2>/dev/null || true
```
(The script is intentionally not committed; it's a one-time bootstrap.)

### Task 3.8: Local structural smoke test

**Files:** none (verification)

- [ ] **Step 1: Boot the server locally and hit the no-credential endpoints**

Run:
```bash
cd /home/andy/andypandy/ti84/server
npm install
OPENAI_API_KEY=dummy node index.mjs &
sleep 2
echo "--- programs ---"; curl -s "localhost:8080/programs/list?p=0" | head -c 120; echo
echo "--- requests json ---"; curl -s "localhost:8080/requests" | head -c 120; echo
echo "--- logs ---"; curl -s "localhost:8080/logs" | head -c 120; echo
kill %1
```
Expected: `/programs/list` returns the padded program names string; `/requests` returns `{"total":...,"count":...,"entries":[...]}`; `/logs` returns `{"total":0,"lines":[]}`. (R2/OpenAI endpoints are verified after deploy with real env.)

### Task 3.9: Deploy TI-84 to a new Vercel project and verify

**Files:** none (Vercel)

- [ ] **Step 1: Link a new project from `ti84/server` and set env vars**

Run (user authenticated):
```bash
cd /home/andy/andypandy/ti84/server
vercel link --yes --project ti84-api
# Add env vars (production):
vercel env add OPENAI_API_KEY production
vercel env add R2_ENDPOINT production
vercel env add R2_ACCESS_KEY_ID production
vercel env add R2_SECRET_ACCESS_KEY production
vercel env add R2_BUCKET_NAME production
git -C /home/andy/andypandy push
vercel deploy --prod
```
> In the dashboard for `ti84-api`: connect `ChinesePrince07/andypandy`, set Root Directory = `ti84/server`.

- [ ] **Step 2: Verify endpoints on the deployment URL**

Run (replace URL):
```bash
URL=https://ti84-api-xxxx.vercel.app
echo "--- version (R2) ---"; curl -s $URL/firmware/version; echo
echo "--- download size ---"; curl -s -o /tmp/fw.bin -w "%{size_download}\n" $URL/firmware/download
echo "--- programs ---"; curl -s "$URL/programs/list?p=0" | head -c 80; echo
echo "--- gpt stateless ---"; curl -s "$URL/gpt/ask?question=WHAT+IS+2+PLUS+2"; echo
echo "--- gpt chat (sid) ---"; curl -s "$URL/gpt/ask?sid=&question=SAY+HI"; echo
```
Expected: version `1.0.0`; download size `1159728`; programs string; a stateless answer for the no-`sid` call; a `xxxxxxxx|ANSWER` formatted response for the `sid=` call (confirms R2 chat write succeeded).

If `/programs/list` is empty, the `includeFiles` glob didn't bundle the files — verify `ti84/server/vercel.json` and that `programs/` contains the committed files; redeploy.

### Task 3.10: Migrate api.andypandy.org and verify the calculator

**Files:** none (Vercel + Cloudflare + Railway + physical device)

- [ ] **Step 1: Add the domain to the `ti84-api` project**

Run:
```bash
cd /home/andy/andypandy/ti84/server
vercel domains add api.andypandy.org
```
Note the CNAME target Vercel shows.

- [ ] **Step 2: Update Cloudflare DNS (user action)**

Change the `api` record for `andypandy.org` from the Railway target to the Vercel CNAME target.

- [ ] **Step 3: Verify the live domain end-to-end**

Run:
```bash
curl -s https://api.andypandy.org/firmware/version; echo
curl -s "https://api.andypandy.org/gpt/ask?question=WHAT+IS+THE+CAPITAL+OF+FRANCE"; echo
```
Expected: `1.0.0`; a short uppercase answer.

- [ ] **Step 4: Verify on the physical calculator**

On the TI-84: run ANDYGPT → GPT → ASK a question; confirm a response. Check Settings → VERSION shows `1.0.0`. (No firmware change needed — the ESP32 already points at `api.andypandy.org`.)

- [ ] **Step 5: Delete the Railway service**

After the calculator is confirmed working, delete the TI-84 server service in Railway.

---

## PHASE 4 — Cleanup

### Task 4.1: Archive the original repositories

**Files:** none (GitHub)

- [ ] **Step 1: Archive each original repo (keeps them as read-only mirrors)**

Run:
```bash
gh repo archive ChinesePrince07/personal-site --yes
gh repo archive ChinesePrince07/afilmory-photos --yes
gh repo archive ChinesePrince07/DesmosBezierRenderer-mac --yes
gh repo archive ChinesePrince07/TI-84-GPT-HACK --yes
```
Expected: each reports archived. (Note: `personal-site` and `afilmory-photos` Vercel projects now build from `andypandy`, so archiving the originals is safe.)

> `site/lib/projects.ts` still fetches project READMEs from these repos by `owner/name`; archived repos remain readable via the GitHub API, so the projects page keeps working unchanged.

### Task 4.2: Final pass — README links and stray config

**Files:**
- Modify: `site/lib/projects.ts` (only if a demo link needs updating — verify first)

- [ ] **Step 1: Confirm projects page still resolves READMEs**

Run:
```bash
curl -s "https://andypandy.org/projects/desmos-bezier-renderer/" -o /dev/null -w "%{http_code}\n"
curl -s "https://andypandy.org/projects/ti-84-gpt-hack/" -o /dev/null -w "%{http_code}\n"
```
Expected: `200` for both (READMEs fetched from the archived mirrors). No code change needed if these pass.

- [ ] **Step 2: Verify no leftover Railway/Docker config remains in the migrated folders**

Run:
```bash
cd /home/andy/andypandy
find desmos ti84 -iname "*railway*" -o -iname "nixpacks.toml" -o -iname "Procfile" -o -iname "Dockerfile"
```
Expected: no output (all removed in Tasks 2.4 and 3.6).

- [ ] **Step 3: Final commit if anything changed**

Run:
```bash
cd /home/andy/andypandy
git add -A && git commit -m "chore: post-migration cleanup" || echo "nothing to commit"
git push
```

---

## Done criteria

- `andypandy.org` and `pics.andypandy.org` deploy from `andypandy` (folders `site/`, `photos/`), unchanged behavior.
- `desmos.andypandy.org` serves the renderer from Vercel (Python/potracer), Railway deleted.
- `api.andypandy.org` serves the TI-84 API from Vercel (Express + R2), the physical calculator works, Railway deleted.
- All four original repos archived; histories preserved under each subfolder in `andypandy`.
