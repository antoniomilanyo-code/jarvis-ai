#!/usr/bin/env python3
"""JARVIS AI Assistant — Unified CGI API v4
   P0-P2: Core + Proposals + Artifacts
   P4: Enhanced NLU (sentiment_log, conversation_threads)
   P5: Parallel Operations (operation_groups)
   P6: Advanced Memory (memory_links, memory_categories)
   P7: Intelligence Briefings (briefings, interaction_patterns)
"""
import json, os, sqlite3, sys, traceback, hashlib, secrets
from datetime import datetime, timedelta
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

        /* ═══ P1: Task Proposals ═══ */
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

        /* ═══ P2: Task Logs ═══ */
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
            created_at TEXT DEFAULT (datetime('now')),
            FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
            FOREIGN KEY (proposal_id) REFERENCES task_proposals(id) ON DELETE CASCADE
        );

        /* ═══ P2: Artifacts ═══ */
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
            created_at TEXT DEFAULT (datetime('now')),
            FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE SET NULL,
            FOREIGN KEY (proposal_id) REFERENCES task_proposals(id) ON DELETE SET NULL,
            FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL
        );

        /* ═══ P4: Sentiment Log ═══ */
        CREATE TABLE IF NOT EXISTS sentiment_log (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            conversation_id INTEGER,
            sentiment TEXT DEFAULT 'neutral',
            score REAL DEFAULT 0.0,
            emotions_json TEXT DEFAULT '{}',
            language TEXT DEFAULT 'en',
            created_at TEXT DEFAULT (datetime('now'))
        );

        /* ═══ P4: Conversation Threads ═══ */
        CREATE TABLE IF NOT EXISTS conversation_threads (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            thread_id TEXT UNIQUE NOT NULL,
            topic TEXT DEFAULT '',
            summary TEXT DEFAULT '',
            message_count INTEGER DEFAULT 0,
            last_intent TEXT DEFAULT '',
            status TEXT DEFAULT 'active',
            created_at TEXT DEFAULT (datetime('now')),
            updated_at TEXT DEFAULT (datetime('now'))
        );

        /* ═══ P5: Operation Groups ═══ */
        CREATE TABLE IF NOT EXISTS operation_groups (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            description TEXT DEFAULT '',
            total_ops INTEGER DEFAULT 0,
            completed_ops INTEGER DEFAULT 0,
            status TEXT DEFAULT 'running',
            created_at TEXT DEFAULT (datetime('now')),
            updated_at TEXT DEFAULT (datetime('now'))
        );

        /* ═══ P7: Intelligence Briefings ═══ */
        CREATE TABLE IF NOT EXISTS briefings (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            type TEXT DEFAULT 'daily',
            title TEXT NOT NULL,
            summary TEXT DEFAULT '',
            insights_json TEXT DEFAULT '[]',
            recommendations_json TEXT DEFAULT '[]',
            metrics_json TEXT DEFAULT '{}',
            period_start TEXT DEFAULT '',
            period_end TEXT DEFAULT '',
            created_at TEXT DEFAULT (datetime('now'))
        );

        /* ═══ P7: Interaction Patterns ═══ */
        CREATE TABLE IF NOT EXISTS interaction_patterns (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            pattern_type TEXT NOT NULL,
            pattern_key TEXT NOT NULL,
            frequency INTEGER DEFAULT 1,
            last_seen TEXT DEFAULT (datetime('now')),
            metadata_json TEXT DEFAULT '{}',
            created_at TEXT DEFAULT (datetime('now')),
            updated_at TEXT DEFAULT (datetime('now')),
            UNIQUE(pattern_type, pattern_key)
        );

        INSERT OR IGNORE INTO settings (key, value) VALUES
            ('user_name', '"Sir"'),
            ('voice_rate', '0.9'),
            ('voice_pitch', '1.0'),
            ('voice_volume', '1.0'),
            ('glow_intensity', '1.0'),
            ('animation_speed', '1.0'),
            ('theme', '"dark"');

        /* ═══ Auth: Users ═══ */
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            salt TEXT NOT NULL,
            display_name TEXT DEFAULT 'Sir',
            role TEXT DEFAULT 'admin',
            auth_token TEXT DEFAULT '',
            token_expires TEXT DEFAULT '',
            created_at TEXT DEFAULT (datetime('now')),
            last_login TEXT DEFAULT ''
        );
    """)
    conn.commit()
    _migrate(conn)

def _migrate(conn):
    """Add new columns to existing tables without dropping data."""
    migrations = [
        ("memories", "category", "TEXT DEFAULT 'general'"),
        ("memories", "importance", "INTEGER DEFAULT 5"),
        ("memories", "access_count", "INTEGER DEFAULT 0"),
        ("memories", "last_accessed", "TEXT DEFAULT ''"),
        ("memories", "linked_memories", "TEXT DEFAULT '[]'"),
        ("memories", "auto_tags", "TEXT DEFAULT '[]'"),
        # P1: task_proposals
        ("task_proposals", "description", "TEXT DEFAULT ''"),
        ("task_proposals", "priority", "TEXT DEFAULT 'medium'"),
        ("task_proposals", "rejection_reason", "TEXT DEFAULT ''"),
        ("task_proposals", "approved_at", "TEXT DEFAULT ''"),
        # P4: conversations
        ("conversations", "thread_id", "TEXT DEFAULT ''"),
        ("conversations", "sentiment", "TEXT DEFAULT 'neutral'"),
        ("conversations", "sentiment_score", "REAL DEFAULT 0.0"),
        ("conversations", "language", "TEXT DEFAULT 'en'"),
        # P5: operations
        ("operations", "group_id", "TEXT DEFAULT ''"),
        ("operations", "depends_on", "TEXT DEFAULT '[]'"),
        ("operations", "priority", "INTEGER DEFAULT 5"),
        ("operations", "type", "TEXT DEFAULT 'general'"),
    ]
    for table, col, col_def in migrations:
        try:
            conn.execute(f"ALTER TABLE {table} ADD COLUMN {col} {col_def}")
            conn.commit()
        except sqlite3.OperationalError:
            pass

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

# ═══════════════════════════════════════════════════════
#  EXISTING HANDLERS (updated for P4-P7)
# ═══════════════════════════════════════════════════════

def handle_conversations(conn, method, params, body):
    if method == 'GET':
        search = params.get('search', '')
        limit = int(params.get('limit', 200))
        source = params.get('source', '')
        thread_id = params.get('thread_id', '')
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
        elif thread_id:
            rows = conn.execute(
                "SELECT * FROM conversations WHERE thread_id=? ORDER BY created_at ASC LIMIT ?",
                (thread_id, limit)
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
        thread_id = body.get('thread_id', '')
        sentiment = body.get('sentiment', 'neutral')
        sentiment_score = body.get('sentiment_score', 0.0)
        language = body.get('language', 'en')
        conn.execute(
            "INSERT INTO conversations (role, content, topic, source, phone, thread_id, sentiment, sentiment_score, language) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
            (role, content, topic, source, phone, thread_id, sentiment, sentiment_score, language)
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
        mid = params.get('id', '')
        if mid:
            # Track access
            conn.execute("UPDATE memories SET access_count=access_count+1, last_accessed=datetime('now') WHERE id=?", (mid,))
            conn.commit()
            row = conn.execute("SELECT * FROM memories WHERE id=?", (mid,)).fetchone()
            return json_response(dict(row) if row else {})
        if search:
            rows = conn.execute(
                "SELECT * FROM memories WHERE title LIKE ? OR content LIKE ? OR auto_tags LIKE ? ORDER BY importance DESC, created_at DESC",
                (f'%{search}%', f'%{search}%', f'%{search}%')
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
        content = body.get('content', '')
        # Auto-categorization based on content keywords
        auto_cat = _auto_categorize(content)
        category = body.get('category', auto_cat)
        # Auto-importance scoring
        auto_imp = body.get('importance', _auto_importance(content))
        # Auto-tagging
        auto_tags = _auto_tag(content)
        conn.execute(
            "INSERT INTO memories (title, content, tags, category, source, importance, auto_tags) VALUES (?, ?, ?, ?, ?, ?, ?)",
            (body.get('title','Memory'), content,
             json.dumps(body.get('tags',[])), category,
             body.get('source','conversation'), auto_imp, json.dumps(auto_tags))
        )
        conn.commit()
        row = conn.execute("SELECT * FROM memories ORDER BY id DESC LIMIT 1").fetchone()
        return json_response(dict(row), 201)
    elif method == 'PUT':
        mid = params.get('id') or body.get('id')
        fields = {k: v for k, v in body.items() if k in ('title', 'content', 'category', 'importance', 'linked_memories')}
        if 'tags' in body:
            fields['tags'] = json.dumps(body['tags'])
        if fields and mid:
            sets = ', '.join(f"{k}=?" for k in fields)
            vals = list(fields.values()) + [mid]
            conn.execute(f"UPDATE memories SET {sets} WHERE id=?", vals)
            conn.commit()
        row = conn.execute("SELECT * FROM memories WHERE id=?", (mid,)).fetchone()
        return json_response(dict(row) if row else {})
    elif method == 'DELETE':
        mid = params.get('id')
        if mid:
            conn.execute("DELETE FROM memories WHERE id=?", (mid,))
        else:
            conn.execute("DELETE FROM memories")
        conn.commit()
        return json_response({'deleted': True})

def _auto_categorize(text):
    """P6: Auto-categorize memory based on content."""
    t = text.lower()
    if any(w in t for w in ['code', 'api', 'deploy', 'server', 'bug', 'feature', 'app', 'website', 'github']):
        return 'technical'
    if any(w in t for w in ['meet', 'call', 'schedule', 'deadline', 'appointment', 'reminder']):
        return 'schedule'
    if any(w in t for w in ['idea', 'concept', 'vision', 'plan', 'strategy', 'brainstorm']):
        return 'ideas'
    if any(w in t for w in ['learn', 'discover', 'research', 'study', 'insight', 'finding']):
        return 'knowledge'
    if any(w in t for w in ['contact', 'person', 'name', 'email', 'phone', 'company']):
        return 'contacts'
    if any(w in t for w in ['money', 'budget', 'cost', 'price', 'revenue', 'invest', 'payment']):
        return 'financial'
    if any(w in t for w in ['prefer', 'like', 'dislike', 'favorite', 'always', 'never', 'habit']):
        return 'preferences'
    return 'general'

def _auto_importance(text):
    """P6: Score importance 1-10 based on content signals."""
    score = 5
    t = text.lower()
    # High importance signals
    if any(w in t for w in ['critical', 'urgent', 'important', 'deadline', 'asap', 'must', 'essential']):
        score += 3
    if any(w in t for w in ['password', 'key', 'secret', 'credential', 'token']):
        score += 2
    if any(w in t for w in ['contact', 'email', 'phone', 'address']):
        score += 1
    # Low importance signals
    if any(w in t for w in ['maybe', 'perhaps', 'might', 'just thinking']):
        score -= 1
    if len(text) < 20:
        score -= 1
    return max(1, min(10, score))

def _auto_tag(text):
    """P6: Auto-extract tags from content."""
    tags = []
    t = text.lower()
    tag_map = {
        'actionable': ['todo', 'task', 'action', 'need to', 'must', 'should', 'remind'],
        'decision': ['decided', 'choose', 'picked', 'going with', 'selected'],
        'reference': ['link', 'url', 'http', 'www', 'documentation'],
        'people': ['person', 'name', 'contact', 'team', 'colleague'],
        'date': ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
        'project': ['project', 'build', 'develop', 'launch', 'deploy'],
        'finance': ['money', 'budget', 'cost', 'invest', 'revenue'],
    }
    for tag, keywords in tag_map.items():
        if any(k in t for k in keywords):
            tags.append(tag)
    return tags[:5]  # Max 5 auto-tags

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
        group_id = params.get('group_id', '')
        if group_id:
            rows = conn.execute("SELECT * FROM operations WHERE group_id=? ORDER BY priority DESC, created_at ASC", (group_id,)).fetchall()
        else:
            rows = conn.execute("SELECT * FROM operations ORDER BY created_at DESC LIMIT 30").fetchall()
        return json_response([dict(r) for r in rows])
    elif method == 'POST':
        conn.execute(
            "INSERT INTO operations (name, status, progress, group_id, depends_on, priority, type) VALUES (?, ?, ?, ?, ?, ?, ?)",
            (body.get('name','Operation'), body.get('status','queued'), body.get('progress',0),
             body.get('group_id',''), json.dumps(body.get('depends_on',[])),
             body.get('priority',5), body.get('type','general'))
        )
        conn.commit()
        row = conn.execute("SELECT * FROM operations ORDER BY id DESC LIMIT 1").fetchone()
        return json_response(dict(row), 201)
    elif method == 'PUT':
        oid = params.get('id') or body.get('id')
        fields = {k: v for k, v in body.items() if k in ('status', 'progress', 'result', 'group_id', 'priority', 'type')}
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
        result = {}
        for r in rows:
            try:
                result[r['key']] = json.loads(r['value'])
            except:
                result[r['key']] = r['value']
        return json_response(result)
    elif method == 'POST':
        for k, v in body.items():
            conn.execute(
                "INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES (?, ?, datetime('now'))",
                (k, json.dumps(v))
            )
        conn.commit()
        rows = conn.execute("SELECT key, value FROM settings").fetchall()
        result = {}
        for r in rows:
            try:
                result[r['key']] = json.loads(r['value'])
            except:
                result[r['key']] = r['value']
        return json_response(result)

# ═══════════════════════════════════════════════════════
#  P1: TASK PROPOSALS HANDLER
# ═══════════════════════════════════════════════════════

def handle_task_proposals(conn, method, params, body):
    if method == 'GET':
        status = params.get('status', '')
        pid = params.get('id', '')
        if pid:
            row = conn.execute("SELECT * FROM task_proposals WHERE id=?", (pid,)).fetchone()
            return json_response(dict(row) if row else {})
        elif status:
            rows = conn.execute(
                "SELECT * FROM task_proposals WHERE status=? ORDER BY created_at DESC", (status,)
            ).fetchall()
        else:
            rows = conn.execute("SELECT * FROM task_proposals ORDER BY created_at DESC").fetchall()
        return json_response([dict(r) for r in rows])
    elif method == 'POST':
        conn.execute(
            """INSERT INTO task_proposals
               (conversation_id, project_id, title, description, objective, reasoning,
                priority, steps_json, required_tools_json, risk_level, impact_level, status)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (body.get('conversation_id'), body.get('project_id'),
             body.get('title', 'Untitled Proposal'),
             body.get('description', ''),
             body.get('objective', ''),
             body.get('reasoning', ''),
             body.get('priority', 'medium'),
             json.dumps(body.get('steps', [])),
             json.dumps(body.get('required_tools', [])),
             body.get('risk_level', 'low'),
             body.get('impact_level', 'medium'),
             body.get('status', 'proposed'))
        )
        conn.commit()
        row = conn.execute("SELECT * FROM task_proposals ORDER BY id DESC LIMIT 1").fetchone()
        return json_response(dict(row), 201)
    elif method == 'PUT':
        pid = params.get('id') or body.get('id')
        fields = {k: v for k, v in body.items() if k in (
            'title', 'description', 'objective', 'reasoning', 'status', 'project_id',
            'priority', 'risk_level', 'impact_level', 'rejection_reason', 'approved_at'
        )}
        if 'steps' in body:
            fields['steps_json'] = json.dumps(body['steps'])
        if 'required_tools' in body:
            fields['required_tools_json'] = json.dumps(body['required_tools'])
        if fields and pid:
            sets = ', '.join(f"{k}=?" for k in fields)
            vals = list(fields.values()) + [datetime.utcnow().isoformat(), pid]
            conn.execute(f"UPDATE task_proposals SET {sets}, updated_at=? WHERE id=?", vals)
            conn.commit()
        row = conn.execute("SELECT * FROM task_proposals WHERE id=?", (pid,)).fetchone()
        return json_response(dict(row) if row else {})
    elif method == 'DELETE':
        pid = params.get('id')
        if pid:
            conn.execute("DELETE FROM task_proposals WHERE id=?", (pid,))
            conn.commit()
        return json_response({'deleted': True})

