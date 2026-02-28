#!/usr/bin/env python3
"""JARVIS AI Assistant — Unified CGI API"""
import json, os, sqlite3, sys, traceback
from datetime import datetime

DB_PATH = os.path.join(os.path.dirname(__file__), '..', 'jarvis.db')

def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    return conn

def init_db(conn):
    conn.executescript("""
        CREATE TABLE IF NOT EXISTS conversations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            role TEXT NOT NULL,
            content TEXT NOT NULL,
            topic TEXT DEFAULT '',
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
            source TEXT DEFAULT 'conversation',
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
            created_at TEXT DEFAULT (datetime('now')),
            updated_at TEXT DEFAULT (datetime('now'))
        );
        CREATE TABLE IF NOT EXISTS settings (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL,
            updated_at TEXT DEFAULT (datetime('now'))
        );
        INSERT OR IGNORE INTO settings (key, value) VALUES
            ('user_name', '"Sir"'),
            ('voice_rate', '0.9'),
            ('voice_pitch', '1.0'),
            ('voice_volume', '1.0'),
            ('glow_intensity', '1.0'),
            ('animation_speed', '1.0'),
            ('theme', '"dark"');
    """)
    conn.commit()

def json_response(data, status=200):
    print(f"Status: {status}")
    print("Content-Type: application/json")
    print("Access-Control-Allow-Origin: *")
    print("Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS")
    print("Access-Control-Allow-Headers: Content-Type")
    print()
    print(json.dumps(data, default=str))

def read_body():
    try:
        length = int(os.environ.get('CONTENT_LENGTH', 0))
        if length > 0:
            return json.loads(sys.stdin.read(length))
    except:
        pass
    return {}

def parse_qs(qs):
    params = {}
    for part in qs.split('&'):
        if '=' in part:
            k, v = part.split('=', 1)
            params[k] = v
    return params

def handle_conversations(conn, method, params, body):
    if method == 'OPTIONS':
        return json_response({})
    if method == 'GET':
        search = params.get('search', '')
        limit = int(params.get('limit', 200))
        if search:
            rows = conn.execute(
                "SELECT * FROM conversations WHERE content LIKE ? ORDER BY created_at DESC LIMIT ?",
                (f'%{search}%', limit)
            ).fetchall()
        else:
            rows = conn.execute(
                "SELECT * FROM conversations ORDER BY created_at DESC LIMIT ?", (limit,)
            ).fetchall()
        return json_response([dict(r) for r in rows])
    elif method == 'POST':
        role = body.get('role', 'user')
        content = body.get('content', '')
        topic = body.get('topic', '')
        conn.execute(
            "INSERT INTO conversations (role, content, topic) VALUES (?, ?, ?)",
            (role, content, topic)
        )
        conn.commit()
        row = conn.execute("SELECT * FROM conversations ORDER BY id DESC LIMIT 1").fetchone()
        return json_response(dict(row), 201)
    elif method == 'DELETE':
        conn.execute("DELETE FROM conversations")
        conn.commit()
        return json_response({'cleared': True})

def handle_projects(conn, method, params, body):
    if method == 'OPTIONS':
        return json_response({})
    if method == 'GET':
        pid = params.get('id')
        if pid:
            row = conn.execute("SELECT * FROM projects WHERE id=?", (pid,)).fetchone()
            return json_response(dict(row) if row else {})
        rows = conn.execute("SELECT * FROM projects ORDER BY created_at DESC").fetchall()
        return json_response([dict(r) for r in rows])
    elif method == 'POST':
        name = body.get('name', 'Untitled Project')
        status = body.get('status', 'Active')
        description = body.get('description', '')
        color = body.get('color', '#00d4ff')
        conn.execute(
            "INSERT INTO projects (name, status, description, color) VALUES (?, ?, ?, ?)",
            (name, status, description, color)
        )
        conn.commit()
        row = conn.execute("SELECT * FROM projects ORDER BY id DESC LIMIT 1").fetchone()
        return json_response(dict(row), 201)
    elif method == 'PUT':
        pid = params.get('id') or body.get('id')
        fields = {k: v for k, v in body.items() if k in ('name', 'status', 'description', 'progress', 'color')}
        if fields and pid:
            sets = ', '.join(f"{k}=?" for k in fields)
            vals = list(fields.values()) + [datetime.utcnow().isoformat(), pid]
            conn.execute(f"UPDATE projects SET {sets}, updated_at=? WHERE id=?", vals)
            conn.commit()
        row = conn.execute("SELECT * FROM projects WHERE id=?", (pid,)).fetchone()
        return json_response(dict(row) if row else {})
    elif method == 'DELETE':
        pid = params.get('id')
        if pid:
            conn.execute("DELETE FROM projects WHERE id=?", (pid,))
            conn.commit()
        return json_response({'deleted': True})

