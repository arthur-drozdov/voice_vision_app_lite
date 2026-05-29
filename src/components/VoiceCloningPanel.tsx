/**
 * Voice Cloning Panel Component
 *
 * A fully-featured component for managing voice clones including:
 * - Listing all cloned voices with active indicator
 * - Recording new voice clones with waveform visualization
 * - Deleting voice clones
 * - Selecting active voice for audio playback
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Mic,
  MicOff,
  Trash2,
  Volume2,
  Check,
  Loader2,
  AlertCircle,
  Play,
  X,
  Pause
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { voiceCloningApi, VoiceClone, TTSPreviewPayload } from "@/lib/voiceCloningApi";
import useAudioRecording from "@/hooks/useAudioRecording";
import { decodeAudioBlob, audioBufferToWav } from "@/lib/wavUtils";

interface VoiceCloningPanelProps {
  onVoiceSelect?: (voiceId: string | null) => void;
  selectedVoiceId?: string | null;
  compact?: boolean;
}

/** Built-in Polly voices — always available, work with pipeline Lambda */
const BUILT_IN_VOICES: VoiceClone[] = [
  { voice_id: "Ruth", name: "Ruth (British, warm)", ref_text: "Polly generative voice — clear, natural British English", is_default: true, has_ref: true, is_conditioned: true },
  { voice_id: "Amy", name: "Amy (British, bright)", ref_text: "Polly generative voice — bright and friendly British English", is_default: false, has_ref: true, is_conditioned: true },
  { voice_id: "Brian", name: "Brian (British, male)", ref_text: "Polly generative voice — male British English", is_default: false, has_ref: true, is_conditioned: true },
  { voice_id: "Emma", name: "Emma (British, soft)", ref_text: "Polly neural voice — soft and warm British English", is_default: false, has_ref: true, is_conditioned: true },
  { voice_id: "Arthur", name: "Arthur (British, male)", ref_text: "Polly neural voice — deep male British English", is_default: false, has_ref: true, is_conditioned: true },
];

/**
 * Waveform visualization component
 */
const WaveformVisualizer = ({
  data,
  isRecording
}: {
  data: number[];
  isRecording: boolean;
}) => {
  return (
    <div className="flex items-center justify-center gap-1 h-16 px-4">
      {data.length === 0 ? (
        <div className="flex items-center gap-1 h-full w-full">
          {[...Array(20)].map((_, i) => (
            <motion.div
              key={i}
              className="w-1 bg-muted-foreground/30 rounded-full"
              animate={{
                height: isRecording ? [8, 24, 8] : 8,
              }}
              transition={{
                duration: 0.5,
                repeat: Infinity,
                delay: i * 0.05,
              }}
              style={{ height: 8 }}
            />
          ))}
        </div>
      ) : (
        data.map((value, i) => (
          <motion.div
            key={i}
            className="w-1 bg-primary rounded-full"
            initial={{ height: 4 }}
            animate={{
              height: Math.max(8, value * 48),
              opacity: isRecording ? 1 : 0.5
            }}
            transition={{ duration: 0.1 }}
          />
        ))
      )}
    </div>
  );
};

/**
 * Voice item component for display in the list
 */