# ═══════════════════════════════════════════════════════
#  P2: TASK LOGS HANDLER
# ═══════════════════════════════════════════════════════

def handle_task_logs(conn, method, params, body):
    if method == 'GET':
        task_id = params.get('task_id', '')
        proposal_id = params.get('proposal_id', '')
        if task_id:
            rows = conn.execute(
                "SELECT * FROM task_logs WHERE task_id=? ORDER BY step ASC", (task_id,)
            ).fetchall()
        elif proposal_id:
            rows = conn.execute(
                "SELECT * FROM task_logs WHERE proposal_id=? ORDER BY step ASC", (proposal_id,)
            ).fetchall()
        else:
            rows = conn.execute("SELECT * FROM task_logs ORDER BY created_at DESC LIMIT 50").fetchall()
        return json_response([dict(r) for r in rows])
    elif method == 'POST':
        conn.execute(
            """INSERT INTO task_logs
               (task_id, proposal_id, step, action, input_json, output_json, status, error, duration_ms)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (body.get('task_id'), body.get('proposal_id'),
             body.get('step', 0), body.get('action', ''),
             json.dumps(body.get('input', {})),
             json.dumps(body.get('output', {})),
             body.get('status', 'completed'),
             body.get('error', ''),
             body.get('duration_ms', 0))
        )
        conn.commit()
        row = conn.execute("SELECT * FROM task_logs ORDER BY id DESC LIMIT 1").fetchone()
        return json_response(dict(row), 201)

# ═══════════════════════════════════════════════════════
#  P2: ARTIFACTS HANDLER
# ═══════════════════════════════════════════════════════

def handle_artifacts(conn, method, params, body):
    if method == 'GET':
        project_id = params.get('project_id', '')
        proposal_id = params.get('proposal_id', '')
        atype = params.get('type', '')
        if project_id:
            rows = conn.execute(
                "SELECT * FROM artifacts WHERE project_id=? ORDER BY created_at DESC", (project_id,)
            ).fetchall()
        elif proposal_id:
            rows = conn.execute(
                "SELECT * FROM artifacts WHERE proposal_id=? ORDER BY created_at DESC", (proposal_id,)
            ).fetchall()
        elif atype:
            rows = conn.execute(
                "SELECT * FROM artifacts WHERE type=? ORDER BY created_at DESC", (atype,)
            ).fetchall()
        else:
            rows = conn.execute("SELECT * FROM artifacts ORDER BY created_at DESC LIMIT 50").fetchall()
        return json_response([dict(r) for r in rows])
    elif method == 'POST':
        conn.execute(
            """INSERT INTO artifacts
               (task_id, proposal_id, project_id, type, title, description, content_json, file_url, file_type)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (body.get('task_id'), body.get('proposal_id'),
             body.get('project_id'), body.get('type', 'report'),
             body.get('title', ''), body.get('description', ''),
             json.dumps(body.get('content', {})),
             body.get('file_url', ''), body.get('file_type', ''))
        )
        conn.commit()
        row = conn.execute("SELECT * FROM artifacts ORDER BY id DESC LIMIT 1").fetchone()
        return json_response(dict(row), 201)
    elif method == 'DELETE':
        aid = params.get('id')
        if aid:
            conn.execute("DELETE FROM artifacts WHERE id=?", (aid,))
            conn.commit()
        return json_response({'deleted': True})

