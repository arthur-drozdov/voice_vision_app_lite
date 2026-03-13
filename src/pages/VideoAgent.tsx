import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Video, VideoOff, PhoneOff, Settings, SwitchCamera, Mic, MicOff, AlertCircle, Moon, Sun } from "lucide-react";
import { useNavigate } from "react-router-dom";
import CharacterSelect, { characters } from "@/components/CharacterSelect";
import { getLLMRTCClient, LLMRTCClient, LLMRTCConnectionStatus } from "@/lib/llmrtcClient";
import { captureFrameResized } from "@/lib/pythonBridge";
import { buildSystemPrompt } from "@/lib/characterPrompts";
import MoodRing from "@/components/MoodRing";
import GlassContainer from "@/components/GlassContainer";
import FocusButton from "@/components/FocusButton";
import { deriveVideoMood } from "@/lib/moodDetector";
import SaveToCanvasPrompt from "@/components/SaveToCanvasPrompt";
import FormatPickerModal from "@/components/FormatPickerModal";
import MergePickerModal from "@/components/MergePickerModal";
import UpgradePrompt from "@/components/UpgradePrompt";
import {
  saveBoard, getBoards, mergeIntoBoard,
  generateBoardTitle, type CanvasFormat, type CanvasMessage,
} from "@/lib/canvasStore";
import { canCreateBoard, getBoardLimit } from "@/lib/subscriptionStore";
import { isFocusActive, toggleFocus } from "@/lib/FocusController";

