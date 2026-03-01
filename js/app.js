/**
 * JARVIS AI Assistant — Core Application Engine
 * J.A.R.V.I.S. — Just A Rather Very Intelligent System
 * Stark Industries — Proprietary Interface v7.3.1
 */

'use strict';

// ═══════════════════════════════════════════════════════
//  CONFIGURATION
// ═══════════════════════════════════════════════════════
// Remote API with in-memory cache (server-backed)

const JARVIS_RESPONSES = {
  greetings: [
    "Good {time}, {name}. All systems are fully operational.",
    "Welcome back, {name}. I've been monitoring the situation.",
    "Ah, {name}. I've taken the liberty of running diagnostics. Everything is nominal.",
    "Systems online, {name}. Ready for your instructions.",
  ],
  thinking: [
    "Processing your request, {name}.",
    "Analyzing data streams...",
    "Cross-referencing available information...",
    "Running analysis. One moment, {name}.",
    "Accessing relevant data banks...",
  ],
  project_created: [
    "Project '{name}' has been initialized and logged to the operational matrix, {user}.",
    "I've created project '{name}'. It's now tracked in your operational timeline, {user}.",
  ],
  task_created: [
    "Task '{name}' has been added to the project queue.",
    "Logged. Task '{name}' is now in the operational pipeline.",
  ],
  research_saved: [
    "Research on '{topic}' has been indexed and stored in the knowledge matrix, {user}.",
  ],
  memory_saved: [
    "Memory indexed successfully. I'll retain that information for future reference, {user}.",
  ],
  voice_start: [
    "Voice interface active. I'm listening, {name}.",
    "Auditory sensors engaged. Go ahead, {name}.",
    "Voice mode activated. Ready for your command, {name}.",
  ],
  voice_end: [
    "Voice interface standing by.",
    "Switching to standby mode.",
  ],
  unknown: [
    "I'm afraid I don't quite follow, {name}. Could you rephrase that?",
    "I didn't catch that entirely. Could you be more specific, {name}?",
    "My apologies, {name}. That command isn't in my current parameters. Try 'help' for a list of commands.",
  ],
  help: `Available commands, {name}:
• "new project [name]" — Create a new project
• "show projects" — Navigate to projects
• "new task [name]" — Add task to current project
• "research [topic]" — Open research center
• "show chat" — Open conversation panel
• "remember [fact]" — Save to memory banks
• "show memory" — Open memory banks
• "show dashboard" — Return to command center
• "settings" — Open configuration panel
• "what time is it" — Current time
• "status" — System diagnostics report`,
};

TRUNCATED_FOR_BREVITY_TESTING