# ═══════════════════════════════════════════════════════
#  P4: SENTIMENT LOG HANDLER
# ═══════════════════════════════════════════════════════

def handle_sentiment_log(conn, method, params, body):
    if method == 'GET':
        limit = int(params.get('limit', 50))
        rows = conn.execute("SELECT * FROM sentiment_log ORDER BY created_at DESC LIMIT ?", (limit,)).fetchall()
        return json_response([dict(r) for r in rows])
    elif method == 'POST':
        conn.execute(
            "INSERT INTO sentiment_log (conversation_id, sentiment, score, emotions_json, language) VALUES (?, ?, ?, ?, ?)",
            (body.get('conversation_id'), body.get('sentiment', 'neutral'),
             body.get('score', 0.0), json.dumps(body.get('emotions', {})),
             body.get('language', 'en'))
        )
        conn.commit()
        row = conn.execute("SELECT * FROM sentiment_log ORDER BY id DESC LIMIT 1").fetchone()
        return json_response(dict(row), 201)

# ═══════════════════════════════════════════════════════
#  P4: CONVERSATION THREADS HANDLER
# ═══════════════════════════════════════════════════════

def handle_conversation_threads(conn, method, params, body):
    if method == 'GET':
        tid = params.get('thread_id', '')
        status = params.get('status', '')
        if tid:
            row = conn.execute("SELECT * FROM conversation_threads WHERE thread_id=?", (tid,)).fetchone()
            return json_response(dict(row) if row else {})
        elif status:
            rows = conn.execute("SELECT * FROM conversation_threads WHERE status=? ORDER BY updated_at DESC", (status,)).fetchall()
        else:
            rows = conn.execute("SELECT * FROM conversation_threads ORDER BY updated_at DESC LIMIT 20").fetchall()
        return json_response([dict(r) for r in rows])
    elif method == 'POST':
        thread_id = body.get('thread_id', '')
        conn.execute(
            """INSERT INTO conversation_threads (thread_id, topic, summary, message_count, last_intent, status)
               VALUES (?, ?, ?, ?, ?, ?)
               ON CONFLICT(thread_id) DO UPDATE SET
               topic=excluded.topic, summary=excluded.summary,
               message_count=message_count+1, last_intent=excluded.last_intent,
               updated_at=datetime('now')""",
            (thread_id, body.get('topic', ''), body.get('summary', ''),
             body.get('message_count', 1), body.get('last_intent', ''),
             body.get('status', 'active'))
        )
        conn.commit()
        row = conn.execute("SELECT * FROM conversation_threads WHERE thread_id=?", (thread_id,)).fetchone()
        return json_response(dict(row) if row else {}, 201)

