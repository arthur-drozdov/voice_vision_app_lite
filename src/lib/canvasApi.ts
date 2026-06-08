// Canvas API — generates canvas content via WebSocket Gateway (Lambda → OpenClaw)
import { CanvasBoard, updateBoard } from "@/lib/canvasStore";

const PROD_WS_URL = 'wss://184z3y4uxi.execute-api.us-east-1.amazonaws.com/prod';

/**
 * Sends a canvas board's messages through the WebSocket to Lambda for AI generation.
 * Opens a one-shot connection, sends the request, waits for the response, then closes.
 */
export async function generateCanvasContent(board: CanvasBoard): Promise<void> {
  // Mark as generating
  updateBoard(board.id, { generationStatus: "generating" });

  const userId = localStorage.getItem('vv-user-id') || '';
  const wsUrl = userId
    ? `${PROD_WS_URL}?userId=${encodeURIComponent(userId)}`
    : PROD_WS_URL;

  return new Promise((resolve) => {
    const ws = new WebSocket(wsUrl);
    let resolved = false;

    const done = () => {
      if (resolved) return;
      resolved = true;
      try { ws.close(); } catch {}
      resolve();
    };

    const timeout = setTimeout(() => {
      console.error("[canvasApi] Canvas generation timed out");
      updateBoard(board.id, { generationStatus: "error" });
      done();
    }, 120000); // 2 min timeout

    ws.onopen = () => {
      console.log("[canvasApi] Connected for canvas generation");
      ws.send(JSON.stringify({
        type: 'canvas_generate',
        messages: board.messages,
        format: board.format,
        characterName: board.characterName,
        character: board.characterId || 'luna',
      }));
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        
        if (msg.type === 'canvas_generated') {
          console.log("[canvasApi] Received canvas:", msg.format);
          clearTimeout(timeout);
          updateBoard(board.id, {
            generationStatus: "ready",
            generatedContent: msg.content,
            structuredData: msg.structured ?? undefined,
          });
          done();
        } else if (msg.type === 'error') {
          console.error("[canvasApi] Generation error:", msg.error);
          clearTimeout(timeout);
          updateBoard(board.id, { generationStatus: "error" });
          done();
        }
        // Ignore hello/pong/other messages
      } catch {
        // Skip non-JSON messages
      }
    };

    ws.onerror = () => {
      console.error("[canvasApi] WebSocket error during canvas generation");
      clearTimeout(timeout);
      updateBoard(board.id, { generationStatus: "error" });
      done();
    };

    ws.onclose = () => {
      if (!resolved) {
        console.warn("[canvasApi] WebSocket closed before canvas response");
        clearTimeout(timeout);
        updateBoard(board.id, { generationStatus: "error" });
        done();
      }
    };
  });
}
