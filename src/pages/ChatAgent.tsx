import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Send, Square, Wifi, WifiOff, LogOut, ChevronLeft, Moon, Sun, Sparkles, Trash2, Copy, Check, Mic } from "lucide-react";
import { useNavigate } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import CharacterSelect, { characters } from "@/components/CharacterSelect";
import { getGatewayClient, GatewayClient } from "@/lib/gatewayClient";
import type { GatewayStatus } from "@/lib/gatewayClient";
import { buildSystemPrompt, getCharacterGreeting } from "@/lib/characterPrompts";
import { getUserName } from "@/lib/userProfileStore";
import MoodRing from "@/components/MoodRing";
import GlassContainer from "@/components/GlassContainer";
import OrbitWrap from "@/components/OrbitWrap";
import FocusButton from "@/components/FocusButton";
import ToneSlider from "@/components/ToneSlider";
import { isFocusActive, toggleFocus } from "@/lib/FocusController";
import { MoodType, detectContentMood, deriveChatMood, detectUserMood, buildMoodInstruction, type UserMood } from "@/lib/moodDetector";
import SaveToCanvasPrompt from "@/components/SaveToCanvasPrompt";
import VoiceDictationButton from "@/components/VoiceDictationButton";
import FormatPickerModal from "@/components/FormatPickerModal";
import MergePickerModal from "@/components/MergePickerModal";
import UpgradePrompt from "@/components/UpgradePrompt";
import {
  saveBoard, updateBoard, getBoards, mergeIntoBoard,
  generateBoardTitle, type CanvasFormat, type CanvasMessage,
} from "@/lib/canvasStore";
import { getSessions, upsertSession, sessionTitle, generateAITitle, updateSessionTitle, deleteSession, type ChatSession } from "@/lib/chatHistoryStore";
import { analyseConversation, buildMemoryContext } from "@/lib/globalMemoryStore";

const PENDING_LOAD_KEY = "pending-load-session";
import { canCreateBoard, getBoardLimit } from "@/lib/subscriptionStore";

// localStorage key for persisting the active conversation across navigation
const ACTIVE_CHAT_KEY = "active-chat-session";

// ─── Typing indicator ──────────────────────────────────────────────────────────
const TypingIndicator = () => (
  <div className="flex items-center gap-1 px-2 py-1">
    {[0, 0.2, 0.4].map((delay, i) => (
      <motion.div
        key={i}
        className="w-2 h-2 bg-muted-foreground rounded-full"
        animate={{ opacity: [0.4, 1, 0.4], scale: [0.8, 1.2, 0.8] }}
        transition={{ duration: 0.8, repeat: Infinity, ease: "easeInOut", delay }}
      />
    ))}
  </div>
);

// ─── Animated search indicator ─────────────────────────────────────────────────
const SearchIndicator = ({ toolName }: { toolName: string }) => {
  const label = toolName === "Search" ? "Searching the web" : `Running ${toolName}`;
  return (
    <div className="flex items-center gap-2 text-xs">
      <motion.span
        animate={{ rotate: 360 }}
        transition={{ duration: 1.2, repeat: Infinity, ease: "linear" }}
        className="inline-block text-sm"
      >
        {"\u{1F50D}"}
      </motion.span>
      <span className="italic text-muted-foreground">
        {label}
        <AnimatedDots />
      </span>
    </div>
  );
};

const AnimatedDots = () => {
  const [dots, setDots] = useState(1);
  useEffect(() => {
    const interval = setInterval(() => setDots((d) => (d % 3) + 1), 500);
    return () => clearInterval(interval);
  }, []);
  return <span className="inline-block w-4 text-left">{"." .repeat(dots)}</span>;
};

/** Extract the "useful" content from an agent message:
 *  1. Code blocks (```...```)  — prompts, captions, code
 *  2. Blockquote lines (> ...) — quoted content
 *  3. Quoted strings ("...")   — inline quotes
 *  Falls back to full text if nothing extractable found. */
const extractCopyContent = (text: string): string => {
  // 1. Code blocks
  const codeBlocks = [...text.matchAll(/```[\s\S]*?\n([\s\S]*?)```/g)].map(m => m[1].trim());
  if (codeBlocks.length > 0) return codeBlocks.join("\n\n");

  // 2. Blockquote lines
  const quoteLines = text.split("\n").filter(l => l.startsWith("> ")).map(l => l.slice(2));
  if (quoteLines.length > 0) return quoteLines.join("\n");

  // 3. Quoted strings (multiline "..." or '...')
  const quoted = [...text.matchAll(/"([^"]{20,})"/g)].map(m => m[1].trim());
  if (quoted.length > 0) return quoted.join("\n\n");

  // Fallback: full text
  return text;
};

/** Returns true only when the message has extractable content (code blocks, quotes, etc.) */
const hasCopyableContent = (text: string): boolean => {
  if (/```[\s\S]*?\n[\s\S]*?```/.test(text)) return true;
  if (text.split("\n").some(l => l.startsWith("> "))) return true;
  if (/"[^"]{20,}"/.test(text)) return true;
  return false;
};

/** Small copy-to-clipboard button for agent messages */
const CopyButton = ({ text }: { text: string }) => {
  const [copied, setCopied] = useState(false);
  const handleCopy = async () => {
    try {
      const content = extractCopyContent(text);
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* fallback: do nothing */ }
  };
  return (
    <button
      onClick={handleCopy}
      className="flex items-center gap-1 mt-2 px-2 py-1 rounded-lg text-[10px] font-medium text-foreground/50 hover:text-foreground/80 hover:bg-foreground/10 transition-all"
      title="Copy to clipboard"
    >
      {copied ? <Check size={11} className="text-emerald-400" /> : <Copy size={11} />}
      {copied ? "Copied!" : "Copy"}
    </button>
  );
};

