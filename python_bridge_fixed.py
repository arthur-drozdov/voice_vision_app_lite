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
from langchain_openai import ChatOpenAI
from langchain_core.tools import BaseTool
from langchain_core.messages import (
    HumanMessage,
    AIMessage,
    SystemMessage,
    ToolMessage,
    ToolCall,
)
from langchain_core.output_parsers import StrOutputParser

logging.basicConfig(
    level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger("python_bridge")


class CameraVision(BaseTool):
    name: str = "Vision"
    description: str = "Use this tool to see the most recent frame from the user's camera when they ask what you see. It returns the image data."

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

    async def _arun(self) -> list[dict]:
        return self._run()


class TavilySearch(BaseTool):
    name: str = "Search"
    description: str = "Use this tool to search the web for current information, news, facts, or any topic that requires up-to-date online information. Returns search results with relevant content and sources."

    def _run(self, query: str) -> str:
        from tavily import TavilyClient

        api_key = os.environ.get(
            "TAVILY_API_KEY",
            "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",
        )
        client = TavilyClient(api_key=api_key)
        try:
            response = client.search(query=query, max_results=5)
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
        except Exception as e:
            return f"Search error: {e}"

    async def _arun(self, query: str) -> str:
        return self._run(query)


@asynccontextmanager
async def lifespan(app: FastAPI):
    global agent, _base_model, _tools_dict
    try:
        _base_model = ChatOpenAI(
            model="Qwen/Qwen3.5-122B-A10B-FP8",
            base_url="http://llm-server.example.com:8000/v1",
            api_key=os.environ.get("OPENAI_API_KEY", "pancakes"),
            streaming=True,
            extra_body={"chat_template_kwargs": {"enable_thinking": False}},
        )
        logger.info(
            "Model: Qwen/Qwen3.5-122B-A10B-FP8 @ http://llm-server.example.com:8000/v1"
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

        tools = [CameraVision(), TavilySearch()]
        _tools_dict = {tool.name: tool for tool in tools}

        agent = create_deep_agent(
            model=_base_model,
            system_prompt=system_prompt,
            tools=tools,
            checkpointer=True,
        )
        logger.info("Agent initialised with create_deep_agent")
        logger.info(f"Available tools: {list(_tools_dict.keys())}")
    except Exception as e:
        logger.error(f"Failed to initialize agent: {e}")
        raise
    yield


_base_model = None
_tools_dict: dict[str, BaseTool] = {}


app = FastAPI(lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

current_agent_task: asyncio.Task | None = None
global_system_prompt: str | None = None


class VisionPayload(BaseModel):
    video_base64: str
    format: str


class CharacterPayload(BaseModel):
    system_prompt: str


@app.post("/set-character")
async def set_character(payload: CharacterPayload):
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
        logger.error(f"Vision error: {e}")
        return {"error": str(e)}


async def execute_tool(
    tool_call: ToolCall, tools_dict: dict[str, BaseTool]
) -> ToolMessage:
    """Execute a tool call and return the result as a ToolMessage."""
    tool_name = tool_call["name"]
    tool_args = tool_call.get("args", {})
    tool_id = tool_call.get("id", f"tool_{os.urandom(8).hex()}")

    logger.info(f"[TOOL EXEC] Executing tool: {tool_name} with args: {tool_args}")

    try:
        tool = tools_dict.get(tool_name)
        if not tool:
            error_msg = f"Unknown tool: {tool_name}"
            logger.error(f"[TOOL EXEC] {error_msg}")
            return ToolMessage(content=error_msg, tool_id=tool_id, name=tool_name)

        # Execute the tool (sync or async)
        if hasattr(tool, "_arun") and asyncio.iscoroutinefunction(tool._arun):
            result = await tool._arun(**tool_args) if tool_args else await tool._arun()
        else:
            result = tool._run(**tool_args) if tool_args else tool._run()

        result_str = str(result)
        logger.info(
            f"[TOOL EXEC] {tool_name} completed, result length: {len(result_str)}"
        )

        return ToolMessage(content=result_str, tool_id=tool_id, name=tool_name)

    except Exception as e:
        error_msg = f"Error executing {tool_name}: {str(e)}"
        logger.error(f"[TOOL EXEC] {error_msg}")
        return ToolMessage(content=error_msg, tool_id=tool_id, name=tool_name)


async def orchestrator_invoke(
    messages: list,
    config: dict,
    tools_dict: dict[str, BaseTool],
    model,
    max_iterations: int = 5,
) -> tuple[str, list]:
    """
    Orchestrator loop: Call LLM, handle tool calls, execute tools, re-call until final response.
    Returns: (final_text, all_messages)
    """
    all_messages = messages.copy()
    iteration = 0

    while iteration < max_iterations:
        iteration += 1
        logger.info(
            f"[ORCHESTRATOR] Iteration {iteration}, calling LLM with {len(all_messages)} messages"
        )

        # Log messages being sent
        for i, msg in enumerate(all_messages[-5:]):
            msg_type = type(msg).__name__
            content = msg.content if hasattr(msg, "content") else str(msg)
            content_preview = (
                content[:80].replace("\n", " ") + "..."
                if len(content) > 80
                else content
            )
            logger.info(
                f"  [{len(all_messages) - 5 + i}] {msg_type}: {content_preview}"
            )

        # Call LLM
        response = await model.ainvoke(all_messages)

        if not hasattr(response, "content") and not hasattr(response, "tool_calls"):
            logger.error("[ORCHESTRATOR] Invalid LLM response format")
            break

        # Check for tool calls
        tool_calls = getattr(response, "tool_calls", [])

        if tool_calls:
            logger.info(f"[ORCHESTRATOR] LLM returned {len(tool_calls)} tool call(s)")

            # Add assistant response with tool calls
            all_messages.append(response)

            # Execute each tool call
            for tool_call in tool_calls:
                tool_message = await execute_tool(tool_call, tools_dict)
                all_messages.append(tool_message)
                logger.info(f"[ORCHESTRATOR] Tool result added: {tool_message.name}")

            # Continue loop to let LLM process tool results
            continue
        else:
            # Final response - no tool calls
            logger.info("[ORCHESTRATOR] Final response received, no tool calls")
            all_messages.append(response)
            final_text = (
                response.content if hasattr(response, "content") else str(response)
            )
            return final_text, all_messages

    logger.warning(f"[ORCHESTRATOR] Max iterations ({max_iterations}) reached")
    return "", all_messages


@app.websocket("/chat")
async def chat_endpoint(websocket: WebSocket):
    await websocket.accept()
    global current_agent_task
    logger.info("Client connected to Python bridge")

    session_system_prompt: str | None = None
    session_thread_id = "default_session"
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

            # Retrieve existing conversation history
            config = {"configurable": {"thread_id": session_thread_id}}
            try:
                previous_state = agent.get_state(config)
                existing_messages = previous_state.values.get("messages", [])
                logger.info(
                    f"[HISTORY] Retrieved {len(existing_messages)} messages from thread_id={session_thread_id}"
                )
            except Exception as e:
                logger.warning(f"Could not retrieve previous state: {e}")
                existing_messages = []

            # Build messages list
            messages = []

            # Add system prompt only on first message
            if active_prompt := (session_system_prompt or global_system_prompt):
                if not existing_messages:
                    messages.append(SystemMessage(content=active_prompt))
                    logger.info("[SYSTEM] System prompt added (first message)")

                # Inject memory summary if we have many messages
                if len(existing_messages) > 20 and memory_summary:
                    summary_msg = SystemMessage(
                        content=f"CONVERSATION SUMMARY: {memory_summary}"
                    )
                    messages.append(summary_msg)
                    logger.info("[MEMORY] Summary injected into context")

            messages.extend(existing_messages)
            messages.append(HumanMessage(content=user_text))

            # Use orchestrator for tool execution loop
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
                    )

                    # Store updated messages back to checkpointer
                    if updated_messages:
                        try:
                            await agent.aupdate_state(
                                config, {"messages": updated_messages}
                            )
                            logger.info(
                                f"[STORE] Saved {len(updated_messages)} messages to checkpointer"
                            )
                        except Exception as store_err:
                            logger.error(f"Failed to store messages: {store_err}")

                    # Generate memory summary every 20 messages
                    if message_count % 20 == 0 and updated_messages:
                        try:
                            summary_prompt = SystemMessage(
                                content=(
                                    "Summarize this conversation in 2-3 sentences. "
                                    "Include key topics, decisions, and user preferences. "
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
                            logger.info(
                                f"[MEMORY] Generated summary: {memory_summary[:100]}..."
                            )
                        except Exception as summary_err:
                            logger.warning(f"Failed to generate summary: {summary_err}")

            except asyncio.TimeoutError:
                logger.error("Orchestrator timed out after 120s")
                timed_out = True
                full_text = "Sorry, that took too long. Please try again."
            except Exception as e:
                logger.error(f"Orchestrator error: {e}", exc_info=True)

            # Stream response to frontend
            if full_text and websocket.application_state == WebSocketState.CONNECTED:
                try:
                    # Send full text in chunks to simulate streaming
                    chunk_size = 50
                    for i in range(0, len(full_text), chunk_size):
                        chunk = full_text[i : i + chunk_size]
                        await websocket.send_json({"chunk": chunk, "source": "main"})
                        await asyncio.sleep(0.02)

                    await websocket.send_json({"done": True})
                    logger.info(f"[RESPONSE] Sent {len(full_text)} chars to client")
                except Exception as send_error:
                    logger.error(f"WebSocket send failed: {send_error}")

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


# ... [rest of the file remains the same: voice cloning endpoints, canvas generation, handwriting recognition]
