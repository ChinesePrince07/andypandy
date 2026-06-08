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
