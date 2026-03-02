#!/usr/bin/env python3
"""JARVIS AI — Flask App for PythonAnywhere
   Wraps the existing CGI API handlers into Flask routes.
   
   Structure on PythonAnywhere:
   /home/USERNAME/jarvis/
   ├── flask_app.py          (this file)
   ├── api_handlers.py       (extracted from api.py)
   ├── conversation_handler.py (Gemini conversation)
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

# ═══════════════════════════════════════════════════════
#  APP SETUP
# ═══════════════════════════════════════════════════════

app = Flask(__name__, static_folder='.', static_url_path='')

# Database path
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(BASE_DIR, 'jarvis.db')

# CORS headers
@app.after_request
def add_cors_headers(response):
    response.headers['Access-Control-Allow-Origin'] = '*'
    response.headers['Access-Control-Allow-Methods'] = 'GET, POST, PUT, DELETE, OPTIONS'
    response.headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization'
    if request.method == 'OPTIONS':
        response.status_code = 200
    return response

# ═══════════════════════════════════════════════════════
#  DATABASE
# ═══════════════════════════════════════════════════════

def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    return conn

def init_db():
    conn = get_db()
    conn.executescript("""
        CREATE TABLE IF NOT EXISTS conversations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            role TEXT NOT NULL,
            content TEXT NOT NULL,
            topic TEXT DEFAULT '',
            source TEXT DEFAULT 'web',
            phone TEXT DEFAULT '',
            thread_id TEXT DEFAULT '',
            sentiment TEXT DEFAULT 'neutral',
            sentiment_score REAL DEFAULT 0.0,
            language TEXT DEFAULT 'en',
            created_at TEXT DEFAULT (datetime('now'))
        );
        CREATE TABLE IF NOT EXISTS projects (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            status TEXT DEFAULT 'Active',
            description TEXT DEFAULT '',
            progress INTEGER DEFAULT 0,
            color TEXT DEFAULT '#00d4ff',
            created_at TEXT DEFAULT (datetime('now')),
            updated_at TEXT DEFAULT (datetime('now'))
        );
        CREATE TABLE IF NOT EXISTS tasks (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            project_id INTEGER,
            title TEXT NOT NULL,
            description TEXT DEFAULT '',
            status TEXT DEFAULT 'todo',
            priority TEXT DEFAULT 'medium',
            created_at TEXT DEFAULT (datetime('now')),
            updated_at TEXT DEFAULT (datetime('now')),
            FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
        );
        CREATE TABLE IF NOT EXISTS memories (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            content TEXT NOT NULL,
            tags TEXT DEFAULT '[]',
            category TEXT DEFAULT 'general',
            source TEXT DEFAULT 'conversation',
            importance INTEGER DEFAULT 5,
            access_count INTEGER DEFAULT 0,
            last_accessed TEXT DEFAULT '',
            linked_memories TEXT DEFAULT '[]',
            auto_tags TEXT DEFAULT '[]',
            created_at TEXT DEFAULT (datetime('now'))
        );
        CREATE TABLE IF NOT EXISTS research (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            topic TEXT NOT NULL,
            summary TEXT DEFAULT '',
            findings TEXT DEFAULT '[]',
            sources TEXT DEFAULT '[]',
            status TEXT DEFAULT 'complete',
            created_at TEXT DEFAULT (datetime('now'))
        );
        CREATE TABLE IF NOT EXISTS operations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            status TEXT DEFAULT 'queued',
            progress INTEGER DEFAULT 0,
            result TEXT DEFAULT '',
            group_id TEXT DEFAULT '',
            depends_on TEXT DEFAULT '[]',
            priority INTEGER DEFAULT 5,
            type TEXT DEFAULT 'general',
            created_at TEXT DEFAULT (datetime('now')),
            updated_at TEXT DEFAULT (datetime('now'))
        );
        CREATE TABLE IF NOT EXISTS scheduled_tasks (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            description TEXT DEFAULT '',
            type TEXT DEFAULT 'report',
            deadline TEXT NOT NULL,
            scheduled_for TEXT DEFAULT '',
            status TEXT DEFAULT 'scheduled',
            progress INTEGER DEFAULT 0,
            priority TEXT DEFAULT 'medium',
            result TEXT DEFAULT '',
            result_url TEXT DEFAULT '',
            delay_reason TEXT DEFAULT '',
            project_id INTEGER DEFAULT NULL,
            source TEXT DEFAULT 'whatsapp',
            created_at TEXT DEFAULT (datetime('now')),
            updated_at TEXT DEFAULT (datetime('now')),
            completed_at TEXT DEFAULT NULL,
            FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL
        );
        CREATE TABLE IF NOT EXISTS user_profile (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            category TEXT NOT NULL,
            key TEXT NOT NULL,
            value TEXT NOT NULL,
            confidence REAL DEFAULT 1.0,
            source TEXT DEFAULT 'conversation',
            created_at TEXT DEFAULT (datetime('now')),
            updated_at TEXT DEFAULT (datetime('now')),
            UNIQUE(category, key)
        );
        CREATE TABLE IF NOT EXISTS settings (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL,
            updated_at TEXT DEFAULT (datetime('now'))
        );
        CREATE TABLE IF NOT EXISTS task_proposals (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            conversation_id INTEGER,
            project_id INTEGER,
            title TEXT NOT NULL,
            description TEXT DEFAULT '',
            objective TEXT DEFAULT '',
            reasoning TEXT DEFAULT '',
            priority TEXT DEFAULT 'medium',
            steps_json TEXT DEFAULT '[]',
            required_tools_json TEXT DEFAULT '[]',
            risk_level TEXT DEFAULT 'low',
            impact_level TEXT DEFAULT 'medium',
            status TEXT DEFAULT 'proposed',
            rejection_reason TEXT DEFAULT '',
            approved_at TEXT DEFAULT '',
            created_at TEXT DEFAULT (datetime('now')),
            updated_at TEXT DEFAULT (datetime('now')),
            FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL
        );
        CREATE TABLE IF NOT EXISTS task_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            task_id INTEGER,
            proposal_id INTEGER,
            step INTEGER DEFAULT 0,
            action TEXT DEFAULT '',
            input_json TEXT DEFAULT '{}',
            output_json TEXT DEFAULT '{}',
            status TEXT DEFAULT 'completed',
            error TEXT DEFAULT '',
            duration_ms INTEGER DEFAULT 0,
            created_at TEXT DEFAULT (datetime('now'))
        );
        CREATE TABLE IF NOT EXISTS artifacts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            task_id INTEGER,
            proposal_id INTEGER,
            project_id INTEGER,
            type TEXT DEFAULT 'report',
            title TEXT DEFAULT '',
            description TEXT DEFAULT '',
            content_json TEXT DEFAULT '{}',
            file_url TEXT DEFAULT '',
            file_type TEXT DEFAULT '',
            created_at TEXT DEFAULT (datetime('now'))
        );
        CREATE TABLE IF NOT EXISTS sentiment_log (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            conversation_id INTEGER,
            sentiment TEXT DEFAULT 'neutral',
            score REAL DEFAULT 0.0,
            emotions_json TEXT DEFAULT '{}',
            language TEXT DEFAULT 'en',
            created_at TEXT DEFAULT (datetime('now'))
        );
        CREATE TABLE IF NOT EXISTS conversation_threads (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT DEFAULT '',
            topic TEXT DEFAULT '',
            status TEXT DEFAULT 'active',
            message_count INTEGER DEFAULT 0,
            last_message_at TEXT DEFAULT '',
            summary TEXT DEFAULT '',
            created_at TEXT DEFAULT (datetime('now'))
        );
        CREATE TABLE IF NOT EXISTS operation_groups (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            status TEXT DEFAULT 'running',
            total_ops INTEGER DEFAULT 0,
            completed_ops INTEGER DEFAULT 0,
            created_at TEXT DEFAULT (datetime('now')),
            updated_at TEXT DEFAULT (datetime('now'))
        );
        CREATE TABLE IF NOT EXISTS memory_links (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            source_id INTEGER,
            target_id INTEGER,
            link_type TEXT DEFAULT 'related',
            strength REAL DEFAULT 0.5,
            created_at TEXT DEFAULT (datetime('now'))
        );
        CREATE TABLE IF NOT EXISTS memory_categories (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT UNIQUE NOT NULL,
            parent_id INTEGER DEFAULT NULL,
            color TEXT DEFAULT '#00d4ff',
            icon TEXT DEFAULT 'folder',
            created_at TEXT DEFAULT (datetime('now'))
        );
        CREATE TABLE IF NOT EXISTS briefings (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            type TEXT DEFAULT 'daily',
            title TEXT NOT NULL,
            content TEXT DEFAULT '',
            data_json TEXT DEFAULT '{}',
            priority TEXT DEFAULT 'medium',
            status TEXT DEFAULT 'active',
            created_at TEXT DEFAULT (datetime('now'))
        );
        CREATE TABLE IF NOT EXISTS interaction_patterns (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            pattern_type TEXT DEFAULT '',
            description TEXT DEFAULT '',
            frequency INTEGER DEFAULT 1,
            last_seen TEXT DEFAULT '',
            metadata_json TEXT DEFAULT '{}',
            created_at TEXT DEFAULT (datetime('now'))
        );

        /* Default settings */
        INSERT OR IGNORE INTO settings (key, value) VALUES
            ('user_name', 'Sir'),
            ('voice_rate', '0.9'),
            ('voice_pitch', '1.0'),
            ('voice_volume', '1.0');
    """)
    conn.commit()
    conn.close()

# Initialize DB on startup
init_db()

# ═══════════════════════════════════════════════════════
#  AUTH
# ═══════════════════════════════════════════════════════

AUTH_USER = 'antonio'
AUTH_PASS_HASH = hashlib.sha256('jarvis2026'.encode()).hexdigest()
TOKENS = {}  # token -> expiry datetime

def check_auth():
    """Check if request has valid auth token (skip for auth endpoint and OPTIONS)"""
    if request.method == 'OPTIONS':
        return None
    action = request.args.get('action', '')
    if action == 'auth':
        return None
    # Check for token in header or query
    token = request.headers.get('Authorization', '').replace('Bearer ', '')
    if not token:
        token = request.args.get('token', '')
    if token and token in TOKENS and TOKENS[token] > datetime.utcnow():
        return None
    # For API calls from the cron/backend, allow without auth
    if request.headers.get('X-Internal', '') == 'jarvis':
        return None
    return None  # Disabled strict auth for now — managed by frontend

# ═══════════════════════════════════════════════════════
#  STATIC FILES — Serve frontend
# ═══════════════════════════════════════════════════════

@app.route('/')
def serve_index():
    return send_from_directory(BASE_DIR, 'index.html')

# Backward-compatible CGI routes (so existing app.js works unchanged)
@app.route('/cgi-bin/api.py', methods=['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'])
def cgi_api_compat():
    return api_handler()

@app.route('/cgi-bin/conversation.py', methods=['GET', 'POST', 'OPTIONS'])
def cgi_conversation_compat():
    return conversation_handler()

@app.route('/<path:filename>')
def serve_static(filename):
    """Serve any static file — JS, CSS, audio, artifacts, etc."""
    file_path = os.path.join(BASE_DIR, filename)
    if os.path.isfile(file_path):
        return send_from_directory(BASE_DIR, filename)
    return jsonify({"error": "Not found"}), 404

# ═══════════════════════════════════════════════════════
#  API ROUTES
# ═══════════════════════════════════════════════════════

@app.route('/api', methods=['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'])
def api_handler():
    """Main API endpoint — handles all JARVIS actions"""
    if request.method == 'OPTIONS':
        return '', 200
    
    auth_error = check_auth()
    if auth_error:
        return jsonify({"error": "Unauthorized"}), 401
    
    action = request.args.get('action', '')
    if not action:
        return jsonify({"error": "No action specified", "available": list(HANDLERS.keys())})
    
    try:
        conn = get_db()
        body = {}
        if request.method in ('POST', 'PUT') and request.content_type and 'json' in request.content_type:
            body = request.get_json(force=True, silent=True) or {}
        
        handler = HANDLERS.get(action)
        if not handler:
            conn.close()
            return jsonify({"error": f"Unknown action: {action}"}), 400
        
        result, status_code = handler(conn, request.method, request.args, body)
        conn.close()
        return jsonify(result) if isinstance(result, (dict, list)) else Response(json.dumps(result), mimetype='application/json'), status_code
    except Exception as e:
        return jsonify({"error": str(e), "trace": traceback.format_exc()}), 422

# ═══════════════════════════════════════════════════════
#  HANDLER FUNCTIONS (same logic as CGI api.py)
# ═══════════════════════════════════════════════════════

def handle_auth(conn, method, params, body):
    sub = params.get('sub', 'login')
    
    # GET: status check — always report account exists (hardcoded auth)
    if method == 'GET':
        if sub == 'status':
            return {"has_account": True, "auth_type": "password"}, 200
        return {"has_account": True}, 200
    
    if method == 'POST':
        if sub == 'validate':
            # Validate existing token
            token = body.get('token', '')
            if token and token in TOKENS and TOKENS[token] > datetime.utcnow():
                return {"valid": True, "user": AUTH_USER}, 200
            return {"valid": False}, 401
        
        # Login (sub=login or sub=create — both do the same with hardcoded creds)
        username = body.get('username', '').lower().strip()
        password = body.get('password', '')
        pass_hash = hashlib.sha256(password.encode()).hexdigest()
        if username == AUTH_USER and pass_hash == AUTH_PASS_HASH:
            token = secrets.token_hex(32)
            TOKENS[token] = datetime.utcnow() + timedelta(days=30)
            return {"token": token, "expires_in": 30*24*3600, "user": username}, 200
        return {"error": "Invalid credentials"}, 401
    return {"error": "Method not allowed"}, 405

def handle_conversations(conn, method, params, body):
    if method == 'GET':
        limit = int(params.get('limit', 50))
        offset = int(params.get('offset', 0))
        source = params.get('source', '')
        query = "SELECT * FROM conversations"
        args = []
        if source:
            query += " WHERE source = ?"
            args.append(source)
        query += " ORDER BY id DESC LIMIT ? OFFSET ?"
        args.extend([limit, offset])
        rows = conn.execute(query, args).fetchall()
        return [dict(r) for r in rows], 200
    elif method == 'POST':
        role = body.get('role', 'user')
        content = body.get('content', '')
        source = body.get('source', 'web')
        topic = body.get('topic', '')
        thread_id = body.get('thread_id', '')
        cursor = conn.execute(
            "INSERT INTO conversations (role, content, source, topic, thread_id) VALUES (?, ?, ?, ?, ?)",
            [role, content, source, topic, thread_id]
        )
        conn.commit()
        row = conn.execute("SELECT * FROM conversations WHERE id = ?", [cursor.lastrowid]).fetchone()
        return dict(row), 201
    return {"error": "Method not allowed"}, 405

def handle_projects(conn, method, params, body):
    if method == 'GET':
        pid = params.get('id', '')
        if pid:
            row = conn.execute("SELECT * FROM projects WHERE id = ?", [pid]).fetchone()
            if row:
                tasks = conn.execute("SELECT * FROM tasks WHERE project_id = ? ORDER BY created_at DESC", [pid]).fetchall()
                result = dict(row)
                result['tasks'] = [dict(t) for t in tasks]
                return result, 200
            return {"error": "Not found"}, 404
        rows = conn.execute("SELECT * FROM projects ORDER BY updated_at DESC").fetchall()
        return [dict(r) for r in rows], 200
    elif method == 'POST':
        name = body.get('name', 'Untitled')
        cursor = conn.execute(
            "INSERT INTO projects (name, description, status, progress, color) VALUES (?, ?, ?, ?, ?)",
            [name, body.get('description', ''), body.get('status', 'Active'), body.get('progress', 0), body.get('color', '#00d4ff')]
        )
        conn.commit()
        row = conn.execute("SELECT * FROM projects WHERE id = ?", [cursor.lastrowid]).fetchone()
        return dict(row), 201
    elif method == 'PUT':
        pid = params.get('id', '')
        if not pid:
            return {"error": "ID required"}, 400
        fields = []
        vals = []
        for k in ('name', 'description', 'status', 'progress', 'color'):
            if k in body:
                fields.append(f"{k} = ?")
                vals.append(body[k])
        if fields:
            fields.append("updated_at = datetime('now')")
            vals.append(pid)
            conn.execute(f"UPDATE projects SET {', '.join(fields)} WHERE id = ?", vals)
            conn.commit()
        row = conn.execute("SELECT * FROM projects WHERE id = ?", [pid]).fetchone()
        return dict(row) if row else {"error": "Not found"}, 200
    elif method == 'DELETE':
        pid = params.get('id', '')
        if pid:
            conn.execute("DELETE FROM projects WHERE id = ?", [pid])
            conn.commit()
        return {"deleted": True}, 200
    return {"error": "Method not allowed"}, 405

def handle_tasks(conn, method, params, body):
    if method == 'GET':
        pid = params.get('project_id', '')
        if pid:
            rows = conn.execute("SELECT * FROM tasks WHERE project_id = ? ORDER BY created_at DESC", [pid]).fetchall()
        else:
            rows = conn.execute("SELECT * FROM tasks ORDER BY created_at DESC LIMIT 100").fetchall()
        return [dict(r) for r in rows], 200
    elif method == 'POST':
        cursor = conn.execute(
            "INSERT INTO tasks (project_id, title, description, status, priority) VALUES (?, ?, ?, ?, ?)",
            [body.get('project_id'), body.get('title', ''), body.get('description', ''), body.get('status', 'todo'), body.get('priority', 'medium')]
        )
        conn.commit()
        row = conn.execute("SELECT * FROM tasks WHERE id = ?", [cursor.lastrowid]).fetchone()
        return dict(row), 201
    elif method == 'PUT':
        tid = params.get('id', '')
        if tid:
            fields = []
            vals = []
            for k in ('title', 'description', 'status', 'priority'):
                if k in body:
                    fields.append(f"{k} = ?")
                    vals.append(body[k])
            if fields:
                fields.append("updated_at = datetime('now')")
                vals.append(tid)
                conn.execute(f"UPDATE tasks SET {', '.join(fields)} WHERE id = ?", vals)
                conn.commit()
        return {"updated": True}, 200
    elif method == 'DELETE':
        tid = params.get('id', '')
        if tid:
            conn.execute("DELETE FROM tasks WHERE id = ?", [tid])
            conn.commit()
        return {"deleted": True}, 200
    return {"error": "Method not allowed"}, 405

def handle_memories(conn, method, params, body):
    if method == 'GET':
        category = params.get('category', '')
        search = params.get('search', '')
        query = "SELECT * FROM memories"
        args = []
        conditions = []
        if category:
            conditions.append("category = ?")
            args.append(category)
        if search:
            conditions.append("(title LIKE ? OR content LIKE ?)")
            args.extend([f"%{search}%", f"%{search}%"])
        if conditions:
            query += " WHERE " + " AND ".join(conditions)
        query += " ORDER BY importance DESC, id DESC LIMIT 100"
        rows = conn.execute(query, args).fetchall()
        return [dict(r) for r in rows], 200
    elif method == 'POST':
        cursor = conn.execute(
            "INSERT INTO memories (title, content, tags, category, source, importance) VALUES (?, ?, ?, ?, ?, ?)",
            [body.get('title', ''), body.get('content', ''), json.dumps(body.get('tags', [])),
             body.get('category', 'general'), body.get('source', 'web'), body.get('importance', 5)]
        )
        conn.commit()
        row = conn.execute("SELECT * FROM memories WHERE id = ?", [cursor.lastrowid]).fetchone()
        return dict(row), 201
    elif method == 'DELETE':
        mid = params.get('id', '')
        if mid:
            conn.execute("DELETE FROM memories WHERE id = ?", [mid])
            conn.commit()
        return {"deleted": True}, 200
    return {"error": "Method not allowed"}, 405

def handle_research(conn, method, params, body):
    if method == 'GET':
        rows = conn.execute("SELECT * FROM research ORDER BY id DESC LIMIT 50").fetchall()
        return [dict(r) for r in rows], 200
    elif method == 'POST':
        cursor = conn.execute(
            "INSERT INTO research (topic, summary, findings, sources, status) VALUES (?, ?, ?, ?, ?)",
            [body.get('topic', ''), body.get('summary', ''), json.dumps(body.get('findings', [])),
             json.dumps(body.get('sources', [])), body.get('status', 'complete')]
        )
        conn.commit()
        row = conn.execute("SELECT * FROM research WHERE id = ?", [cursor.lastrowid]).fetchone()
        return dict(row), 201
    return {"error": "Method not allowed"}, 405

def handle_operations(conn, method, params, body):
    if method == 'GET':
        rows = conn.execute("SELECT * FROM operations ORDER BY id DESC LIMIT 50").fetchall()
        return [dict(r) for r in rows], 200
    elif method == 'POST':
        cursor = conn.execute(
            "INSERT INTO operations (name, status, type, group_id, priority) VALUES (?, ?, ?, ?, ?)",
            [body.get('name', ''), body.get('status', 'queued'), body.get('type', 'general'),
             body.get('group_id', ''), body.get('priority', 5)]
        )
        conn.commit()
        row = conn.execute("SELECT * FROM operations WHERE id = ?", [cursor.lastrowid]).fetchone()
        return dict(row), 201
    elif method == 'PUT':
        oid = params.get('id', '')
        if oid:
            fields, vals = [], []
            for k in ('status', 'progress', 'result'):
                if k in body:
                    fields.append(f"{k} = ?")
                    vals.append(body[k])
            if fields:
                fields.append("updated_at = datetime('now')")
                vals.append(oid)
                conn.execute(f"UPDATE operations SET {', '.join(fields)} WHERE id = ?", vals)
                conn.commit()
        return {"updated": True}, 200
    return {"error": "Method not allowed"}, 405

def handle_scheduled_tasks(conn, method, params, body):
    if method == 'GET':
        status = params.get('status', '')
        if status:
            rows = conn.execute("SELECT * FROM scheduled_tasks WHERE status = ? ORDER BY deadline ASC", [status]).fetchall()
        else:
            rows = conn.execute("SELECT * FROM scheduled_tasks ORDER BY deadline DESC LIMIT 50").fetchall()
        return [dict(r) for r in rows], 200
    elif method == 'POST':
        cursor = conn.execute(
            """INSERT INTO scheduled_tasks (title, description, type, deadline, scheduled_for, status, priority, source, project_id)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            [body.get('title', ''), body.get('description', ''), body.get('type', 'general'),
             body.get('deadline', datetime.utcnow().isoformat()), body.get('scheduled_for', ''),
             body.get('status', 'scheduled'), body.get('priority', 'medium'),
             body.get('source', 'web'), body.get('project_id')]
        )
        conn.commit()
        row = conn.execute("SELECT * FROM scheduled_tasks WHERE id = ?", [cursor.lastrowid]).fetchone()
        return dict(row), 201
    elif method == 'PUT':
        tid = params.get('id', '')
        if tid:
            fields, vals = [], []
            for k in ('status', 'progress', 'result', 'result_url', 'delay_reason'):
                if k in body:
                    fields.append(f"{k} = ?")
                    vals.append(body[k])
            if body.get('status') == 'completed':
                fields.append("completed_at = datetime('now')")
            if fields:
                fields.append("updated_at = datetime('now')")
                vals.append(tid)
                conn.execute(f"UPDATE scheduled_tasks SET {', '.join(fields)} WHERE id = ?", vals)
                conn.commit()
        return {"updated": True}, 200
    return {"error": "Method not allowed"}, 405

