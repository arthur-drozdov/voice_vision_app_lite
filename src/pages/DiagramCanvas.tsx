import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence, Reorder } from "framer-motion";
import {
  ChevronLeft, Trash2, Sparkles, Clock, Pencil, Check, Plus,
  Loader2, AlertCircle, RefreshCw, PenLine, Moon, Sun,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  getBoards, deleteBoard, updateBoard, mergeIntoBoard,
  FORMAT_OPTIONS, type CanvasBoard, type CanvasMessage,
  type MindmapNode, type TodoItem, type CalendarItem, type ReminderTime,
  type GenerationStatus, generateBoardTitle,
} from "@/lib/canvasStore";
import { getSessions, deleteSession, type ChatSession } from "@/lib/chatHistoryStore";
import { generateCanvasContent } from "@/lib/canvasApi";
import { canCreateBoard, getBoardLimit, getTier, TIER_CONFIGS } from "@/lib/subscriptionStore";
import FormatPickerModal from "@/components/FormatPickerModal";
import MindMapView from "@/components/MindMapView";
import MergePickerModal from "@/components/MergePickerModal";
import UpgradePrompt from "@/components/UpgradePrompt";
import VoiceDictationButton from "@/components/VoiceDictationButton";
import HandwritingCanvas from "@/components/HandwritingCanvas";
import { saveBoard } from "@/lib/canvasStore";
import type { CanvasFormat } from "@/lib/canvasStore";
import { isFocusActive, toggleFocus } from "@/lib/FocusController";
import GlassContainer from "@/components/GlassContainer";
import OrbitWrap from "@/components/OrbitWrap";
import FocusButton from "@/components/FocusButton";

// ─── Format renderers ──────────────────────────────────────────────────────────

// Branch colours that cycle for top-level branches
const BRANCH_COLOURS = [
  { accent: "from-primary to-primary/60", bg: "bg-primary/90", border: "border-primary/80", text: "text-primary-foreground" },
  { accent: "from-violet-400 to-violet-400/60", bg: "bg-violet-400/90", border: "border-violet-400/80", text: "text-white" },
  { accent: "from-amber-400 to-amber-400/60", bg: "bg-amber-400/90", border: "border-amber-400/80", text: "text-amber-950" },
  { accent: "from-rose-400 to-rose-400/60", bg: "bg-rose-400/90", border: "border-rose-400/80", text: "text-white" },
  { accent: "from-emerald-400 to-emerald-400/60", bg: "bg-emerald-400/90", border: "border-emerald-400/80", text: "text-emerald-950" },
  { accent: "from-sky-400 to-sky-400/60", bg: "bg-sky-400/90", border: "border-sky-400/80", text: "text-sky-950" },
];

// Helper: the API may return "title" or "label" depending on version
const getNodeLabel = (n: any): string => n.label || n.title || "";

