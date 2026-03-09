/**
 * Voice Cloning API Client
 *
 * This module provides a TypeScript client for interacting with the voice cloning backend API.
 * It handles listing, creating, and deleting voice clones.
 */

export interface VoiceClone {
  voice_id: string;
  name: string;
  ref_text: string;
  created_at?: string;
  is_default?: boolean;
  has_ref?: boolean;
  is_conditioned?: boolean;
}

export interface RecordVoicePayload {
  ref_audio: Blob;
  ref_text?: string;
  name?: string;
}

export interface RecordVoiceResponse {
  voice_id: string;
  name: string;
  ref_text: string;
}

export interface TTSPreviewPayload {
  text: string;
  voice_id?: string;
  ref_audio_base64?: string;
  ref_text?: string;
}

export interface TTSPreviewResponse {
  audio_base64: string;
  sample_rate: number;
  duration_seconds: number;
  conditioned?: boolean;
}

export class VoiceCloningApi {
  private baseUrl: string;

  constructor(baseUrl: string = 'http://127.0.0.1:8080') {
    this.baseUrl = baseUrl;
  }

  /**
   * List all available voice clones
   * @returns Promise resolving to array of voice clones
   */
  async listVoices(): Promise<VoiceClone[]> {
    try {
      const response = await fetch(`${this.baseUrl}/api/voice-cloning/voices`);

      if (!response.ok) {
        throw new Error(`Failed to list voices: ${response.statusText}`);
      }

      const data = await response.json();

      // Map from API response format to VoiceClone interface
      return data.map((v: any) => ({
        voice_id: v.voice_id || v.id,
        name: v.name,
        ref_text: v.ref_text || v.reference_text_preview || '',
        created_at: v.created_at,
        is_default: v.is_default,
        is_conditioned: v.is_conditioned,
        has_ref: v.has_ref
      }));
    } catch (error) {
      console.error('VoiceCloningApi.listVoices error:', error);
      throw error;
    }
  }

  /**
   * Record and create a new voice clone
   * @param payload - Audio blob and optional metadata
   * @returns Promise resolving to the created voice clone
   */
  async recordVoice(payload: RecordVoicePayload): Promise<RecordVoiceResponse> {
    try {
      const formData = new FormData();
      formData.append('ref_audio', payload.ref_audio, 'recording.wav');

      if (payload.ref_text) {
        formData.append('ref_text', payload.ref_text);
      }

      if (payload.name) {
        formData.append('name', payload.name);
      }

      const response = await fetch(`${this.baseUrl}/api/voice-cloning/record`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`Voice cloning failed: ${errorData.detail || response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('VoiceCloningApi.recordVoice error:', error);
      throw error;
    }
  }

  /**
   * Select a voice clone as the active voice
   * @param voiceId - The voice ID to select (empty string to deselect)
   * @returns Promise resolving when selection is complete
   */
  async selectVoice(voiceId: string): Promise<void> {
    try {
      const response = await fetch(`${this.baseUrl}/api/voice-cloning/select/${voiceId}`, {
        method: 'POST',
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`Failed to select voice: ${errorData.detail || response.statusText}`);
      }
    } catch (error) {
      console.error('VoiceCloningApi.selectVoice error:', error);
      throw error;
    }
  }

  /**
   * Delete a voice clone
   * @param voiceId - The voice ID to delete
   * @returns Promise resolving when deletion is complete
   */
  async deleteVoice(voiceId: string): Promise<void> {
    try {
      const response = await fetch(`${this.baseUrl}/api/voice-cloning/voices/${voiceId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`Failed to delete voice: ${errorData.detail || response.statusText}`);
      }
    } catch (error) {
      console.error('VoiceCloningApi.deleteVoice error:', error);
      throw error;
    }
  }

  /**
   * Synthesize text to speech for preview playback
   * @param payload - Text and optional voice_id for TTS synthesis
   * @returns Promise resolving to audio data with sample rate and duration
   */
  async playPreview(payload: TTSPreviewPayload): Promise<TTSPreviewResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/api/audio/tts/preview`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`TTS preview failed: ${errorData.detail || response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('VoiceCloningApi.playPreview error:', error);
      throw error;
    }
  }
}

// Export a singleton instance for convenience
export const voiceCloningApi = new VoiceCloningApi();