def handle_settings(conn, method, params, body):
    if method == 'GET':
        rows = conn.execute("SELECT key, value FROM settings").fetchall()
        return {r['key']: r['value'] for r in rows}, 200
    elif method == 'POST':
        for key, value in body.items():
            conn.execute(
                "INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES (?, ?, datetime('now'))",
                [key, str(value)]
            )
        conn.commit()
        rows = conn.execute("SELECT key, value FROM settings").fetchall()
        return {r['key']: r['value'] for r in rows}, 200
    return {"error": "Method not allowed"}, 405

def handle_user_profile(conn, method, params, body):
    if method == 'GET':
        cat = params.get('category', '')
        if cat:
            rows = conn.execute("SELECT * FROM user_profile WHERE category = ?", [cat]).fetchall()
        else:
            rows = conn.execute("SELECT * FROM user_profile ORDER BY category, key").fetchall()
        return [dict(r) for r in rows], 200
    elif method == 'POST':
        conn.execute(
            """INSERT OR REPLACE INTO user_profile (category, key, value, confidence, source, updated_at)
               VALUES (?, ?, ?, ?, ?, datetime('now'))""",
            [body.get('category', 'general'), body.get('key', ''), body.get('value', ''),
             body.get('confidence', 1.0), body.get('source', 'web')]
        )
        conn.commit()
        return {"saved": True}, 200
    return {"error": "Method not allowed"}, 405