/** Generate a human-readable preview for a canvas board (not raw JSON) */
function getBoardPreview(board: CanvasBoard): string {
  const sd = board.structuredData as any;
  if (sd) {
    if (sd.type === "mindmap" && sd.root) {
      const cats = (sd.root.children || []).map((c: any) => getNodeLabel(c)).filter(Boolean);
      return cats.length > 0 ? cats.join(" · ") : "Mind map";
    }
    if (sd.type === "todo" && Array.isArray(sd.items)) {
      const total = sd.items.length;
      const done = sd.items.filter((t: any) => t.done).length;
      const high = sd.items.filter((t: any) => t.priority === "high" && !t.done).length;
      const parts: string[] = [];
      parts.push(`${done}/${total} done`);
      if (high > 0) parts.push(`🔴 ${high} high priority`);
      // Show first 2 undone tasks as preview
      const undone = sd.items.filter((t: any) => !t.done).slice(0, 2).map((t: any) => `☐ ${t.text}`);
      if (undone.length > 0) parts.push(undone.join(" · "));
      return parts.join(" — ");
    }
    if (sd.type === "calendar" && Array.isArray(sd.events)) {
      const previews = sd.events.slice(0, 3).map((e: any) => {
        const d = e.date ? `📅 ${e.date}` : "";
        return d ? `${d} ${e.title}` : `📅 ${e.title}`;
      });
      const more = sd.events.length > 3 ? ` +${sd.events.length - 3} more` : "";
      return previews.join(" · ") + more;
    }
  }
  // For summary/custom, use generatedContent (markdown, not JSON)
  if (board.generatedContent) {
    // Extract first meaningful line, strip markdown formatting
    const lines = board.generatedContent
      .replace(/<think>[\s\S]*?<\/think>/g, "")
      .split("\n")
      .map(l => l.replace(/^#+\s*/g, "").replace(/\*\*/g, "").replace(/[*_~`]/g, "").trim())
      .filter(l => l.length > 10 && !l.startsWith("{") && !l.startsWith("["));
    const first = lines[0] ?? "";
    return first.slice(0, 120) + (first.length > 120 ? "…" : "");
  }
  return "";
}

// Sub-node: renders children as compact pills inside a branch
const MindmapLeaf = ({ node, colour }: { node: MindmapNode; colour: typeof BRANCH_COLOURS[0] }) => (
  <div className="space-y-1.5">
    <p className="text-xs font-medium text-foreground leading-snug">{getNodeLabel(node)}</p>
    {node.children && node.children.length > 0 && (
      <div className={`pl-3 border-l-2 ${colour.border} space-y-1.5`}>
        {node.children.map((child, i) => (
          <p key={i} className="text-[11px] font-normal text-foreground/90 leading-snug">{getNodeLabel(child)}</p>
        ))}
      </div>
    )}
  </div>
);

const MindmapNodeView = ({ node }: { node: MindmapNode }) => {
  const hasChildren = node.children && node.children.length > 0;

  return (
    <div className="space-y-5">
      {/* Root title */}
      <GlassContainer variant="dark" size="lg" className="text-center py-4">
        <p className="text-lg font-extrabold text-foreground tracking-tight">{getNodeLabel(node)}</p>
      </GlassContainer>

      {/* Branches grid */}
      {hasChildren && (
        <div className="grid grid-cols-2 gap-4">
          {node.children!.map((branch, i) => {
            const colour = BRANCH_COLOURS[i % BRANCH_COLOURS.length];
            return (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.06 }}
                className={`rounded-xl ${colour.bg} border ${colour.border} overflow-hidden`}
              >
                {/* Accent bar + branch label */}
                <div className="flex items-stretch">
                  <div className={`w-2.5 bg-gradient-to-b ${colour.accent} shrink-0`} />
                  <div className="p-4 flex-1 space-y-3">
                    <p className={`text-sm font-semibold ${colour.text} uppercase tracking-wide leading-snug`}>{getNodeLabel(branch)}</p>
                    {/* Sub-nodes */}
                    {branch.children && branch.children.length > 0 && (
                      <div className="space-y-2.5">
                        {branch.children.map((child, j) => (
                          <MindmapLeaf key={j} node={child} colour={colour} />
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
};

const TodoListView = ({
  items,
  boardId,
}: {
  items: TodoItem[];
  boardId: string;
}) => {
  const [local, setLocal] = useState<TodoItem[]>(items);
  const [addingTask, setAddingTask] = useState(false);
  const [newTaskText, setNewTaskText] = useState("");
  const doneCount = local.filter((i) => i.done).length;
  const progress = local.length > 0 ? Math.round((doneCount / local.length) * 100) : 0;

  const persist = (items: TodoItem[]) => {
    const boards = getBoards();
    const board = boards.find((b) => b.id === boardId);
    if (board?.structuredData && board.structuredData.type === "todo") {
      updateBoard(boardId, { structuredData: { type: "todo", items } });
    }
  };

  const toggle = (idx: number) => {
    const next = local.map((item, i) =>
      i === idx ? { ...item, done: !item.done } : item
    );
    setLocal(next);
    persist(next);
  };

  const cyclePriority = (idx: number, e: React.MouseEvent) => {
    e.stopPropagation();
    const order: Array<"low" | "medium" | "high"> = ["low", "medium", "high"];
    const next = local.map((item, i) => {
      if (i !== idx) return item;
      const cur = order.indexOf(item.priority);
      return { ...item, priority: order[(cur + 1) % 3] };
    });
    setLocal(next);
    persist(next);
  };

  const addTask = () => {
    if (!newTaskText.trim()) return;
    const next = [...local, { text: newTaskText.trim(), done: false, priority: "medium" as const }];
    setLocal(next);
    persist(next);
    setNewTaskText("");
    setAddingTask(false);
  };

  const priorityDot: Record<string, string> = {
    high: "bg-red-400",
    medium: "bg-yellow-400",
    low: "bg-emerald-400",
  };
  const priorityLabel: Record<string, string> = {
    high: "High",
    medium: "Med",
    low: "Low",
  };

  // Group by priority
  const grouped = [
    { label: "🔴 High Priority", items: local.map((item, i) => ({ item, i })).filter(({ item }) => item.priority === "high"), color: "text-red-400" },
    { label: "🟡 Medium Priority", items: local.map((item, i) => ({ item, i })).filter(({ item }) => item.priority === "medium"), color: "text-yellow-400" },
    { label: "🟢 Low Priority", items: local.map((item, i) => ({ item, i })).filter(({ item }) => item.priority === "low"), color: "text-emerald-400" },
  ].filter((g) => g.items.length > 0);

  return (
    <div className="space-y-4">
      {/* Progress bar */}
      <div className="glass rounded-xl p-3">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-medium text-foreground">Progress</span>
          <span className="text-xs font-bold text-primary">{doneCount}/{local.length} done</span>
        </div>
        <div className="h-2 rounded-full bg-white/10 overflow-hidden">
          <motion.div
            className="h-full rounded-full bg-gradient-to-r from-primary to-violet-400"
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.4, ease: "easeOut" }}
          />
        </div>
      </div>

      {grouped.map((group) => (
        <div key={group.label} className="space-y-2">
          <GlassContainer variant="dark" size="sm">
            <p className={`text-xs font-bold ${group.color} uppercase tracking-wider`}>{group.label}</p>
          </GlassContainer>
          {group.items.map(({ item, i }) => (
            <motion.div
              key={i}
              whileTap={{ scale: 0.98 }}
              className="w-full flex items-start gap-3 p-3.5 rounded-xl glass border border-white/10 text-left hover:border-white/20 transition-all"
            >
              <button
                onClick={() => toggle(i)}
                className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 mt-0.5 transition-all duration-200 ${
                  item.done ? "bg-primary border-primary scale-110" : "border-white/30"
                }`}
              >
                {item.done && <Check size={10} className="text-primary-foreground" />}
              </button>
              <span
                onClick={() => toggle(i)}
                className={`text-sm flex-1 leading-snug transition-all duration-200 cursor-pointer ${
                  item.done ? "line-through text-foreground/40" : "text-foreground"
                }`}
              >
                {item.text}
              </span>
              <button
                onClick={(e) => cyclePriority(i, e)}
                className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border transition-colors ${
                  item.priority === "high" ? "bg-red-400/20 text-red-300 border-red-400/30" :
                  item.priority === "medium" ? "bg-yellow-400/20 text-yellow-300 border-yellow-400/30" :
                  "bg-emerald-400/20 text-emerald-300 border-emerald-400/30"
                }`}
                title="Tap to change priority"
              >
                <div className={`w-1.5 h-1.5 rounded-full ${priorityDot[item.priority]}`} />
                {priorityLabel[item.priority]}
              </button>
            </motion.div>
          ))}
        </div>
      ))}

      {/* Add task */}
      {addingTask ? (
        <div className="glass rounded-xl p-3 flex gap-2">
          <input
            autoFocus
            value={newTaskText}
            onChange={(e) => setNewTaskText(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addTask()}
            placeholder="New task..."
            className="flex-1 bg-transparent text-sm text-foreground placeholder:text-foreground/40 outline-none"
          />
          <button onClick={addTask} className="px-3 py-1 rounded-lg bg-primary text-primary-foreground text-xs font-semibold">Add</button>
          <button onClick={() => { setAddingTask(false); setNewTaskText(""); }} className="px-2 py-1 rounded-lg glass text-xs text-foreground/60">Cancel</button>
        </div>
      ) : (
        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={() => setAddingTask(true)}
          className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-xl glass border border-dashed border-white/15 text-xs text-foreground/60 font-medium hover:border-white/25 hover:text-foreground transition-all"
        >
          <Plus size={13} /> Add task
        </motion.button>
      )}
    </div>
  );
};

const REMINDER_OPTIONS: { value: ReminderTime; label: string }[] = [
  { value: null, label: "No reminder" },
  { value: "start", label: "🔔 At start" },
  { value: "1hr", label: "🔔 1 hour before" },
  { value: "1day", label: "🔔 1 day before" },
  { value: "custom", label: "⏱️ Custom..." },
];

const CalendarView = ({ events: initialEvents, boardId }: { events: CalendarItem[]; boardId: string }) => {
  const [events, setEvents] = useState<CalendarItem[]>(initialEvents);
  const [addingEvent, setAddingEvent] = useState(false);
  const [newDate, setNewDate] = useState("");
  const [newTitle, setNewTitle] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [customReminderIdx, setCustomReminderIdx] = useState<number | null>(null);

  const persist = (items: CalendarItem[]) => {
    const boards = getBoards();
    const board = boards.find((b) => b.id === boardId);
    if (board?.structuredData && board.structuredData.type === "calendar") {
      updateBoard(boardId, { structuredData: { type: "calendar", events: items } });
    }
  };

  const addEvent = () => {
    if (!newTitle.trim()) return;
    const next = [...events, { date: newDate || new Date().toISOString().split("T")[0], title: newTitle.trim(), description: newDesc.trim() || undefined, reminder: null as ReminderTime }];
    setEvents(next);
    persist(next);
    setNewDate(""); setNewTitle(""); setNewDesc(""); setAddingEvent(false);
  };

  const setReminder = (idx: number, reminder: ReminderTime) => {
    if (reminder === "custom") {
      setCustomReminderIdx(idx);
      return;
    }
    setCustomReminderIdx(null);
    const next = events.map((ev, i) => i === idx ? { ...ev, reminder, customReminderMinutes: undefined } : ev);
    setEvents(next);
    persist(next);
  };

  const setCustomReminderDate = (idx: number, datetimeStr: string) => {
    const next = events.map((ev, i) => {
      if (i !== idx) return ev;
      // Calculate minutes before event
      const eventDate = new Date(ev.date);
      const reminderDate = new Date(datetimeStr);
      const diffMs = eventDate.getTime() - reminderDate.getTime();
      const diffMin = Math.max(0, Math.round(diffMs / 60000));
      return { ...ev, reminder: "custom" as ReminderTime, customReminderMinutes: diffMin };
    });
    setEvents(next);
    persist(next);
  };

  const confirmCustomReminder = () => setCustomReminderIdx(null);

  // Parse event dates and find which month to show
  const parsedEvents = events.map((ev) => {
    const d = new Date(ev.date);
    return { ...ev, parsed: isNaN(d.getTime()) ? null : d };
  });
  const validDates = parsedEvents.filter((e) => e.parsed).map((e) => e.parsed!);
  const refDate = validDates.length > 0 ? validDates[0] : new Date();
  const year = refDate.getFullYear();
  const month = refDate.getMonth();
  const monthName = refDate.toLocaleDateString("en-GB", { month: "long", year: "numeric" });

  // Build calendar grid
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startPad = (firstDay.getDay() + 6) % 7; // Monday start
  const totalDays = lastDay.getDate();

  const eventDaySet = new Set(
    validDates
      .filter((d) => d.getMonth() === month && d.getFullYear() === year)
      .map((d) => d.getDate())
  );

  const dayNames = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  const tagColours = [
    "bg-primary/20 text-primary border-primary/30",
    "bg-violet-400/20 text-violet-300 border-violet-400/30",
    "bg-amber-400/20 text-amber-300 border-amber-400/30",
    "bg-emerald-400/20 text-emerald-300 border-emerald-400/30",
    "bg-rose-400/20 text-rose-300 border-rose-400/30",
    "bg-sky-400/20 text-sky-300 border-sky-400/30",
  ];

  // Helper: get the default datetime-local value for the custom picker (event date at 09:00)
  const getDefaultReminderDatetime = (evDate: string) => {
    const d = new Date(evDate);
    if (isNaN(d.getTime())) return "";
    d.setHours(9, 0, 0, 0);
    // Format as YYYY-MM-DDTHH:MM for datetime-local input
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };

  // Helper: get stored custom reminder datetime from customReminderMinutes
  const getCustomReminderDatetime = (ev: CalendarItem) => {
    if (ev.customReminderMinutes == null) return getDefaultReminderDatetime(ev.date);
    const eventDate = new Date(ev.date);
    if (isNaN(eventDate.getTime())) return "";
    const reminderDate = new Date(eventDate.getTime() - ev.customReminderMinutes * 60000);
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${reminderDate.getFullYear()}-${pad(reminderDate.getMonth() + 1)}-${pad(reminderDate.getDate())}T${pad(reminderDate.getHours())}:${pad(reminderDate.getMinutes())}`;
  };

  // Helper: format custom reminder for display
  const formatCustomReminder = (ev: CalendarItem) => {
    if (ev.customReminderMinutes == null) return "";
    const mins = ev.customReminderMinutes;
    if (mins < 60) return `🔔 ${mins}m before`;
    if (mins < 1440) return `🔔 ${Math.round(mins / 60)}h before`;
    return `🔔 ${Math.round(mins / 1440)}d before`;
  };

  return (
    <div className="space-y-4">
      {/* Month grid */}
      <div className="glass rounded-2xl p-4">
        <GlassContainer variant="dark" size="sm" className="mb-3 text-center">
          <p className="text-sm font-bold text-foreground">{monthName}</p>
        </GlassContainer>
        <div className="grid grid-cols-7 gap-1 text-center">
          {dayNames.map((d) => (
            <div key={d} className="text-[10px] font-semibold text-foreground/60 py-1">{d}</div>
          ))}
          {Array.from({ length: startPad }).map((_, i) => (
            <div key={`pad-${i}`} />
          ))}
          {Array.from({ length: totalDays }).map((_, i) => {
            const day = i + 1;
            const hasEvent = eventDaySet.has(day);
            const isToday = day === new Date().getDate() && month === new Date().getMonth() && year === new Date().getFullYear();
            return (
              <div
                key={day}
                className={`relative py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  hasEvent
                    ? "bg-primary/20 text-primary font-bold"
                    : isToday
                    ? "ring-1 ring-primary/30 text-foreground"
                    : "text-foreground/50"
                }`}
              >
                {day}
                {hasEvent && (
                  <div className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-primary" />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Events header */}
      <GlassContainer variant="dark" size="sm">
        <p className="text-xs font-bold text-foreground uppercase tracking-wider">📅 Events</p>
      </GlassContainer>

      {/* Event list */}
      <div className="space-y-2">
        {events.map((ev, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.05 }}
            className="flex gap-3"
          >
            <div className="w-1 rounded-full bg-gradient-to-b from-primary/60 to-violet-400/40 shrink-0" />
            <div className="glass rounded-xl p-3.5 flex-1 border border-white/10 space-y-2">
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full border ${tagColours[i % tagColours.length]}`}>
                  {ev.date}
                </span>
                {/* Reminder dropdown */}
                <select
                  value={ev.reminder === "custom" ? "custom" : (ev.reminder ?? "")}
                  onChange={(e) => setReminder(i, (e.target.value || null) as ReminderTime)}
                  className="text-[10px] bg-transparent text-foreground/60 border border-white/10 rounded-full px-2 py-0.5 outline-none cursor-pointer appearance-none"
                >
                  {REMINDER_OPTIONS.map((opt) => (
                    <option key={String(opt.value)} value={opt.value ?? ""} className="bg-[#1a1a2e] text-white">
                      {opt.label}
                    </option>
                  ))}
                </select>
                {/* Show custom reminder label if set */}
                {ev.reminder === "custom" && ev.customReminderMinutes != null && customReminderIdx !== i && (
                  <button
                    onClick={() => setCustomReminderIdx(i)}
                    className="text-[10px] text-primary font-medium"
                  >
                    {formatCustomReminder(ev)}
                  </button>
                )}
              </div>
              <p className="text-sm font-semibold text-foreground">{ev.title}</p>
              {ev.description && (
                <p className="text-xs text-foreground/60 leading-relaxed">{ev.description}</p>
              )}
              {/* Custom reminder datetime picker */}
              {customReminderIdx === i && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  className="rounded-xl bg-background/60 backdrop-blur-lg p-3 space-y-2.5 border border-white/10"
                >
                  <p className="text-[10px] font-bold text-foreground/70 uppercase tracking-wider">⏱️ Set custom reminder</p>
                  <input
                    type="datetime-local"
                    defaultValue={getCustomReminderDatetime(ev)}
                    onChange={(e) => setCustomReminderDate(i, e.target.value)}
                    style={{ colorScheme: "dark" }}
                    className="w-full bg-white/5 border border-white/15 rounded-xl px-3 py-2 text-xs text-foreground outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/30 transition-all"
                  />
                  <button
                    onClick={confirmCustomReminder}
                    className="w-full py-2 rounded-xl bg-primary text-primary-foreground text-xs font-bold transition-opacity hover:opacity-90"
                  >
                    Set reminder
                  </button>
                </motion.div>
              )}
            </div>
          </motion.div>
        ))}
      </div>

      {/* Add event */}
      {addingEvent ? (
        <div className="glass rounded-xl p-3 space-y-2">
          <input
            autoFocus
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="Event title..."
            className="w-full bg-transparent text-sm text-foreground placeholder:text-foreground/40 outline-none"
          />
          <input
            type="date"
            value={newDate}
            onChange={(e) => setNewDate(e.target.value)}
            className="w-full bg-transparent text-xs text-foreground/60 outline-none"
          />
          <input
            value={newDesc}
            onChange={(e) => setNewDesc(e.target.value)}
            placeholder="Description (optional)"
            className="w-full bg-transparent text-xs text-foreground/60 placeholder:text-foreground/30 outline-none"
          />
          <div className="flex gap-2 pt-1">
            <button onClick={addEvent} className="px-3 py-1 rounded-lg bg-primary text-primary-foreground text-xs font-semibold">Add</button>
            <button onClick={() => { setAddingEvent(false); setNewTitle(""); setNewDate(""); setNewDesc(""); }} className="px-2 py-1 rounded-lg glass text-xs text-foreground/60">Cancel</button>
          </div>
        </div>
      ) : (
        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={() => setAddingEvent(true)}
          className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-xl glass border border-dashed border-white/15 text-xs text-foreground/60 font-medium hover:border-white/25 hover:text-foreground transition-all"
        >
          <Plus size={13} /> Add event
        </motion.button>
      )}
    </div>
  );
};

// ─── Generation status overlay ─────────────────────────────────────────────────

const GenerationState = ({
  status,
  onRetry,
}: {
  status: GenerationStatus;
  onRetry: () => void;
}) => {
  if (status === "ready") return null;

  return (
    <div className="flex flex-col items-center justify-center gap-4 py-12 text-center">
      {status === "generating" && (
        <>
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1.2, repeat: Infinity, ease: "linear" }}
          >
            <Loader2 size={32} className="text-primary" />
          </motion.div>
          <GlassContainer variant="dark" size="sm">
            <p className="text-sm font-semibold text-foreground">Generating canvas…</p>
            <p className="text-xs text-foreground/60 mt-1">The AI is structuring your conversation</p>
          </GlassContainer>
        </>
      )}
      {status === "pending" && (
        <>
          <Sparkles size={32} className="text-primary/50" />
          <p className="text-sm text-foreground/70">Preparing generation…</p>
        </>
      )}
      {status === "error" && (
        <>
          <AlertCircle size={32} className="text-destructive" />
          <div>
            <p className="text-sm font-semibold text-foreground">Generation failed</p>
            <p className="text-xs text-foreground/70 mt-1">Could not reach the AI backend</p>
          </div>
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={onRetry}
            className="flex items-center gap-2 px-4 py-2 rounded-xl glass text-sm"
          >
            <RefreshCw size={14} />
            Try again
          </motion.button>
        </>
      )}
    </div>
  );
};

// ─── Board detail view ─────────────────────────────────────────────────────────

const BoardDetail = ({
  board: initialBoard,
  onBack,
  onDelete,
  onBoardChange,
}: {
  board: CanvasBoard;
  onBack: () => void;
  onDelete: (id: string) => void;
  onBoardChange: () => void;
}) => {
  const [board, setBoard] = useState(initialBoard);
  const [editMode, setEditMode] = useState(false);
  const [editedMessages, setEditedMessages] = useState<CanvasMessage[]>(board.messages);
  const [showHandwriting, setShowHandwriting] = useState(false);
  const [showHandwritingCanvas, setShowHandwritingCanvas] = useState(false);
  const [activeFormat, setActiveFormat] = useState<CanvasFormat>(board.format);

  const fmt = FORMAT_OPTIONS.find((f) => f.id === board.format);
  const tier = getTier();
  const hasHandwriting = TIER_CONFIGS[tier].handwriting;

  // Trigger generation when status is pending
  const triggerGeneration = useCallback(async () => {
    const fresh = getBoards().find((b) => b.id === board.id);
    if (!fresh) return;
    await generateCanvasContent(fresh);
    // Reload board from store
    const updated = getBoards().find((b) => b.id === board.id);
    if (updated) setBoard(updated);
    onBoardChange();
  }, [board.id, onBoardChange]);

  useEffect(() => {
    if (board.generationStatus === "pending" || board.generationStatus === "generating") {
      triggerGeneration();
    }
    // Poll for status updates if generating
    const interval = setInterval(() => {
      const fresh = getBoards().find((b) => b.id === board.id);
      if (fresh && fresh.generationStatus !== board.generationStatus) {
        setBoard(fresh);
      }
    }, 500);
    return () => clearInterval(interval);
  }, []);

  const saveEdits = () => {
    updateBoard(board.id, {
      messages: editedMessages,
      generationStatus: "pending",
      generatedContent: undefined,
      structuredData: undefined,
    });
    const updated = getBoards().find((b) => b.id === board.id);
    if (updated) setBoard(updated);
    setEditMode(false);
    onBoardChange();
    // Re-generate
    setTimeout(triggerGeneration, 300);
  };

  const addNote = () => {
    setEditedMessages((prev) => [...prev, { role: "user", text: "" }]);
  };

  const handleDictation = (text: string) => {
    setEditedMessages((prev) => [...prev, { role: "user", text }]);
  };

  const renderContent = () => {
    const sd = board.structuredData;
    if (!sd && !board.generatedContent) return null;

    if (board.format === "mindmap" && sd?.type === "mindmap") {
      return (
        <MindMapView
          root={sd.root}
          boardId={board.id}
          onUpdate={(newRoot) => {
            updateBoard(board.id, {
              structuredData: { type: "mindmap", root: newRoot },
            });
            onBoardChange();
          }}
        />
      );
    }
    if (board.format === "todo" && sd?.type === "todo") {
      return <TodoListView items={sd.items} boardId={board.id} />;
    }
    if (board.format === "calendar" && sd?.type === "calendar") {
      return <CalendarView events={sd.events} boardId={board.id} />;
    }
    // Markdown fallback (summary, custom, or failed JSON parse)
    if (board.generatedContent) {
      return (
        <div className="glass rounded-2xl p-4 prose prose-sm max-w-none prose-contrast">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>
            {board.generatedContent}
          </ReactMarkdown>
        </div>
      );
    }
    return null;
  };

  const dateStr = new Date(board.createdAt).toLocaleDateString("en-GB", {
    day: "2-digit", month: "short", year: "numeric",
  });

  return (
    <motion.div
      key="detail"
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      className="flex flex-col h-full"
    >
      {/* Header */}
      <header className="flex items-center gap-3 px-5 pt-12 pb-3">
        <button onClick={onBack} className="p-2 rounded-xl glass" aria-label="Back">
          <ChevronLeft size={18} className="text-foreground" />
        </button>
        <GlassContainer variant="dark" size="sm" className="flex-1 min-w-0">
          <h1 className="text-sm font-bold text-foreground truncate">{board.title}</h1>
          <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
            <span className="text-xs">{board.characterEmoji}</span>
            <span className="text-xs font-medium text-foreground/70">{board.characterName}</span>
            <span className="text-xs font-medium text-foreground/70">·</span>
            <span className="text-xs">{fmt?.icon}</span>
            <span className="text-xs font-medium text-foreground/70">{fmt?.label}</span>
            <span className="text-xs font-medium text-foreground/70">·</span>
            <span className="text-xs font-medium text-foreground/70">{dateStr}</span>
          </div>
        </GlassContainer>
        <div className="flex items-center gap-1">
          {/* Edit toggle */}
          <button
            onClick={() => {
              if (editMode) saveEdits();
              else { setEditedMessages(board.messages); setEditMode(true); }
            }}
            className={`p-2 rounded-xl glass ${editMode ? "bg-primary/20" : ""}`}
          >
            {editMode
              ? <Check size={16} className="text-primary" />
              : <Pencil size={16} className="text-foreground/70" />
            }
          </button>
          {/* Delete */}
          <button
            onClick={() => onDelete(board.id)}
            className="p-2 rounded-xl glass opacity-60 hover:opacity-100 transition-opacity"
          >
            <Trash2 size={16} className="text-destructive" />
          </button>
        </div>
      </header>

      {/* Format switcher dropdown */}
      <div className="mx-5 mt-1 mb-2">
        <div className="glass rounded-xl px-3 py-2 flex items-center gap-2 relative">
          <select
            value={activeFormat}
            onChange={(e) => {
              const newFormat = e.target.value as CanvasFormat;
              if (newFormat === activeFormat) return;
              setActiveFormat(newFormat);
              updateBoard(board.id, {
                format: newFormat,
                generationStatus: "pending",
                generatedContent: undefined,
                structuredData: undefined,
              });
              const fresh = getBoards().find((b) => b.id === board.id);
              if (fresh) setBoard(fresh);
              onBoardChange();
              setTimeout(triggerGeneration, 200);
            }}
            className="flex-1 bg-transparent text-sm font-medium text-foreground appearance-none outline-none cursor-pointer"
          >
            {FORMAT_OPTIONS.map((f) => (
              <option key={f.id} value={f.id} className="bg-[#1a1a2e] text-white">
                {f.icon} {f.label} — {f.description}
              </option>
            ))}
          </select>
          <ChevronLeft size={14} className="text-foreground/50 -rotate-90 shrink-0" />
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 overflow-y-auto px-5 pb-20 space-y-4">
        {/* AI-generated content section */}
        {board.generationStatus !== "ready" ? (
          <GenerationState
            status={board.generationStatus}
            onRetry={() => {
              updateBoard(board.id, { generationStatus: "pending" });
              triggerGeneration();
            }}
          />
        ) : (
          renderContent()
        )}

        {/* Separator */}
        {board.generationStatus === "ready" && editMode && (
          <div className="flex items-center gap-2">
            <div className="flex-1 h-px bg-border/50" />
            <span className="text-xs text-foreground/70">Source messages</span>
            <div className="flex-1 h-px bg-border/50" />
          </div>
        )}

        {/* Messages — only shown in edit mode (source context for editing) */}
        {editMode &&
          editedMessages.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
              <textarea
                value={msg.text}
                onChange={(e) => {
                  const next = [...editedMessages];
                  next[i] = { ...next[i], text: e.target.value };
                  setEditedMessages(next);
                }}
                rows={2}
                className={`max-w-[85%] px-4 py-2.5 rounded-2xl text-sm resize-none outline-none bg-transparent border ${
                  msg.role === "agent"
                    ? "glass border-border/40 text-foreground"
                    : "bg-primary/20 border-primary/30 text-foreground"
                }`}
              />
            </div>
          ))}
      </div>

      {/* Edit mode toolbar */}
      <AnimatePresence>
        {editMode && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            className="flex items-center gap-3 px-5 pb-24 pt-2"
          >
            {/* Add note */}
            <button
              onClick={addNote}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl glass text-xs text-foreground/70"
            >
              <Plus size={13} />
              Add note
            </button>

            {/* Voice dictation */}
            <VoiceDictationButton onResult={handleDictation} />

            {/* Handwriting (Premium gate) */}
            <button
              onClick={() => {
                if (!hasHandwriting) {
                  setShowHandwriting(true); // shows UpgradePrompt
                } else {
                  setShowHandwritingCanvas(true);
                }
              }}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl glass text-xs ${
                hasHandwriting ? "text-foreground/70" : "text-foreground/40"
              }`}
              title={hasHandwriting ? "Write with finger or stylus" : "Upgrade to Premium for handwriting"}
            >
              <PenLine size={13} />
              Draw
              {!hasHandwriting && (
                <span className="text-[9px] text-primary font-bold ml-0.5">PRO</span>
              )}
            </button>

            <div className="flex-1" />
            <button
              onClick={() => setEditMode(false)}
              className="px-3 py-2 rounded-xl glass text-xs text-foreground/70"
            >
              Cancel
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Upgrade prompt for handwriting */}
      <UpgradePrompt
        show={showHandwriting}
        onClose={() => setShowHandwriting(false)}
        reason="Handwriting recognition requires a Premium subscription."
      />

      {/* Handwriting canvas — full screen drawing overlay */}
      <AnimatePresence>
        {showHandwritingCanvas && (
          <HandwritingCanvas
            onResult={(text) => {
              setEditedMessages((prev) => [...prev, { role: "user", text }]);
              setShowHandwritingCanvas(false);
            }}
            onClose={() => setShowHandwritingCanvas(false)}
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
};

// ─── History session card ──────────────────────────────────────────────────────

const HistoryCard = ({
  session,
  onGenerateCanvas,
  onDelete,
}: {
  session: ChatSession;
  onGenerateCanvas: (session: ChatSession) => void;
  onDelete: (id: string) => void;
}) => {
  const date = new Date(session.updatedAt).toLocaleDateString("en-GB", {
    day: "2-digit", month: "short",
  });
  const preview = session.messages.find((m) => m.role === "agent")?.text?.slice(0, 80) ?? "";

  return (
    <div className="glass rounded-2xl p-4 flex items-start gap-3">
      <span className="text-2xl shrink-0">{session.characterEmoji}</span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-foreground truncate">{session.title}</p>
        <p className="text-xs text-foreground/70 mt-0.5 w-fit bg-background/60 rounded px-1.5 py-px">{date}</p>
        {preview && (
          <p className="text-xs text-foreground/70 mt-1.5 line-clamp-2 leading-relaxed">
            {preview}{preview.length >= 80 ? "…" : ""}
          </p>
        )}
        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={() => onGenerateCanvas(session)}
          className="mt-2 flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-primary/10 border border-primary/20 text-xs text-primary font-medium"
        >
          <Sparkles size={11} />
          Generate Canvas
        </motion.button>
      </div>
      <button
        onClick={() => onDelete(session.id)}
        className="p-2 rounded-xl glass opacity-40 hover:opacity-80 transition-opacity shrink-0"
      >
        <Trash2 size={13} className="text-foreground/70" />
      </button>
    </div>
  );
};

// ─── Main Canvas page ──────────────────────────────────────────────────────────

type Tab = "boards" | "history";

const DiagramCanvas = () => {
  const [boards, setBoards] = useState<CanvasBoard[]>([]);
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeTab, setActiveTab] = useState<Tab>("boards");
  const [selectedBoard, setSelectedBoard] = useState<CanvasBoard | null>(null);

  // Format / merge / upgrade flow
  const [showFormatPicker, setShowFormatPicker] = useState(false);
  const [showMergePicker, setShowMergePicker] = useState(false);
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [pendingSession, setPendingSession] = useState<ChatSession | null>(null);
  const [pendingFormat, setPendingFormat] = useState<CanvasFormat | null>(null);
  // Delete confirmation — holds the board ID pending permanent deletion
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [focusMode, setFocusMode] = useState(isFocusActive);

  const tier = getTier();
  const config = TIER_CONFIGS[tier];

  const loadData = useCallback(() => {
    setBoards(getBoards());
    setSessions(getSessions());
  }, []);

  useEffect(() => {
    loadData();
    window.addEventListener("storage", loadData);
    return () => window.removeEventListener("storage", loadData);
  }, [loadData]);

  const handleDeleteBoard = (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    // Always ask for confirmation — deletion is permanent
    setDeleteConfirmId(id);
  };

  const confirmDelete = () => {
    if (!deleteConfirmId) return;
    deleteBoard(deleteConfirmId);
    loadData();
    if (selectedBoard?.id === deleteConfirmId) setSelectedBoard(null);
    setDeleteConfirmId(null);
  };

  const handleDeleteSession = (id: string) => {
    deleteSession(id);
    loadData();
  };

  // History → "Generate Canvas" tapped
  const handleGenerateFromHistory = (session: ChatSession) => {
    setPendingSession(session);
    if (!canCreateBoard(boards.length)) {
      setShowUpgrade(true);
      return;
    }
    setShowFormatPicker(true);
  };

  // Format picked (either from history or external save flow)
  const handleFormatPicked = (format: CanvasFormat) => {
    setShowFormatPicker(false);
    setPendingFormat(format);
    if (boards.length > 0) {
      setShowMergePicker(true);
    } else {
      createNewBoard(format);
    }
  };

  const createNewBoard = (format: CanvasFormat, session?: ChatSession | null) => {
    const src = session ?? pendingSession;
    if (!src) return;
    const now = new Date();
    const messages = src.messages.map(({ role, text }) => ({ role, text }));
    const board: CanvasBoard = {
      id: `board-${Date.now()}`,
      title: generateBoardTitle(messages, src.characterName, now),
      characterId: src.characterId,
      characterEmoji: src.characterEmoji,
      characterName: src.characterName,
      format,
      createdAt: now.toISOString(),
      messages,
      generationStatus: "pending",
    };
    saveBoard(board);
    loadData();
    setActiveTab("boards");
    setSelectedBoard(board);
    setPendingSession(null);
    setPendingFormat(null);
  };

  const handleMergeInto = (boardId: string) => {
    const src = pendingSession;
    if (!src) return;
    const newMessages = src.messages.map(({ role, text }) => ({ role, text }));
    mergeIntoBoard(boardId, newMessages);
    loadData();
    const merged = getBoards().find((b) => b.id === boardId);
    if (merged) {
      setActiveTab("boards");
      setSelectedBoard(merged);
    }
    setShowMergePicker(false);
    setPendingSession(null);
    setPendingFormat(null);
  };

  // Board count / limit display
  const boardLimit = getBoardLimit();
  const boardCountLabel =
    boardLimit === -1
      ? `${boards.length} boards`
      : `${boards.length}/${boardLimit} boards`;

  // ── Delete confirmation modal (shared between both view states) ───────────
  const deleteConfirmModal = deleteConfirmId ? (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-end justify-center p-5 bg-black/60 backdrop-blur-sm"
      onClick={() => setDeleteConfirmId(null)}
    >
      <motion.div
        initial={{ opacity: 0, y: 40, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 40 }}
        transition={{ type: "spring", damping: 26, stiffness: 320 }}
        onClick={(e) => e.stopPropagation()}
        className="glass rounded-3xl p-6 w-full max-w-xs mb-8"
      >
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="w-12 h-12 rounded-full bg-destructive/15 flex items-center justify-center">
            <Trash2 size={20} className="text-destructive" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-foreground">Delete this board?</h3>
            <p className="text-sm text-foreground/70 leading-relaxed mt-1.5">
              This board will be{" "}
              <span className="text-destructive font-semibold">permanently deleted</span>{" "}
              and cannot be recovered.
            </p>
          </div>
          <div className="flex gap-2 w-full mt-1">
            <motion.button
              whileTap={{ scale: 0.96 }}
              onClick={() => setDeleteConfirmId(null)}
              className="flex-1 py-2.5 rounded-xl glass text-sm text-foreground/70 font-medium"
            >
              Keep it
            </motion.button>
            <motion.button
              whileTap={{ scale: 0.96 }}
              onClick={confirmDelete}
              className="flex-1 py-2.5 rounded-xl bg-destructive text-destructive-foreground text-sm font-semibold"
            >
              Delete
            </motion.button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  ) : null;

  // ── Selected board detail view ──
  if (selectedBoard) {
    // Get fresh version from store
    const fresh = boards.find((b) => b.id === selectedBoard.id) ?? selectedBoard;
    return (
      <>
        <AnimatePresence mode="wait">
          <BoardDetail
            key={fresh.id}
            board={fresh}
            onBack={() => setSelectedBoard(null)}
            onDelete={(id) => handleDeleteBoard(id)}
            onBoardChange={loadData}
          />
        </AnimatePresence>
        {/* Delete confirmation overlay — rendered on top of board detail */}
        {deleteConfirmModal}
      </>
    );
  }

  return (
    <div className="flex flex-col h-full page-canvas">
      {/* Header */}
      <header className="px-5 pt-12 pb-3 page-header">
        <div className="flex items-start justify-between">
          <OrbitWrap planet="venus">
            <GlassContainer variant="dark" size="sm" className="flex flex-col">
              <h1 className="text-lg font-semibold text-foreground leading-tight">Canvas</h1>
              <p className="text-xs text-foreground/70 mt-0.5">AI Co-working Space</p>
            </GlassContainer>
          </OrbitWrap>
          <div className="flex items-center gap-2">
            <GlassContainer variant="dark" size="sm">
              <span className="text-xs text-foreground/70">{boardCountLabel}</span>
            </GlassContainer>
            <FocusButton />
          </div>
        </div>

        {/* Tab switcher */}
        <div className="flex gap-1 mt-4 glass rounded-xl p-1">
          {(["boards", "history"] as Tab[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium transition-colors ${
                activeTab === tab
                  ? "bg-primary text-primary-foreground"
                  : "text-foreground/70"
              }`}
            >
              {tab === "boards" ? <Sparkles size={12} /> : <Clock size={12} />}
              {tab === "boards" ? "Boards" : "History"}
            </button>
          ))}
        </div>
      </header>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-5 pb-24">
        <AnimatePresence mode="wait">
          {activeTab === "boards" ? (
            <motion.div
              key="boards"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-3 pt-3"
            >
              {boards.length === 0 ? (
                <div className="h-[50vh] flex flex-col items-center justify-center gap-4 text-center">
                  <motion.div
                    animate={{ scale: [1, 1.06, 1], opacity: [0.5, 0.8, 0.5] }}
                    transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                    className="w-20 h-20 rounded-3xl glass flex items-center justify-center"
                  >
                    <Sparkles size={32} className="text-primary/60" />
                  </motion.div>
                  <GlassContainer variant="dark" size="sm" className="flex flex-col items-center">
                    <h2 className="text-base font-semibold text-foreground">Nothing saved yet</h2>
                    <p className="text-sm text-foreground/70 mt-1.5 leading-relaxed max-w-[220px]">
                      After a Chat or Video session, tap{" "}
                      <span className="font-medium text-foreground">Save to Canvas</span>{" "}
                      to see your boards here.
                    </p>
                  </GlassContainer>
                </div>
              ) : (
                <AnimatePresence>
                  {boards.map((board, idx) => {
                    const fmt = FORMAT_OPTIONS.find((f) => f.id === board.format);
                    const date = new Date(board.createdAt).toLocaleDateString("en-GB", {
                      day: "2-digit", month: "short",
                    });
                    const isGenerating = board.generationStatus === "generating" || board.generationStatus === "pending";
                    return (
                      <motion.div
                        key={board.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        transition={{ delay: idx * 0.04 }}
                        onClick={() => setSelectedBoard(board)}
                        className="glass rounded-2xl p-4 flex items-start gap-3 cursor-pointer active:scale-[0.98] transition-transform"
                      >
                        <span className="text-2xl shrink-0 mt-0.5">{board.characterEmoji}</span>
                        <div className="flex-1 min-w-0">
                          <h3 className="text-sm font-semibold text-foreground truncate">{board.title}</h3>
                          <div className="flex items-center gap-1.5 mt-0.5 w-fit bg-background/60 rounded px-1.5 py-px">
                            <span className="text-xs">{fmt?.icon}</span>
                            <span className="text-xs font-medium text-foreground/70">{fmt?.label}</span>
                            <span className="text-xs font-medium text-foreground/70">·</span>
                            <span className="text-xs font-medium text-foreground/70">{date}</span>
                            {isGenerating && (
                              <>
                                <span className="text-xs font-medium text-foreground/70">·</span>
                                <motion.span
                                  animate={{ opacity: [0.4, 1, 0.4] }}
                                  transition={{ duration: 1.2, repeat: Infinity }}
                                  className="text-xs text-primary"
                                >
                                  Generating…
                                </motion.span>
                              </>
                            )}
                          </div>
                          {!isGenerating && (() => {
                            const preview = getBoardPreview(board);
                            return preview ? (
                              <p className="text-xs text-foreground/70 mt-1.5 line-clamp-2 leading-relaxed">
                                {preview}
                              </p>
                            ) : null;
                          })()}
                        </div>
                        <button
                          onClick={(e) => handleDeleteBoard(board.id, e)}
                          className="p-2 rounded-xl glass shrink-0 opacity-40 hover:opacity-80 transition-opacity"
                        >
                          <Trash2 size={13} className="text-foreground/70" />
                        </button>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              )}
            </motion.div>
          ) : (
            <motion.div
              key="history"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-3 pt-3"
            >
              {sessions.length === 0 ? (
                <div className="h-[50vh] flex flex-col items-center justify-center text-center gap-1">
                  <h2 className="text-base font-semibold text-white bg-background/40 rounded-md px-3 py-0.5 backdrop-blur-sm" style={{ fontFamily: "'Poppins', sans-serif" }}>No history yet</h2>
                  <p className="text-sm text-white/70 leading-relaxed max-w-[220px] bg-background/30 rounded-md px-3 py-0.5 backdrop-blur-sm" style={{ fontFamily: "'Poppins', sans-serif" }}>
                    Your chat sessions will appear here automatically after you start talking.
                  </p>
                </div>
              ) : (
                sessions.map((session) => (
                  <HistoryCard
                    key={session.id}
                    session={session}
                    onGenerateCanvas={handleGenerateFromHistory}
                    onDelete={handleDeleteSession}
                  />
                ))
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Modals */}
      <FormatPickerModal
        show={showFormatPicker}
        onSelect={handleFormatPicked}
        onClose={() => { setShowFormatPicker(false); setPendingSession(null); }}
      />

      <MergePickerModal
        show={showMergePicker}
        boards={boards}
        onCreateNew={() => {
          setShowMergePicker(false);
          if (pendingFormat) createNewBoard(pendingFormat);
        }}
        onMerge={(boardId) => {
          setShowMergePicker(false);
          handleMergeInto(boardId);
        }}
        onClose={() => { setShowMergePicker(false); setPendingSession(null); setPendingFormat(null); }}
      />

      <UpgradePrompt
        show={showUpgrade}
        onClose={() => setShowUpgrade(false)}
        reason={`You've used all ${boardLimit} board${boardLimit === 1 ? "" : "s"} on the Free plan.`}
      />

      {/* Delete confirmation overlay */}
      {deleteConfirmModal}
    </div>
  );
};

export default DiagramCanvas;