# ═══════════════════════════════════════════════════════
#  P5: OPERATION GROUPS HANDLER
# ═══════════════════════════════════════════════════════

def handle_operation_groups(conn, method, params, body):
    if method == 'GET':
        gid = params.get('id', '')
        if gid:
            row = conn.execute("SELECT * FROM operation_groups WHERE id=?", (gid,)).fetchone()
            if row:
                group = dict(row)
                ops = conn.execute("SELECT * FROM operations WHERE group_id=? ORDER BY priority DESC", (str(gid),)).fetchall()
                group['operations'] = [dict(o) for o in ops]
                return json_response(group)
            return json_response({})
        rows = conn.execute("SELECT * FROM operation_groups ORDER BY created_at DESC LIMIT 20").fetchall()
        return json_response([dict(r) for r in rows])
    elif method == 'POST':
        conn.execute(
            "INSERT INTO operation_groups (name, description, total_ops, status) VALUES (?, ?, ?, ?)",
            (body.get('name', 'Operation Group'), body.get('description', ''),
             body.get('total_ops', 0), body.get('status', 'running'))
        )
        conn.commit()
        row = conn.execute("SELECT * FROM operation_groups ORDER BY id DESC LIMIT 1").fetchone()
        return json_response(dict(row), 201)
    elif method == 'PUT':
        gid = params.get('id') or body.get('id')
        fields = {k: v for k, v in body.items() if k in ('name', 'description', 'total_ops', 'completed_ops', 'status')}
        if fields and gid:
            sets = ', '.join(f"{k}=?" for k in fields)
            vals = list(fields.values()) + [datetime.utcnow().isoformat(), gid]
            conn.execute(f"UPDATE operation_groups SET {sets}, updated_at=? WHERE id=?", vals)
            conn.commit()
        row = conn.execute("SELECT * FROM operation_groups WHERE id=?", (gid,)).fetchone()
        return json_response(dict(row) if row else {})

