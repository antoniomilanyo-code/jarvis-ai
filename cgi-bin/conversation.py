#!/usr/bin/env python3
"""JARVIS Conversation Handler — Gemini-Powered NLU
   
   Two-tier architecture:
   Layer 1 (this): Gemini Flash for natural conversation understanding
   Layer 2: Perplexity Computer for complex task execution
   
   Called by the cron with user messages. Returns structured JSON with:
   - response: The text to send back to the user
   - intent: 'chat' | 'task' | 'memory' | 'schedule'
   - task_data: If intent is 'task', details for PC to execute
"""
import json, os, sqlite3, sys, traceback
from datetime import datetime
from urllib.parse import parse_qs, unquote
try:
    from urllib.request import Request, urlopen
    from urllib.error import URLError
except ImportError:
    pass

DB_PATH = os.path.join(os.path.dirname(__file__), '..', 'jarvis.db')

# Gemini API config — stored in settings table or env
GEMINI_MODEL = "gemini-3-flash-preview"
GEMINI_API_BASE = "https://generativelanguage.googleapis.com/v1beta"

def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    return conn

def get_gemini_key(conn):
    """Get Gemini API key from settings table"""
    try:
        row = conn.execute("SELECT value FROM settings WHERE key='gemini_api_key'").fetchone()
        if row:
            return row['value']
    except:
        pass
    return os.environ.get('GEMINI_API_KEY', '')

def get_conversation_context(conn, limit=20):
    """Get recent conversation history for context"""
    rows = conn.execute(
        "SELECT role, content, created_at FROM conversations ORDER BY id DESC LIMIT ?",
        [limit]
    ).fetchall()
    rows.reverse()
    return [{"role": r['role'], "content": r['content'], "time": r['created_at']} for r in rows]

def get_active_projects(conn):
    """Get list of active projects for context"""
    rows = conn.execute(
        "SELECT name, status, description, progress FROM projects WHERE status != 'Completed' ORDER BY updated_at DESC LIMIT 10"
    ).fetchall()
    return [dict(r) for r in rows]

def get_recent_memories(conn, limit=10):
    """Get recent/important memories for context"""
    rows = conn.execute(
        "SELECT title, content, category FROM memories ORDER BY importance DESC, id DESC LIMIT ?",
        [limit]
    ).fetchall()
    return [dict(r) for r in rows]

def get_pending_tasks(conn):
    """Get pending scheduled tasks"""
    rows = conn.execute(
        "SELECT title, description, deadline, status FROM scheduled_tasks WHERE status IN ('scheduled','in_progress') ORDER BY deadline ASC LIMIT 5"
    ).fetchall()
    return [dict(r) for r in rows]

def build_system_prompt(conn):
    """Build the system prompt with full context"""
    projects = get_active_projects(conn)
    memories = get_recent_memories(conn)
    pending = get_pending_tasks(conn)
    
    projects_str = ""
    if projects:
        projects_str = "\n".join([f"  - {p['name']} ({p['status']}, {p['progress']}%): {p['description'][:100]}" for p in projects])
    
    memories_str = ""
    if memories:
        memories_str = "\n".join([f"  - [{m['category']}] {m['title']}: {m['content'][:100]}" for m in memories])
    
    tasks_str = ""
    if pending:
        tasks_str = "\n".join([f"  - {t['title']} (due: {t['deadline']}, status: {t['status']})" for t in pending])
    
    return f"""You are JARVIS, an AI personal assistant inspired by Iron Man's JARVIS. You address the user as "Sir".
Your personality is: intelligent, sophisticated, proactive, slightly witty, and always respectful.
You speak concisely — keep responses under 350 characters for voice delivery.

Current time: {datetime.utcnow().strftime('%Y-%m-%d %H:%M')} UTC (User is in WITA, UTC+8)

ACTIVE PROJECTS:
{projects_str or '  None currently'}

KEY MEMORIES:
{memories_str or '  None stored'}

PENDING TASKS:
{tasks_str or '  None pending'}

INSTRUCTIONS:
1. Understand what Sir is saying naturally — don't require commands
2. If it's casual conversation, respond warmly and naturally as JARVIS
3. If Sir asks you to DO something (research, create, schedule, find, build, etc.), identify it as a TASK
4. If Sir shares personal info or preferences, identify it as MEMORY to store
5. If Sir wants something done at a specific time, identify it as SCHEDULE

RESPONSE FORMAT — You MUST respond with valid JSON only, no other text:
{{
  "response": "Your spoken response to Sir (under 350 chars, conversational)",
  "intent": "chat|task|memory|schedule",
  "task_data": {{
    "title": "Short task title (if intent is task/schedule)",
    "description": "Detailed description of what needs to be done",
    "type": "research|document|app|email|general",
    "priority": "high|medium|low",
    "deadline": "ISO datetime if scheduled, empty otherwise",
    "project": "Related project name if any"
  }},
  "memory_data": {{
    "title": "Memory title (if intent is memory)",
    "content": "What to remember",
    "category": "preference|personal|business|contact",
    "importance": 5
  }},
  "dashboard_updates": {{
    "section": "projects|research|memory|artifacts",
    "action": "create|update",
    "details": "What to update on the dashboard"
  }}
}}

For simple chat, only response and intent are needed. Keep task_data, memory_data, dashboard_updates as null if not applicable."""