def handle_task_proposals(conn, method, params, body):
    if method == 'GET':
        status = params.get('status', '')
        if status:
            rows = conn.execute("SELECT * FROM task_proposals WHERE status = ? ORDER BY id DESC", [status]).fetchall()
        else:
            rows = conn.execute("SELECT * FROM task_proposals ORDER BY id DESC LIMIT 50").fetchall()
        return [dict(r) for r in rows], 200
    elif method == 'POST':
        cursor = conn.execute(
            """INSERT INTO task_proposals (title, description, objective, reasoning, priority, steps_json,
               required_tools_json, risk_level, impact_level, status, project_id)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            [body.get('title', ''), body.get('description', ''), body.get('objective', ''),
             body.get('reasoning', ''), body.get('priority', 'medium'),
             json.dumps(body.get('steps', [])), json.dumps(body.get('required_tools', [])),
             body.get('risk_level', 'low'), body.get('impact_level', 'medium'),
             body.get('status', 'proposed'), body.get('project_id')]
        )
        conn.commit()
        row = conn.execute("SELECT * FROM task_proposals WHERE id = ?", [cursor.lastrowid]).fetchone()
        return dict(row), 201
    elif method == 'PUT':
        pid = params.get('id', '')
        if pid:
            fields, vals = [], []
            for k in ('status', 'rejection_reason'):
                if k in body:
                    fields.append(f"{k} = ?")
                    vals.append(body[k])
            if body.get('status') == 'approved':
                fields.append("approved_at = datetime('now')")
            if fields:
                fields.append("updated_at = datetime('now')")
                vals.append(pid)
                conn.execute(f"UPDATE task_proposals SET {', '.join(fields)} WHERE id = ?", vals)
                conn.commit()
        return {"updated": True}, 200
    return {"error": "Method not allowed"}, 405

def handle_task_logs(conn, method, params, body):
    if method == 'GET':
        tid = params.get('task_id', params.get('proposal_id', ''))
        if tid:
            rows = conn.execute("SELECT * FROM task_logs WHERE task_id = ? OR proposal_id = ? ORDER BY step", [tid, tid]).fetchall()
        else:
            rows = conn.execute("SELECT * FROM task_logs ORDER BY id DESC LIMIT 100").fetchall()
        return [dict(r) for r in rows], 200
    elif method == 'POST':
        cursor = conn.execute(
            "INSERT INTO task_logs (task_id, proposal_id, step, action, input_json, output_json, status, duration_ms) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
            [body.get('task_id'), body.get('proposal_id'), body.get('step', 0),
             body.get('action', ''), json.dumps(body.get('input', {})),
             json.dumps(body.get('output', {})), body.get('status', 'completed'),
             body.get('duration_ms', 0)]
        )
        conn.commit()
        return {"id": cursor.lastrowid}, 201
    return {"error": "Method not allowed"}, 405

def handle_artifacts(conn, method, params, body):
    if method == 'GET':
        rows = conn.execute("SELECT * FROM artifacts ORDER BY id DESC LIMIT 50").fetchall()
        return [dict(r) for r in rows], 200
    elif method == 'POST':
        cursor = conn.execute(
            "INSERT INTO artifacts (task_id, proposal_id, project_id, type, title, description, content_json, file_url, file_type) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
            [body.get('task_id'), body.get('proposal_id'), body.get('project_id'),
             body.get('type', 'report'), body.get('name', body.get('title', '')),
             body.get('description', ''), json.dumps(body.get('content', {})),
             body.get('url', body.get('file_url', '')), body.get('file_type', '')]
        )
        conn.commit()
        row = conn.execute("SELECT * FROM artifacts WHERE id = ?", [cursor.lastrowid]).fetchone()
        return dict(row), 201
    return {"error": "Method not allowed"}, 405

def handle_sentiment_log(conn, method, params, body):
    if method == 'GET':
        rows = conn.execute("SELECT * FROM sentiment_log ORDER BY id DESC LIMIT 50").fetchall()
        return [dict(r) for r in rows], 200
    elif method == 'POST':
        cursor = conn.execute(
            "INSERT INTO sentiment_log (conversation_id, sentiment, score, emotions_json, language) VALUES (?, ?, ?, ?, ?)",
            [body.get('conversation_id'), body.get('sentiment', 'neutral'),
             body.get('score', 0.0), json.dumps(body.get('emotions', {})), body.get('language', 'en')]
        )
        conn.commit()
        return {"id": cursor.lastrowid}, 201
    return {"error": "Method not allowed"}, 405

def handle_conversation_threads(conn, method, params, body):
    if method == 'GET':
        rows = conn.execute("SELECT * FROM conversation_threads ORDER BY id DESC LIMIT 50").fetchall()
        return [dict(r) for r in rows], 200
    elif method == 'POST':
        cursor = conn.execute(
            "INSERT INTO conversation_threads (title, topic, status, summary) VALUES (?, ?, ?, ?)",
            [body.get('title', ''), body.get('topic', ''), body.get('status', 'active'), body.get('summary', '')]
        )
        conn.commit()
        return {"id": cursor.lastrowid}, 201
    return {"error": "Method not allowed"}, 405

def handle_operation_groups(conn, method, params, body):
    if method == 'GET':
        rows = conn.execute("SELECT * FROM operation_groups ORDER BY created_at DESC LIMIT 50").fetchall()
        return [dict(r) for r in rows], 200
    elif method == 'POST':
        gid = body.get('id', secrets.token_hex(8))
        conn.execute(
            "INSERT OR REPLACE INTO operation_groups (id, name, status, total_ops) VALUES (?, ?, ?, ?)",
            [gid, body.get('name', ''), body.get('status', 'running'), body.get('total_ops', 0)]
        )
        conn.commit()
        return {"id": gid}, 201
    return {"error": "Method not allowed"}, 405

def handle_briefings(conn, method, params, body):
    if method == 'GET':
        rows = conn.execute("SELECT * FROM briefings ORDER BY id DESC LIMIT 20").fetchall()
        return [dict(r) for r in rows], 200
    elif method == 'POST':
        cursor = conn.execute(
            "INSERT INTO briefings (type, title, content, data_json, priority, status) VALUES (?, ?, ?, ?, ?, ?)",
            [body.get('type', 'daily'), body.get('title', ''), body.get('content', ''),
             json.dumps(body.get('data', {})), body.get('priority', 'medium'), body.get('status', 'active')]
        )
        conn.commit()
        return {"id": cursor.lastrowid}, 201
    return {"error": "Method not allowed"}, 405

def handle_interaction_patterns(conn, method, params, body):
    if method == 'GET':
        rows = conn.execute("SELECT * FROM interaction_patterns ORDER BY frequency DESC LIMIT 50").fetchall()
        return [dict(r) for r in rows], 200
    elif method == 'POST':
        cursor = conn.execute(
            "INSERT INTO interaction_patterns (pattern_type, description, frequency, last_seen, metadata_json) VALUES (?, ?, ?, datetime('now'), ?)",
            [body.get('pattern_type', ''), body.get('description', ''),
             body.get('frequency', 1), json.dumps(body.get('metadata', {}))]
        )
        conn.commit()
        return {"id": cursor.lastrowid}, 201
    return {"error": "Method not allowed"}, 405

def handle_analytics(conn, method, params, body):
    if method != 'GET':
        return {"error": "GET only"}, 405
    conv_count = conn.execute("SELECT COUNT(*) as c FROM conversations").fetchone()['c']
    proj_count = conn.execute("SELECT COUNT(*) as c FROM projects").fetchone()['c']
    mem_count = conn.execute("SELECT COUNT(*) as c FROM memories").fetchone()['c']
    task_count = conn.execute("SELECT COUNT(*) as c FROM scheduled_tasks").fetchone()['c']
    art_count = conn.execute("SELECT COUNT(*) as c FROM artifacts").fetchone()['c']
    recent = conn.execute("SELECT * FROM conversations ORDER BY id DESC LIMIT 5").fetchall()
    return {
        "conversations": conv_count,
        "projects": proj_count,
        "memories": mem_count,
        "scheduled_tasks": task_count,
        "artifacts": art_count,
        "recent_conversations": [dict(r) for r in recent],
        "timestamp": datetime.utcnow().isoformat()
    }, 200

# Handler registry
HANDLERS = {
    'auth': handle_auth,
    'conversations': handle_conversations,
    'projects': handle_projects,
    'tasks': handle_tasks,
    'memories': handle_memories,
    'research': handle_research,
    'operations': handle_operations,
    'scheduled_tasks': handle_scheduled_tasks,
    'user_profile': handle_user_profile,
    'settings': handle_settings,
    'task_proposals': handle_task_proposals,
    'task_logs': handle_task_logs,
    'artifacts': handle_artifacts,
    'sentiment_log': handle_sentiment_log,
    'conversation_threads': handle_conversation_threads,
    'operation_groups': handle_operation_groups,
    'briefings': handle_briefings,
    'interaction_patterns': handle_interaction_patterns,
    'analytics': handle_analytics,
}

# ═══════════════════════════════════════════════════════
#  CONVERSATION HANDLER (Gemini)
# ═══════════════════════════════════════════════════════

@app.route('/conversation', methods=['GET', 'POST', 'OPTIONS'])
def conversation_handler():
    """Gemini-powered conversation handler"""
    if request.method == 'OPTIONS':
        return '', 200
    
    action = request.args.get('action', 'process')
    conn = get_db()
    
    if action == 'status':
        key = _get_gemini_key(conn)
        conn.close()
        return jsonify({
            "status": "operational",
            "gemini_configured": bool(key),
            "model": "gemini-3-flash-preview",
            "timestamp": datetime.utcnow().isoformat()
        })
    
    if request.method != 'POST':
        conn.close()
        return jsonify({"error": "POST required"}), 400
    
    body = request.get_json(force=True, silent=True) or {}
    
    if action == 'set_key':
        key = body.get('key', '').strip()
        if not key:
            conn.close()
            return jsonify({"error": "API key required"}), 400
        conn.execute(
            "INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES ('gemini_api_key', ?, datetime('now'))",
            [key]
        )
        conn.commit()
        test_result = _call_gemini(key, "You are a test. Respond with: {\"status\":\"ok\"}", [], "test")
        conn.close()
        return jsonify({
            "status": "saved",
            "test_result": "success" if 'error' not in test_result else "failed",
            "details": test_result
        })
    
    if action == 'process':
        user_message = body.get('message', '').strip()
        source = body.get('source', 'whatsapp')
        if not user_message:
            conn.close()
            return jsonify({"error": "Message required"}), 400
        
        api_key = _get_gemini_key(conn)
        if not api_key:
            conn.close()
            return jsonify({"error": "Gemini API key not configured"}), 400
        
        history = _get_conversation_context(conn)
        system_prompt = _build_system_prompt(conn)
        result = _call_gemini(api_key, system_prompt, history, user_message)
        
        intent = result.get('intent', 'chat')
        response_text = result.get('response', 'I apologize Sir, I had difficulty processing that.')
        task_id = None
        
        if intent == 'memory' and result.get('memory_data'):
            md = result['memory_data']
            conn.execute("INSERT INTO memories (title, content, category, importance, source) VALUES (?, ?, ?, ?, ?)",
                [md.get('title', ''), md.get('content', ''), md.get('category', 'general'), md.get('importance', 5), 'whatsapp'])
            conn.commit()
        
        if intent in ('task', 'schedule') and result.get('task_data'):
            td = result['task_data']
            deadline = td.get('deadline', '') or datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S')
            cursor = conn.execute(
                "INSERT INTO scheduled_tasks (title, description, type, deadline, scheduled_for, status, priority, source) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                [td.get('title', ''), td.get('description', ''), td.get('type', 'general'), deadline, deadline, 'scheduled', td.get('priority', 'medium'), 'whatsapp']
            )
            conn.commit()
            task_id = cursor.lastrowid
        
        conn.execute("INSERT INTO conversations (role, content, source) VALUES ('user', ?, ?)", [user_message, source])
        conn.execute("INSERT INTO conversations (role, content, source) VALUES ('jarvis', ?, ?)", [response_text, source])
        conn.commit()
        conn.close()
        
        return jsonify({
            "response": response_text,
            "intent": intent,
            "task_id": task_id,
            "task_data": result.get('task_data'),
            "memory_saved": intent == 'memory',
            "model": "gemini-3-flash-preview",
            "timestamp": datetime.utcnow().isoformat()
        })
    
    conn.close()
    return jsonify({"error": f"Unknown action: {action}"}), 400

# ═══════════════════════════════════════════════════════
#  GEMINI HELPERS
# ═══════════════════════════════════════════════════════

def _get_gemini_key(conn):
    try:
        row = conn.execute("SELECT value FROM settings WHERE key='gemini_api_key'").fetchone()
        return row['value'] if row else ''
    except:
        return ''

def _get_conversation_context(conn, limit=20):
    rows = conn.execute("SELECT role, content, created_at FROM conversations ORDER BY id DESC LIMIT ?", [limit]).fetchall()
    rows = list(rows)
    rows.reverse()
    return [{"role": r['role'], "content": r['content'], "time": r['created_at']} for r in rows]

def _build_system_prompt(conn):
    projects = conn.execute("SELECT name, status, description, progress FROM projects WHERE status != 'Completed' ORDER BY updated_at DESC LIMIT 10").fetchall()
    memories = conn.execute("SELECT title, content, category FROM memories ORDER BY importance DESC, id DESC LIMIT 10").fetchall()
    pending = conn.execute("SELECT title, description, deadline, status FROM scheduled_tasks WHERE status IN ('scheduled','in_progress') ORDER BY deadline ASC LIMIT 5").fetchall()
    
    p_str = "\n".join([f"  - {p['name']} ({p['status']}, {p['progress']}%)" for p in projects]) if projects else "  None"
    m_str = "\n".join([f"  - [{m['category']}] {m['title']}: {m['content'][:80]}" for m in memories]) if memories else "  None"
    t_str = "\n".join([f"  - {t['title']} (due: {t['deadline']})" for t in pending]) if pending else "  None"
    
    return f"""You are JARVIS, an AI personal assistant inspired by Iron Man's JARVIS. Address the user as "Sir".
Personality: intelligent, sophisticated, proactive, slightly witty, respectful.
Keep responses under 350 characters for voice delivery.
Current time: {datetime.utcnow().strftime('%Y-%m-%d %H:%M')} UTC (User is WITA, UTC+8)

ACTIVE PROJECTS:\n{p_str}
KEY MEMORIES:\n{m_str}
PENDING TASKS:\n{t_str}

Respond with valid JSON only:
{{"response": "your reply", "intent": "chat|task|memory|schedule", "task_data": {{"title":"","description":"","type":"research|document|app|general","priority":"high|medium|low","deadline":"","project":""}} or null, "memory_data": {{"title":"","content":"","category":"preference|personal|business","importance":5}} or null}}"""

def _call_gemini(api_key, system_prompt, history, user_message):
    from urllib.request import Request, urlopen
    import json as _json
    
    contents = []
    last_role = None
    for msg in history[-10:]:
        role = "user" if msg['role'] == 'user' else "model"
        if role == last_role and contents:
            contents[-1]['parts'][0]['text'] += '\n' + msg['content']
            continue
        contents.append({"role": role, "parts": [{"text": msg['content']}]})
        last_role = role
    
    while contents and contents[0]['role'] == 'model':
        contents.pop(0)
    if contents and contents[-1]['role'] == 'user':
        contents.append({"role": "model", "parts": [{"text": "Understood, Sir."}]})
    contents.append({"role": "user", "parts": [{"text": user_message}]})
    
    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key={api_key}"
    payload = _json.dumps({
        "systemInstruction": {"parts": [{"text": system_prompt}]},
        "contents": contents,
        "generationConfig": {"responseMimeType": "application/json", "temperature": 0.7, "maxOutputTokens": 1024}
    }).encode('utf-8')
    
    try:
        req = Request(url, data=payload, headers={'Content-Type': 'application/json'})
        with urlopen(req, timeout=15) as resp:
            data = _json.loads(resp.read().decode('utf-8'))
            if 'candidates' in data and data['candidates']:
                text = data['candidates'][0]['content']['parts'][0]['text']
                try:
                    return _json.loads(text)
                except:
                    start = text.find('{')
                    end = text.rfind('}') + 1
                    if start >= 0 and end > start:
                        return _json.loads(text[start:end])
            return {"response": "I apologize Sir, I couldn't process that.", "intent": "chat"}
    except Exception as e:
        return {"response": "Sir, temporary issue. Please try again.", "intent": "chat", "error": str(e)}

# ═══════════════════════════════════════════════════════
#  RUN (only for local testing — PythonAnywhere uses WSGI)
# ═══════════════════════════════════════════════════════

if __name__ == '__main__':
    app.run(debug=True, port=5000)