# ═══════════════════════════════════════════════════════
#  P7: BRIEFINGS HANDLER
# ═══════════════════════════════════════════════════════

def handle_briefings(conn, method, params, body):
    if method == 'GET':
        btype = params.get('type', '')
        limit = int(params.get('limit', 10))
        if btype:
            rows = conn.execute("SELECT * FROM briefings WHERE type=? ORDER BY created_at DESC LIMIT ?", (btype, limit)).fetchall()
        else:
            rows = conn.execute("SELECT * FROM briefings ORDER BY created_at DESC LIMIT ?", (limit,)).fetchall()
        return json_response([dict(r) for r in rows])
    elif method == 'POST':
        conn.execute(
            """INSERT INTO briefings (type, title, summary, insights_json, recommendations_json, metrics_json, period_start, period_end)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
            (body.get('type', 'daily'), body.get('title', 'Briefing'),
             body.get('summary', ''), json.dumps(body.get('insights', [])),
             json.dumps(body.get('recommendations', [])),
             json.dumps(body.get('metrics', {})),
             body.get('period_start', ''), body.get('period_end', ''))
        )
        conn.commit()
        row = conn.execute("SELECT * FROM briefings ORDER BY id DESC LIMIT 1").fetchone()
        return json_response(dict(row), 201)

# ═══════════════════════════════════════════════════════
#  P7: INTERACTION PATTERNS HANDLER
# ═══════════════════════════════════════════════════════

def handle_interaction_patterns(conn, method, params, body):
    if method == 'GET':
        ptype = params.get('pattern_type', '')
        if ptype:
            rows = conn.execute("SELECT * FROM interaction_patterns WHERE pattern_type=? ORDER BY frequency DESC", (ptype,)).fetchall()
        else:
            rows = conn.execute("SELECT * FROM interaction_patterns ORDER BY frequency DESC LIMIT 50").fetchall()
        return json_response([dict(r) for r in rows])
    elif method == 'POST':
        conn.execute(
            """INSERT INTO interaction_patterns (pattern_type, pattern_key, frequency, metadata_json)
               VALUES (?, ?, 1, ?)
               ON CONFLICT(pattern_type, pattern_key) DO UPDATE SET
               frequency=frequency+1, last_seen=datetime('now'),
               metadata_json=excluded.metadata_json, updated_at=datetime('now')""",
            (body.get('pattern_type', ''), body.get('pattern_key', ''),
             json.dumps(body.get('metadata', {})))
        )
        conn.commit()
        row = conn.execute(
            "SELECT * FROM interaction_patterns WHERE pattern_type=? AND pattern_key=?",
            (body.get('pattern_type', ''), body.get('pattern_key', ''))
        ).fetchone()
        return json_response(dict(row) if row else {}, 201)

# ═══════════════════════════════════════════════════════
#  P7: ANALYTICS ENDPOINT
# ═══════════════════════════════════════════════════════

def handle_analytics(conn, method, params, body):
    """Aggregate analytics for intelligence briefings."""
    if method != 'GET':
        return json_response({'error': 'GET only'}, 405)

    period = params.get('period', '7d')
    days = int(period.replace('d', '')) if period.endswith('d') else 7
    cutoff = (datetime.utcnow() - timedelta(days=days)).isoformat()

    # Conversation stats
    total_convos = conn.execute("SELECT COUNT(*) as c FROM conversations WHERE created_at >= ?", (cutoff,)).fetchone()['c']
    user_msgs = conn.execute("SELECT COUNT(*) as c FROM conversations WHERE role='user' AND created_at >= ?", (cutoff,)).fetchone()['c']
    jarvis_msgs = conn.execute("SELECT COUNT(*) as c FROM conversations WHERE role='jarvis' AND created_at >= ?", (cutoff,)).fetchone()['c']

    # Sentiment distribution
    sentiments = conn.execute(
        "SELECT sentiment, COUNT(*) as c FROM sentiment_log WHERE created_at >= ? GROUP BY sentiment ORDER BY c DESC",
        (cutoff,)
    ).fetchall()

    # Top intents
    top_intents = conn.execute(
        "SELECT pattern_key, frequency FROM interaction_patterns WHERE pattern_type='intent' ORDER BY frequency DESC LIMIT 10"
    ).fetchall()

    # Active hours
    active_hours = conn.execute(
        "SELECT CAST(strftime('%H', created_at) AS INTEGER) as hour, COUNT(*) as c FROM conversations WHERE created_at >= ? GROUP BY hour ORDER BY c DESC LIMIT 5",
        (cutoff,)
    ).fetchall()

    # Memory growth
    new_memories = conn.execute("SELECT COUNT(*) as c FROM memories WHERE created_at >= ?", (cutoff,)).fetchone()['c']
    total_memories = conn.execute("SELECT COUNT(*) as c FROM memories").fetchone()['c']

    # Project activity
    active_projects = conn.execute("SELECT COUNT(*) as c FROM projects WHERE status='Active'").fetchone()['c']
    new_ops = conn.execute("SELECT COUNT(*) as c FROM operations WHERE created_at >= ?", (cutoff,)).fetchone()['c']

    return json_response({
        'period_days': days,
        'conversations': {'total': total_convos, 'user': user_msgs, 'jarvis': jarvis_msgs},
        'sentiments': [dict(s) for s in sentiments],
        'top_intents': [dict(i) for i in top_intents],
        'active_hours': [dict(h) for h in active_hours],
        'memory': {'new': new_memories, 'total': total_memories},
        'projects': {'active': active_projects},
        'operations': {'new': new_ops},
    })

# ═══════════════════════════════════════════════════════
#  AUTH SYSTEM
# ═══════════════════════════════════════════════════════

def _hash_password(password, salt=None):
    if salt is None:
        salt = secrets.token_hex(16)
    h = hashlib.pbkdf2_hmac('sha256', password.encode('utf-8'), salt.encode('utf-8'), 100000)
    return h.hex(), salt

def _generate_token():
    return secrets.token_urlsafe(48)

def handle_auth(conn, method, params, body):
    """Handle user registration, login, token validation, and API endpoint config."""
    sub = params.get('sub', '')

    if sub == 'register' and method == 'POST':
        username = body.get('username', '').strip().lower()
        password = body.get('password', '')
        display_name = body.get('display_name', 'Sir')

        if not username or not password:
            json_response({'error': 'Username and password required'}, 400)
            return
        if len(password) < 4:
            json_response({'error': 'Password must be at least 4 characters'}, 400)
            return

        # Check if any user exists already (single-user system)
        existing = conn.execute('SELECT COUNT(*) FROM users').fetchone()[0]
        if existing > 0:
            json_response({'error': 'Account already exists. Use login.'}, 409)
            return

        pw_hash, salt = _hash_password(password)
        token = _generate_token()
        expires = (datetime.utcnow() + timedelta(days=30)).isoformat()
        conn.execute(
            '''INSERT INTO users (username, password_hash, salt, display_name, role, auth_token, token_expires, last_login)
               VALUES (?, ?, ?, ?, 'admin', ?, ?, datetime('now'))''',
            (username, pw_hash, salt, display_name, token, expires)
        )
        conn.commit()
        json_response({
            'success': True,
            'token': token,
            'username': username,
            'display_name': display_name,
            'expires': expires
        })
        return

    elif sub == 'login' and method == 'POST':
        username = body.get('username', '').strip().lower()
        password = body.get('password', '')

        if not username or not password:
            json_response({'error': 'Username and password required'}, 400)
            return

        user = conn.execute('SELECT * FROM users WHERE username = ?', (username,)).fetchone()
        if not user:
            json_response({'error': 'Invalid credentials'}, 401)
            return

        pw_hash, _ = _hash_password(password, user['salt'])
        if pw_hash != user['password_hash']:
            json_response({'error': 'Invalid credentials'}, 401)
            return

        token = _generate_token()
        expires = (datetime.utcnow() + timedelta(days=30)).isoformat()
        conn.execute(
            'UPDATE users SET auth_token = ?, token_expires = ?, last_login = datetime("now") WHERE id = ?',
            (token, expires, user['id'])
        )
        conn.commit()
        json_response({
            'success': True,
            'token': token,
            'username': user['username'],
            'display_name': user['display_name'],
            'expires': expires
        })
        return

    elif sub == 'validate' and method == 'POST':
        token = body.get('token', '')
        if not token:
            json_response({'valid': False, 'error': 'No token'}, 401)
            return
        user = conn.execute(
            'SELECT * FROM users WHERE auth_token = ? AND token_expires > datetime("now")',
            (token,)
        ).fetchone()
        if user:
            json_response({
                'valid': True,
                'username': user['username'],
                'display_name': user['display_name']
            })
        else:
            json_response({'valid': False, 'error': 'Token expired or invalid'}, 401)
        return

    elif sub == 'status':
        # Check if any account exists
        count = conn.execute('SELECT COUNT(*) FROM users').fetchone()[0]
        json_response({'has_account': count > 0, 'user_count': count})
        return

    elif sub == 'api_endpoint':
        # Store/retrieve the current API endpoint so GitHub Pages can auto-connect
        if method == 'GET':
            row = conn.execute("SELECT value FROM settings WHERE key = 'api_endpoint'").fetchone()
            json_response({'endpoint': row['value'] if row else ''})
        elif method == 'POST':
            endpoint = body.get('endpoint', '')
            conn.execute(
                "INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES ('api_endpoint', ?, datetime('now'))",
                (endpoint,)
            )
            conn.commit()
            json_response({'success': True, 'endpoint': endpoint})
        return

    json_response({'error': 'Unknown auth sub-action', 'available': ['register', 'login', 'validate', 'status', 'api_endpoint']}, 400)


# ═══════════════════════════════════════════════════════
#  MAIN ROUTER
# ═══════════════════════════════════════════════════════

def main():
    method = os.environ.get('REQUEST_METHOD', 'GET').upper()
    qs = os.environ.get('QUERY_STRING', '')
    params = parse_qs(qs)
    action = params.get('action', '')
    body = read_body() if method in ('POST', 'PUT', 'PATCH') else {}

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
            # P1 + P2
            'task_proposals': handle_task_proposals,
            'task_logs': handle_task_logs,
            'artifacts': handle_artifacts,
            # P4: Enhanced NLU
            'sentiment_log': handle_sentiment_log,
            'conversation_threads': handle_conversation_threads,
            # P5: Parallel Operations
            'operation_groups': handle_operation_groups,
            # P7: Intelligence
            'briefings': handle_briefings,
            'interaction_patterns': handle_interaction_patterns,
            'analytics': handle_analytics,
            # Auth
            'auth': handle_auth,
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
