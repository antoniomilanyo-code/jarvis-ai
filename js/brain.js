/**
 * JARVIS BRAIN — Conversational Intelligence Engine
 * Replaces rigid command matching with NLU intent detection,
 * conversation context tracking, and autonomous action execution.
 *
 * JARVIS understands natural conversation and decides what to do:
 *   "I've been thinking about building a mobile app" → creates a project
 *   "That's a really good point, don't forget it" → saves to memory
 *   "I wonder how quantum computing works" → starts research
 *   "Can you look into the latest AI trends" → starts research
 *   "Let's get that deployed" → queues an operation
 */

'use strict';

const JarvisBrain = (function () {

  // ───────────────────────────────────────────────────
  //  CONVERSATION CONTEXT — short-term memory
  // ───────────────────────────────────────────────────
  const context = {
    recentMessages: [],      // last 10 messages for context
    currentTopic: null,      // what we're talking about
    lastIntent: null,        // what JARVIS last detected
    lastEntityName: null,    // extracted entity (project name, topic, etc.)
    pendingConfirmation: null, // waiting for user to confirm an action
    mood: 'neutral',         // user mood detection
    conversationDepth: 0,    // how deep into a topic we are
  };

  function addToContext(role, text) {
    context.recentMessages.push({ role, text, time: Date.now() });
    if (context.recentMessages.length > 12) context.recentMessages.shift();
  }

  function getRecentContext() {
    return context.recentMessages.map(m => `${m.role}: ${m.text}`).join('\n');
  }

  // ───────────────────────────────────────────────────
  //  KEYWORD & PATTERN LIBRARIES
  // ───────────────────────────────────────────────────

  const INTENT_SIGNALS = {
    create_project: {
      strong: [
        /\b(?:start|create|build|launch|begin|kick\s*off|initiate|set\s*up|spin\s*up|open)\b.*\b(?:project|app|application|website|site|startup|venture|business|platform|tool|product|prototype|mvp|system)\b/i,
        /\b(?:project|app|venture|startup|business)\b.*\b(?:called|named|about|for|on)\b/i,
        /\blet'?s\s+(?:start|build|create|make|work\s+on|do)\b/i,
        /\bi\s+(?:want|need|wanna|gotta|should|must|have\s+to)\s+(?:to\s+)?(?:start|build|create|make|develop|launch)\b/i,
        /\bnew\s+(?:project|idea|venture|thing|concept)\b/i,
        /\bi'?(?:ve|m)\s+(?:been\s+)?(?:thinking|planning|considering)\s+(?:about\s+)?(?:building|creating|starting|making|launching|developing)\b/i,
      ],
      weak: [
        /\b(?:working\s+on|idea\s+for|plan\s+for|concept\s+for)\b/i,
        /\b(?:could|should|might)\s+(?:we\s+)?(?:build|create|make|start)\b/i,
        /\bwhat\s+(?:if|about)\s+(?:we|i)\s+(?:build|create|make)\b/i,
      ]
    },
    save_memory: {
      strong: [
        /\b(?:remember|don'?t\s+forget|note|save|store|keep\s+(?:in\s+mind|track|note)|log|record|index|write\s+(?:down|that))\b/i,
        /\b(?:that'?s?\s+)?(?:important|key|crucial|critical|vital|essential|worth\s+(?:noting|remembering|saving))\b/i,
        /\b(?:make\s+(?:a\s+)?note|take\s+(?:a\s+)?note|jot\s+(?:that\s+)?down)\b/i,
        /\bfor\s+(?:future\s+)?reference\b/i,
        /\bi\s+(?:learned|discovered|found\s+out|realized|noticed)\b/i,
      ],
      weak: [
        /\b(?:interesting|good\s+(?:point|idea|info)|keep\s+that)\b/i,
        /\bso\s+basically\b/i,
      ]
    },
    research: {
      strong: [
        /\b(?:research|investigate|look\s*(?:up|into)|find\s+(?:out|info|information|data)|explore|study|dig\s+into|deep\s*dive)\b/i,
        /\b(?:how|what|why|when|where)\s+(?:does|do|is|are|was|were|can|could|would|should)\b.*\b(?:work|mean|function|operate|happen)\b/i,
        /\b(?:i\s+)?(?:wonder|curious|wanna?\s+know|need\s+to\s+(?:know|understand|learn)|tell\s+me\s+about)\b/i,
        /\b(?:can\s+you|could\s+you)\s+(?:find|look|search|check|get\s+(?:me\s+)?info)\b/i,
        /\bwhat(?:'s|\s+is)\s+(?:the\s+)?(?:deal|story|situation|latest|status)\s+(?:with|on|about)\b/i,
      ],
      weak: [
        /\b(?:apparently|supposedly|i\s+(?:heard|read|saw)\s+that)\b/i,
        /\b(?:what\s+about|how\s+about)\b/i,
      ]
    },
    create_task: {
      strong: [
        /\b(?:add|create|make|need)\s+(?:a\s+)?(?:task|todo|to-do|action\s*item|item|step|thing\s+to\s+do)\b/i,
        /\b(?:i\s+)?(?:need\s+to|have\s+to|should|must|gotta)\s+(?:do|finish|complete|handle|take\s+care\s+of)\b/i,
        /\b(?:next\s+step|action\s+item|todo|to-do)\b.*\b(?:is|should\s+be|will\s+be)\b/i,
        /\bdon'?t\s+(?:let\s+me\s+)?forget\s+to\b/i,
        /\bremind\s+me\s+to\b/i,
      ],
      weak: [
        /\b(?:then\s+(?:we|i)\s+(?:need|have)\s+to|after\s+that)\b/i,
      ]
    },
    launch_operation: {
      strong: [
        /\b(?:deploy|launch|execute|run|ship|release|push|go\s+live|activate|fire\s+up|boot\s+up|kick\s+off|spin\s+up)\b/i,
        /\b(?:start|begin|initiate)\s+(?:the\s+)?(?:operation|process|pipeline|workflow|procedure|analysis|scan|build|deployment|compilation|sync|backup|migration|download|upload|transfer|test|audit|optimization)\b/i,
        /\blet'?s\s+(?:get|make)\s+(?:it|this|that)\s+(?:running|going|started|done|deployed|live|shipped)\b/i,
      ],
      weak: [
        /\b(?:ready\s+to\s+(?:go|launch|ship)|time\s+to\s+(?:deploy|ship|launch))\b/i,
      ]
    },
    navigate: {
      strong: [
        /\b(?:show|open|go\s+to|switch\s+to|take\s+me\s+to|navigate\s+to|pull\s+up|bring\s+up|let\s+me\s+see)\s+(?:the\s+)?(?:dashboard|chat|projects?|operations?|research|memory|memories|settings?|config)\b/i,
      ],
      weak: []
    },
    greeting: {
      strong: [
        // Only match pure greetings — not "hey jarvis" followed by a command
        /^(?:hey|hello|hi|yo|sup|what'?s\s*up|good\s+(?:morning|afternoon|evening|day)|howdy|greetings)\s*(?:jarvis)?\s*[.!,]*\s*$/i,
      ],
      weak: [
        /^(?:hey|hello|hi|yo)\s+(?:jarvis|there|buddy|man|dude)\b/i,
      ]
    },
    status_check: {
      strong: [
        /\b(?:status|how\s+(?:are\s+)?(?:things|we|you|systems?)|what'?s\s+(?:the\s+)?(?:status|situation|state)|diagnostics?|report|overview|sitrep)\b/i,
      ],
      weak: []
    },
    gratitude: {
      strong: [
        /\b(?:thanks?(?:\s+you)?|thank\s+you|thx|cheers|appreciated?|grateful|nice\s+(?:one|job|work)|good\s+(?:job|work)|well\s+done|perfect|excellent|awesome|great)\b/i,
      ],
      weak: []
    },
    agreement: {
      strong: [
        /^(?:yes|yeah|yep|yup|sure|ok(?:ay)?|affirmative|absolutely|definitely|of\s+course|do\s+it|go\s+(?:ahead|for\s+it)|proceed|confirm|exactly|right|correct)\b/i,
      ],
      weak: []
    },
    disagreement: {
      strong: [
        /^(?:no|nah|nope|never|don'?t|stop|cancel|abort|negative|scratch\s+that|forget\s+(?:it|that)|not\s+(?:really|quite|exactly))\b/i,
      ],
      weak: []
    },
    time_query: {
      strong: [
        /\b(?:what\s+(?:time|day|date)|current\s+(?:time|date)|today'?s?\s+date)\b/i,
      ],
      weak: []
    },
    help: {
      strong: [
        /\b(?:help|what\s+can\s+you\s+do|capabilities|features|commands?|how\s+(?:do\s+(?:i|you)|does\s+(?:this|it))\s+work)\b/i,
      ],
      weak: []
    },
    casual_chat: {
      strong: [],
      weak: [
        /\b(?:i\s+think|i\s+feel|i\s+believe|in\s+my\s+opinion|honestly|personally|you\s+know)\b/i,
        /^(?:so|well|anyway|hmm|huh|oh|wow|man|dude|lol|haha)\b/i,
      ]
    }
  };

  // ───────────────────────────────────────────────────
  //  ENTITY EXTRACTION
  // ───────────────────────────────────────────────────

  function extractProjectName(text) {
    // Try quoted names first — most explicit
    const quoted = text.match(/["']([^"']+)["']/);
    if (quoted) return quoted[1];

    // "called X" / "named X" — explicit naming
    const called = text.match(/\b(?:called|named|titled)\s+(.+?)(?:\.|,|!|\?|$)/i);
    if (called) return _cleanProjectName(called[1]);

    // "project about X"
    const about = text.match(/\b(?:project|app|product|platform|venture|startup)\s+(?:about|for|on|around)\s+(.+?)(?:\.|,|!|\?|$)/i);
    if (about) return _cleanProjectName(about[1]);

    // "thinking about building X"
    const thinkBuild = text.match(/\b(?:thinking|planning|considering)\s+(?:about|of)?\s*(?:building|creating|making|starting|launching|developing)\s+(?:a\s+|an\s+|the\s+)?(.+?)(?:\.|,|!|\?|$)/i);
    if (thinkBuild) {
      const name = _cleanProjectName(thinkBuild[1]);
      if (name && name.length > 2 && name.length < 80) return name;
    }

    // "build/create/start a new project" — WITHOUT a specific name, return null (don't guess)
    const genericProject = /\b(?:build|create|start|launch|make|develop|begin|kick\s*off)\s+(?:a\s+)?(?:new\s+)?(?:project|app|venture|startup|business)\b/i;
    if (genericProject.test(text)) {
      // Check if there's a specific name AFTER "project" like "start a new project for crypto trading"
      const afterProject = text.match(/\b(?:project|app|venture|startup|business)\s+(?:for|about|on|called|named)\s+(.+?)(?:\.|,|!|\?|$)/i);
      if (afterProject) return _cleanProjectName(afterProject[1]);
      // No specific name given — return null so brain asks for one
      return null;
    }

    // "build/create X" where X is a specific thing (not generic)
    const verb = text.match(/\b(?:build|create|start|launch|make|develop)\s+(?:a\s+|an\s+|the\s+)?(.+?)(?:\.|,|!|\?|$)/i);
    if (verb) {
      const name = _cleanProjectName(verb[1]);
      if (name && name.length > 2 && name.length < 80) return name;
    }

    // "I want/need to build X"
    const wantTo = text.match(/\b(?:want|need|wanna|gotta)\s+(?:to\s+)?(?:build|create|start|make|develop|launch)\s+(?:a\s+|an\s+|the\s+)?(.+?)(?:\.|,|!|\?|$)/i);
    if (wantTo) {
      const name = _cleanProjectName(wantTo[1]);
      if (name && name.length > 2 && name.length < 80) return name;
    }

    return null;
  }

  // Clean up extracted project names — remove conversational filler
  function _cleanProjectName(raw) {
    if (!raw) return null;
    let name = raw.trim();
    // Remove trailing conversational phrases that aren't part of the name
    name = name.replace(/\s*[,.]\s*(?:are you|you ready|ready|right|okay|ok|yes|yeah|let'?s|shall we|can you|will you|what do you think|sounds? good|i think|don'?t you think|is that|isn'?t it|how about|please|thanks?|thank you|sir|boss|jarvis|hey|oh|so|and|but|or|also|then).*$/i, '');
    // Remove trailing filler words (but keep "app" if preceded by a descriptor)
    name = name.replace(/\s+(?:project|thing|or\s+something|maybe|i\s+think|you\s+know|new)$/i, '').trim();
    // Only strip "app" if it's the ONLY word
    if (name.toLowerCase() === 'app') return null;
    // Remove leading "new" if it's the only word left
    if (name.toLowerCase() === 'new') return null;
    // Too short or too generic
    if (name.length < 3) return null;
    if (/^(a|an|the|this|that|it|one|some|my)$/i.test(name)) return null;
    return name;
  }

  function extractMemoryContent(text) {
    // If the user says "remember that X" or "don't forget X"
    const patterns = [
      /\b(?:remember|note|save|store|keep|record|don'?t\s+forget)\s+(?:that\s+)?(.+)/i,
      /\b(?:make\s+(?:a\s+)?note|take\s+(?:a\s+)?note|jot\s+down)\s*(?::\s*|that\s+)?(.+)/i,
      /\b(?:for\s+future\s+reference)\s*(?::\s*|,\s*)?(.+)/i,
    ];
    for (const pat of patterns) {
      const m = text.match(pat);
      if (m) return m[1].trim();
    }
    return text;
  }

  function extractResearchTopic(text) {
    const patterns = [
      /\b(?:research|investigate|look\s*(?:up|into)|find\s+(?:out|info)\s+(?:about|on)|explore|study|dig\s+into|deep\s*dive\s+(?:into|on))\s+(.+?)(?:\.|!|\?|$)/i,
      /\b(?:tell\s+me\s+about|what(?:'s|\s+is)\s+(?:the\s+)?(?:deal|story|situation|latest)\s+(?:with|on|about))\s+(.+?)(?:\.|!|\?|$)/i,
      /\b(?:how|what|why)\s+(?:does|do|is|are|can|could)\s+(.+?)(?:\?|$)/i,
      /\b(?:i\s+)?(?:wonder|curious)\s+(?:about\s+)?(.+?)(?:\.|!|\?|$)/i,
      /\b(?:can\s+you|could\s+you)\s+(?:find|search|check|look)\s+(?:(?:up|into|for)\s+)?(.+?)(?:\.|!|\?|$)/i,
    ];
    for (const pat of patterns) {
      const m = text.match(pat);
      if (m) {
        let topic = m[1].trim();
        topic = topic.replace(/\b(please|for\s+me|real\s+quick|quickly|asap)\b/gi, '').trim();
        if (topic.length > 2) return topic;
      }
    }
    return null;
  }

  function extractTaskTitle(text) {
    const patterns = [
      /\b(?:need\s+to|have\s+to|should|must|gotta)\s+(.+?)(?:\.|!|\?|$)/i,
      /\b(?:remind\s+me\s+to|don'?t\s+(?:let\s+me\s+)?forget\s+to)\s+(.+?)(?:\.|!|\?|$)/i,
      /\b(?:add\s+(?:a\s+)?(?:task|todo|item)\s*(?:to|for|:)?\s*)(.+?)(?:\.|!|\?|$)/i,
      /\b(?:next\s+step\s+(?:is|should\s+be)\s+(?:to\s+)?)(.+?)(?:\.|!|\?|$)/i,
    ];
    for (const pat of patterns) {
      const m = text.match(pat);
      if (m) return m[1].trim();
    }
    return null;
  }

  function extractOperationName(text) {
    const patterns = [
      /\b(?:deploy|launch|execute|run|ship|activate)\s+(?:the\s+)?(.+?)(?:\.|!|\?|$)/i,
      /\b(?:start|begin|initiate)\s+(?:the\s+)?(.+?)(?:\s+(?:operation|process|pipeline))?(?:\.|!|\?|$)/i,
      /\b(?:let'?s\s+(?:get|make))\s+(?:the\s+)?(.+?)\s+(?:running|going|started|done|deployed|live|shipped)(?:\.|!|\?|$)/i,
    ];
    for (const pat of patterns) {
      const m = text.match(pat);
      if (m) return m[1].trim();
    }
    return null;
  }

  function extractNavigationTarget(text) {
    const targets = {
      dashboard: /\b(?:dashboard|home|main|overview|command\s+center)\b/i,
      chat: /\b(?:chat|conversation|talk|messages?)\b/i,
      projects: /\b(?:projects?|project\s+(?:list|matrix|board))\b/i,
      operations: /\b(?:operations?|ops|tasks?\s+queue|processing)\b/i,
      research: /\b(?:research|knowledge|analysis|data)\b/i,
      memory: /\b(?:memor(?:y|ies)|notes?|saved|indexed|brain)\b/i,
      settings: /\b(?:settings?|config(?:uration)?|preferences?|options?|setup)\b/i,
    };
    for (const [view, pat] of Object.entries(targets)) {
      if (pat.test(text)) return view;
    }
    return null;
  }

  // ───────────────────────────────────────────────────
  //  INTENT DETECTION — the core brain
  // ───────────────────────────────────────────────────

  function detectIntent(text) {
    const lower = text.toLowerCase().trim();
    const scores = {};

    for (const [intent, signals] of Object.entries(INTENT_SIGNALS)) {
      scores[intent] = 0;
      for (const pat of signals.strong) {
        if (pat.test(lower)) scores[intent] += 3;
      }
      for (const pat of signals.weak) {
        if (pat.test(lower)) scores[intent] += 1;
      }
    }

    // Context boosting: if we were talking about projects, boost project-related intents
    if (context.lastIntent === 'create_project') {
      scores.create_task += 1;
      scores.save_memory += 0.5;
    }
    if (context.pendingConfirmation) {
      scores.agreement += 1;
      scores.disagreement += 1;
    }

    // Sort by score
    const ranked = Object.entries(scores)
      .filter(([_, s]) => s > 0)
      .sort((a, b) => b[1] - a[1]);

    if (ranked.length === 0) return { intent: 'casual_chat', confidence: 0.3, scores };

    const topIntent = ranked[0][0];
    const topScore = ranked[0][1];
    const confidence = Math.min(topScore / 6, 1.0);

    return { intent: topIntent, confidence, scores, ranked };
  }

  // ───────────────────────────────────────────────────
  //  RESPONSE GENERATION — intelligent, contextual
  // ───────────────────────────────────────────────────

  function generateResponse(intent, text, actionResult, userName) {
    const name = userName || 'Sir';
    const openers = {
      acknowledge: [
        `Understood, ${name}.`,
        `Of course, ${name}.`,
        `Right away, ${name}.`,
        `On it, ${name}.`,
        `Consider it done, ${name}.`,
        `Very well, ${name}.`,
        `Absolutely, ${name}.`,
      ],
      thinking: [
        `Interesting thought, ${name}.`,
        `I see where you're going with this, ${name}.`,
        `That's a solid direction, ${name}.`,
        `Good thinking, ${name}.`,
      ],
      casual: [
        `I appreciate you sharing that, ${name}.`,
        `That's an interesting perspective, ${name}.`,
        `I'm tracking with you, ${name}.`,
      ],
    };

    const pick = arr => arr[Math.floor(Math.random() * arr.length)];

    switch (intent) {
      case 'create_project': {
        const projectName = actionResult?.name || extractProjectName(text) || 'your new initiative';
        return `${pick(openers.acknowledge)} I've initialized project "${projectName}" and it's now tracked in the operational matrix. All resources allocated. Would you like to add some initial tasks to it, or shall I set up a research brief first?`;
      }
      case 'save_memory': {
        return `${pick(openers.acknowledge)} I've indexed that into the memory banks for future reference. It's searchable and permanently stored. Is there anything else worth noting while we're on this topic?`;
      }
      case 'research': {
        const topic = actionResult?.topic || extractResearchTopic(text) || 'that topic';
        return `${pick(openers.acknowledge)} I've logged a research entry on "${topic}" in the knowledge matrix. I should note, ${name}, the more details you feed me about what specifically you want to understand, the more useful the analysis becomes. What angle interests you most?`;
      }
      case 'create_task': {
        const task = actionResult?.title || 'your task';
        return `${pick(openers.acknowledge)} Task "${task}" has been added to the pipeline. I'll keep it tracked. Need me to set a priority level on that, or shall we keep moving?`;
      }
      case 'launch_operation': {
        const opName = actionResult?.name || 'the operation';
        return `${pick(openers.acknowledge)} Operation "${opName}" is now queued and processing. I'll monitor progress and report back when it completes. Anything else to deploy?`;
      }
      case 'navigate': {
        const target = extractNavigationTarget(text);
        const viewNames = {
          dashboard: 'command center', chat: 'conversation interface', projects: 'project matrix',
          operations: 'operations panel', research: 'research center', memory: 'memory banks', settings: 'configuration panel'
        };
        return `${pick(openers.acknowledge)} Navigating to the ${viewNames[target] || target}. Let me know what you need, ${name}.`;
      }
      case 'greeting': {
        const tod = new Date().getHours();
        const timeStr = tod < 12 ? 'morning' : tod < 17 ? 'afternoon' : 'evening';
        const greetings = [
          `Good ${timeStr}, ${name}. All systems are fully operational and at your disposal. What shall we work on?`,
          `Welcome back, ${name}. I've been running diagnostics in your absence — everything is nominal. Ready when you are.`,
          `Ah, ${name}. Good ${timeStr}. I've taken the liberty of reviewing our recent projects. Shall I bring you up to speed?`,
          `Systems online, ${name}. I've been keeping things in order. What's on the agenda?`,
        ];
        return pick(greetings);
      }
      case 'status_check': {
        return `All primary systems nominal, ${name}. Arc reactor operating at peak efficiency. We currently have ${actionResult?.projects || 0} active projects, ${actionResult?.memories || 0} indexed memories, and ${actionResult?.operations || 0} operations in the pipeline. AI core is processing at optimal capacity. No anomalies detected. Anything specific you'd like me to drill into?`;
      }
      case 'gratitude': {
        const responses = [
          `Always at your service, ${name}. That's what I'm here for.`,
          `My pleasure, ${name}. Is there anything else I can assist with?`,
          `Happy to help, ${name}. Shall we continue?`,
          `Glad that was useful, ${name}. What's next on the agenda?`,
        ];
        return pick(responses);
      }
      case 'agreement': {
        if (context.pendingConfirmation) {
          return null; // Handled by confirmation logic
        }
        return `Confirmed, ${name}. Proceeding accordingly.`;
      }
      case 'disagreement': {
        if (context.pendingConfirmation) {
          return `Understood, ${name}. Standing down on that. What would you prefer instead?`;
        }
        return `Noted, ${name}. I'll adjust course. What direction would you like to take?`;
      }
      case 'time_query': {
        const now = new Date();
        const time = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
        const date = now.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
        return `It's currently ${time} on ${date}, ${name}.`;
      }
      case 'help': {
        return `I'm your personal AI interface, ${name}. You don't need specific commands — just talk to me naturally. Tell me about a project you want to start, something you want to remember, a topic you're curious about, or an operation you need to launch. I'll figure out what to do. I can also navigate the interface, check system status, and maintain our conversation history. Just speak your mind.`;
      }
      case 'casual_chat':
      default: {
        return generateCasualResponse(text, name);
      }
    }
  }

  function generateCasualResponse(text, name) {
    const lower = text.toLowerCase();
    const length = text.split(/\s+/).length;

    // Very short inputs — could be continuation
    if (length <= 3) {
      if (context.lastIntent && context.lastEntityName) {
        return `Are you referring to "${context.lastEntityName}", ${name}? Could you elaborate so I can assist more effectively?`;
      }
      const shorts = [
        `I'm listening, ${name}. Tell me more about what you have in mind.`,
        `Go on, ${name}. I'm processing.`,
        `I'm with you, ${name}. What specifically would you like me to do with that?`,
      ];
      return shorts[Math.floor(Math.random() * shorts.length)];
    }

    // Detect if this sounds like something worth saving
    const informational = /\b(the\s+(?:key|main|important)\s+thing|basically|essentially|in\s+summary|the\s+point\s+is|conclusion|takeaway|lesson|insight)\b/i.test(lower);
    if (informational) {
      context.pendingConfirmation = {
        action: 'save_memory',
        data: text,
        question: `That sounds like valuable information, ${name}. Shall I index that into the memory banks for future reference?`
      };
      return context.pendingConfirmation.question;
    }

    // Detect if this sounds like a project idea
    const ideational = /\b(idea|concept|vision|plan|strategy|approach|thinking\s+about|what\s+if|imagine|picture\s+this)\b/i.test(lower);
    if (ideational && length > 8) {
      const topic = extractProjectName(text);
      context.pendingConfirmation = {
        action: 'create_project',
        data: topic || text.slice(0, 60),
        question: `That sounds like it could be a project worth tracking, ${name}. Shall I initialize "${topic || 'this concept'}" in the project matrix so we can develop it properly?`
      };
      return context.pendingConfirmation.question;
    }

    // Detect opinion or discussion about a topic — offer research
    const curiosity = /\b(wonder|curious|interesting|fascinating|weird|strange|surprising|confused|don'?t\s+understand|how\s+come|why\s+(?:does|is|are|do))\b/i.test(lower);
    if (curiosity && length > 6) {
      const topic = extractResearchTopic(text) || text.replace(/^(?:i\s+)?(?:wonder|am\s+curious)\s*/i, '').slice(0, 60);
      context.pendingConfirmation = {
        action: 'research',
        data: topic,
        question: `Sounds like a topic worth investigating, ${name}. Want me to open a research file on "${topic}" so we can dig deeper?`
      };
      return context.pendingConfirmation.question;
    }

    // Generic conversational responses that feel intelligent
    const responses = [
      `I hear you, ${name}. Based on what you're telling me, I'm thinking there might be an action we should take. Would you like to turn this into a project, save it as a note, or explore it further through research?`,
      `That's an interesting direction, ${name}. I'm tracking the conversation and I'll remember this context. If you want me to take any specific action — create a project, log a memory, or launch an operation — just let me know naturally. I'll pick up on it.`,
      `Noted, ${name}. I've added this to our conversation history so I can reference it later. Is there a particular outcome you're looking for, or are we brainstorming?`,
      `I'm following you, ${name}. My analysis suggests this could tie into our current operations. Want to explore any specific direction with this?`,
      `Processing, ${name}. I can see several potential action paths from here. We could formalize this as a project, save the key points to memory, or initiate a research thread. What feels right?`,
    ];
    return responses[Math.floor(Math.random() * responses.length)];
  }

  // ───────────────────────────────────────────────────
  //  AUTONOMOUS ACTION EXECUTION
  // ───────────────────────────────────────────────────

  async function executeAction(intent, text, api, helpers) {
    const { navigate, loadProjects, loadDashboard, loadOperations, loadResearch,
            loadMemory, renderKanban, playSuccessSound, showToast, openModal,
            State, CinematicVFX } = helpers;

    let actionResult = null;

    switch (intent) {
      case 'create_project': {
        const name = extractProjectName(text);
        if (!name) return null;
        if (CinematicVFX) CinematicVFX.projectInit(name);
        const p = await api('projects', 'POST', { name, status: 'Active' });
        if (p) {
          playSuccessSound();
          loadProjects();
          loadDashboard();
          actionResult = { name: p.name, id: p.id };
          context.lastEntityName = p.name;
        }
        break;
      }
      case 'save_memory': {
        const content = extractMemoryContent(text);
        if (CinematicVFX) CinematicVFX.memoryIndex();
        await api('memories', 'POST', {
          title: content.slice(0, 60),
          content: content,
          tags: [context.currentTopic || 'conversation'].filter(Boolean),
          source: 'conversation'
        });
        playSuccessSound();
        if (State.currentView === 'memory') loadMemory();
        loadDashboard();
        actionResult = { content };
        break;
      }
      case 'research': {
        const topic = extractResearchTopic(text);
        if (!topic) return null;
        if (CinematicVFX) CinematicVFX.researchAnalysis(topic);
        const r = await api('research', 'POST', {
          topic,
          summary: `Research initiated from conversation: "${text.slice(0, 120)}"`,
          findings: [],
          status: 'active'
        });
        playSuccessSound();
        if (State.currentView === 'research') loadResearch();
        loadDashboard();
        actionResult = { topic: r?.topic || topic };
        context.lastEntityName = topic;
        break;
      }
      case 'create_task': {
        const title = extractTaskTitle(text);
        if (!title) return null;
        if (State.currentProjectId) {
          const t = await api('tasks', 'POST', { title, project_id: State.currentProjectId, status: 'todo', priority: 'medium' });
          if (t) {
            playSuccessSound();
            renderKanban(State.currentProjectId);
            actionResult = { title: t.title };
          }
        } else {
          // No project open — save as memory instead
          await api('memories', 'POST', { title: title.slice(0, 60), content: `Task: ${title}`, tags: ['task'], source: 'conversation' });
          playSuccessSound();
          actionResult = { title, savedAsMemory: true };
        }
        break;
      }
      case 'launch_operation': {
        const opName = extractOperationName(text) || context.lastEntityName || 'Autonomous Operation';
        if (CinematicVFX) CinematicVFX.operationLaunch(opName);
        const op = await api('operations', 'POST', { name: opName, status: 'queued', progress: 0 });
        if (op) {
          playSuccessSound();
          showToast(`Operation "${op.name}" queued.`);
          loadOperations();
          loadDashboard();
          actionResult = { name: op.name };
        }
        break;
      }
      case 'navigate': {
        const target = extractNavigationTarget(text);
        if (target) {
          navigate(target);
          actionResult = { view: target };
        }
        break;
      }
      case 'status_check': {
        const [projects, memories, operations] = await Promise.all([
          api('projects'), api('memories'), api('operations')
        ]);
        actionResult = {
          projects: (projects || []).filter(p => p.status === 'Active').length,
          memories: (memories || []).length,
          operations: (operations || []).length
        };
        break;
      }
    }

    return actionResult;
  }

  // ───────────────────────────────────────────────────
  //  MAIN PROCESSOR — the public brain function
  // ───────────────────────────────────────────────────

  async function process(userText, api, helpers) {
    const { State } = helpers;
    const userName = State?.userName || 'Sir';

    // Strip wake word prefix — "hey jarvis" is the activation phrase, not part of the command
    const cleanedText = userText.replace(/^\s*(?:hey|ok|okay)?\s*jarvis\s*[,.]?\s*/i, '').trim() || userText;

    // Add to conversation context
    addToContext('user', cleanedText);

    // Check for pending confirmation first
    if (context.pendingConfirmation) {
      const detection = detectIntent(cleanedText);

      // Special case: pending project name request
      if (context.pendingConfirmation.action === 'create_project_named') {
        // User is providing the project name
        if (detection.intent === 'disagreement') {
          context.pendingConfirmation = null;
          const response = `No problem, ${userName}. Standing down. What else can I help with?`;
          addToContext('jarvis', response);
          return { response, intent: 'disagreement', actionTaken: false };
        }
        // Treat whatever they said as the project name (unless it's a completely different command)
        const possibleName = cleanedText.trim().replace(/^(?:call\s+it|name\s+it|let'?s\s+call\s+it|it'?s?\s+called|how\s+about|maybe)\s+/i, '').replace(/["']/g, '').trim();
        if (possibleName.length > 1 && possibleName.length < 120) {
          context.pendingConfirmation = null;
          const actionResult = await executeAction('create_project', `create project called "${possibleName}"`, api, helpers);
          const response = generateResponse('create_project', possibleName, actionResult, userName);
          addToContext('jarvis', response);
          context.lastIntent = 'create_project';
          return { response, intent: 'create_project', actionTaken: true, actionResult };
        }
        // Couldn't parse — clear and process normally
        context.pendingConfirmation = null;
      }
      else if (detection.intent === 'agreement') {
        const pending = context.pendingConfirmation;
        context.pendingConfirmation = null;
        // Execute the pending action
        const actionResult = await executeAction(pending.action,
          pending.action === 'save_memory' ? `remember ${pending.data}` :
          pending.action === 'create_project' ? `create project ${pending.data}` :
          pending.action === 'research' ? `research ${pending.data}` :
          pending.data,
          api, helpers
        );
        const response = generateResponse(pending.action, pending.data, actionResult, userName);
        addToContext('jarvis', response);
        context.lastIntent = pending.action;
        return { response, intent: pending.action, actionTaken: true, actionResult };
      } else if (detection.intent === 'disagreement') {
        context.pendingConfirmation = null;
        const response = `No problem, ${userName}. Consider it forgotten. What else can I help with?`;
        addToContext('jarvis', response);
        return { response, intent: 'disagreement', actionTaken: false };
      }
      // If neither agreement nor disagreement, clear pending and process normally
      context.pendingConfirmation = null;
    }

    // Detect intent from natural language
    const detection = detectIntent(cleanedText);
    let { intent, confidence } = detection;

    // Decide whether to take autonomous action
    const shouldAct = confidence >= 0.4 && [
      'create_project', 'save_memory', 'research', 'create_task',
      'launch_operation', 'navigate', 'status_check'
    ].includes(intent);

    let actionResult = null;
    let actionTaken = false;

    if (shouldAct) {
      // For create_project: check if we can extract a name first
      if (intent === 'create_project') {
        const projectName = extractProjectName(cleanedText);
        if (!projectName) {
          // User wants to start a project but didn't give a name — ask for one
          context.pendingConfirmation = {
            action: 'create_project_named',
            data: null,
            question: `Absolutely, ${userName}. I'm ready to initialize a new project. What would you like to call it?`
          };
          const response = context.pendingConfirmation.question;
          addToContext('jarvis', response);
          context.lastIntent = 'create_project';
          return { response, intent: 'create_project', confidence, actionTaken: false };
        }
      }
      // High confidence — take action autonomously
      actionResult = await executeAction(intent, cleanedText, api, helpers);
      actionTaken = actionResult !== null;
      if (!actionTaken) {
        // Action failed (couldn't extract entity) — fall back to conversation
        intent = 'casual_chat';
      }
    }

    // Generate response
    const response = generateResponse(intent, cleanedText, actionResult, userName);

    // Update context
    addToContext('jarvis', response);
    context.lastIntent = intent;
    if (actionResult) {
      context.currentTopic = intent;
      context.conversationDepth++;
    }

    return { response, intent, confidence, actionTaken, actionResult };
  }

  // ───────────────────────────────────────────────────
  //  PUBLIC API
  // ───────────────────────────────────────────────────
  return {
    process,
    detectIntent,
    getContext: () => ({ ...context }),
    clearContext: () => {
      context.recentMessages = [];
      context.currentTopic = null;
      context.lastIntent = null;
      context.lastEntityName = null;
      context.pendingConfirmation = null;
      context.conversationDepth = 0;
    }
  };

})();