def handle_tasks(conn, method, params, body):
    if method == 'OPTIONS':
        return json_response({})
    if method == 'GET':
        project_id = params.get('project_id')
        if project_id:
            rows = conn.execute("SELECT * FROM tasks WHERE project_id=? ORDER BY created_at", (project_id,)).fetchall()
        else:
            rows = conn.execute("SELECT * FROM tasks ORDER BY created_at DESC").fetchall()
        return json_response([dict(r) for r in rows])
    elif method == 'POST':
        conn.execute(
            "INSERT INTO tasks (project_id, title, description, status, priority) VALUES (?, ?, ?, ?, ?)",
            (body.get('project_id'), body.get('title','Task'), body.get('description',''), body.get('status','todo'), body.get('priority','medium'))
        )
        conn.commit()
        row = conn.execute("SELECT * FROM tasks ORDER BY id DESC LIMIT 1").fetchone()
        return json_response(dict(row), 201)
    elif method == 'PUT':
        tid = params.get('id') or body.get('id')
        fields = {k: v for k, v in body.items() if k in ('title', 'description', 'status', 'priority')}
        if fields and tid:
            sets = ', '.join(f"{k}=?" for k in fields)
            vals = list(fields.values()) + [datetime.utcnow().isoformat(), tid]
            conn.execute(f"UPDATE tasks SET {sets}, updated_at=? WHERE id=?", vals)
            conn.commit()
        row = conn.execute("SELECT * FROM tasks WHERE id=?", (tid,)).fetchone()
        return json_response(dict(row) if row else {})
    elif method == 'DELETE':
        tid = params.get('id')
        if tid:
            conn.execute("DELETE FROM tasks WHERE id=?", (tid,))
            conn.commit()
        return json_response({'deleted': True})

def handle_memories(conn, method, params, body):
    if method == 'OPTIONS':
        return json_response({})
    if method == 'GET':
        search = params.get('search', '')
        if search:
            rows = conn.execute(
                "SELECT * FROM memories WHERE title LIKE ? OR content LIKE ? ORDER BY created_at DESC",
                (f'%{search}%', f'%{search}%')
            ).fetchall()
        else:
            rows = conn.execute("SELECT * FROM memories ORDER BY created_at DESC").fetchall()
        return json_response([dict(r) for r in rows])
    elif method == 'POST':
        conn.execute(
            "INSERT INTO memories (title, content, tags, source) VALUES (?, ?, ?, ?)",
            (body.get('title','Memory'), body.get('content',''), json.dumps(body.get('tags',[])), body.get('source','conversation'))
        )
        conn.commit()
        row = conn.execute("SELECT * FROM memories ORDER BY id DESC LIMIT 1").fetchone()
        return json_response(dict(row), 201)
    elif method == 'DELETE':
        mid = params.get('id')
        if mid:
            conn.execute("DELETE FROM memories WHERE id=?", (mid,))
        else:
            conn.execute("DELETE FROM memories")
        conn.commit()
        return json_response({'deleted': True})

