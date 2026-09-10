import asyncio
import json
import logging
import os
import sys
import shutil
import tempfile
import base64
from pathlib import Path
from contextlib import asynccontextmanager
from fastapi import (
    FastAPI,
    WebSocket,
    WebSocketDisconnect,
    File,
    UploadFile,
    Form,
    HTTPException,
)
from fastapi.websockets import WebSocketState
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
import numpy as np
from pydantic import BaseModel

# Internal imports
from services.voice_store import get_voice_store
from audio_utils import load_wav_to_floats

# Set Tavily API key
os.environ.setdefault(
    "TAVILY_API_KEY", "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"
)

# LangSmith tracing — DISABLED to eliminate per-call network latency.
os.environ["LANGSMITH_TRACING"] = "false"
os.environ.setdefault("LANGSMITH_ENDPOINT", "https://eu.api.smith.langchain.com")
os.environ.setdefault(
    "LANGSMITH_API_KEY", "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"
)
os.environ.setdefault("LANGSMITH_PROJECT", "Olaph")

from deepagents import create_deep_agent
from langgraph.checkpoint.sqlite.aio import AsyncSqliteSaver
import aiosqlite
from langchain_openai import ChatOpenAI
from langchain_core.tools import BaseTool
from langchain_core.messages import (
    HumanMessage,
    AIMessage,
    SystemMessage,
    ToolMessage,
    ToolCall,
)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("python_bridge")

from pydantic import BaseModel, Field


class VisionInput(BaseModel):
    """Input for the Vision tool — no arguments needed."""
    pass


class SearchInput(BaseModel):
    """Input for the Search tool."""
    query: str = Field(description="The search query to look up on the web")


class CameraVision(BaseTool):
    name: str = "Vision"
    description: str = "Use this tool to see the most recent frame from the user's camera when they ask you what you see. It returns the image data."
    args_schema: type = VisionInput

    def _run(self) -> list[dict]:
        frame_path = os.path.join(os.getcwd(), "latest_frame.jpg")
        if not os.path.exists(frame_path):
            return [{"type": "text", "text": "The camera frame is not available yet."}]

        try:
            with open(frame_path, "rb") as f:
                image_bytes = f.read()
            b64_img = base64.b64encode(image_bytes).decode("utf-8")
            return [
                {
                    "type": "text",
                    "text": "Here is the most recent snapshot from the user's camera:",
                },
                {
                    "type": "image_url",
                    "image_url": {"url": f"data:image/jpeg;base64,{b64_img}"},
                },
            ]
        except Exception as e:
            return [{"type": "text", "text": f"Error reading camera frame: {e}"}]


class TavilySearch(BaseTool):
    name: str = "Search"
    description: str = "Use this tool to search the web for current information, news, facts, weather forecasts, prices, availability, or any topic that requires up-to-date online information. Returns search results with relevant content and sources."
    args_schema: type = SearchInput

    def _run(self, query: str) -> str:
        import concurrent.futures
        from tavily import TavilyClient

        api_key = os.environ.get(
            "TAVILY_API_KEY",
            "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",
        )
        client = TavilyClient(api_key=api_key)
        try:
            # Use a thread with timeout to prevent Tavily from hanging
            with concurrent.futures.ThreadPoolExecutor() as executor:
                future = executor.submit(client.search, query=query, max_results=5)
                response = future.result(timeout=15)  # 15 second timeout
            results = response.get("results", [])
            if not results:
                return "No search results found."

            formatted_results = []
            for i, result in enumerate(results[:5], 1):
                title = result.get("title", "No title")
                content = result.get("content", "No content")
                url = result.get("url", "No URL")
                formatted_results.append(
                    f"{i}. **{title}**\n   {content}\n   Source: {url}"
                )

            return "\n\n".join(formatted_results)
        except concurrent.futures.TimeoutError:
            return "Search timed out after 15 seconds. Please try a more specific query."
        except Exception as e:
            return f"Search error: {e}"


@asynccontextmanager
async def lifespan(app: FastAPI):
    global agent, _base_model, _checkpointer
    try:
        # Build ChatOpenAI pointing directly at the custom Qwen-compatible server.
        # OPENAI_API_KEY can be any non-empty string (e.g. "pancakes") — the server
        # doesn't validate it, but the client library requires it to be set.
        _llm_base_url = os.environ.get("LLM_BASE_URL", "http://127.0.0.1:8000/v1")
        _base_model = ChatOpenAI(
            model="Qwen/Qwen3.5-122B-A10B-FP8",
            base_url=_llm_base_url,
            api_key=os.environ.get("OPENAI_API_KEY", "pancakes"),
            streaming=True,
            extra_body={"chat_template_kwargs": {"enable_thinking": False}},
        )
        logger.info(
            f"Model: Qwen/Qwen3.5-122B-A10B-FP8 @ {_llm_base_url}"
        )

        system_prompt = (
            "You are a helpful and concise voice assistant. "
            "You have access to a tool called 'Vision' which returns the latest camera snapshot from the user. "
            "If the user asks a vision-related question (e.g. 'what do you see?'), you MUST call the Vision tool to see the image. "
            "When analyzing the image, describe what is visibly present as if you are naturally seeing it. "
            "IMPORTANT: This is a voice assistant. NEVER use markdown formatting (no **bold**, *italic*, # headers, - lists, or code blocks). "
            "Speak naturally as if you are talking to someone. Use complete sentences and plain text only. "
            "Do not use any special formatting symbols that would sound awkward when read aloud."
        )

        tools_list = [CameraVision(), TavilySearch()]
        _tools_dict.clear()
        _tools_dict.update({tool.name: tool for tool in tools_list})

        # Persistent SQLite checkpointer — conversations survive backend restarts
        db_path = os.path.join(os.getcwd(), "data", "conversations.db")
        os.makedirs(os.path.dirname(db_path), exist_ok=True)
        _sqlite_conn = await aiosqlite.connect(db_path)
        _checkpointer = AsyncSqliteSaver(conn=_sqlite_conn)
        await _checkpointer.setup()
        logger.info(f"Persistent conversation DB: {db_path}")

        agent = create_deep_agent(
            model=_base_model,
            system_prompt=system_prompt,
            tools=tools_list,
            checkpointer=_checkpointer,
        )
        logger.info("Agent initialised with create_deep_agent (persistent SQLite checkpointer)")
        logger.info(f"Tools registered: {list(_tools_dict.keys())}")
    except Exception as e:
        logger.error(f"Failed to initialize agent: {e}")
        raise
    yield
    # Cleanup: close the SQLite connection
    if _checkpointer and hasattr(_checkpointer, 'conn') and _checkpointer.conn:
        try:
            await _checkpointer.conn.close()
            logger.info("SQLite checkpointer closed")
        except Exception as e:
            logger.warning(f"Error closing checkpointer: {e}")


# Shared model instance — set during lifespan startup, reused for fallback calls
_base_model = None
# Persistent checkpointer — set during lifespan startup
_checkpointer = None

