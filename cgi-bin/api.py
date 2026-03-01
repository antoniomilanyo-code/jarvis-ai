#!/usr/bin/env python3
"""JARVIS AI Assistant — Unified CGI API v2
   Added: scheduled_tasks, user_profile tables
"""
import json, os, sqlite3, sys, traceback
from datetime import datetime
from urllib.parse import unquote

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
            source TEXT DEFAULT 'web',
            phone TEXT DEFAULT '',
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
    # Migrate: add columns to existing tables if missing
    _migrate(conn)

def _migrate(conn):
    """Add new columns to existing tables without dropping data."""
    migrations = [
        ("memories", "category", "TEXT DEFAULT 'general'"),
        ("memories", "importance", "INTEGER DEFAULT 5"),
    ]
    for table, col, col_def in migrations:
        try:
            conn.execute(f"ALTER TABLE {table} ADD COLUMN {col} {col_def}")
            conn.commit()
        except sqlite3.OperationalError:
            pass  # Column already exists

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
            params[k] = unquote(v)
    return params

def handle_conversations(conn, method, params, body):
    if method == 'GET':
        search = params.get('search', '')
        limit = int(params.get('limit', 200))
        source = params.get('source', '')
        if search:
            rows = conn.execute(
                "SELECT * FROM conversations WHERE content LIKE ? ORDER BY created_at DESC LIMIT ?",
                (f'%{search}%', limit)
            ).fetchall()
        elif source:
            rows = conn.execute(
                "SELECT * FROM conversations WHERE source=? ORDER BY created_at DESC LIMIT ?",
                (source, limit)
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
        source = body.get('source', 'web')
        phone = body.get('phone', '')
        conn.execute(
            "INSERT INTO conversations (role, content, topic, source, phone) VALUES (?, ?, ?, ?, ?)",
            (role, content, topic, source, phone)
        )
        conn.commit()
        row = conn.execute("SELECT * FROM conversations ORDER BY id DESC LIMIT 1").fetchone()
        return json_response(dict(row), 201)
    elif method == 'DELETE':
        conn.execute("DELETE FROM conversations")
        conn.commit()
        return json_response({'cleared': True})

def handle_projects(conn, method, params, body):
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
    if method == 'GET':
        search = params.get('search', '')
        category = params.get('category', '')
        if search:
            rows = conn.execute(
                "SELECT * FROM memories WHERE title LIKE ? OR content LIKE ? ORDER BY importance DESC, created_at DESC",
                (f'%{search}%', f'%{search}%')
            ).fetchall()
        elif category:
            rows = conn.execute(
                "SELECT * FROM memories WHERE category=? ORDER BY importance DESC, created_at DESC",
                (category,)
            ).fetchall()
        else:
            rows = conn.execute("SELECT * FROM memories ORDER BY importance DESC, created_at DESC").fetchall()
        return json_response([dict(r) for r in rows])
    elif method == 'POST':
        conn.execute(
            "INSERT INTO memories (title, content, tags, category, source, importance) VALUES (?, ?, ?, ?, ?, ?)",
            (body.get('title','Memory'), body.get('content',''),
             json.dumps(body.get('tags',[])), body.get('category','general'),
             body.get('source','conversation'), body.get('importance', 5))
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

def handle_scheduled_tasks(conn, method, params, body):
    if method == 'GET':
        status = params.get('status', '')
        upcoming = params.get('upcoming', '')
        if status:
            rows = conn.execute(
                "SELECT * FROM scheduled_tasks WHERE status=? ORDER BY deadline ASC", (status,)
            ).fetchall()
        elif upcoming:
            rows = conn.execute(
                "SELECT * FROM scheduled_tasks WHERE status IN ('scheduled','in_progress') ORDER BY deadline ASC"
            ).fetchall()
        else:
            rows = conn.execute("SELECT * FROM scheduled_tasks ORDER BY deadline ASC").fetchall()
        return json_response([dict(r) for r in rows])
    elif method == 'POST':
        conn.execute(
            """INSERT INTO scheduled_tasks
               (title, description, type, deadline, scheduled_for, status, priority, project_id, source)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (body.get('title','Task'), body.get('description',''),
             body.get('type','report'), body.get('deadline',''),
             body.get('scheduled_for',''), body.get('status','scheduled'),
             body.get('priority','medium'), body.get('project_id'),
             body.get('source','whatsapp'))
        )
        conn.commit()
        row = conn.execute("SELECT * FROM scheduled_tasks ORDER BY id DESC LIMIT 1").fetchone()
        return json_response(dict(row), 201)
    elif method == 'PUT':
        sid = params.get('id') or body.get('id')
        fields = {k: v for k, v in body.items() if k in (
            'title', 'description', 'status', 'progress', 'result',
            'result_url', 'delay_reason', 'deadline', 'priority', 'completed_at'
        )}
        if fields and sid:
            sets = ', '.join(f"{k}=?" for k in fields)
            vals = list(fields.values()) + [datetime.utcnow().isoformat(), sid]
            conn.execute(f"UPDATE scheduled_tasks SET {sets}, updated_at=? WHERE id=?", vals)
            conn.commit()
        row = conn.execute("SELECT * FROM scheduled_tasks WHERE id=?", (sid,)).fetchone()
        return json_response(dict(row) if row else {})
    elif method == 'DELETE':
        sid = params.get('id')
        if sid:
            conn.execute("DELETE FROM scheduled_tasks WHERE id=?", (sid,))
            conn.commit()
        return json_response({'deleted': True})

def handle_user_profile(conn, method, params, body):
    if method == 'GET':
        category = params.get('category', '')
        if category:
            rows = conn.execute(
                "SELECT * FROM user_profile WHERE category=? ORDER BY updated_at DESC", (category,)
            ).fetchall()
        else:
            rows = conn.execute("SELECT * FROM user_profile ORDER BY category, key").fetchall()
        return json_response([dict(r) for r in rows])
    elif method == 'POST':
        cat = body.get('category', 'general')
        key = body.get('key', '')
        value = body.get('value', '')
        confidence = body.get('confidence', 1.0)
        source = body.get('source', 'conversation')
        conn.execute(
            """INSERT INTO user_profile (category, key, value, confidence, source, updated_at)
               VALUES (?, ?, ?, ?, ?, datetime('now'))
               ON CONFLICT(category, key) DO UPDATE SET
               value=excluded.value, confidence=excluded.confidence,
               source=excluded.source, updated_at=datetime('now')""",
            (cat, key, value, confidence, source)
        )
        conn.commit()
        row = conn.execute(
            "SELECT * FROM user_profile WHERE category=? AND key=?", (cat, key)
        ).fetchone()
        return json_response(dict(row), 201)
    elif method == 'DELETE':
        pid = params.get('id')
        if pid:
            conn.execute("DELETE FROM user_profile WHERE id=?", (pid,))
            conn.commit()
        return json_response({'deleted': True})

def handle_settings(conn, method, params, body):
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
            'scheduled_tasks': handle_scheduled_tasks,
            'user_profile': handle_user_profile,
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
