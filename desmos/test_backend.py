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
    # blanked trace (the pypotrace->potracer regression) would give only ~8.
    assert len(payload['result']) > 15
    first = payload['result'][0]
    assert set(first.keys()) == {'id', 'latex', 'color', 'secret'}
    assert payload['width'] == 60 and payload['height'] == 60


def test_render_rejects_missing_file():
    client = app.test_client()
    res = client.post('/render', data={}, content_type='multipart/form-data')
    assert res.status_code == 400