const ChatAgent = () => {
  const navigate = useNavigate();

  const [messages, setMessages] = useState<{ role: string; text: string; isStreaming?: boolean }[]>([]);
  const [input, setInput] = useState("");
  const [selectedChar, setSelectedChar] = useState("noe");
  const [showCharSelect, setShowCharSelect] = useState(true);
  const [quickInput, setQuickInput] = useState("");
  const [connectionStatus, setConnectionStatus] = useState<GatewayStatus>("disconnected");
  const [isGenerating, setIsGenerating] = useState(false);
  const [hasStartedStreaming, setHasStartedStreaming] = useState(false);
  const [hasInitialized, setHasInitialized] = useState(false);
  const [contentMood, setContentMood] = useState<MoodType>("idle");
  // Deep-thinking indicator: true when backend sends a reasoning/thought token
  const [isThinking, setIsThinking] = useState(false);
  // Focus mode state
  const [focusMode, setFocusMode] = useState(isFocusActive);
  // Slow-response warning: true after 25s of waiting with no chunk received
  const [isSlowResponse, setIsSlowResponse] = useState(false);
  // Tool call indicator: true when a backend tool (e.g. Search) is executing
  const [isSearching, setIsSearching] = useState(false);
  const [searchToolName, setSearchToolName] = useState("");

  // Canvas save state
  const [showSavePrompt, setShowSavePrompt] = useState(false);
  const [showFormatPicker, setShowFormatPicker] = useState(false);
  const [showMergePicker, setShowMergePicker] = useState(false);
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [pendingFormat, setPendingFormat] = useState<CanvasFormat | null>(null);
  const [showSaveSuccess, setShowSaveSuccess] = useState(false);
  // Inline delete confirmation for chat history
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // Refs
  const bridgeRef = useRef<GatewayClient | null>(null);
  const currentResponseRef = useRef<string>("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const systemPromptSentRef = useRef<boolean>(false);
  const prevGeneratingRef = useRef<boolean>(false);
  const moodTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const slowResponseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Stable session ID for history auto-save + LangGraph thread_id
  const sessionIdRef = useRef<string>(`session-${Date.now()}`);
  // Inactivity timeout ref (3 minutes)
  const inactivityTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const preTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Always-current messages ref — avoids stale closure in timer callbacks
  const messagesRef = useRef(messages);
  messagesRef.current = messages;
  // Track whether AI title has been generated for this session
  const titleGeneratedRef = useRef<boolean>(false);

  // Rotating greeting: pick a default agent that changes each visit
  const defaultGreetIdx = useMemo(() => {
    const key = "chat-greeting-index";
    const saved = parseInt(localStorage.getItem(key) ?? "0");
    const next = (saved + 1) % characters.length;
    localStorage.setItem(key, String(next));
    return saved;
  }, []);

  // Goodbye detection patterns
  const FAREWELL_RE = /\b(bye|goodbye|good bye|see you|see ya|cya|take care|later|gotta go|talk later|thanks bye|thank you bye|adios|cheers)\b/i;

  const char = characters.find((c) => c.id === selectedChar);

  const displayMood = deriveChatMood({
    isGenerating,
    hasStartedStreaming,
    isBarging: false,
    contentMood,
  });

  // ── Auto-save session to history whenever AI finishes ──────────────────────
  const autoSaveSession = useCallback(
    (msgs: typeof messages) => {
      if (!char || msgs.length < 2) return;
      const clean = msgs
        .filter((m) => !m.isStreaming)
        .map(({ role, text }) => ({ role, text }));
      const session: ChatSession = {
        id: sessionIdRef.current,
        characterId: selectedChar,
        characterEmoji: char.emoji,
        characterName: char.name,
        messages: clean,
        startedAt: sessionIdRef.current.replace("session-", ""),
        updatedAt: String(Date.now()),
        title: sessionTitle(clean),
      };
      upsertSession(session);

      // Feed conversation into Global Memory Core for cross-session pattern tracking
      try { analyseConversation(clean); } catch { /* ignore */ }

      // Generate an AI title after 2-3 user messages (only once per session)
      const userMsgCount = clean.filter((m) => m.role === "user").length;
      if (userMsgCount >= 2 && !titleGeneratedRef.current) {
        titleGeneratedRef.current = true;
        generateAITitle(clean, char.name).then((aiTitle) => {
          if (aiTitle) {
            updateSessionTitle(sessionIdRef.current, aiTitle);
          }
        });
      }
    },
    [selectedChar, char]
  );

  // ── Restore conversation on mount (only from Chat History navigation) ───────
  useEffect(() => {
    if (hasInitialized) return;
    setHasInitialized(true);
    try {
      // Only restore if user navigated here from Chat History to load a specific session
      const pendingLoad = localStorage.getItem(PENDING_LOAD_KEY);
      if (pendingLoad) {
        localStorage.removeItem(PENDING_LOAD_KEY);
        const { sessionId } = JSON.parse(pendingLoad);
        if (sessionId) {
          const allSessions = getSessions();
          const target = allSessions.find((s) => s.id === sessionId);
          if (target) {
            sessionIdRef.current = target.id;
            setMessages(target.messages.map(({ role, text }) => ({ role, text })));
            setSelectedChar(target.characterId);
            setShowCharSelect(false);
            systemPromptSentRef.current = false;
            return;
          }
        }
      }
      // Otherwise: always start on the chat home screen.
      // Just load the preferred character (if any) for the agent selection.
      const settings = localStorage.getItem("customize-settings");
      if (settings) {
        const parsed = JSON.parse(settings);
        if (parsed.character) {
          const validChar = characters.find((c) => c.id === parsed.character);
          if (validChar) {
            setSelectedChar(parsed.character);
          }
        }
      }
    } catch (err) {
      console.error("Failed to restore chat session:", err);
    }
  }, []);

  // ── Persist conversation whenever messages change ──────────────────────────
  useEffect(() => {
    // Only save once there's a real back-and-forth (>1 message, no streaming in progress)
    const cleanMsgs = messages.filter((m) => !m.isStreaming);
    if (cleanMsgs.length <= 1 || showCharSelect) return;
    try {
      localStorage.setItem(
        ACTIVE_CHAT_KEY,
        JSON.stringify({
          messages: cleanMsgs,
          selectedChar,
          systemPromptSent: systemPromptSentRef.current,
          sessionId: sessionIdRef.current,
        })
      );
    } catch (err) {
      console.error("Failed to save chat session:", err);
    }
  }, [messages, selectedChar]);

  // ── Auto-scroll ────────────────────────────────────────────────────────────
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // ── Content mood detection ─────────────────────────────────────────────────
  useEffect(() => {
    const justFinished = prevGeneratingRef.current && !isGenerating;
    prevGeneratingRef.current = isGenerating;

    if (justFinished) {
      // Auto-save to history
      autoSaveSession(messages);

      const lastAgent = [...messages].reverse().find((m) => m.role === "agent");
      if (lastAgent?.text) {
        const detected = detectContentMood(lastAgent.text, selectedChar);
        if (detected !== "idle") {
          setContentMood(detected);
          if (moodTimerRef.current) clearTimeout(moodTimerRef.current);
          moodTimerRef.current = setTimeout(() => setContentMood("idle"), 3500);
        }
      }
    }
    if (isGenerating) setContentMood("idle");
  }, [isGenerating]);

  // ── Smart Inactivity timeout — 3 minutes of COMPLETE silence ──────────────
  // Reset on ANY user input: typing, clicking, mouse movement, touch, scroll
  const suppressPromptRef = useRef<boolean>(false); // After "Keep Chatting", suppress until new silence

  useEffect(() => {
    if (showCharSelect) return; // Don't run on character select screen

    const resetInactivityTimer = () => {
      if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);
      if (preTimeoutRef.current) clearTimeout(preTimeoutRef.current);

      // Hide prompts on any activity
      if (showSavePrompt) setShowSavePrompt(false);

      // Clear suppress flag — any new activity starts a fresh silence window
      suppressPromptRef.current = false;

      // 10 seconds before timeout: show Canvas save prompt (if not suppressed)
      preTimeoutRef.current = setTimeout(() => {
        if (messagesRef.current.length >= 2 && !suppressPromptRef.current) {
          setShowSavePrompt(true);
        }
      }, (3 * 60 - 10) * 1000); // 2 min 50 sec

      // Full timeout: return to chat home
      inactivityTimerRef.current = setTimeout(() => {
        autoSaveSession(messagesRef.current);
        localStorage.removeItem(ACTIVE_CHAT_KEY);
        setShowCharSelect(true);
      }, 3 * 60 * 1000); // 3 minutes
    };

    // Listen for ALL user activity — not just message changes
    const activityEvents = ["mousemove", "mousedown", "keydown", "touchstart", "scroll", "input", "click"];

    const handleActivity = () => {
      resetInactivityTimer();
    };

    // Start timer and attach listeners
    resetInactivityTimer();
    activityEvents.forEach((evt) => window.addEventListener(evt, handleActivity, { passive: true }));

    return () => {
      if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);
      if (preTimeoutRef.current) clearTimeout(preTimeoutRef.current);
      activityEvents.forEach((evt) => window.removeEventListener(evt, handleActivity));
    };
  }, [showCharSelect]); // Only re-run when screen changes, NOT on every message

  // ── Goodbye detection — auto-prompt Canvas save ──────────────────────────
  useEffect(() => {
    if (showCharSelect || messages.length < 2) return;
    // Check last user message
    const userMessages = messages.filter(m => m.role === "user");
    const lastUser = userMessages[userMessages.length - 1];
    if (lastUser && FAREWELL_RE.test(lastUser.text)) {
      // Wait a moment for the AI to respond, then show prompt
      const t = setTimeout(() => setShowSavePrompt(true), 2000);
      return () => clearTimeout(t);
    }
  }, [messages, showCharSelect]);

  // ── Canvas save flow ───────────────────────────────────────────────────────
  const handleSavePromptTap = () => {
    setShowSavePrompt(false);
    const boardCount = getBoards().length;
    if (!canCreateBoard(boardCount)) {
      setShowUpgrade(true);
      return;
    }
    setShowFormatPicker(true);
  };

  const handleFormatPicked = (format: CanvasFormat) => {
    setShowFormatPicker(false);
    setPendingFormat(format);
    const boardCount = getBoards().length;
    if (boardCount > 0) {
      setShowMergePicker(true);
    } else {
      createNewBoard(format);
    }
  };

  const createNewBoard = (format: CanvasFormat) => {
    const now = new Date();
    const canvasMessages: CanvasMessage[] = messages
      .filter((m) => !m.isStreaming)
      .map(({ role, text }) => ({ role, text }));
    const boardId = `board-${Date.now()}`;
    const fallbackTitle = generateBoardTitle(canvasMessages, char?.name ?? "AI", now);
    saveBoard({
      id: boardId,
      title: fallbackTitle,
      characterId: selectedChar,
      characterEmoji: char?.emoji ?? "\u{1F916}",
      characterName: char?.name ?? "AI",
      format,
      createdAt: now.toISOString(),
      messages: canvasMessages,
      generationStatus: "pending",
    });
    setShowMergePicker(false);
    setPendingFormat(null);
    // Show success toast — keep user in chat so they can keep talking
    setShowSaveSuccess(true);
    setTimeout(() => setShowSaveSuccess(false), 4500);

    // Async: generate an AI-powered title in the background
    fetch("/api/generate-title", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: canvasMessages.slice(0, 10).map(m => ({
          role: m.role, text: m.text.slice(0, 200)
        })),
        agent_name: char?.name ?? "AI",
      }),
    })
      .then(r => r.json())
      .then(data => {
        if (data.title) {
          updateBoard(boardId, { title: data.title });
        }
      })
      .catch(() => {/* keep fallback title */});
  };

  const handleMerge = (boardId: string) => {
    const newMessages: CanvasMessage[] = messages
      .filter((m) => !m.isStreaming)
      .map(({ role, text }) => ({ role, text }));
    mergeIntoBoard(boardId, newMessages);
    setShowMergePicker(false);
    setPendingFormat(null);
    // Show success toast — keep user in chat so they can keep talking
    setShowSaveSuccess(true);
    setTimeout(() => setShowSaveSuccess(false), 4500);
  };

  // ── Send message ───────────────────────────────────────────────────────────
  const sendMessage = useCallback(
    (text: string = input) => {
      if (!text.trim()) return;
      const bridge = bridgeRef.current;
      if (!bridge) {
        setMessages((prev) => [
          ...prev,
          { role: "agent", text: `${char?.emoji} I'm not connected. Please refresh the page.` },
        ]);
        return;
      }
      setMessages((prev) => [...prev, { role: "user", text }]);
      setInput("");
      currentResponseRef.current = "";
      setIsGenerating(true);
      setHasStartedStreaming(false);
      setIsThinking(false);
      setIsSlowResponse(false);
      // Start slow-response warning: if no chunk arrives within 25s, show a notice
      if (slowResponseTimerRef.current) clearTimeout(slowResponseTimerRef.current);
      slowResponseTimerRef.current = setTimeout(() => setIsSlowResponse(true), 25000);
      setMessages((prev) => [...prev, { role: "agent", text: "", isStreaming: true }]);

      let systemPrompt: string | undefined;

      // Read the tone slider value (0–100) for conciseness control
      let sliderValue = 50;
      try {
        const sliderState = JSON.parse(sessionStorage.getItem("ai-tone-slider") ?? "{}");
        sliderValue = sliderState.value ?? 50;
      } catch { /* fallback */ }

      // Map slider to a tone instruction
      const toneInstruction = sliderValue < 20
        ? "\n\n[TONE] Be extremely concise and to-the-point. Use short sentences. Avoid filler, fluff, or follow-up questions unless essential."
        : sliderValue < 40
        ? "\n\n[TONE] Be concise and focused. Keep responses brief but clear. Minimise follow-up questions."
        : sliderValue < 60
        ? "\n\n[TONE] Be balanced — friendly and helpful, neither too brief nor too verbose."
        : sliderValue < 80
        ? "\n\n[TONE] Be warm, conversational, and engaging. Feel free to elaborate and ask follow-up questions."
        : "\n\n[TONE] Be very chatty, whimsical, and expressive. Use creative language, metaphors, and enthusiastic energy.";

      // Always send system prompt (with tone) so slider changes take effect mid-session
      try {
        const savedSettings = JSON.parse(localStorage.getItem("customize-settings") ?? "{}");
        const tone = savedSettings.tone ?? "warm";
        systemPrompt = buildSystemPrompt(selectedChar, tone, "chat", getUserName()) + toneInstruction;
      } catch {
        systemPrompt = buildSystemPrompt(selectedChar, "warm", "chat", getUserName()) + toneInstruction;
      }

      // Pillar 1: Inject Global Memory Core context for cross-session continuity
      const memoryContext = buildMemoryContext();
      if (memoryContext) systemPrompt += memoryContext;

      // Pillar 3: Context-Aware Output rules
      systemPrompt += "\n\n--- CONTEXT-AWARE OUTPUT RULES ---\n" +
        "1. COPYABLE PROMPTS: When the user asks you to generate a prompt for copy-pasting " +
        "(e.g., for another AI, for ChatGPT, for writing), IGNORE mood detection and always produce " +
        "deeply detailed, technically precise, structurally clear content. This is for machine consumption.\n" +
        "2. SOCIAL MEDIA CAPTIONS: If asked for social media captions (Instagram, TikTok, etc.), " +
        "generate engaging, human-centric copy with hooks, hashtags, and audience appeal. " +
        "Do not match the current AI mood — focus on what's compelling for an audience.\n" +
        "3. VISUAL ACCESSIBILITY: When outputting content the user will copy, always use " +
        "high-contrast formatting. NEVER use low-contrast text (e.g., grey on grey). " +
        "Use clear black-on-white or dark-on-light colour pairings.\n" +
        "--- END RULES ---";
      systemPromptSentRef.current = true;

      // Detect user mood (single source of truth for ToneSlider + system prompt)
      const userMood = detectUserMood(messages);
      systemPrompt += buildMoodInstruction(userMood, messages);

      // Build conversation history for the backend (last 20 messages for context)
      const historyForBackend = messages
        .filter((m) => !m.isStreaming)
        .slice(-20)
        .map(({ role, text }) => ({ role, text }));

      bridge.send(text, selectedChar, systemPrompt);
    },
    [input, selectedChar, char]
  );

  // ── Gateway client setup ──────────────────────────────────────────────────
  useEffect(() => {
    const bridge = getGatewayClient({
      onChunk: (chunk: string) => {
        setIsThinking(false);
        setIsSlowResponse(false);
        if (slowResponseTimerRef.current) {
          clearTimeout(slowResponseTimerRef.current);
          slowResponseTimerRef.current = null;
        }
        currentResponseRef.current += chunk;
        setHasStartedStreaming(true);
        setMessages((prev) => {
          const last = prev[prev.length - 1];
          if (last?.role === "agent") {
            return [...prev.slice(0, -1), { ...last, text: last.text + chunk, isStreaming: false }];
          }
          return [...prev, { role: "agent", text: chunk, isStreaming: false }];
        });
      },
      onDone: () => {
        setIsGenerating(false);
        setHasStartedStreaming(false);
        setIsThinking(false);
        setIsSlowResponse(false);
        setIsSearching(false);
        if (slowResponseTimerRef.current) {
          clearTimeout(slowResponseTimerRef.current);
          slowResponseTimerRef.current = null;
        }
      },
      onError: (error: string) => {
        setIsGenerating(false);
        setIsThinking(false);
        setIsSlowResponse(false);
        setIsSearching(false);
        if (slowResponseTimerRef.current) {
          clearTimeout(slowResponseTimerRef.current);
          slowResponseTimerRef.current = null;
        }
        const c = characters.find((x) => x.id === selectedChar);
        setMessages((prev) => [
          ...prev,
          { role: "agent", text: `${c?.emoji ?? "\u{1F916}"} Sorry, I'm having trouble connecting: ${error}` },
        ]);
      },
      onStatusChange: (s) => setConnectionStatus(s),
      onThinking: () => setIsThinking(true),
    });

    bridgeRef.current = bridge;

    bridge.connect();

    return () => {
      bridge.disconnect();
    };
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const handleStop = () => {
    setMessages((prev) => {
      const last = prev[prev.length - 1];
      if (last?.isStreaming) return [...prev.slice(0, -1), { ...last, isStreaming: false }];
      return prev;
    });
    setIsGenerating(false);
    setHasStartedStreaming(false);
    setIsThinking(false);
    setIsSlowResponse(false);
    if (slowResponseTimerRef.current) {
      clearTimeout(slowResponseTimerRef.current);
      slowResponseTimerRef.current = null;
    }
    currentResponseRef.current = "";
    bridgeRef.current?.cancel();
  };

  // ── Start a new chat ─────────────────────────────────────────────────────
  const handleNewChat = () => {
    autoSaveSession(messages);
    localStorage.removeItem(ACTIVE_CHAT_KEY);
    sessionIdRef.current = `session-${Date.now()}`;
    systemPromptSentRef.current = false;
    titleGeneratedRef.current = false;
    setMessages([]);
    setShowCharSelect(true);
  };

  const ConnectionStatusIndicator = () => {
    const cfg = {
      disconnected: { color: "text-destructive", icon: WifiOff, label: "Offline" },
      connecting: { color: "text-yellow-500", icon: Wifi, label: "Connecting..." },
      connected: { color: "text-green-500", icon: Wifi, label: "Online" },
      error: { color: "text-destructive", icon: WifiOff, label: "Error" },
    }[connectionStatus];
    const Icon = cfg.icon;
    return (
      <div className="flex items-center gap-1">
        <Icon size={14} className={cfg.color} />
        <span className={`text-xs font-mono ${cfg.color}`}>{cfg.label}</span>
      </div>
    );
  };

  // ── Quick chat submit: select agent and enter full chat ───────────────────
  const handleQuickChat = () => {
    if (!quickInput.trim()) return;
    const firstMsg = quickInput.trim();
    setQuickInput("");
    localStorage.removeItem(ACTIVE_CHAT_KEY);
    systemPromptSentRef.current = false;
    sessionIdRef.current = `session-${Date.now()}`;
    const c = characters.find((x) => x.id === selectedChar);
    if (c) {
      setMessages([{ role: "agent", text: getCharacterGreeting(c.id, c.emoji, c.name, getUserName()) }]);
    }
    setShowCharSelect(false);
    // Send the quick message after a tick so the bridge can connect
    setTimeout(() => sendMessage(firstMsg), 100);
  };

  // ── Chat Home Screen ────────────────────────────────────────────────────────
  if (showCharSelect) {
    const activeChar = characters.find((c) => c.id === selectedChar) ?? characters[defaultGreetIdx];
    const histSessions = getSessions();

    return (
      <div className="flex flex-col h-full overflow-y-auto">
        {/* Header */}
        <header className="px-6 pt-12 pb-2 page-header">
          <div className="max-w-[1000px] mx-auto w-full flex items-start justify-between">
            <OrbitWrap planet="saturn">
              <GlassContainer variant="dark" size="sm" className="inline-block">
                <h1 className="text-xl font-bold text-foreground leading-tight">Chat</h1>
                <p className="text-xs font-medium text-foreground/70 mt-0.5">Your AI workspace</p>
              </GlassContainer>
            </OrbitWrap>
            <FocusButton />
          </div>
        </header>

        <div className="px-6 pb-4">
          <div className="max-w-[1000px] mx-auto w-full">

            {/* ── AI Assistants ────────────────────────────── */}
            <section className="pt-6 pb-4">
              <GlassContainer variant="dark" size="sm" className="inline-block mb-4">
                <p className="text-sm text-foreground font-bold flex items-center gap-2">
                  {"\u{1F916}"} AI Assistants
                </p>
              </GlassContainer>
              <div className="flex gap-3 justify-center flex-wrap">
                {characters.map((c) => {
                  const isActive = selectedChar === c.id;
                  return (
                    <motion.button
                      key={c.id}
                      whileTap={{ scale: 0.93 }}
                      whileHover={{ scale: 1.04, y: -2 }}
                      onClick={() => setSelectedChar(c.id)}
                      className={`flex flex-col items-center gap-1 p-3 w-[80px] rounded-2xl backdrop-blur-md transition-all duration-200 ${
                        isActive
                          ? "bg-primary/25 border-2 border-primary glow-primary ring-1 ring-primary/30"
                          : "glass border border-white/18 hover:border-white/30 hover:shadow-lg"
                      }`}
                    >
                      <span className="text-2xl">{c.emoji}</span>
                      <span className="text-[10px] font-bold text-foreground w-full text-center">{c.name}</span>
                      <span className="text-[9px] font-medium text-foreground/70 w-full text-center leading-tight">{c.description}</span>
                    </motion.button>
                  );
                })}
              </div>
            </section>

            {/* ── Quick Chat (inline under agents) ─────────── */}
            <motion.div
              key={activeChar.id}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.18 }}
            >
              <div className="glass rounded-2xl p-4 border border-white/10">
                <p className="text-sm text-foreground mb-3">
                  {"Hi, I\u2019m "}
                  <span className="font-semibold">{activeChar.name}</span>
                  {" \u2014 "}
                  {activeChar.role}
                </p>
                <div className="flex items-center gap-2">
                  <input
                    value={quickInput}
                    onChange={(e) => { setQuickInput(e.target.value); setSelectedChar(activeChar.id); }}
                    onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleQuickChat(); } }}
                    placeholder="Type a message..."
                    className="flex-1 bg-black/25 border border-white/10 rounded-xl px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/50 transition-colors"
                  />
                  <motion.button
                    whileTap={{ scale: 0.9 }}
                    onClick={handleQuickChat}
                    disabled={!quickInput.trim()}
                    className={`w-11 h-11 rounded-full flex items-center justify-center shrink-0 transition-colors btn-send ${
                      quickInput.trim() ? "" : "opacity-40 cursor-not-allowed"
                    }`}
                  >
                    <Send size={16} className={quickInput.trim() ? "text-primary-foreground" : "text-muted-foreground"} />
                  </motion.button>
                  <VoiceDictationButton
                    onResult={(text) => { setQuickInput(prev => prev ? prev + ' ' + text : text); setSelectedChar(activeChar.id); }}
                    onInterim={(text) => setQuickInput(text)}
                    className="w-11 h-11 rounded-full flex items-center justify-center shrink-0 transition-colors"
                    iconSize={16}
                  />
                </div>
              </div>
            </motion.div>

            {/* ── Chat History ─────────────────────────────── */}
            <section className="pt-10">
              <GlassContainer variant="dark" size="sm" className="inline-block mb-4">
                <p className="text-sm text-foreground font-bold flex items-center gap-2">
                  {"\u{1F4CB}"} Chat History
                </p>
              </GlassContainer>

              {histSessions.length > 0 ? (
                <div className="space-y-3">
                  {histSessions.slice(0, 2).map((s) => {
                    const date = new Date(Number(s.updatedAt)).toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
                    const isConfirming = confirmDeleteId === s.id;
                    return (
                      <div
                        key={s.id}
                        className="w-full flex items-center gap-4 p-4 rounded-2xl glass border border-white/8 hover:border-white/20 hover:bg-white/5 transition-all duration-200"
                      >
                        <button
                          onClick={() => {
                            const allSessions = getSessions();
                            const target = allSessions.find((sess) => sess.id === s.id);
                            if (target) {
                              sessionIdRef.current = target.id;
                              setMessages(target.messages.map(({ role, text }) => ({ role, text })));
                              setSelectedChar(target.characterId);
                              setShowCharSelect(false);
                              systemPromptSentRef.current = false;
                            }
                          }}
                          className="flex-1 flex items-center gap-4 text-left min-w-0"
                        >
                          <span className="text-xl shrink-0">{s.characterEmoji}</span>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-foreground truncate">{s.title}</p>
                            <p className="text-[11px] text-muted-foreground mt-1">{s.characterName} {"\u2014"} {date}</p>
                          </div>
                        </button>
                        {/* Delete button */}
                        {isConfirming ? (
                          <div className="flex items-center gap-1.5 shrink-0">
                            <button
                              onClick={() => { deleteSession(s.id); setConfirmDeleteId(null); }}
                              className="px-2.5 py-1 rounded-lg bg-destructive/80 text-destructive-foreground text-[10px] font-semibold"
                            >
                              Delete
                            </button>
                            <button
                              onClick={() => setConfirmDeleteId(null)}
                              className="px-2.5 py-1 rounded-lg glass text-muted-foreground text-[10px] font-medium"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={(e) => { e.stopPropagation(); setConfirmDeleteId(s.id); }}
                            className="p-2 rounded-xl hover:bg-white/10 transition-colors shrink-0"
                            title="Delete conversation"
                          >
                            <Trash2 size={14} className="text-muted-foreground hover:text-destructive transition-colors" />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="glass rounded-2xl p-5 text-center border border-white/8">
                  <p className="text-foreground/60 text-sm">No chats yet</p>
                  <p className="text-foreground/40 text-xs mt-1">Start a conversation with one of the AI assistants above!</p>
                </div>
              )}

              {/* View full history button — always visible */}
              <motion.button
                  whileTap={{ scale: 0.97 }}
                  onClick={() => navigate("/history")}
                  className="w-full mt-4 py-3 rounded-2xl glass border border-white/10 text-sm text-muted-foreground font-medium hover:border-white/20 hover:text-foreground transition-all duration-200"
                >
                  View your chat history
                </motion.button>
            </section>

          </div>
        </div>
      </div>
    );
  }

  // ── Chat UI ────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full page-chat" data-char={selectedChar}>
      <header className="flex items-center justify-between px-5 pt-12 pb-3 page-header">
        <div className="flex items-center gap-3">
          <button
            onClick={handleNewChat}
            className="p-2 rounded-xl glass active:scale-95 transition-transform"
            title="Back to Chat Home"
          >
            <ChevronLeft size={18} className="text-muted-foreground" />
          </button>
          <MoodRing mood={displayMood} charColor={char?.color ?? "hsl(172 90% 52%)"} size="sm">
            <div className="w-10 h-10 rounded-full flex items-center justify-center bg-black/20">
              <span className="text-2xl leading-none">{char?.emoji}</span>
            </div>
          </MoodRing>
          <GlassContainer variant="dark" size="sm" className="flex flex-col">
            <h1 className="text-lg font-semibold text-foreground leading-tight">{char?.name}</h1>
            <ConnectionStatusIndicator />
          </GlassContainer>
        </div>
        <div className="flex items-center gap-1.5">
          <FocusButton />
          <button
            onClick={() => {
              setShowSavePrompt(false);
              const boardCount = getBoards().length;
              if (!canCreateBoard(boardCount)) {
                setShowUpgrade(true);
                return;
              }
              setShowFormatPicker(true);
            }}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl glass active:scale-95 transition-transform text-[10px] font-medium"
            title="Save to Canvas"
          >
            <Sparkles size={16} className="text-primary" />
            <span className="text-muted-foreground">Canvas</span>
          </button>
        </div>
      </header>

      {/* Aurora stripe — subtle teal light bleed at top */}
      <div className="aurora-stripe" />

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-5 pb-20 space-y-3">
        <AnimatePresence>
          {messages.map((msg, i) => {
            let longPressTimer: ReturnType<typeof setTimeout> | null = null;
            const handleTouchStart = () => {
              if (!msg.text) return;
              longPressTimer = setTimeout(async () => {
                try {
                  const content = hasCopyableContent(msg.text) ? extractCopyContent(msg.text) : msg.text;
                  await navigator.clipboard.writeText(content);
                  // Brief visual feedback — pulse the bubble
                  const el = document.getElementById(`msg-${i}`);
                  if (el) { el.style.outline = "2px solid hsl(142 70% 50%)"; setTimeout(() => { el.style.outline = "none"; }, 800); }
                } catch { /* ignore */ }
              }, 600);
            };
            const handleTouchEnd = () => { if (longPressTimer) clearTimeout(longPressTimer); };
            return (
            <motion.div
              key={i}
              id={`msg-${i}`}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              onTouchStart={handleTouchStart}
              onTouchEnd={handleTouchEnd}
              onTouchCancel={handleTouchEnd}
              className={`px-4 py-3 rounded-2xl text-sm overflow-hidden break-words transition-[outline] ${
                msg.role === "agent"
                  ? "w-full backdrop-blur-md self-start prose prose-sm dark:prose-invert"
                  : "max-w-[80%] ml-auto"
              }`}
              style={{
                overflowWrap: "break-word",
                wordBreak: "break-word",
                userSelect: "text",
                backdropFilter: "blur(8px) saturate(1.2)",
                WebkitBackdropFilter: "blur(8px) saturate(1.2)",
                border: "1px solid rgba(255,255,255,0.10)",
                ...(msg.role === "agent"
                  ? {
                      // AI bubbles: dedicated contrasting colours per theme
                      background: "linear-gradient(135deg, hsl(var(--bubble-ai-start) / 0.55) 0%, hsl(var(--bubble-ai-end) / 0.65) 100%)",
                      color: "hsl(0, 0%, 100%)",
                    }
                  : {
                      // User bubbles: dedicated contrasting colours per theme
                      background: "linear-gradient(135deg, hsl(var(--bubble-user-start) / 0.55) 0%, hsl(var(--bubble-user-end) / 0.65) 100%)",
                      color: "hsl(0, 0%, 100%)",
                    }),
              }}
            >
              {msg.role === "agent" ? (
                msg.isStreaming && !msg.text && connectionStatus === "connected" ? (
                  <div>
                    {isSearching ? (
                      <SearchIndicator toolName={searchToolName} />
                    ) : isThinking ? (
                      <div className="flex items-center gap-2 text-xs text-foreground/70">
                        <span className="text-yellow-400 animate-pulse">{"\u26A1"}</span>
                        <span>Deep thinking…</span>
                      </div>
                    ) : (
                      <TypingIndicator />
                    )}
                    {isSlowResponse && (
                      <p className="text-[10px] text-foreground/50 mt-1 opacity-70">
                        This is taking longer than usual…
                      </p>
                    )}
                  </div>
                ) : (
                  <>
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm]}
                      components={{
                        a: ({ href, children }) => (
                          <a
                            href={href}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{ color: "var(--accent, #60a5fa)", textDecoration: "underline" }}
                          >
                            {children} ↗
                          </a>
                        ),
                        pre: ({ children }) => (
                          <pre style={{ whiteSpace: "pre-wrap", wordBreak: "break-word", overflowX: "hidden", maxWidth: "100%" }}>
                            {children}
                          </pre>
                        ),
                        code: ({ children, className }) => {
                          const isBlock = className?.startsWith("language-");
                          return isBlock ? (
                            <code style={{ whiteSpace: "pre-wrap", wordBreak: "break-word", overflowWrap: "break-word", display: "block" }}>{children}</code>
                          ) : (
                            <code className={className}>{children}</code>
                          );
                        },
                      }}
                    >{msg.text}</ReactMarkdown>
                    {hasCopyableContent(msg.text) && <CopyButton text={msg.text} />}
                  </>
                )
              ) : (
                msg.text
              )}
            </motion.div>
            );
          })}
        </AnimatePresence>
        <div ref={messagesEndRef} />
      </div>

      {/* Save to Canvas prompt */}
      <SaveToCanvasPrompt
        show={showSavePrompt}
        onSave={handleSavePromptTap}
        onDismiss={() => setShowSavePrompt(false)}
        onKeepChatting={() => {
          setShowSavePrompt(false);
          // Suppress prompt until a NEW 3-minute silence begins
          // suppressPromptRef will be cleared on the next user activity
          suppressPromptRef.current = true;
          if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);
          if (preTimeoutRef.current) clearTimeout(preTimeoutRef.current);
        }}
      />

      {/* Save success toast */}
      <AnimatePresence>
        {showSaveSuccess && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 16 }}
            transition={{ type: "spring", damping: 22, stiffness: 260 }}
            className="mx-5 mb-2 px-4 py-3 glass rounded-2xl flex items-center justify-between border border-green-500/30"
          >
            <div className="flex items-center gap-2">
              <span className="text-green-400 text-base">{"\u2713"}</span>
              <span className="text-sm text-foreground font-medium">Saved to Canvas!</span>
              <span className="text-xs text-muted-foreground">Keep chatting or view it later</span>
            </div>
            <button
              onClick={() => navigate("/canvas")}
              className="text-xs text-primary font-semibold shrink-0 ml-2"
            >
              {"View \u2192"}
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Input area */}
      <div className="px-5 pb-20 pt-2 flex flex-col gap-1.5">
        {/* Tone indicator row — above the input */}
        <div className="flex items-center px-1">
          <ToneSlider detectedMood={detectUserMood(messages)} />
        </div>
        <div className="flex items-end gap-2">
        <div className="flex-1 glass rounded-2xl flex items-center">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a message..."
            className="flex-1 bg-transparent px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground outline-none"
          />
        </div>
        {!isGenerating ? (
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={() => sendMessage()}
            disabled={!input.trim() || connectionStatus === "disconnected" || connectionStatus === "error"}
            className={`w-12 h-12 rounded-full flex items-center justify-center shrink-0 btn-send ${
              !input.trim() || connectionStatus === "disconnected" || connectionStatus === "error"
                ? "opacity-40 cursor-not-allowed"
                : ""
            }`}
          >
            <Send
              size={18}
              className={
                !input.trim() || connectionStatus === "disconnected" || connectionStatus === "error"
                  ? "text-muted-foreground"
                  : "text-primary-foreground"
              }
            />
          </motion.button>
        ) : (
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={handleStop}
            className="w-12 h-12 rounded-full bg-destructive flex items-center justify-center shrink-0"
          >
            <Square size={18} className="text-destructive-foreground" fill="currentColor" />
          </motion.button>
        )}
        <VoiceDictationButton
          onResult={(text) => setInput(prev => prev ? prev + ' ' + text : text)}
          onInterim={(text) => setInput(text)}
          disabled={isGenerating}
          iconSize={18}
        />
        </div>
      </div>

      {/* Modals */}
      <FormatPickerModal
        show={showFormatPicker}
        onSelect={handleFormatPicked}
        onClose={() => setShowFormatPicker(false)}
      />
      <MergePickerModal
        show={showMergePicker}
        boards={getBoards()}
        onCreateNew={() => { setShowMergePicker(false); if (pendingFormat) createNewBoard(pendingFormat); }}
        onMerge={handleMerge}
        onClose={() => { setShowMergePicker(false); setPendingFormat(null); }}
      />
      <UpgradePrompt
        show={showUpgrade}
        onClose={() => setShowUpgrade(false)}
        reason={`You've used all ${getBoardLimit()} board${getBoardLimit() === 1 ? "" : "s"} on the Free plan.`}
      />
    </div>
  );
};

export default ChatAgent;
