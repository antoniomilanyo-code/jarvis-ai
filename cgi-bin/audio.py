#!/usr/bin/env python3
"""JARVIS Audio Hosting — accepts base64 audio, stores and serves it."""
import json, os, sys, base64, hashlib, time

AUDIO_DIR = os.path.join(os.path.dirname(__file__), '..', 'audio')
os.makedirs(AUDIO_DIR, exist_ok=True)

method = os.environ.get('REQUEST_METHOD', 'GET')
qs = os.environ.get('QUERY_STRING', '')
path_info = os.environ.get('PATH_INFO', '')

def parse_qs(qs):
    params = {}
    for part in qs.split('&'):
        if '=' in part:
            k, v = part.split('=', 1)
            params[k] = v
    return params

params = parse_qs(qs)

if method == 'POST':
    # Accept base64-encoded audio, save to file, return URL
    try:
        length = int(os.environ.get('CONTENT_LENGTH', 0))
        body = json.loads(sys.stdin.read(length)) if length > 0 else {}
        audio_b64 = body.get('audio', '')
        fmt = body.get('format', 'mp3')
        filename = body.get('filename', '')
        
        if not audio_b64:
            print("Status: 400")
            print("Content-Type: application/json")
            print()
            print(json.dumps({"error": "Missing 'audio' field (base64)"}))
            sys.exit(0)
        
        audio_bytes = base64.b64decode(audio_b64)
        
        if not filename:
            h = hashlib.md5(str(time.time()).encode()).hexdigest()[:10]
            filename = f"jarvis_{h}.{fmt}"
        
        filepath = os.path.join(AUDIO_DIR, filename)
        with open(filepath, 'wb') as f:
            f.write(audio_bytes)
        
        print("Status: 201")
        print("Content-Type: application/json")
        print()
        print(json.dumps({
            "ok": True,
            "filename": filename,
            "path": f"audio/{filename}",
            "size": len(audio_bytes)
        }))
    except Exception as e:
        print("Status: 500")
        print("Content-Type: application/json")
        print()
        print(json.dumps({"error": str(e)}))

elif method == 'GET':
    # Serve audio file
    filename = params.get('file', '')
    if filename:
        filepath = os.path.join(AUDIO_DIR, filename)
        if os.path.exists(filepath):
            ext = filename.rsplit('.', 1)[-1].lower()
            mime = {'mp3': 'audio/mpeg', 'ogg': 'audio/ogg', 'wav': 'audio/wav'}.get(ext, 'application/octet-stream')
            with open(filepath, 'rb') as f:
                data = f.read()
            print(f"Content-Type: {mime}")
            print(f"Content-Length: {len(data)}")
            print()
            sys.stdout.buffer.write(data)
        else:
            print("Status: 404")
            print("Content-Type: application/json")
            print()
            print(json.dumps({"error": "File not found"}))
    else:
        # List audio files
        files = sorted(os.listdir(AUDIO_DIR)) if os.path.isdir(AUDIO_DIR) else []
        print("Content-Type: application/json")
        print()
        print(json.dumps({"files": files}))

elif method == 'DELETE':
    filename = params.get('file', '')
    if filename:
        filepath = os.path.join(AUDIO_DIR, filename)
        if os.path.exists(filepath):
            os.remove(filepath)
        print("Content-Type: application/json")
        print()
        print(json.dumps({"deleted": filename}))
    else:
        # Clean old files (older than 24 hours)
        now = time.time()
        cleaned = 0
        if os.path.isdir(AUDIO_DIR):
            for f in os.listdir(AUDIO_DIR):
                fp = os.path.join(AUDIO_DIR, f)
                if os.path.getmtime(fp) < now - 86400:
                    os.remove(fp)
                    cleaned += 1
        print("Content-Type: application/json")
        print()
        print(json.dumps({"cleaned": cleaned}))