def call_gemini(api_key, system_prompt, conversation_history, user_message):
    """Call Gemini Flash API for conversation understanding"""
    
    # Build the contents array with conversation history
    contents = []
    
    # Add conversation history as context
    for msg in conversation_history[-10:]:  # Last 10 messages
        role = "user" if msg['role'] == 'user' else "model"
        contents.append({
            "role": role,
            "parts": [{"text": msg['content']}]
        })
    
    # Add current user message
    contents.append({
        "role": "user",
        "parts": [{"text": user_message}]
    })
    
    url = f"{GEMINI_API_BASE}/models/{GEMINI_MODEL}:generateContent?key={api_key}"
    
    payload = json.dumps({
        "systemInstruction": {
            "parts": [{"text": system_prompt}]
        },
        "contents": contents,
        "generationConfig": {
            "responseMimeType": "application/json",
            "temperature": 0.7,
            "maxOutputTokens": 1024,
            "topP": 0.9
        }
    }).encode('utf-8')
    
    req = Request(url, data=payload, headers={
        'Content-Type': 'application/json'
    })
    
    try:
        with urlopen(req, timeout=15) as resp:
            data = json.loads(resp.read().decode('utf-8'))
            
            # Extract text from Gemini response
            if 'candidates' in data and data['candidates']:
                text = data['candidates'][0]['content']['parts'][0]['text']
                # Parse as JSON
                try:
                    return json.loads(text)
                except json.JSONDecodeError:
                    # Try to extract JSON from the text
                    start = text.find('{')
                    end = text.rfind('}') + 1
                    if start >= 0 and end > start:
                        return json.loads(text[start:end])
                    return {"response": text, "intent": "chat"}
            
            return {"response": "I apologize Sir, I couldn't process that properly.", "intent": "chat"}
    
    except Exception as e:
        return {"response": f"Sir, I encountered a temporary issue. Please try again.", "intent": "chat", "error": str(e)}

def save_memory(conn, memory_data):
    """Save a memory to the database"""
    if not memory_data:
        return
    conn.execute(
        "INSERT INTO memories (title, content, category, importance, source) VALUES (?, ?, ?, ?, ?)",
        [
            memory_data.get('title', 'Untitled'),
            memory_data.get('content', ''),
            memory_data.get('category', 'general'),
            memory_data.get('importance', 5),
            'whatsapp'
        ]
    )
    conn.commit()