app = FastAPI(lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global variable to track the current agent task for cancellation
current_agent_task: asyncio.Task | None = None

# Global character/tone system prompt — set by /set-character endpoint (used by Video/LLMRTC)
global_system_prompt: str | None = None

# Global tools dictionary — populated in lifespan from tools list
_tools_dict: dict[str, BaseTool] = {}


# ── Shared Multi-Agent Conversation Memory ──────────────────────────────────────

class SharedConversationMemory:
    """
    Thread-safe shared memory store for multi-agent conversations.

    All agents in the same conversation share a single message history
    keyed by `conversation_id`. Each AIMessage is tagged with the agent
    name that produced it, so agents can see what other agents said.

    This is separate from the LangGraph MemorySaver (which is per-thread).
    The shared memory is the source of truth for cross-agent awareness.
    """

    def __init__(self):
        self._store: dict[str, list] = {}  # conversation_id -> messages
        self._summaries: dict[str, str] = {}  # conversation_id -> working memory summary
        self._lock = asyncio.Lock()

    async def get_messages(self, conversation_id: str) -> list:
        """Get all messages for a conversation."""
        async with self._lock:
            return list(self._store.get(conversation_id, []))

    async def add_messages(self, conversation_id: str, messages: list):
        """Append messages to a conversation's shared history."""
        async with self._lock:
            if conversation_id not in self._store:
                self._store[conversation_id] = []
            self._store[conversation_id].extend(messages)
            logger.info(
                f"[SHARED_MEMORY] Added {len(messages)} messages to conversation={conversation_id}, "
                f"total={len(self._store[conversation_id])}"
            )

    async def get_summary(self, conversation_id: str) -> str | None:
        """Get the working memory summary for a conversation."""
        async with self._lock:
            return self._summaries.get(conversation_id)

    async def set_summary(self, conversation_id: str, summary: str):
        """Set the working memory summary for a conversation."""
        async with self._lock:
            self._summaries[conversation_id] = summary
            logger.info(
                f"[SHARED_MEMORY] Updated summary for conversation={conversation_id}: {summary[:80]}..."
            )

    async def get_conversation_info(self, conversation_id: str) -> dict:
        """Get debug info about a conversation."""
        async with self._lock:
            messages = self._store.get(conversation_id, [])
            agents_seen = set()
            for msg in messages:
                if isinstance(msg, AIMessage) and hasattr(msg, "name") and msg.name:
                    agents_seen.add(msg.name)
            return {
                "conversation_id": conversation_id,
                "message_count": len(messages),
                "agents": list(agents_seen),
                "has_summary": conversation_id in self._summaries,
            }

    async def list_conversations(self) -> list[dict]:
        """List all active conversations with basic info."""
        async with self._lock:
            result = []
            for cid, msgs in self._store.items():
                agents_seen = set()
                for msg in msgs:
                    if isinstance(msg, AIMessage) and hasattr(msg, "name") and msg.name:
                        agents_seen.add(msg.name)
                result.append({
                    "conversation_id": cid,
                    "message_count": len(msgs),
                    "agents": list(agents_seen),
                })
            return result


# Singleton shared memory instance
shared_memory = SharedConversationMemory()


class VisionPayload(BaseModel):
    video_base64: str
    format: str


class CharacterPayload(BaseModel):
    system_prompt: str


@app.post("/set-character")
async def set_character(payload: CharacterPayload):
    """Set the active character + tone system prompt (called by VideoAgent before starting a call)."""
    global global_system_prompt
    global_system_prompt = payload.system_prompt
    logger.info("Global character system prompt updated via /set-character")
    return {"status": "ok"}


@app.post("/vision")
async def process_vision(payload: VisionPayload):
    try:
        frame_path = os.path.join(os.getcwd(), "latest_frame.jpg")
        image_data = base64.b64decode(payload.video_base64)

        with open(frame_path, "wb") as f:
            f.write(image_data)

        return {"status": "saved"}
    except Exception as e:
        logger.error(f"Vision endpoint error: {e}")
        return {"error": str(e)}


async def execute_tool(tool_call: dict, tools_dict: dict[str, BaseTool]) -> ToolMessage:
    """Execute a single tool call and return the result as a ToolMessage."""
    tool_name = tool_call.get("name", "")
    tool_args = tool_call.get("args", {})
    tool_id = tool_call.get("id", f"tool_{os.urandom(8).hex()}")

    logger.info(f"[TOOL EXEC] Calling tool: {tool_name} with args: {tool_args}")

    if tool_name not in tools_dict:
        error_msg = f"Tool '{tool_name}' not found"
        logger.error(f"[TOOL EXEC] {error_msg}")
        return ToolMessage(content=error_msg, tool_call_id=tool_id, name=tool_name)

    tool = tools_dict[tool_name]
    try:
        result = tool.invoke(tool_args) if tool_args else tool.invoke({})
        result_str = str(result) if not isinstance(result, str) else result
        logger.info(f"[TOOL EXEC] Tool {tool_name} executed successfully")
        return ToolMessage(content=result_str, tool_call_id=tool_id, name=tool_name)
    except Exception as e:
        error_msg = f"Error executing tool {tool_name}: {str(e)}"
        logger.error(f"[TOOL EXEC] {error_msg}")
        return ToolMessage(content=error_msg, tool_call_id=tool_id, name=tool_name)


async def orchestrator_invoke(
    messages: list,
    config: dict,
    tools_dict: dict[str, BaseTool],
    model,
    max_iterations: int = 5,
    agent_name: str | None = None,
    websocket: WebSocket | None = None,
) -> tuple[str, list]:
    """
    Orchestrator loop that:
    1. Calls LLM with current messages
    2. Checks if response has tool_calls
    3. If yes: executes all tools, adds ToolMessages, calls LLM again
    4. If no: this is the final response
    5. Max iterations to prevent infinite loops
    6. Tags AIMessages with agent_name for multi-agent awareness
    7. Sends tool_call WebSocket signals so the frontend can show progress

    Returns: (final_text, new_messages_only)
    new_messages_only contains only the NEW messages added during this turn
    (user message + AI response + any tool messages)
    """
    logger.info(
        f"[ORCHESTRATOR] Starting with {len(messages)} messages, max_iterations={max_iterations}"
    )

    all_messages: list = list(messages)
    new_messages: list = []
    final_text: str = ""
    iteration = 0

    async def _send_tool_signal(tool_name: str, status: str):
        """Send a tool_call signal to the frontend if websocket is available."""
        if websocket and websocket.application_state == WebSocketState.CONNECTED:
            try:
                await websocket.send_json({"tool_call": tool_name, "status": status})
            except Exception as e:
                logger.warning(f"Failed to send tool signal: {e}")

    while iteration < max_iterations:
        iteration += 1
        logger.info(f"[ORCHESTRATOR] Iteration {iteration}/{max_iterations}")

        try:
            # Bind tools to the model so it can generate tool_calls
            model_with_tools = model.bind_tools(list(tools_dict.values())) if tools_dict else model
            response = await model_with_tools.ainvoke(all_messages)
        except Exception as e:
            logger.error(f"[ORCHESTRATOR] LLM invoke error: {e}")
            raise

        # Tag the AIMessage with the agent name for multi-agent awareness
        if agent_name and isinstance(response, AIMessage):
            response.name = agent_name
        all_messages.append(response)
        new_messages.append(response)

        tool_calls = getattr(response, "tool_calls", None)
        if not tool_calls or len(tool_calls) == 0:
            logger.info(f"[ORCHESTRATOR] No tool calls found - final response")
            final_text = response.content if hasattr(response, "content") else ""
            if isinstance(final_text, list):
                final_text = str(final_text)
            break

        logger.info(f"[ORCHESTRATOR] Found {len(tool_calls)} tool calls")

        for tool_call in tool_calls:
            tool_name = tool_call.get('name', 'unknown')
            await _send_tool_signal(tool_name, "running")
            tool_msg = await execute_tool(tool_call, tools_dict)
            await _send_tool_signal(tool_name, "done")
            all_messages.append(tool_msg)
            new_messages.append(tool_msg)
            logger.info(
                f"[ORCHESTRATOR] Added ToolMessage for {tool_name}"
            )

    if not final_text and all_messages:
        for msg in reversed(all_messages):
            if isinstance(msg, AIMessage) and hasattr(msg, "content"):
                final_text = msg.content
                if isinstance(final_text, list):
                    final_text = str(final_text)
                break

    logger.info(
        f"[ORCHESTRATOR] Complete - {iteration} iterations, final_text length: {len(final_text)}"
    )
    logger.info(
        f"[ORCHESTRATOR] Returning {len(new_messages)} new messages for storage"
    )
    return final_text, new_messages


@app.websocket("/chat")
async def chat_endpoint(websocket: WebSocket):
    await websocket.accept()
    global current_agent_task
    logger.info("Client connected to Python bridge")

    session_system_prompt: str | None = None
    session_thread_id = "default_session"
    conversation_id: str | None = None  # shared conversation ID for multi-agent
    agent_name: str | None = None  # current agent name (e.g. "kai", "eden")
    message_count = 0
    memory_summary: str | None = None

    try:
        while True:
            data = await websocket.receive_text()
            payload = json.loads(data)

            if "system_prompt" in payload and payload["system_prompt"]:
                session_system_prompt = payload["system_prompt"]
                logger.info("Session system prompt updated")

            if "thread_id" in payload and payload["thread_id"]:
                session_thread_id = payload["thread_id"]

            # Multi-agent: read agent name and conversation ID from payload
            if "agent_name" in payload and payload["agent_name"]:
                agent_name = payload["agent_name"]
            # conversation_id groups multiple agents in the same conversation
            # Falls back to thread_id if not provided
            if "conversation_id" in payload and payload["conversation_id"]:
                conversation_id = payload["conversation_id"]
            elif not conversation_id:
                conversation_id = session_thread_id

            user_text = payload.get("text", "")

            if not user_text:
                continue

            logger.info(f"User: {user_text}")
            message_count += 1

            if current_agent_task and not current_agent_task.done():
                logger.info("Cancelling previous agent task due to new request")
                current_agent_task.cancel()
                try:
                    await current_agent_task
                except asyncio.CancelledError:
                    pass

            active_prompt = session_system_prompt or global_system_prompt
            config = {"configurable": {"thread_id": session_thread_id}}

            # ── Load shared conversation memory ─────────────────────────────
            # Shared memory is the source of truth for cross-agent awareness.
            # It stores ALL messages from ALL agents in the conversation.
            shared_messages = await shared_memory.get_messages(conversation_id)
            shared_summary = await shared_memory.get_summary(conversation_id)

            # Also try LangGraph's per-thread checkpointer as a fallback
            try:
                previous_state = agent.get_state(config)
                checkpointer_messages = previous_state.values.get("messages", [])
                logger.info(
                    f"[HISTORY] Retrieved {len(checkpointer_messages)} messages from checkpointer thread_id={session_thread_id}"
                )
            except Exception as e:
                logger.warning(f"Could not retrieve checkpointer state: {e}")
                checkpointer_messages = []

            # Use shared memory if available, fall back to checkpointer
            existing_messages = shared_messages if shared_messages else checkpointer_messages

            # Fallback: If no server-side history, use frontend-sent history
            # This handles the case where the backend restarted (MemorySaver is in-memory)
            # or the user loaded a session from chat history
            frontend_history = payload.get("history", [])
            if not existing_messages and frontend_history:
                logger.info(
                    f"[HISTORY] No server-side history found. Using {len(frontend_history)} "
                    f"messages from frontend history"
                )
                for msg in frontend_history:
                    role = msg.get("role", "")
                    text = msg.get("text", "")
                    if not text:
                        continue
                    if role == "user":
                        existing_messages.append(HumanMessage(content=text))
                    elif role == "agent":
                        existing_messages.append(AIMessage(content=text))

            logger.info(
                f"[HISTORY] Using {'shared_memory' if shared_messages else 'checkpointer' if checkpointer_messages else 'frontend_history' if frontend_history else 'none'} "
                f"with {len(existing_messages)} messages for conversation={conversation_id}, "
                f"agent={agent_name or 'unknown'}"
            )

            messages = []

            # ALWAYS include the system prompt — not just on first message.
            # Without this, the agent loses its identity after the first turn.
            if active_prompt:
                messages.append(SystemMessage(content=active_prompt))
                logger.info("[SYSTEM] System prompt included in messages")

            # Inject working memory summary from shared memory
            effective_summary = shared_summary or memory_summary
            if len(existing_messages) > 20 and effective_summary:
                summary_msg = SystemMessage(
                    content=f"CONVERSATION SUMMARY: {effective_summary}"
                )
                messages.append(summary_msg)
                logger.info("[MEMORY] Summary injected into context")

            messages.extend(existing_messages)
            messages.append(HumanMessage(content=user_text))

            # Verify message integrity before sending to LLM
            human_count = sum(1 for m in messages if isinstance(m, HumanMessage))
            ai_count = sum(1 for m in messages if isinstance(m, AIMessage))
            system_count = sum(1 for m in messages if isinstance(m, SystemMessage))
            logger.info(
                f"[VERIFY] Message composition: {system_count} system, "
                f"{human_count} human, {ai_count} assistant, "
                f"{len(messages)} total"
            )

            # CRITICAL DEBUG: Log EVERY message in the array
            logger.info("=" * 80)
            logger.info(
                f"[LLM REQUEST] FULL MESSAGES ARRAY - Total: {len(messages)} messages"
            )
            logger.info(f"[LLM REQUEST] session_thread_id: {session_thread_id}")
            logger.info(f"[LLM REQUEST] conversation_id: {conversation_id}")
            logger.info(f"[LLM REQUEST] agent_name: {agent_name or 'not set'}")
            logger.info(
                f"[LLM REQUEST] message_count in this connection: {message_count}"
            )
            logger.info("=" * 80)

            for i, msg in enumerate(messages):
                msg_type = type(msg).__name__
                msg_name = getattr(msg, "name", None)
                name_tag = f" (agent={msg_name})" if msg_name else ""
                content = msg.content if hasattr(msg, "content") else str(msg)
                if isinstance(content, list):
                    content = str(content)

                # Show full content for system messages, preview for others
                if isinstance(msg, SystemMessage) or len(str(content)) < 200:
                    content_display = content
                else:
                    content_display = content[:200].replace("\n", " ") + "..."

                logger.info(f"  [{i}] {msg_type}{name_tag}: {content_display}")

            logger.info("=" * 80)

            full_text = ""
            timed_out = False

            try:
                async with asyncio.timeout(120):
                    full_text, updated_messages = await orchestrator_invoke(
                        messages=messages,
                        config=config,
                        tools_dict=_tools_dict,
                        model=_base_model,
                        max_iterations=5,
                        agent_name=agent_name,
                        websocket=websocket,
                    )

                    if updated_messages:
                        # Save BOTH the user message AND AI response to shared memory
                        user_msg = HumanMessage(content=user_text)
                        await shared_memory.add_messages(
                            conversation_id, [user_msg] + updated_messages
                        )

                        # Save BOTH the user message AND AI response to checkpointer
                        # BUG FIX: Previously only saved updated_messages (AI+tool),
                        # which meant the checkpointer had no HumanMessages.
                        # This caused history to be [A1, A2, A3] with no user context.
                        messages_to_store = [user_msg] + updated_messages
                        try:
                            logger.info(
                                f"[STORE] Saving {len(messages_to_store)} messages "
                                f"(1 user + {len(updated_messages)} AI/tool) to checkpointer"
                            )
                            result = await agent.aupdate_state(
                                config, {"messages": messages_to_store}, as_node="__end__"
                            )
                            logger.info(
                                f"[STORE] aupdate_state returned: {type(result)}"
                            )

                            # VERIFY: read back the state to confirm it was saved
                            verify_state = agent.get_state(config)
                            verify_msgs = verify_state.values.get("messages", [])
                            verify_human = sum(1 for m in verify_msgs if isinstance(m, HumanMessage))
                            verify_ai = sum(1 for m in verify_msgs if isinstance(m, AIMessage))
                            logger.info(
                                f"[STORE] VERIFIED checkpointer now has {len(verify_msgs)} messages "
                                f"({verify_human} human, {verify_ai} AI)"
                            )
                        except Exception as store_err:
                            logger.error(
                                f"Failed to store messages: {store_err}", exc_info=True
                            )

                    if message_count % 20 == 0 and updated_messages:
                        try:
                            summary_prompt = SystemMessage(
                                content=(
                                    "Summarize this conversation in 2-3 sentences. "
                                    "Include key topics, decisions, and user preferences. "
                                    "Note which agents were involved if multiple. "
                                    "Keep it under 200 words."
                                )
                            )
                            summary_response = await _base_model.ainvoke(
                                [summary_prompt] + updated_messages[-10:]
                            )
                            memory_summary = (
                                summary_response.content
                                if hasattr(summary_response, "content")
                                else ""
                            )
                            if isinstance(memory_summary, list):
                                memory_summary = str(memory_summary)
                            logger.info(
                                f"[MEMORY] Generated summary: {memory_summary[:100]}..."
                            )
                            # Store summary in shared memory for cross-agent access
                            await shared_memory.set_summary(conversation_id, memory_summary)
                        except Exception as summary_err:
                            logger.warning(f"Failed to generate summary: {summary_err}")

            except asyncio.TimeoutError:
                logger.error("Orchestrator timed out after 120s")
                timed_out = True
                full_text = "Sorry, that took too long. Please try again."
            except Exception as e:
                logger.error(f"Orchestrator error: {e}", exc_info=True)

            if full_text and websocket.application_state == WebSocketState.CONNECTED:
                try:
                    chunk_size = 50
                    for i in range(0, len(full_text), chunk_size):
                        chunk = full_text[i : i + chunk_size]
                        await websocket.send_json({"chunk": chunk, "source": "main"})
                        await asyncio.sleep(0.02)

                    await websocket.send_json({"done": True})
                    logger.info(f"[RESPONSE] Sent {len(full_text)} chars to client")
                except Exception as send_error:
                    logger.error(f"WebSocket send failed: {send_error}")
            elif not timed_out:
                if websocket.application_state == WebSocketState.CONNECTED:
                    await websocket.send_json({"done": True})

    except WebSocketDisconnect:
        logger.info("Client disconnected normally")
    except Exception as e:
        logger.error(f"WebSocket Error: {e}")
    finally:
        if current_agent_task and not current_agent_task.done():
            current_agent_task.cancel()
            try:
                await current_agent_task
            except asyncio.CancelledError:
                pass
        logger.info("Client disconnected from Python bridge")


# ── Conversation Title Generation ───────────────────────────────────────────────


class GenerateTitleRequest(BaseModel):
    messages: list[dict]  # [{role: "user"|"agent", text: "..."}]
    agent_name: str = "AI"


@app.post("/api/generate-title")
async def generate_title(req: GenerateTitleRequest):
    """Generate a short descriptive conversation title using the LLM."""
    if not _base_model or len(req.messages) < 2:
        # Fallback: first user message, truncated
        first_user = next((m["text"] for m in req.messages if m["role"] == "user"), "Chat")
        words = first_user.strip().split()[:6]
        return {"title": " ".join(words)}

    # Build a compact transcript for the LLM
    transcript_lines = []
    for m in req.messages[:10]:  # limit to first 10 messages
        speaker = "User" if m["role"] == "user" else req.agent_name
        transcript_lines.append(f"{speaker}: {m['text'][:200]}")
    transcript = "\n".join(transcript_lines)

    prompt = SystemMessage(
        content=(
            "You are an intelligent assistant specialized in creating names for chat sessions. "
            "Generate concise, creative, descriptive, and context-aware names that reflect "
            "the main topic, tone, or purpose of the conversation.\n\n"
            "Instructions:\n"
            "1. Generate 3 unique name options for this chat session.\n"
            "2. Each name should be 2-5 words long, concise, easy to read, "
            "and capture the main topic or theme.\n"
            "3. Names can be playful, metaphorical, witty, or professional depending on content.\n"
            "4. Avoid generic names like 'Chat 1' or 'Session'.\n"
            "5. If the conversation covers multiple topics, prioritize the most prominent one.\n"
            "6. Return ONLY valid JSON in this format:\n"
            '{"names":[{"name":"<Name>","tone":"<Tone>","keywords":["kw1","kw2"]}]}\n\n'
            f"Conversation:\n{transcript}"
        )
    )

    try:
        response = await _base_model.ainvoke([prompt])
        raw = response.content.strip()
        # Try to parse JSON response
        import json
        # Extract JSON from response (may have markdown fencing)
        json_str = raw
        if "```" in raw:
            json_str = raw.split("```")[1]
            if json_str.startswith("json"):
                json_str = json_str[4:]
        data = json.loads(json_str.strip())
        names = data.get("names", [])
        if names:
            # Pick the first name (usually the best)
            title = names[0].get("name", "").strip()
            if title and len(title) <= 60:
                return {"title": title, "alternatives": [n.get("name", "") for n in names[1:]]}
        # Fallback: use raw response as title
        title = raw.strip().strip('"\'').strip()
        if len(title) > 60:
            title = " ".join(title.split()[:6])
        return {"title": title}
    except Exception as e:
        logger.warning(f"Failed to generate title: {e}")
        first_user = next((m["text"] for m in req.messages if m["role"] == "user"), "Chat")
        words = first_user.strip().split()[:6]
        return {"title": " ".join(words)}


# ── Shared Memory Debug Endpoints ───────────────────────────────────────────────

@app.get("/api/shared-memory")
async def list_shared_conversations():
    """List all conversations in shared memory with agent info."""
    conversations = await shared_memory.list_conversations()
    return {"conversations": conversations}


@app.get("/api/shared-memory/{conversation_id}")
async def get_shared_conversation(conversation_id: str):
    """Get full shared memory for a conversation (debug endpoint)."""
    info = await shared_memory.get_conversation_info(conversation_id)
    messages = await shared_memory.get_messages(conversation_id)
    summary = await shared_memory.get_summary(conversation_id)

    formatted_messages = []
    for msg in messages:
        entry = {
            "type": type(msg).__name__,
            "content": msg.content if hasattr(msg, "content") else str(msg),
        }
        if hasattr(msg, "name") and msg.name:
            entry["agent"] = msg.name
        formatted_messages.append(entry)

    return {
        **info,
        "summary": summary,
        "messages": formatted_messages,
    }


# Voice Cloning Endpoints


@app.get("/api/voice-cloning/voices")
async def list_voices():
    try:
        store = get_voice_store()
        voices = store.list_all()
        return voices
    except Exception as e:
        logger.error(f"Error listing voices: {e}")
        return []


import traceback


async def transcribe_with_spark_asr(audio_path: str) -> str:
    """Transcribe an audio file using the Spark ASR WebSocket server."""
    import websockets

    asr_url = os.environ.get(
        "STT_SERVER_URL", "ws://127.0.0.1:8002/ws/asr"
    )
    if not asr_url.endswith("/ws/asr"):
        # If it doesn't end with /ws/asr, check if it's just the host:port
        if asr_url.count("/") < 3:  # ws://host:port case
            asr_url = asr_url.rstrip("/") + "/ws/asr"

    logger.info(f"Connecting to Spark ASR at {asr_url}...")

    try:
        # Load and resample to 16kHz for Spark ASR
        audio, sr = librosa.load(audio_path, sr=16000)

        async with websockets.connect(asr_url) as ws:
            # Send audio in chunks
            chunk_size = 8000  # 0.5s chunks at 16kHz
            for i in range(0, len(audio), chunk_size):
                chunk = audio[i : i + chunk_size].astype(np.float32).tobytes()
                await ws.send(chunk)

            # Send EOS
            await ws.send(json.dumps({"event": "eos"}))

            # Collect results
            full_transcript = ""
            async for message in ws:
                data = json.loads(message)
                if data.get("event") in ["text", "final"]:
                    text = data.get("text", "")
                    if data.get("event") == "final":
                        full_transcript = text
                        break
                    full_transcript = text

            return full_transcript.strip()
    except Exception as e:
        logger.error(f"Spark ASR error: {e}")
        return ""


async def synthesize_with_spark_tts(
    text: str,
    voice_id: str | None = None,
    ref_audio_data: np.ndarray | None = None,
    ref_text: str | None = None,
) -> tuple[np.ndarray, int]:
    """Synthesize text to speech using Spark TTS server."""
    import websockets
    from services.voice_store import get_voice_store

    tts_url = os.environ.get(
        "TTS_SERVER_URL", "ws://127.0.0.1:8001/ws/tts"
    )
    if not tts_url.endswith("/ws/tts"):
        if tts_url.count("/") < 3:
            tts_url = tts_url.rstrip("/") + "/ws/tts"

    global _last_synthesis_voice_id
    if not hasattr(sys.modules[__name__], "_last_synthesis_voice_id"):
        _last_synthesis_voice_id = None

    # Optimization: Only send ref_audio if it's broad-hoc or different from last time
    # matches the "video chat path" (CustomTTSProvider.ts)
    should_send_ref = (_last_synthesis_voice_id != voice_id) or (voice_id is None)

    active_ref_audio = ref_audio_data
    active_ref_text = ref_text
    ref_sr = 24000  # Default for ad-hoc (already resampled)

    if should_send_ref:
        if voice_id and (active_ref_audio is None or active_ref_text is None):
            store = get_voice_store()
            voice = store.get(voice_id)
            if not voice:
                logger.error(f"Voice {voice_id} not found for synthesis")
                return np.zeros(0), 24000

            if active_ref_audio is None:
                ref_result = store.get_reference_audio(voice_id)
                if ref_result is None:
                    logger.error(f"Reference audio file not found for voice {voice_id}")
                    return np.zeros(0), 24000
                active_ref_audio, ref_sr = ref_result
            if active_ref_text is None:
                active_ref_text = voice.reference_text

        if active_ref_audio is None or active_ref_text is None:
            logger.error("Missing reference audio or text for synthesis")
            return np.zeros(0), 24000

        # Ensure reference audio is at 24000Hz (Spark TTS target) and truncate it
        # to avoid sending 30MB+ JSON payloads over network.
        target_sr = 24000
        max_duration = 15  # 15s is more than enough for cloning

        import librosa

        try:
            if ref_sr != target_sr:
                logger.info(f"Resampling reference audio from {ref_sr} to {target_sr}")
                active_ref_audio = librosa.resample(
                    active_ref_audio, orig_sr=ref_sr, target_sr=target_sr
                )

            max_samples = max_duration * target_sr
            if len(active_ref_audio) > max_samples:
                logger.info(
                    f"Truncating reference audio from {len(active_ref_audio)} to {max_samples} samples ({max_duration}s)"
                )
                active_ref_audio = active_ref_audio[:max_samples]
        except Exception as re_e:
            logger.warning(f"Failed to optimize reference audio: {re_e}")
    else:
        logger.info(
            f"Voice {voice_id} already active on server. Skipping redundant reference load."
        )

    payload = {
        "text": text,
        "emit_every_frames": 2,
        "decode_window_frames": 24,
    }

    if should_send_ref:
        logger.info(
            f"Voice changed or first request ({voice_id}). Including reference data."
        )
        payload["ref_audio"] = active_ref_audio.tolist()
        payload["ref_text"] = active_ref_text
        _last_synthesis_voice_id = voice_id
    else:
        logger.info(
            f"Voice {voice_id} already active on server. Skipping redundant reference transfer."
        )

    logger.info(
        f"Connecting to Spark TTS at {tts_url} for voice {voice_id if voice_id else 'ad-hoc'}..."
    )

    try:
        start_time = asyncio.get_event_loop().time()
        # Add 120s timeout for the whole process (large payloads can be slow over network)
        async with asyncio.timeout(120.0):
            # 30s connection timeout for slow Handshakes
            connect_start = asyncio.get_event_loop().time()
            logger.info(f"Opening WebSocket connection to {tts_url}...")
            # Disable ping timeout as large uploads can block ping/pong
            async with websockets.connect(
                tts_url,
                max_size=100 * 1024 * 1024,
                open_timeout=30.0,
                ping_interval=None,
            ) as ws:
                logger.info(
                    f"Connected to Spark TTS in {asyncio.get_event_loop().time() - connect_start:.2f}s. Sending payload..."
                )

                send_start = asyncio.get_event_loop().time()
                # Use compact separators to reduce payload size for large float lists
                payload_str = json.dumps(payload, separators=(",", ":"))
                logger.info(
                    f"Payload JSON size: {len(payload_str) / 1024 / 1024:.2f} MB"
                )
                await ws.send(payload_str)
                logger.info(
                    f"Payload sent in {asyncio.get_event_loop().time() - send_start:.2f}s. Waiting for response..."
                )

                audio_chunks = []
                received_meta = False
                while True:
                    try:
                        # 30s timeout per message
                        message = await asyncio.wait_for(ws.recv(), timeout=30.0)

                        is_json = False
                        data = None

                        # Try to parse as JSON regardless of frame type (text or binary)
                        try:
                            content = ""
                            if isinstance(message, str):
                                content = message.strip()
                            else:
                                content = message.decode(
                                    "utf-8", errors="ignore"
                                ).strip()

                            if content.startswith("{"):
                                data = json.loads(content)
                                is_json = True
                        except:
                            pass

                        if is_json:
                            if data.get("event") == "meta":
                                logger.info(f"Received meta: {data}")
                                received_meta = True
                            elif data.get("event") == "eos":
                                break
                            elif data.get("error"):
                                logger.error(f"TTS Server Error: {data['error']}")
                                break
                        else:
                            # Binary audio chunk
                            if not received_meta:
                                continue

                            if isinstance(message, bytes):
                                # Binary audio chunk (float32)
                                chunk = np.frombuffer(message, dtype=np.float32)
                                audio_chunks.append(chunk)

                    except asyncio.TimeoutError:
                        logger.error("Timeout waiting for message from TTS server")
                        break

                logger.info(
                    f"Synthesis complete in {asyncio.get_event_loop().time() - start_time:.2f}s. Received {len(audio_chunks)} audio chunks."
                )

            if not audio_chunks:
                return np.zeros(0), 24000

            full_audio = np.concatenate(audio_chunks)
            return full_audio, 24000
    except asyncio.TimeoutError:
        logger.error(
            f"Spark TTS Timeout after {asyncio.get_event_loop().time() - start_time:.2f}s: Connection or response took too long"
        )
        return np.zeros(0), 24000
    except Exception as e:
        import traceback

        logger.error(f"Spark TTS error: {traceback.format_exc()}")
        return np.zeros(0), 24000


@app.post("/api/voice-cloning/record")
async def record_voice(
    ref_audio: UploadFile = File(...),
    name: str = Form("New Voice"),
    ref_text: str = Form(None),
):
    try:
        logger.info(f"Received recording request for name: {name}")
        with tempfile.NamedTemporaryFile(delete=False, suffix=".wav") as tmp:
            shutil.copyfileobj(ref_audio.file, tmp)
            tmp_path = tmp.name

        logger.info(f"Saved temporary recording to: {tmp_path}")

        try:
            # 1. Load audio data for storage
            audio_data, sample_rate = load_wav_to_floats(tmp_path)
            logger.info(
                f"Loaded audio successfully: {len(audio_data)} samples at {sample_rate}Hz"
            )

            # 2. Transcribe if ref_text is missing using Spark ASR
            transcript = ref_text
            if not transcript:
                logger.info("Transcribing recording with Spark ASR...")
                transcript = await transcribe_with_spark_asr(tmp_path)
                if not transcript:
                    logger.warning(
                        "Spark ASR returned empty transcript, using default."
                    )
                    transcript = "This is a recorded voice reference for cloning."
                else:
                    logger.info(f"Spark ASR Transcript: {transcript}")

            # 3. Save to voice store
            store = get_voice_store()
            logger.info(f"Using voice store at: {store.store_path}")

            if name.lower() == "default":
                reference_dir = Path.home() / ".deepagents"
                reference_dir.mkdir(parents=True, exist_ok=True)
                target_audio = reference_dir / "reference.wav"
                target_text = reference_dir / "reference.txt"
                shutil.copy2(tmp_path, target_audio)
                with open(target_text, "w") as f:
                    f.write(transcript)

                if target_audio.exists() and target_text.exists():
                    logger.info(
                        f"Successfully saved default reference files to {reference_dir}"
                    )
                else:
                    logger.error(
                        f"Failed to verify default reference files at {reference_dir}"
                    )

                voice = store.load_default_reference_voice()
            else:
                voice = store.save(
                    voice_id=None,
                    name=name,
                    reference_audio=audio_data,
                    reference_text=transcript,
                    sample_rate=sample_rate,
                )

                # Verify the file was actually written to the store
                if os.path.exists(voice.reference_audio_path):
                    logger.info(
                        f"Verified voice audio saved at: {voice.reference_audio_path}"
                    )
                else:
                    logger.error(
                        f"Voice audio path {voice.reference_audio_path} does not exist after save!"
                    )

            logger.info(f"Voice record created successfully: {voice.voice_id}")

            return {
                "voice_id": voice.voice_id,
                "name": voice.name,
                "ref_text": voice.reference_text,
            }
        except Exception as inner_e:
            logger.error(f"Error processing audio data: {traceback.format_exc()}")
            raise inner_e
        finally:
            if os.path.exists(tmp_path):
                os.remove(tmp_path)

    except Exception as e:
        logger.error(f"Error recording voice: {traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/voice-cloning/select/{voice_id}")
async def select_voice(voice_id: str):
    try:
        store = get_voice_store()
        # We'll save the selection to a special file that the LLMRTC server can read
        selection_path = Path(store.store_path) / "selected_voice.json"
        with open(selection_path, "w") as f:
            json.dump({"voice_id": voice_id}, f)

        logger.info(f"Selected voice: {voice_id}")
        return {"status": "success", "voice_id": voice_id}
    except Exception as e:
        logger.error(f"Error selecting voice: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.delete("/api/voice-cloning/voices/{voice_id}")
async def delete_voice(voice_id: str):
    try:
        store = get_voice_store()
        if store.delete(voice_id):
            return {"status": "success"}
        else:
            raise HTTPException(status_code=404, detail="Voice not found")
    except Exception as e:
        logger.error(f"Error deleting voice: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/audio/tts/preview")
async def tts_preview(payload: dict):
    try:
        import base64
        import numpy as np
        from audio_utils import save_audio_to_file

        text = payload.get("text", "Hello!")
        voice_id = payload.get("voice_id")
        ref_audio_b64 = payload.get("ref_audio_base64")
        ref_text = payload.get("ref_text")

        ref_audio_data = None
        if ref_audio_b64:
            # Decode provided reference audio
            audio_bytes = base64.b64decode(ref_audio_b64)
            with tempfile.NamedTemporaryFile(delete=False, suffix=".wav") as tmp:
                tmp.write(audio_bytes)
                tmp_audio_path = tmp.name
            try:
                from audio_utils import load_wav_to_floats
                import librosa

                # Force resample to 24000Hz to match Spark TTS expectations
                ref_audio_data, _ = librosa.load(tmp_audio_path, sr=24000)
            finally:
                if os.path.exists(tmp_audio_path):
                    os.remove(tmp_audio_path)

        if not voice_id and not ref_audio_data:
            raise HTTPException(
                status_code=400, detail="voice_id or ref_audio_base64 is required"
            )

        logger.info(
            f"Generating real preview (voice_id={voice_id}, has_ad_hoc_ref={ref_audio_data is not None})"
        )

        # 1. Synthesize real audio
        audio_data, sr = await synthesize_with_spark_tts(
            text, voice_id, ref_audio_data, ref_text
        )

        if len(audio_data) == 0:
            # Fallback to silence if synthesis failed, but log it
            logger.warning(f"Synthesis failed for {voice_id}, returning silence")
            duration = 1.0
            audio_data = np.zeros(int(sr * duration), dtype=np.float32)
            status = "failed_fallback_silence"
        else:
            duration = len(audio_data) / sr
            status = "success"

        # 2. Save to a temporary file to get a valid WAV with header
        with tempfile.NamedTemporaryFile(delete=False, suffix=".wav") as tmp:
            tmp_path = tmp.name

        try:
            save_audio_to_file(audio_data, sr, tmp_path)
            with open(tmp_path, "rb") as f:
                audio_b64 = base64.b64encode(f.read()).decode("utf-8")
        finally:
            if os.path.exists(tmp_path):
                os.remove(tmp_path)

        return {
            "audio_base64": audio_b64,
            "sample_rate": sr,
            "duration_seconds": duration,
            "status": status,
        }
    except Exception as e:
        logger.error(f"Error in TTS preview: {traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=str(e))


# ─── Canvas Generation Endpoint ──────────────────────────────────────────────

FORMAT_SYSTEM_PROMPTS = {
    "mindmap": (
        "You are a THOROUGH mind-map generator. Your job is to transform a conversation "
        "into a rich, detailed, hierarchical mind map that captures EVERY important element.\n\n"
        "CRITICAL: Before generating, carefully re-read the ENTIRE conversation. "
        "Do NOT skip details. Do NOT summarise. Extract EVERYTHING.\n\n"
        "Return ONLY valid JSON in this exact shape:\n"
        '{"label":"Central Topic", "id":"root", "children":['
        '{"label":"emoji Category","id":"c1","children":['
        '{"label":"Sub-idea","id":"c1_1","children":[{"label":"Detail","id":"c1_1_1"}]}'
        "]}]}\n\n"
        "MANDATORY RULES:\n"
        "1. Central node: 2-5 word label summarising the main conversation topic.\n"
        "2. Create 3-4 CATEGORY branches (Level 1) — one for each major theme discussed.\n"
        "3. Each category label MUST start with a relevant emoji, e.g. '✈️ Flights', '💡 Key Ideas'.\n"
        "4. Each category should have 1-3 children (Level 2) with the MOST important facts or sub-topics.\n"
        "5. Level 2 nodes may have 1-2 children (Level 3) ONLY for crucial supporting details.\n"
        "6. Every node MUST have a unique 'id' field (e.g. 'c1', 'c1_2', 'c1_2_3').\n"
        "7. Category labels: SHORT (2-5 words). Detail labels: INFORMATIVE (3-10 words) "
        "— include names, numbers, prices, dates, specifics.\n"
        "8. Do NOT include empty placeholder nodes — the user can add their own nodes.\n"
        "9. KEEP IT COMPACT. Focus on the highlights, not exhaustive detail.\n\n"
        "MINIMUM REQUIREMENTS:\n"
        "- 3-4 top-level categories\n"
        "- 8-15 total nodes across all levels (keep it concise!)\n"
        "- 2-3 levels of depth beyond the root\n\n"
        "STRUCTURE EXAMPLE:\n"
        '{"label":"Budapest Trip Planning","id":"root","children":[\n'
        '  {"label":"✈️ Flights","id":"c1","children":[\n'
        '    {"label":"Ryanair £39 one way","id":"c1_1"},\n'
        '    {"label":"Depart Fri 15 Mar 6am","id":"c1_2"}\n'
        "  ]},\n"
        '  {"label":"🏨 Stay","id":"c2","children":[\n'
        '    {"label":"Maverick Lodge £35/night","id":"c2_1"},\n'
        '    {"label":"3 nights = £105","id":"c2_2"}\n'
        "  ]},\n"
        '  {"label":"🎭 Activities","id":"c3","children":[\n'
        '    {"label":"Thermal Baths","id":"c3_1"},\n'
        '    {"label":"Ruin Bars","id":"c3_2"}\n'
        "  ]},\n"
        '  {"label":"💰 Budget","id":"c4","children":[\n'
        '    {"label":"Total ~£280","id":"c4_1"}\n'
        "  ]}\n"
        "]}\n\n"
        "Return ONLY the JSON. No other text, no markdown fences."
    ),
    "summary": (
        "You are a canvas content generator. The user will give you a conversation transcript. "
        "Your task: write a structured summary using markdown. "
        "Use ## for main sections, bullet points for key ideas. "
        "Keep it concise (150-300 words). Return ONLY the markdown, no other text."
    ),
    "table": (
        "You are a canvas content generator. The user will give you a conversation transcript. "
        "Your task: build a comparison table in GitHub-flavored markdown. "
        "Identify the items being compared (e.g. two destinations, products, options) and the "
        "relevant comparison criteria discussed (e.g. price, pros, cons, activities, travel time). "
        "Format as a markdown table with the criteria as rows and the items as columns, or vice versa — "
        "whichever makes the table most readable. Include all specific facts, numbers, and details "
        "from the conversation. If some cells have no data, write 'N/A'. "
        "Return ONLY the markdown table (and an optional short header line), no other text."
    ),
    "calendar": (
        "You are a canvas content generator. The user will give you a conversation transcript. "
        "Your task: extract all dates, deadlines, events, and time-based actions mentioned. "
        "Return ONLY valid JSON in this exact shape:\n"
        '[{"date":"YYYY-MM-DD or descriptive like \'next Monday\'","title":"...","description":"..."}]\n'
        "If no dates are mentioned, infer logical ones from context. "
        "Return at least 1 item. Return ONLY the JSON, no other text."
    ),
    "todo": (
        "You are an intelligent to-do list generator. The user will give you a conversation transcript. "
        "Your job is to create a COMPREHENSIVE, ACTIONABLE to-do list that helps the user be fully prepared.\n\n"
        "Return ONLY valid JSON in this exact shape:\n"
        '[{"text":"...","done":false,"priority":"high"|"medium"|"low"}]\n\n'
        "YOUR APPROACH:\n"
        "1. Detect the TOPIC of the conversation (travel, creative project, coding, learning, "
        "life admin, fitness, event planning, work, finance, etc.).\n"
        "2. Extract every explicit action item from the conversation.\n"
        "3. Then use your knowledge to PROACTIVELY ADD practical items someone working on "
        "this topic would typically need — things they might forget or haven't thought of yet. "
        "Think like a knowledgeable friend who has done this before.\n"
        "   Examples of this thinking:\n"
        "   - Travel → packing, documents, transport, weather prep, bank notification\n"
        "   - Creative project → references, tool setup, drafts, feedback, publishing plan\n"
        "   - Coding → repo setup, testing, docs, deployment, code review\n"
        "   - Learning → resources, schedule, practice exercises, progress tracking\n"
        "   - Life admin → paperwork, deadlines, contacts, appointments\n"
        "   Apply the same pattern to ANY topic — use your judgement.\n"
        "4. Every item must be RELEVANT to the conversation topic. "
        "Never add travel items to a coding chat or vice versa.\n\n"
        "RULES:\n"
        "- Group related items together logically.\n"
        "- Use specific details from the conversation (names, dates, amounts).\n"
        "- Distribute priorities naturally:\n"
        "  • high = urgent, time-sensitive, or critical\n"
        "  • medium = important but not urgent\n"
        "  • low = nice-to-have, optional extras\n"
        "- Aim for 15-30 items for detailed conversations, fewer for simple ones.\n"
        "Return ONLY the JSON, no other text."
    ),
    "custom": (
        "You are a canvas content generator. The user will give you a conversation transcript "
        "and a custom format description. Structure the conversation content according to that description. "
        "Return the content in markdown format. Return ONLY the content, no other text."
    ),
}


class GenerateCanvasPayload(BaseModel):
    messages: list[dict]  # [{role: "user"|"agent", text: "..."}]
    format: str  # "mindmap"|"summary"|"calendar"|"todo"|"custom"
    character_name: str
    custom_description: str | None = None
    existing_structured_data: dict | None = None


@app.post("/generate-canvas")
async def generate_canvas(payload: GenerateCanvasPayload):
    """
    One-shot LLM call (not the full agent) that structures a conversation
    into the requested canvas format.
    Returns: {content: str, structured: object|null, format: str}
    """
    import json as _json

    fmt = payload.format
    if fmt not in FORMAT_SYSTEM_PROMPTS:
        raise HTTPException(status_code=400, detail=f"Unknown format: {fmt}")

    # Build conversation transcript
    lines = []
    for msg in payload.messages:
        role = "User" if msg.get("role") == "user" else payload.character_name
        text = msg.get("text", "").strip()
        if text:
            lines.append(f"{role}: {text}")
    transcript = "\n".join(lines)

    if not transcript:
        raise HTTPException(
            status_code=400, detail="No conversation content to process"
        )

    # Build system prompt — use incremental prompt if existing data provided
    system_content = FORMAT_SYSTEM_PROMPTS[fmt]

    # For mindmaps: dynamically scale detail level based on conversation richness
    if fmt == "mindmap" and not payload.existing_structured_data:
        word_count = len(transcript.split())
        msg_count = len(payload.messages)
        if word_count > 1000 or msg_count > 15:
            # Rich, detailed conversation — capture everything
            system_content = system_content.replace(
                "8-15 total nodes across all levels (keep it concise!)",
                "20-35 total nodes across all levels — this is a detailed conversation, capture ALL specifics"
            ).replace(
                "3-4 CATEGORY branches",
                "4-6 CATEGORY branches"
            ).replace(
                "1-3 children (Level 2)",
                "2-5 children (Level 2)"
            )
        elif word_count > 400 or msg_count > 8:
            # Medium conversation
            system_content = system_content.replace(
                "8-15 total nodes across all levels (keep it concise!)",
                "12-20 total nodes across all levels — include key specifics"
            )
    if fmt == "custom" and payload.custom_description:
        system_content += (
            f"\n\nFormat description from user: {payload.custom_description}"
        )

    # INCREMENTAL MODE: if existing structured data is provided, tell the LLM
    # to ADD to the existing structure rather than rebuild from scratch
    existing_json = None
    if payload.existing_structured_data and fmt == "mindmap":
        import json as _json2
        # Extract the root mindmap JSON from the structured wrapper
        existing_root = payload.existing_structured_data.get("root", payload.existing_structured_data)
        existing_json = _json2.dumps(existing_root, ensure_ascii=False)
        system_content = (
            "You are an INCREMENTAL mind-map updater. You have an EXISTING mind map (JSON) "
            "and a NEW conversation transcript. Your job is to MERGE new information into "
            "the existing map.\n\n"
            "CRITICAL RULES:\n"
            "1. KEEP every existing node exactly as-is — same id, same label, same position. "
            "Do NOT remove, rename, or reorganise existing nodes.\n"
            "2. ADD new nodes for new information from the conversation. Place them under "
            "the most relevant existing category, or create a new category if needed.\n"
            "3. New node IDs must be unique and not clash with existing ones (e.g. c5, c5_1).\n"
            "4. Keep category labels starting with a relevant emoji.\n"
            "5. Return the COMPLETE updated JSON (existing + new nodes merged together).\n"
            "6. Return ONLY valid JSON, no other text.\n\n"
            f"EXISTING MIND MAP:\n{existing_json}\n\n"
            "Now integrate the NEW conversation content below into this existing map."
        )

    user_content = f"Here is the conversation transcript:\n\n{transcript}"

    try:
        raw = await _base_model.ainvoke(
            [
                SystemMessage(content=system_content),
                HumanMessage(content=user_content),
            ]
        )
        content = raw.content.strip() if hasattr(raw, "content") else str(raw).strip()

        # Try to parse structured JSON for mindmap/todo/calendar
        structured = None
        if fmt in ("mindmap", "todo", "calendar"):
            try:
                clean = content
                # Strip <think>...</think> blocks (Qwen reasoning model output)
                import re as _re
                clean = _re.sub(r"<think>.*?</think>", "", clean, flags=_re.DOTALL).strip()
                # Strip code fences if model wrapped the JSON
                if clean.startswith("```"):
                    clean = "\n".join(clean.split("\n")[1:])
                if clean.endswith("```"):
                    clean = "\n".join(clean.split("\n")[:-1])
                clean = clean.strip()
                # Try direct parse first
                try:
                    parsed = _json.loads(clean)
                except _json.JSONDecodeError:
                    # Extract the first JSON array [...] or object {...} from the text
                    arr_match = _re.search(r"\[[\s\S]*\]", clean)
                    obj_match = _re.search(r"\{[\s\S]*\}", clean)
                    if fmt in ("todo", "calendar") and arr_match:
                        parsed = _json.loads(arr_match.group())
                    elif fmt == "mindmap" and obj_match:
                        parsed = _json.loads(obj_match.group())
                    else:
                        raise ValueError("No JSON found in response")
                if fmt == "mindmap":
                    # API returns {"title":"...", "children":[...]} but frontend expects "label"
                    if "title" in parsed and "label" not in parsed:
                        parsed["label"] = parsed.pop("title")
                    structured = {"type": "mindmap", "root": parsed}
                elif fmt == "todo":
                    structured = {"type": "todo", "items": parsed}
                elif fmt == "calendar":
                    structured = {"type": "calendar", "events": parsed}
            except Exception as parse_err:
                logger.warning(
                    f"Could not parse structured JSON for {fmt}: {parse_err}"
                )

        logger.info(
            f"/generate-canvas complete: format={fmt}, content_len={len(content)}"
        )
        return {"content": content, "structured": structured, "format": fmt}

    except Exception as e:
        logger.error(f"/generate-canvas error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ─── Handwriting Recognition Endpoint ───────────────────────────────────────


class HandwritingPayload(BaseModel):
    image_base64: str  # PNG of the user's handwriting drawing


@app.post("/recognize-handwriting")
async def recognize_handwriting(payload: HandwritingPayload):
    """
    Takes a base64-encoded PNG of handwritten text drawn on the canvas,
    sends it to the LLM vision model, and returns the recognized typed text.
    """
    try:
        response = await _base_model.ainvoke(
            [
                HumanMessage(
                    content=[
                        {
                            "type": "text",
                            "text": (
                                "This image contains handwritten text drawn by a user on a digital canvas. "
                                "Please read the handwriting carefully and return ONLY the text you can see, "
                                "typed out exactly as written. "
                                "Do not add any explanation, punctuation corrections, or commentary. "
                                "If the image is blank or you cannot read anything, return an empty string."
                            ),
                        },
                        {
                            "type": "image_url",
                            "image_url": {
                                "url": f"data:image/png;base64,{payload.image_base64}"
                            },
                        },
                    ]
                )
            ]
        )
        text = response.content.strip() if hasattr(response, "content") else ""
        logger.info(f"/recognize-handwriting result: '{text}'")
        return {"text": text}
    except Exception as e:
        logger.error(f"/recognize-handwriting error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8080)
