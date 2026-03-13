// Canvas API — calls /generate-canvas on the Python backend
import { CanvasBoard, updateBoard, type StructuredData } from "@/lib/canvasStore";

const BACKEND_URL = import.meta.env.VITE_PYTHON_BACKEND_URL ?? "http://127.0.0.1:8080";

interface GenerateCanvasResponse {
  content: string;
  structured: StructuredData | null;
  format: string;
}

/**
 * Sends a canvas board's messages to the Python backend for AI generation.
 * Updates the board in localStorage with the result.
 */
export async function generateCanvasContent(board: CanvasBoard): Promise<void> {
  // Mark as generating
  updateBoard(board.id, { generationStatus: "generating" });

  try {
    const response = await fetch(`${BACKEND_URL}/generate-canvas`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: board.messages,
        format: board.format,
        character_name: board.characterName,
        custom_description: board.customDescription ?? null,
        existing_structured_data: board.structuredData ?? null,
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Backend error: ${response.status} — ${err}`);
    }

    const data: GenerateCanvasResponse = await response.json();

    updateBoard(board.id, {
      generationStatus: "ready",
      generatedContent: data.content,
      structuredData: data.structured ?? undefined,
    });
  } catch (err) {
    console.error("[canvasApi] generateCanvasContent failed:", err);
    updateBoard(board.id, { generationStatus: "error" });
  }
}