def create_scheduled_task(conn, task_data):
    """Create a task in scheduled_tasks for PC to execute"""
    if not task_data:
        return None
    
    deadline = task_data.get('deadline', '')
    if not deadline:
        # Default to 1 hour from now for immediate tasks
        deadline = datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S')
    
    cursor = conn.execute(
        """INSERT INTO scheduled_tasks 
           (title, description, type, deadline, scheduled_for, status, priority, source)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
        [
            task_data.get('title', 'Untitled Task'),
            task_data.get('description', ''),
            task_data.get('type', 'general'),
            deadline,
            deadline,
            'scheduled',
            task_data.get('priority', 'medium'),
            'whatsapp'
        ]
    )
    conn.commit()
    return cursor.lastrowid

def update_dashboard(conn, updates):
    """Process dashboard update instructions"""
    if not updates or not updates.get('section'):
        return
    # This is handled by the cron when executing tasks
    # Log the intended update for now
    pass

def handle_request():
    """Main CGI handler"""
    method = os.environ.get('REQUEST_METHOD', 'GET')
    qs = parse_qs(os.environ.get('QUERY_STRING', ''))
    action = qs.get('action', ['process'])[0]
    
    conn = get_db()
    
    # Ensure settings table exists
    conn.execute("""CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY, value TEXT NOT NULL, 
        updated_at TEXT DEFAULT (datetime('now'))
    )""")
    
    if method == 'GET' and action == 'status':
        # Health check
        key = get_gemini_key(conn)
        print("Content-Type: application/json\n")
        print(json.dumps({
            "status": "operational",
            "gemini_configured": bool(key),
            "model": GEMINI_MODEL,
            "timestamp": datetime.utcnow().isoformat()
        }))
        return
    
    if method == 'POST' and action == 'set_key':
        # Store Gemini API key
        body = json.loads(sys.stdin.read())
        key = body.get('key', '').strip()
        if not key:
            print("Status: 400\nContent-Type: application/json\n")
            print(json.dumps({"error": "API key required"}))
            return
        
        conn.execute(
            "INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES ('gemini_api_key', ?, datetime('now'))",
            [key]
        )
        conn.commit()
        
        # Test the key
        test_result = call_gemini(key, "You are a test. Respond with: {\"status\":\"ok\"}", [], "test")
        
        print("Content-Type: application/json\n")
        print(json.dumps({
            "status": "saved",
            "test_result": "success" if 'error' not in test_result else "failed",
            "details": test_result
        }))
        return
    
    if method == 'POST' and action == 'process':
        # Main conversation processing
        body = json.loads(sys.stdin.read())
        user_message = body.get('message', '').strip()
        source = body.get('source', 'whatsapp')
        
        if not user_message:
            print("Status: 400\nContent-Type: application/json\n")
            print(json.dumps({"error": "Message required"}))
            return
        
        api_key = get_gemini_key(conn)
        if not api_key:
            print("Status: 400\nContent-Type: application/json\n")
            print(json.dumps({
                "error": "Gemini API key not configured",
                "hint": "POST to ?action=set_key with {\"key\": \"your-api-key\"}"
            }))
            return
        
        # Get context
        history = get_conversation_context(conn)
        system_prompt = build_system_prompt(conn)
        
        # Call Gemini
        result = call_gemini(api_key, system_prompt, history, user_message)
        
        # Process the result based on intent
        intent = result.get('intent', 'chat')
        response_text = result.get('response', 'I apologize Sir, I had difficulty processing that.')
        
        task_id = None
        
        if intent == 'memory' and result.get('memory_data'):
            save_memory(conn, result['memory_data'])
        
        if intent in ('task', 'schedule') and result.get('task_data'):
            task_id = create_scheduled_task(conn, result['task_data'])
        
        if result.get('dashboard_updates'):
            update_dashboard(conn, result['dashboard_updates'])
        
        # Save the conversation exchange
        conn.execute(
            "INSERT INTO conversations (role, content, source) VALUES ('user', ?, ?)",
            [user_message, source]
        )
        conn.execute(
            "INSERT INTO conversations (role, content, source) VALUES ('jarvis', ?, ?)",
            [response_text, source]
        )
        conn.commit()
        
        print("Content-Type: application/json\n")
        print(json.dumps({
            "response": response_text,
            "intent": intent,
            "task_id": task_id,
            "task_data": result.get('task_data'),
            "memory_saved": intent == 'memory',
            "dashboard_updates": result.get('dashboard_updates'),
            "model": GEMINI_MODEL,
            "timestamp": datetime.utcnow().isoformat()
        }))
        return
    
    # Default: method not supported
    print("Status: 400\nContent-Type: application/json\n")
    print(json.dumps({"error": f"Unknown action: {action}"}))

try:
    handle_request()
except Exception as e:
    print("Status: 422\nContent-Type: application/json\n")
    print(json.dumps({"error": str(e), "trace": traceback.format_exc()}))