const VoiceItem = ({
  voice,
  isSelected,
  onSelect,
  onDelete,
  onPlayPreview,
  isPlayingPreview
}: {
  voice: VoiceClone & { created_at?: string };
  isSelected: boolean;
  onSelect: () => void;
  onDelete: (e: React.MouseEvent) => void;
  onPlayPreview: () => void;
  isPlayingPreview: boolean;
}) => {
  const formatDate = (dateString?: string): string => {
    if (!dateString) return "Recently";
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      });
    } catch {
      return "Recently";
    }
  };

  const isDefault = voice.is_default || false;
  const isConditioned = voice.is_conditioned || false;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className={`group flex items-center justify-between p-3 rounded-xl border transition-all ${isSelected
        ? "border-primary bg-primary/10 shadow-sm"
        : "border-border/50 bg-card/50 hover:bg-card hover:border-border"
        }`}
    >
      <div
        className="flex items-center gap-3 flex-1 cursor-pointer min-w-0"
        onClick={onSelect}
      >
        <div
          className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${isSelected
            ? "bg-primary text-primary-foreground"
            : "bg-secondary/30 text-secondary"
            }`}
        >
          <Volume2 className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className={`font-medium truncate ${isSelected ? "text-primary" : "text-foreground"}`}>
              {voice.name}
            </p>
            {isDefault && (
              <Badge variant="secondary" className="text-[10px] shrink-0">
                Default
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2">
            <p className="text-xs text-muted-foreground truncate">
              {voice.ref_text || "No description"}
            </p>
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            <p className="text-[10px] text-muted-foreground/70">
              Created {formatDate(voice.created_at)}
            </p>
            {!isConditioned && !isDefault && (
              <Badge variant="outline" className="text-[9px] shrink-0">
                First use may be slower
              </Badge>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-1 shrink-0">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={onPlayPreview}
          title={isPlayingPreview ? "Stop preview" : "Play preview"}
          disabled={isPlayingPreview}
        >
          {isPlayingPreview ? (
            <Pause className="h-4 w-4" />
          ) : (
            <Play className="h-4 w-4" />
          )}
        </Button>

        {isSelected ? (
          <Badge variant="secondary" className="shrink-0">
            <Check className="h-3 w-3 mr-1" />
            Active
          </Badge>
        ) : isDefault ? (
          <Badge variant="outline" className="shrink-0 text-[10px]">
            Read-only
          </Badge>
        ) : (
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive hover:bg-destructive/10"
            onClick={onDelete}
            title="Delete voice"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        )}
      </div>
    </motion.div>
  );
};

/**
 * Recording dialog component
 */
const RecordingDialog = ({
  open,
  onOpenChange,
  onSuccess,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}) => {
  const { toast } = useToast();
  const [voiceName, setVoiceName] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [transcription, setTranscription] = useState<string>("");
  const audioContextRef = useRef<AudioContext | null>(null);

  const getAudioContext = () => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    return audioContextRef.current;
  };

  const {
    isRecording,
    waveformData,
    duration,
    startRecording,
    stopRecording,
    cancelRecording,
    error,
    isPermissionDenied,
  } = useAudioRecording();

  useEffect(() => {
    if (isRecording && duration >= 10.0) {
      handleStopRecording();
    }
  }, [isRecording, duration]);

  const handleStartRecording = async () => {
    try {
      setRecordedBlob(null);
      setTranscription("");
      await startRecording();
    } catch (err) {
      toast({
        title: "Recording Error",
        description: err instanceof Error ? err.message : "Failed to start recording",
        variant: "destructive",
      });
    }
  };

  const handleStopRecording = async () => {
    try {
      const blob = await stopRecording();
      setRecordedBlob(blob);
      toast({
        title: "Recording Complete",
        description: `${(blob.size / 1024).toFixed(0)}KB recorded.`,
      });
    } catch (err) {
      toast({
        title: "Recording Error",
        description: "Failed to stop recording",
        variant: "destructive",
      });
    }
  };

  const handlePlayRecording = async () => {
    if (!recordedBlob || isPreviewing) return;
    setIsPreviewing(true);

    try {
      const audioContext = getAudioContext();
      const arrayBuffer = await recordedBlob.arrayBuffer();
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
      const source = audioContext.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(audioContext.destination);
      source.onended = () => setIsPreviewing(false);
      source.start(0);
    } catch (err) {
      console.error("Playback error:", err);
      toast({
        title: "Playback Error",
        description: "Failed to play recording",
        variant: "destructive",
      });
      setIsPreviewing(false);
    }
  };

  const handlePreviewSynthesis = async () => {
    if (!recordedBlob || isPreviewing) return;
    setIsPreviewing(true);

    try {
      // 1. Convert blob to base64
      const reader = new FileReader();
      const base64Promise = new Promise<string>((resolve) => {
        reader.onloadend = () => {
          const base64String = (reader.result as string).split(',')[1];
          resolve(base64String);
        };
      });
      reader.readAsDataURL(recordedBlob);
      const audioBase64 = await base64Promise;

      // 2. Transcribe if we don't have it yet (or just let backend handle it)
      // For the preview, we'll send the audio and let the backend transcribe+synthesize
      // using the same transcript to show what it would sound like.
      const payload: TTSPreviewPayload = {
        text: "This is a preview of my new voice clone. How do I sound?",
        ref_audio_base64: audioBase64,
        // Backend will transcribe if ref_text is missing
      };

      const result = await voiceCloningApi.playPreview(payload);

      // 3. Play the result
      const binaryString = atob(result.audio_base64);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      const audioContext = getAudioContext();
      const audioBuffer = await audioContext.decodeAudioData(bytes.buffer);
      const source = audioContext.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(audioContext.destination);
      source.onended = () => setIsPreviewing(false);
      source.start(0);

    } catch (err) {
      console.error("Ad-hoc preview error:", err);
      toast({
        title: "Synthesis Error",
        description: err instanceof Error ? err.message : "Failed to synthesize preview",
        variant: "destructive",
      });
      setIsPreviewing(false);
    }
  };

  const handleSubmit = async () => {
    if (!recordedBlob) return;
    setIsProcessing(true);

    try {
      const name = voiceName.trim() || `Voice ${new Date().toLocaleDateString()}`;
      const audioBuffer = await decodeAudioBlob(recordedBlob);
      const wavBlob = audioBufferToWav(audioBuffer);

      await voiceCloningApi.recordVoice({
        ref_audio: wavBlob,
        name,
      });

      toast({
        title: "Voice Clone Created",
        description: `"${name}" has been successfully cloned.`,
      });

      setVoiceName("");
      setRecordedBlob(null);
      onSuccess();
      onOpenChange(false);
    } catch (err) {
      toast({
        title: "Error Creating Voice",
        description: err instanceof Error ? err.message : "Failed to create voice clone",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCancel = () => {
    cancelRecording();
    setRecordedBlob(null);
    setVoiceName("");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleCancel}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create New Voice Clone</DialogTitle>
          <DialogDescription>
            {isRecording
              ? `Recording... ${duration.toFixed(1)}s`
              : recordedBlob
                ? "Test your voice clone and save it"
                : "Click the microphone to start recording"}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex flex-col items-center justify-center py-6 space-y-4">
            {isPermissionDenied ? (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>Permission Denied</AlertDescription>
              </Alert>
            ) : isRecording ? (
              <>
                <motion.div
                  animate={{ scale: [1, 1.1, 1] }}
                  transition={{ duration: 1, repeat: Infinity }}
                  className="w-20 h-20 rounded-full bg-destructive flex items-center justify-center"
                >
                  <Mic className="h-10 w-10 text-destructive-foreground" />
                </motion.div>
                <p className="font-mono text-sm">{duration.toFixed(1)}s</p>
              </>
            ) : recordedBlob ? (
              <div className="flex flex-col items-center gap-4 w-full">
                <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center text-green-500">
                  <Check className="h-8 w-8" />
                </div>

                <div className="grid grid-cols-2 gap-3 w-full">
                  <Button
                    onClick={handlePlayRecording}
                    variant="outline"
                    disabled={isPreviewing}
                    className="gap-2"
                  >
                    {isPreviewing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Volume2 className="h-4 w-4" />}
                    Play Original
                  </Button>
                  <Button
                    onClick={handlePreviewSynthesis}
                    variant="outline"
                    disabled={isPreviewing}
                    className="gap-2"
                  >
                    {isPreviewing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                    Preview Clone
                  </Button>
                </div>
              </div>
            ) : (
              <Button onClick={handleStartRecording} size="lg" className="w-20 h-20 rounded-full" variant="destructive">
                <Mic className="h-8 w-8" />
              </Button>
            )}

            {(isRecording || waveformData.length > 0) && (
              <div className="w-full border rounded-lg p-2">
                <WaveformVisualizer data={waveformData} isRecording={isRecording} />
              </div>
            )}
          </div>

          {recordedBlob && (
            <div className="space-y-3">
              <div className="space-y-2">
                <Label>Voice Name</Label>
                <Input
                  placeholder="E.g. My Custom Voice"
                  value={voiceName}
                  onChange={(e) => setVoiceName(e.target.value)}
                  disabled={isProcessing}
                />
              </div>
              <div className="flex gap-2">
                <Button onClick={handleStartRecording} className="flex-1" variant="outline" disabled={isProcessing}>
                  Re-record
                </Button>
                <Button onClick={handleSubmit} className="flex-1" disabled={isProcessing}>
                  {isProcessing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Check className="h-4 w-4 mr-2" />}
                  Save Voice
                </Button>
              </div>
            </div>
          )}

          {isRecording && (
            <Button onClick={handleStopRecording} className="w-full" variant="destructive">
              Stop Recording
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export function VoiceCloningPanel({
  onVoiceSelect,
  selectedVoiceId,
  compact = false
}: VoiceCloningPanelProps) {
  const { toast } = useToast();
  const [voices, setVoices] = useState<(VoiceClone & { created_at?: string })[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [openDialog, setOpenDialog] = useState(false);
  const [selectedVoice, setSelectedVoice] = useState<string | null>(selectedVoiceId || null);
  const [isPlayingPreview, setIsPlayingPreview] = useState<string | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);

  // Initialize AudioContext lazily
  const getAudioContext = () => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    return audioContextRef.current;
  };

  // Cleanup AudioContext on unmount
  useEffect(() => {
    return () => {
      if (audioContextRef.current) {
        audioContextRef.current.close();
        audioContextRef.current = null;
      }
    };
  }, []);

  // Sync with prop
  useEffect(() => {
    if (selectedVoiceId !== undefined) {
      setSelectedVoice(selectedVoiceId);
    }
  }, [selectedVoiceId]);

  // Load voices on mount and when dialog closes
  const loadVoices = useCallback(async () => {
    setIsLoading(true);
    try {
      const fetchedVoices = await voiceCloningApi.listVoices();
      const voicesWithDate = fetchedVoices.map(v => ({
        ...v,
        created_at: v.created_at || new Date().toISOString(),
      }));
      // Merge with built-in voices (API voices take priority on duplicate IDs)
      const apiIds = new Set(voicesWithDate.map((v: any) => v.voice_id));
      const builtInWithoutDuplicates = BUILT_IN_VOICES.filter(v => !apiIds.has(v.voice_id));
      setVoices([...voicesWithDate, ...builtInWithoutDuplicates]);
      console.log(`Loaded ${voicesWithDate.length} API voices + ${builtInWithoutDuplicates.length} built-in voices`);
    } catch (err) {
      console.error("Failed to fetch voices:", err);
      // Fall back to built-in Polly voices when backend is unreachable
      setVoices([...BUILT_IN_VOICES]);
      toast({
        title: "Using Built-in Voices",
        description: "Voice cloning server not available. Using Polly voices.",
        variant: "default",
        duration: 4000,
      });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    loadVoices();
  }, [loadVoices]);

  const handleSelectVoice = async (voiceId: string) => {
    const newSelection = selectedVoice === voiceId ? null : voiceId;
    setSelectedVoice(newSelection);
    onVoiceSelect?.(newSelection);

    const voice = voices.find(v => v.voice_id === voiceId);
    const isBuiltIn = voice?.is_conditioned && voice?.has_ref && BUILT_IN_VOICES.some(bv => bv.voice_id === voiceId);

    // Built-in voices don't need backend API
    if (isBuiltIn) {
      if (newSelection) {
        toast({
          title: "Voice Selected",
          description: `Using "${voice?.name || voiceId}" for voice calls (built-in).`,
        });
      }
      return;
    }

    try {
      if (newSelection) {
        await voiceCloningApi.selectVoice(newSelection);

        let description = `Using "${voice?.name || voiceId}" for audio playback`;
        if (!isConditioned && !isDefault) {
          description += ". First synthesis may take longer while conditioning the voice model.";
        }

        toast({
          title: "Voice Selected",
          description,
        });
      } else {
        // Deselect current voice (if API supports it, otherwise use default)
        // For now, selecting null just reverts to default on next session
        await voiceCloningApi.selectVoice("");
      }
    } catch (err) {
      console.error("Failed to select voice:", err);
      toast({
        title: "Selection Error",
        description: "Failed to persist voice selection on server.",
        variant: "destructive",
      });
    }
  };

  const handleDeleteVoice = async (voiceId: string) => {
    // Don't allow deleting built-in Polly voices
    if (BUILT_IN_VOICES.some(bv => bv.voice_id === voiceId)) {
      toast({
        title: "Cannot Delete",
        description: "Built-in voices cannot be deleted.",
        variant: "default",
      });
      return;
    }

    if (!confirm("Are you sure you want to delete this voice clone? This action cannot be undone.")) {
      return;
    }

    try {
      await voiceCloningApi.deleteVoice(voiceId);
      setVoices((prev) => prev.filter((v) => v.voice_id !== voiceId));

      if (selectedVoice === voiceId) {
        setSelectedVoice(null);
        onVoiceSelect?.(null);
      }

      toast({
        title: "Voice Deleted",
        description: "The voice clone has been successfully removed.",
      });
    } catch (err) {
      toast({
        title: "Error Deleting Voice",
        description: err instanceof Error ? err.message : "Failed to delete voice",
        variant: "destructive",
      });
    }
  };

  const handlePlayPreview = async (voiceId: string, voiceName: string) => {
    // If already playing this voice, stop playback
    if (isPlayingPreview === voiceId) {
      setIsPlayingPreview(null);
      return;
    }

    setIsPlayingPreview(voiceId);

    try {
      // Preview text to synthesize
      const previewText = `This is a preview of ${voiceName}. Hello!`;

      // Call TTS API to synthesize audio
      const previewPayload: TTSPreviewPayload = {
        text: previewText,
        voice_id: voiceId,
      };

      const result = await voiceCloningApi.playPreview(previewPayload);

      // Decode base64 audio data to ArrayBuffer
      const binaryString = atob(result.audio_base64);
      const len = binaryString.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      // Decode audio data using Web Audio API
      const audioContext = getAudioContext();
      const audioBuffer = await audioContext.decodeAudioData(bytes.buffer);

      // Create source and play audio
      const source = audioContext.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(audioContext.destination);

      // Handle playback end
      source.onended = () => {
        setIsPlayingPreview(null);
      };

      source.start(0);
    } catch (err) {
      console.error("Preview playback error:", err);
      toast({
        title: "Preview Error",
        description: err instanceof Error ? err.message : "Failed to play preview",
        variant: "destructive",
      });
      setIsPlayingPreview(null);
    }
  };

  // Separate default voices from custom voices
  const defaultVoices = voices.filter(v => v.is_default);
  const customVoices = voices.filter(v => !v.is_default);

  if (compact) {
    // Compact view for embedded use
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium">Voice Cloning</h3>
          <Badge className="text-xs bg-primary/20 text-white border border-primary/40">
            {selectedVoice || selectedVoiceId ? "Voice Active" : "No Voice"}
          </Badge>
        </div>

        <Button
          onClick={() => setOpenDialog(true)}
          className="w-full glass border-secondary/40 text-secondary hover:bg-secondary/10"
          variant="outline"
        >
          <Mic className="h-4 w-4 mr-2" />
          Record New Voice
        </Button>

        {voices.length > 0 && (
          <div className="space-y-2">
            {[...defaultVoices, ...customVoices].slice(0, 5).map((voice) => (
              <VoiceItem
                key={voice.voice_id}
                voice={voice}
                isSelected={selectedVoice === voice.voice_id}
                onSelect={() => handleSelectVoice(voice.voice_id)}
                onDelete={(e) => {
                  e.stopPropagation();
                  handleDeleteVoice(voice.voice_id);
                }}
                onPlayPreview={() => handlePlayPreview(voice.voice_id, voice.name)}
                isPlayingPreview={isPlayingPreview === voice.voice_id}
              />
            ))}
          </div>
        )}

        <RecordingDialog
          open={openDialog}
          onOpenChange={setOpenDialog}
          onSuccess={loadVoices}
        />
      </div>
    );
  }

  // Full view
  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Volume2 className="h-5 w-5" />
            Voice Cloning
          </span>
          <Badge className="bg-primary/20 text-primary border border-primary/40">
            {selectedVoice || selectedVoiceId ? (
              <>
                <Check className="h-3 w-3 mr-1" />
                Voice Active
              </>
            ) : (
              "No Voice Selected"
            )}
          </Badge>
        </CardTitle>
        <CardDescription>
          Create and manage custom voice clones for audio playback
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Quick actions */}
        <div className="flex gap-2">
          <Button
            onClick={() => setOpenDialog(true)}
            className="flex-1"
            size="sm"
          >
            <Mic className="h-4 w-4 mr-2" />
            Record New Voice
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={loadVoices}
            disabled={isLoading}
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              "Refresh"
            )}
          </Button>
        </div>

        {/* Voice list */}
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : voices.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
              <Volume2 className="h-8 w-8 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium text-foreground mb-1">
              No voice clones yet
            </p>
            <p className="text-xs text-muted-foreground mb-4">
              Create your first voice clone to get started!
            </p>
            <Button onClick={() => setOpenDialog(true)} size="sm">
              <Mic className="h-4 w-4 mr-2" />
              Create Voice Clone
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Default Reference Voice Section */}
            {defaultVoices.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Reference Voice
                </h4>
                <AnimatePresence>
                  {defaultVoices.map((voice) => (
                    <VoiceItem
                      key={voice.voice_id}
                      voice={voice}
                      isSelected={selectedVoice === voice.voice_id}
                      onSelect={() => handleSelectVoice(voice.voice_id)}
                      onDelete={(e) => {
                        e.stopPropagation();
                        // Default voices cannot be deleted
                      }}
                      onPlayPreview={() => handlePlayPreview(voice.voice_id, voice.name)}
                      isPlayingPreview={isPlayingPreview === voice.voice_id}
                    />
                  ))}
                </AnimatePresence>
              </div>
            )}

            {/* Custom Voices Section */}
            {customVoices.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Custom Voices
                </h4>
                <AnimatePresence>
                  {customVoices.map((voice) => (
                    <VoiceItem
                      key={voice.voice_id}
                      voice={voice}
                      isSelected={selectedVoice === voice.voice_id}
                      onSelect={() => handleSelectVoice(voice.voice_id)}
                      onDelete={(e) => {
                        e.stopPropagation();
                        handleDeleteVoice(voice.voice_id);
                      }}
                      onPlayPreview={() => handlePlayPreview(voice.voice_id, voice.name)}
                      isPlayingPreview={isPlayingPreview === voice.voice_id}
                    />
                  ))}
                </AnimatePresence>
              </div>
            )}
          </div>
        )}
      </CardContent>

      <RecordingDialog
        open={openDialog}
        onOpenChange={setOpenDialog}
        onSuccess={loadVoices}
      />
    </Card>
  );
}

export default VoiceCloningPanel;