def handle_research(conn, method, params, body):
    if method == 'OPTIONS':
        return json_response({})
    if method == 'GET':
        rows = conn.execute("SELECT * FROM research ORDER BY created_at DESC").fetchall()
        return json_response([dict(r) for r in rows])
    elif method == 'POST':
        conn.execute(
            "INSERT INTO research (topic, summary, findings, sources, status) VALUES (?, ?, ?, ?, ?)",
            (body.get('topic',''), body.get('summary',''), json.dumps(body.get('findings',[])), json.dumps(body.get('sources',[])), body.get('status','complete'))
        )
        conn.commit()
        row = conn.execute("SELECT * FROM research ORDER BY id DESC LIMIT 1").fetchone()
        return json_response(dict(row), 201)
    elif method == 'DELETE':
        rid = params.get('id')
        if rid:
            conn.execute("DELETE FROM research WHERE id=?", (rid,))
            conn.commit()
        return json_response({'deleted': True})

def handle_operations(conn, method, params, body):
    if method == 'OPTIONS':
        return json_response({})
    if method == 'GET':
        rows = conn.execute("SELECT * FROM operations ORDER BY created_at DESC LIMIT 20").fetchall()
        return json_response([dict(r) for r in rows])
    elif method == 'POST':
        conn.execute(
            "INSERT INTO operations (name, status, progress) VALUES (?, ?, ?)",
            (body.get('name','Operation'), body.get('status','queued'), body.get('progress',0))
        )
        conn.commit()
        row = conn.execute("SELECT * FROM operations ORDER BY id DESC LIMIT 1").fetchone()
        return json_response(dict(row), 201)
    elif method == 'PUT':
        oid = params.get('id') or body.get('id')
        fields = {k: v for k, v in body.items() if k in ('status', 'progress', 'result')}
        if fields and oid:
            sets = ', '.join(f"{k}=?" for k in fields)
            vals = list(fields.values()) + [datetime.utcnow().isoformat(), oid]
            conn.execute(f"UPDATE operations SET {sets}, updated_at=? WHERE id=?", vals)
            conn.commit()
        row = conn.execute("SELECT * FROM operations WHERE id=?", (oid,)).fetchone()
        return json_response(dict(row) if row else {})

def handle_settings(conn, method, params, body):
    if method == 'OPTIONS':
        return json_response({})
    if method == 'GET':
        rows = conn.execute("SELECT key, value FROM settings").fetchall()
        return json_response({r['key']: json.loads(r['value']) for r in rows})
    elif method == 'POST':
        for k, v in body.items():
            conn.execute(
                "INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES (?, ?, datetime('now'))",
                (k, json.dumps(v))
            )
        conn.commit()
        rows = conn.execute("SELECT key, value FROM settings").fetchall()
        return json_response({r['key']: json.loads(r['value']) for r in rows})

def main():
    method = os.environ.get('REQUEST_METHOD', 'GET').upper()
    qs = os.environ.get('QUERY_STRING', '')
    params = parse_qs(qs)
    action = params.get('action', '')
    body = read_body() if method in ('POST', 'PUT', 'PATCH') else {}

    # Handle CORS preflight
    if method == 'OPTIONS':
        print("Status: 204")
        print("Access-Control-Allow-Origin: *")
        print("Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS")
        print("Access-Control-Allow-Headers: Content-Type")
        print()
        return

    try:
        conn = get_db()
        init_db(conn)

        handlers = {
            'conversations': handle_conversations,
            'projects': handle_projects,
            'tasks': handle_tasks,
            'memories': handle_memories,
            'research': handle_research,
            'operations': handle_operations,
            'settings': handle_settings,
        }

        handler = handlers.get(action)
        if handler:
            handler(conn, method, params, body)
        else:
            json_response({'error': f'Unknown action: {action}', 'available': list(handlers.keys())}, 400)
        conn.close()
    except Exception as e:
        json_response({'error': str(e), 'trace': traceback.format_exc()}, 500)

main()
