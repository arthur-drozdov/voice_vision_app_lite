# Chat History Restructure — Implementation Plan

## Overview
Replace the inline sessions tab bar with a dedicated Chat History page, fix session logic so one session = one history entry, and add delete with confirmation.

---

## Step 1: Create `src/pages/ChatHistory.tsx`
A new full-screen page listing all past sessions.

**Design:**
- Header: "Chat History" title with a back button (goes to `/chat`)
- List: glass cards for each session showing:
  - Character emoji (large, left side)
  - Session title (bold, from first user message)
  - Character name + date (subtle metadata line with the same `bg-background/60` highlight used on Canvas)
  - 1-line message preview (first agent response, truncated)
- Tapping a card: saves `{ sessionId }` to `localStorage["pending-load-session"]`, navigates to `/chat`
- Delete: trash icon on each card. On tap → confirmation modal:
  > "This will permanently delete this conversation. This cannot be undone."
  > [Keep it] [Delete]
  (Same delete modal style as DiagramCanvas)
- Empty state: centered icon + "No chat history yet" message

## Step 2: Add `/history` route in `App.tsx`
- Import `ChatHistory` from `@/pages/ChatHistory`
- Add `<Route path="/history" element={<ChatHistory />} />`

## Step 3: Modify `ChatAgent.tsx` header
**Remove:**
- The entire sessions tab bar (lines 489-513) — the `{sessions.length > 0 && (...)}` block
- The `sessions` state (`useState<ChatSession[]>`) and all `setSessions(...)` calls
- The `loadSession()` function (no longer needed here — handled by ChatHistory page)

**Add to header (right side):**
- "New Chat" button: small pill `[+ New]` — calls `handleNewChat()`
- "History" button: Clock icon — navigates to `/history`
- Keep existing "End Session" and Settings buttons

**New header layout:**
```
[Avatar + Name + Status]        [+ New] [🕐] [End Session] [⚙]
```

## Step 4: Fix session load on mount (`ChatAgent.tsx`)
**Current issue:** On remount, `sessionIdRef` gets a new `Date.now()`, potentially creating duplicate entries. Fix:

1. At top of the mount `useEffect`, check `localStorage["pending-load-session"]` first:
   - If found: load that session's messages/character from chatHistoryStore, set `sessionIdRef` to that session's ID, clear the key, skip character select
2. Then check `localStorage["active-chat-session"]` (existing logic) — restores in-progress conversation
3. Fallback: show character select (new session)

Also update `handleNewChat()`:
- Save current session via `autoSaveSession`
- Clear `ACTIVE_CHAT_KEY`
- Generate new `sessionIdRef`
- Clear `messages` to `[]`
- Show character select screen

## Step 5: Fix auto-save logic (`ChatAgent.tsx`)
The `autoSaveSession` function already uses `upsertSession` which updates by `sessionIdRef.current`. The fix is ensuring `sessionIdRef` stays stable:
- On mount restore: always set `sessionIdRef` from the restored session
- On new chat: generate ONE new ID and keep it
- Remove `setSessions(...)` calls since the tab bar is gone

## Step 6: Handle "return after closing app" = new session
**Current:** On mount, restores the last active session from `localStorage["active-chat-session"]`. This means the user picks up where they left off.
**Fix:** Keep this behavior (it's what users expect). A "new session" only happens when user explicitly taps "New Chat". The user's original complaint was about duplicated entries, not about restoring.

---

## Files changed:
1. **NEW** `src/pages/ChatHistory.tsx` — full history page
2. **EDIT** `src/App.tsx` — add `/history` route
3. **EDIT** `src/pages/ChatAgent.tsx` — remove tab bar, add header buttons, fix mount logic
4. **No changes** to `chatHistoryStore.ts` — upsert logic is already correct
