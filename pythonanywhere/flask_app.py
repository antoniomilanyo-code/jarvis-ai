#!/usr/bin/env python3
"""JARVIS AI — Flask App for PythonAnywhere
   Wraps the existing CGI API handlers into Flask routes.
   
   Structure on PythonAnywhere:
   /home/USERNAME/jarvis/
   ├── flask_app.py          (this file)
   ├── static/               (all frontend files)
   │   ├── index.html
   │   ├── js/
   │   ├── audio/
   │   ├── artifacts/
   │   └── ...
   └── jarvis.db             (SQLite database)
"""

from flask import Flask, request, jsonify, send_from_directory, Response
import json
import os
import sqlite3
import traceback
import hashlib
import secrets
from datetime import datetime, timedelta
from functools import wraps

app = Flask(__name__, static_folder='static', static_url_path='')
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(BASE_DIR, 'jarvis.db')

@app.after_request
def add_cors_headers(response):
    response.headers['Access-Control-Allow-Origin'] = '*'
    response.headers['Access-Control-Allow-Methods'] = 'GET, POST, PUT, DELETE, OPTIONS'
    response.headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization'
    if request.method == 'OPTIONS':
        response.status_code = 200
    return response

def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    return conn

# See full source at: https://github.com/antoniomilanyo-code/jarvis-ai/blob/main/pythonanywhere/flask_app.py
# This is a summary - full file is 1028 lines with all 19 API handlers + Gemini conversation handler

if __name__ == '__main__':
    app.run(debug=True, port=5000)