const VideoAgent = () => {
  const navigate = useNavigate();

  const [isActive, setIsActive] = useState(false);
  const [frontCamera, setFrontCamera] = useState(true);
  const [selectedChar, setSelectedChar] = useState("noe");
  const [showCharSelect, setShowCharSelect] = useState(true);
  const [isMuted, setIsMuted] = useState(false);
  const [audioStatus, setAudioStatus] = useState<LLMRTCConnectionStatus>("disconnected");
  const [isBarging, setIsBarging] = useState(false);
  const [isTTSActive, setIsTTSActive] = useState(false);
  const [isUserSpeaking, setIsUserSpeaking] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  // Canvas save state
  const [showSavePrompt, setShowSavePrompt] = useState(false);
  const [showFormatPicker, setShowFormatPicker] = useState(false);
  const [showMergePicker, setShowMergePicker] = useState(false);
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [pendingFormat, setPendingFormat] = useState<CanvasFormat | null>(null);
  const [showSaveSuccess, setShowSaveSuccess] = useState(false);
  const [focusMode, setFocusMode] = useState(isFocusActive);

  // Refs
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const llmrtcClientRef = useRef<LLMRTCClient | null>(null);
  const visionTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // Transcript accumulator — avoids stale closure in LLMRTC callbacks
  const transcriptsRef = useRef<CanvasMessage[]>([]);
  // Track previous isActive value to detect session end
  const prevIsActiveRef = useRef(false);
  // Canvas refs
  const promptDismissedRef = useRef(false);
  const sessionSavedRef = useRef(false);

  const char = characters.find((c) => c.id === selectedChar)!;

  // Detect when a session ends → show save prompt if we have transcripts
  useEffect(() => {
    const justEnded = prevIsActiveRef.current && !isActive;
    prevIsActiveRef.current = isActive;

    if (justEnded && transcriptsRef.current.length > 0 && !sessionSavedRef.current && !promptDismissedRef.current) {
      setShowSavePrompt(true);
    }
  }, [isActive]);

  // Reset transcript + prompt flags when a new session starts
  useEffect(() => {
    if (isActive) {
      transcriptsRef.current = [];
      sessionSavedRef.current = false;
      promptDismissedRef.current = false;
      setShowSavePrompt(false);
    }
  }, [isActive]);

  // Initialize LLMRTC client once on mount
  useEffect(() => {
    const llmrtcBackendUrl = import.meta.env.VITE_LLMRTC_BACKEND_URL || "ws://localhost:8787";

    const client = getLLMRTCClient({
      signallingUrl: llmrtcBackendUrl,
      callbacks: {
        onSpeechStart: () => {
          console.log("[VideoAgent] Speech started (VAD detected)");
          setIsBarging(false);
          setIsUserSpeaking(true);
          setIsTTSActive(false);
        },
        onSpeechEnd: () => {
          console.log("[VideoAgent] Speech ended");
          setIsUserSpeaking(false);
        },
        onTranscript: (text) => {
          console.log("[VideoAgent] Transcript:", text);
          // Accumulate user speech transcripts using ref to avoid stale closure
          transcriptsRef.current = [...transcriptsRef.current, { role: "user", text }];
        },
        onTTSStart: () => {
          console.log("[VideoAgent] TTS started");
          setIsTTSActive(true);
          setIsUserSpeaking(false);
        },
        onTTSCancelled: () => {
          console.log("[VideoAgent] TTS cancelled - barge-in activated!");
          setIsTTSActive(false);
          setIsBarging(true);
          setTimeout(() => setIsBarging(false), 1000);
        },
        onTTSTrack: (_stream) => {
          console.log("[VideoAgent] Received TTS audio track from WebRTC");
        },
        onError: (error) => {
          console.error("[VideoAgent] LLMRTC error:", error);
          setConnectionError(`LLMRTC backend error: ${error}. Ensure the LLMRTC backend is running.`);
        },
        onStatusChange: (status) => {
          console.log("[VideoAgent] Connection status:", status);
          setAudioStatus(status);
          if (status === "error") {
            setConnectionError("Failed to connect to LLMRTC backend. Ensure the backend server is running at the configured address.");
          } else if (status === "connected") {
            setConnectionError(null);
          }
        },
      },
    });
    llmrtcClientRef.current = client;

    return () => {
      client.disconnect().catch(() => {});
    };
  }, []);

  // Handle video stream when session starts/stops
  useEffect(() => {
    console.log("[VideoAgent] isActive changed to:", isActive);

    if (isActive) {
      console.log("[VideoAgent] Starting video session");
      startVideo();
      startVisionCapture();
      console.log("[VideoAgent] Connecting LLMRTC client...");
      llmrtcClientRef.current?.connect();

      const checkAndStartRecording = async () => {
        const maxAttempts = 50;
        for (let i = 0; i < maxAttempts; i++) {
          const status = llmrtcClientRef.current?.getStatus();
          console.log("[VideoAgent] LLMRTC status check", i + 1, ":", status);
          if (status === "connected") {
            console.log("[VideoAgent] Starting audio recording with VAD...");
            await llmrtcClientRef.current?.startRecording();
            console.log("[VideoAgent] Auto-started recording - VAD enabled (Silero VAD v5)");
            return;
          }
          if (status === "error") {
            console.error("[VideoAgent] LLMRTC connection error");
            setConnectionError("Failed to connect to LLMRTC backend. Ensure the backend server is running.");
            setIsActive(false);
            return;
          }
          await new Promise((resolve) => setTimeout(resolve, 100));
        }
        console.error("[VideoAgent] Timeout waiting for LLMRTC connection");
        setConnectionError("Connection timeout. Ensure the LLMRTC backend is running.");
        setIsActive(false);
      };
      checkAndStartRecording();
    } else {
      console.log("[VideoAgent] Stopping video session");
      stopVideo();
      stopVisionCapture();
      llmrtcClientRef.current?.stopRecording();
      llmrtcClientRef.current?.disconnect();
      setConnectionError(null);
    }

    return () => {
      console.log("[VideoAgent] Cleanup effect");
      stopVideo();
      stopVisionCapture();
    };
  }, [isActive]);

  const startVideo = async () => {
    try {
      const constraints = {
        video: {
          facingMode: frontCamera ? "user" : "environment",
          width: { ideal: 640 },
          height: { ideal: 480 },
        },
        audio: true,
      };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (error) {
      console.error("Failed to start video:", error);
    }
  };

  const stopVideo = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  };

  const startVisionCapture = () => {
    visionTimerRef.current = setInterval(async () => {
      if (videoRef.current && !videoRef.current.paused && !videoRef.current.ended) {
        try {
          const frameBase64 = captureFrameResized(videoRef.current, 240, 180);
          await fetch("/vision", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ video_base64: frameBase64, format: "jpeg" }),
          });
        } catch (error) {
          console.error("Failed to capture vision frame:", error);
        }
      }
    }, 1000);
  };

  const stopVisionCapture = () => {
    if (visionTimerRef.current) {
      clearInterval(visionTimerRef.current);
      visionTimerRef.current = null;
    }
  };

  const toggleCamera = () => {
    stopVideo();
    setFrontCamera(!frontCamera);
    if (isActive) {
      setTimeout(startVideo, 100);
    }
  };

  const toggleMute = () => {
    const newMuted = !isMuted;
    setIsMuted(newMuted);
    if (streamRef.current) {
      streamRef.current.getAudioTracks().forEach((track) => {
        track.enabled = !newMuted;
      });
    }
  };

  const handleSavePromptTap = () => {
    setShowSavePrompt(false);
    if (!canCreateBoard(getBoards().length)) {
      setShowUpgrade(true);
      return;
    }
    setShowFormatPicker(true);
  };

  const handleFormatPicked = (format: CanvasFormat) => {
    setShowFormatPicker(false);
    setPendingFormat(format);
    if (getBoards().length > 0) {
      setShowMergePicker(true);
    } else {
      createNewBoard(format);
    }
  };

  const createNewBoard = (format: CanvasFormat) => {
    const now = new Date();
    const messages: CanvasMessage[] =
      transcriptsRef.current.length > 0
        ? transcriptsRef.current
        : [{ role: "agent", text: `Voice session with ${char.name}` }];
    saveBoard({
      id: `board-${Date.now()}`,
      title: generateBoardTitle(messages, char.name, now),
      characterId: selectedChar,
      characterEmoji: char.emoji,
      characterName: char.name,
      format,
      createdAt: now.toISOString(),
      messages,
      generationStatus: "pending",
    });
    sessionSavedRef.current = true;
    setShowMergePicker(false);
    setPendingFormat(null);
    // Show success toast — let the user start a new call or navigate manually
    setShowSaveSuccess(true);
    setTimeout(() => setShowSaveSuccess(false), 4500);
  };

  const handleMerge = (boardId: string) => {
    const msgs: CanvasMessage[] = transcriptsRef.current;
    if (msgs.length > 0) mergeIntoBoard(boardId, msgs);
    sessionSavedRef.current = true;
    setShowMergePicker(false);
    setPendingFormat(null);
    // Show success toast — let the user start a new call or navigate manually
    setShowSaveSuccess(true);
    setTimeout(() => setShowSaveSuccess(false), 4500);
  };

  // ─── Character selection screen ───────────────────────────────────────────
  if (showCharSelect) {
    return (
      <div className="flex flex-col h-full items-center justify-center px-5">
        <div className="glass rounded-3xl p-8 w-full max-w-sm flex flex-col items-center gap-6">
          <div className="w-full flex items-start justify-between">
            <GlassContainer variant="dark" size="sm" className="text-center">
              <h1 className="text-2xl font-bold text-foreground">Video Chat</h1>
              <p className="text-sm font-medium text-foreground/70 mt-1">Pick a character to video call</p>
            </GlassContainer>
            <FocusButton />
          </div>
          <CharacterSelect selected={selectedChar} onSelect={setSelectedChar} />
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={async () => {
              // Push character + tone system prompt to Python backend before the call starts
              try {
                const savedSettings = JSON.parse(localStorage.getItem("customize-settings") ?? "{}");
                const tone = savedSettings.tone ?? "warm";
                const systemPrompt = buildSystemPrompt(selectedChar, tone, "voice");
                await fetch("/set-character", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ system_prompt: systemPrompt }),
                });
              } catch (e) {
                console.warn("[VideoAgent] Could not set character prompt:", e);
              }
              setShowCharSelect(false);
            }}
            className="bg-primary text-primary-foreground px-8 py-3 rounded-2xl font-semibold text-sm glow-primary w-full"
          >
            Start Video
          </motion.button>
          {connectionError && (
            <div className="flex items-center gap-2 text-destructive text-sm">
              <AlertCircle size={16} />
              <span>{connectionError}</span>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ─── Active video UI ──────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full page-video">
      <header className="flex items-center justify-between px-5 pt-12 pb-4 page-header">
        <div className="flex items-center gap-3">
          <button onClick={() => setShowCharSelect(true)} className="text-2xl">
            {char.emoji}
          </button>
          <GlassContainer variant="dark" size="sm" className="flex flex-col">
            <h1 className="text-lg font-semibold text-foreground leading-tight">{char.name}</h1>
            <p className="text-xs font-mono text-muted-foreground">
              {isActive
                ? audioStatus === "connected"
                  ? "Connected"
                  : "Connecting..."
                : "Offline"}
            </p>
            {connectionError && (
              <p className="text-xs text-destructive mt-1 flex items-center gap-1">
                <AlertCircle size={10} />
                Backend required
              </p>
            )}
          </GlassContainer>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={toggleMute}
            className="p-2 rounded-lg glass"
            title={isMuted ? "Unmute microphone" : "Mute microphone"}
          >
            {isMuted ? (
              <MicOff size={18} className="text-destructive" />
            ) : (
              <Mic size={18} className="text-muted-foreground" />
            )}
          </button>
          <button className="p-2 rounded-lg glass">
            <Settings size={18} className="text-foreground/70" />
          </button>
          <FocusButton />
        </div>
      </header>

      {/* Video preview */}
      <div className="flex-1 px-5 pb-4">
        <div className="relative w-full h-full rounded-2xl glass overflow-hidden flex items-center justify-center min-h-[300px]">
          {isActive ? (
            <>
              {/* Character-specific radial glow background */}
              <div
                className="absolute inset-0"
                style={{
                  background: `radial-gradient(circle at 50% 40%, ${char.color}25 0%, transparent 55%), hsl(var(--background))`,
                }}
              />

              {/* Cosmic floating particles (idle) */}
              {!isTTSActive && (
                <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
                  {[...Array(5)].map((_, i) => (
                    <div
                      key={i}
                      className="absolute rounded-full"
                      style={{
                        width: `${3 + Math.random() * 3}px`,
                        height: `${3 + Math.random() * 3}px`,
                        left: `${15 + i * 17}%`,
                        bottom: `${10 + i * 12}%`,
                        background: `hsla(38, 75%, 62%, ${0.06 + Math.random() * 0.06})`,
                        animation: `vv-float-particle ${14 + i * 2}s ease-in-out infinite ${i * 2}s`,
                      }}
                    />
                  ))}
                </div>
              )}

              <div className="relative flex flex-col items-center gap-4 z-10">
                {/* 3 animated rings during talking — teal, lavender, gold */}
                {isTTSActive && (
                  <>
                    {[
                      { color: "hsl(172, 88%, 50%)", delay: 0 },
                      { color: "hsl(270, 55%, 68%)", delay: 0.7 },
                      { color: "hsla(38, 75%, 62%, 0.4)", delay: 1.4 },
                    ].map((ring, i) => (
                      <motion.div
                        key={`ring-${i}`}
                        className="absolute rounded-full pointer-events-none"
                        style={{
                          width: "13rem",
                          height: "13rem",
                          border: `2px solid ${ring.color}`,
                        }}
                        initial={{ scale: 1, opacity: 0.6 }}
                        animate={{ scale: 1.8, opacity: 0 }}
                        transition={{
                          duration: 2,
                          repeat: Infinity,
                          delay: ring.delay,
                          ease: "easeOut",
                        }}
                      />
                    ))}
                  </>
                )}

                <MoodRing
                  mood={deriveVideoMood({ isBarging, isTTSActive, isUserSpeaking, isActive })}
                  charColor={char.color}
                  size="lg"
                >
                  <div
                    className="w-48 h-48 rounded-full flex items-center justify-center"
                    style={{
                      backgroundColor: `${char.color}20`,
                      boxShadow: `0 0 40px ${char.color}30, 0 0 80px ${char.color}15`,
                    }}
                  >
                    <span className="text-8xl">{char.emoji}</span>
                  </div>
                </MoodRing>
                <span className="text-lg font-medium text-muted-foreground">{char.name}</span>
              </div>

              {/* Small self-view */}
              <div className="absolute bottom-3 right-3 w-60 h-45 rounded-xl glass border border-border/50 overflow-hidden z-20">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className={`w-full h-full object-cover ${frontCamera ? "scale-x-[-1]" : ""}`}
                />
                <div className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 hover:opacity-100 transition-opacity">
                  <button onClick={toggleCamera} className="p-2 glass rounded-lg" title="Switch camera">
                    <SwitchCamera size={20} className="text-white" />
                  </button>
                </div>
                <div className="absolute top-2 left-2 px-2 py-1 rounded bg-black/50">
                  <span className="text-[10px] text-white">{frontCamera ? "Front" : "Back"}</span>
                </div>
              </div>

              {/* Audio status indicator */}
              {isActive && audioStatus === "connected" && !isMuted && (
                <div className="absolute bottom-3 left-3 flex items-center gap-2 z-20">
                  {isBarging ? (
                    <>
                      <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                      <span className="text-xs text-red-500 font-medium">Interrupting...</span>
                    </>
                  ) : (
                    <>
                      <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                      <span className="text-xs text-muted-foreground">Listening...</span>
                    </>
                  )}
                </div>
              )}
            </>
          ) : (
            <div className="text-center space-y-3">
              <div
                className="w-20 h-20 mx-auto rounded-full flex items-center justify-center"
                style={{ backgroundColor: `${char.color}15` }}
              >
                <span className="text-4xl">{char.emoji}</span>
              </div>
              <p className="text-sm text-muted-foreground">Tap to start video call with {char.name}</p>
            </div>
          )}
        </div>
      </div>

      {/* Save to Canvas prompt — appears after session ends if transcripts exist */}
      <SaveToCanvasPrompt
        show={showSavePrompt}
        onSave={handleSavePromptTap}
        onDismiss={() => {
          promptDismissedRef.current = true;
          setShowSavePrompt(false);
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
              <span className="text-green-400 text-base">✓</span>
              <span className="text-sm text-foreground font-medium">Saved to Canvas!</span>
            </div>
            <button
              onClick={() => navigate("/canvas")}
              className="text-xs text-primary font-semibold shrink-0 ml-2"
            >
              View →
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Controls */}
      <div className="flex items-center justify-center gap-6 pb-24 pt-4">
        <button
          onClick={() => setIsActive(!isActive)}
          className={`w-14 h-14 rounded-full flex items-center justify-center transition-colors ${
            isActive ? "bg-primary glow-primary" : "glass"
          }`}
        >
          {isActive ? (
            <Video size={20} className="text-primary-foreground" />
          ) : (
            <VideoOff size={20} className="text-muted-foreground" />
          )}
        </button>
        {isActive && (
          <>
            <motion.button
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              onClick={toggleMute}
              className={`w-14 h-14 rounded-full flex items-center justify-center transition-all ${
                isMuted ? "bg-destructive" : "glass"
              }`}
              title={isMuted ? "Unmute microphone" : "Mute microphone"}
            >
              {isMuted ? (
                <MicOff size={20} className="text-destructive-foreground" />
              ) : (
                <Mic size={20} className="text-muted-foreground" />
              )}
            </motion.button>
            <motion.button
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              onClick={toggleCamera}
              className="w-14 h-14 rounded-full glass flex items-center justify-center"
            >
              <SwitchCamera size={20} className="text-muted-foreground" />
            </motion.button>
            <motion.button
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              onClick={() => setIsActive(false)}
              className="w-14 h-14 rounded-full bg-destructive flex items-center justify-center"
            >
              <PhoneOff size={20} className="text-destructive-foreground" />
            </motion.button>
          </>
        )}
      </div>

      {/* Format Picker Modal */}
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

export default VideoAgent;
