"""Voice cloning storage service.

This module provides a simple file-based storage system for managing
voice clone references including reference audio and text.
"""

import base64
import json
import logging
import os
import uuid
from dataclasses import asdict, dataclass
from datetime import datetime
from pathlib import Path

import numpy as np

from audio_utils import load_wav_to_floats, save_audio_to_file

logger = logging.getLogger(__name__)

# Default reference voice location
DEFAULT_VOICE_DIR = Path.home() / ".deepagents"
DEFAULT_REFERENCE_AUDIO = DEFAULT_VOICE_DIR / "reference.wav"
DEFAULT_REFERENCE_TEXT = DEFAULT_VOICE_DIR / "reference.txt"
DEFAULT_VOICE_ID = "reference_voice"
DEFAULT_VOICE_NAME = "Reference Voice"


@dataclass
class VoiceClone:
    """Represents a voice clone with its metadata."""

    voice_id: str
    name: str
    reference_audio_path: str
    reference_text: str
    created_at: str
    sample_rate: int = 24000
    is_default: bool = False
    is_conditioned: bool = False


class VoiceStore:
    """File-based storage for voice clones.

    Stores voice clone metadata in JSON format and reference audio as WAV files.
    """

    def __init__(self, store_path: str | Path | None = None):
        """Initialize the voice store.

        Args:
            store_path: Path to the voice store directory. If None, uses
                       VOICE_STORE_PATH environment variable or defaults to ./data/voices.
        """
        self.store_path = Path(store_path or os.environ.get("VOICE_STORE_PATH", "./data/voices"))
        self.store_path.mkdir(parents=True, exist_ok=True)

        self._index_file = self.store_path / "voices.json"
        self._voices: dict[str, VoiceClone] = {}

        # Load existing voices on init
        self._load_index()

    def _load_index(self) -> None:
        """Load voice index from JSON file."""
        if self._index_file.exists():
            try:
                with open(self._index_file, "r") as f:
                    data = json.load(f)
                    for voice_data in data:
                        voice = VoiceClone(**voice_data)
                        self._voices[voice.voice_id] = voice
            except (json.JSONDecodeError, KeyError) as e:
                logger.warning(f"Failed to load voice index: {e}")
                self._voices = {}
        else:
            self._voices = {}

    def _save_index(self) -> None:
        """Save voice index to JSON file."""
        self.store_path.mkdir(parents=True, exist_ok=True)

        data = [asdict(voice) for voice in self._voices.values()]
        with open(self._index_file, "w") as f:
            json.dump(data, f, indent=2)

    def load_default_reference_voice(self) -> VoiceClone | None:
        """Load the default reference voice from ~/.deepagents/.

        Checks for reference.wav and reference.txt in the default location.
        If both exist, creates a default voice clone entry.

        Returns:
            The loaded VoiceClone object if found, None otherwise.
        """
        if not DEFAULT_REFERENCE_AUDIO.exists() or not DEFAULT_REFERENCE_TEXT.exists():
            logger.debug("Default reference voice files not found")
            return None

        try:
            # Read reference text
            with open(DEFAULT_REFERENCE_TEXT, "r") as f:
                reference_text = f.read().strip()

            # Verify audio file is valid
            if not DEFAULT_REFERENCE_AUDIO.exists():
                return None

            # Create default voice clone entry
            voice = VoiceClone(
                voice_id=DEFAULT_VOICE_ID,
                name=DEFAULT_VOICE_NAME,
                reference_audio_path=str(DEFAULT_REFERENCE_AUDIO.absolute()),
                reference_text=reference_text,
                created_at=datetime.utcnow().isoformat(),
                sample_rate=24000,
                is_default=True,
                is_conditioned=False,
            )

            # Store in memory
            self._voices[DEFAULT_VOICE_ID] = voice
            logger.info(f"Loaded default reference voice: {DEFAULT_VOICE_NAME}")
            return voice

        except Exception as e:
            logger.error(f"Failed to load default reference voice: {e}")
            return None

    def is_voice_conditioned(self, voice_id: str) -> bool:
        """Check if a voice has been conditioned (ref/ref_text sent).

        Args:
            voice_id: Voice identifier to check.

        Returns:
            True if voice is conditioned, False otherwise.
        """
        voice = self._voices.get(voice_id)
        if not voice:
            return False
        return voice.is_conditioned

    def mark_voice_as_conditioned(self, voice_id: str) -> VoiceClone | None:
        """Mark a voice as conditioned after first TTS request.

        Args:
            voice_id: Voice identifier to mark.

        Returns:
            Updated VoiceClone object or None if not found.
        """
        voice = self._voices.get(voice_id)
        if not voice:
            return None

        voice.is_conditioned = True
        self._save_index()
        logger.info(f"Marked voice as conditioned: {voice_id}")
        return voice

    def clear_voice_conditioning(self, voice_id: str) -> bool:
        """Clear conditioning state for a voice (e.g., when re-cloned).

        Args:
            voice_id: Voice identifier to clear.

        Returns:
            True if clearing was successful, False otherwise.
        """
        voice = self._voices.get(voice_id)
        if not voice:
            return False

        voice.is_conditioned = False
        self._save_index()
        logger.info(f"Cleared conditioning for voice: {voice_id}")
        return True

    def save(
        self,
        voice_id: str,
        name: str,
        reference_audio: np.ndarray,
        reference_text: str,
        sample_rate: int = 24000,
    ) -> VoiceClone:
        """Save a voice clone to storage.

        Args:
            voice_id: Unique identifier for the voice.
            name: Display name for the voice.
            reference_audio: Reference audio samples as float32 numpy array.
            reference_text: Transcription of the reference audio.
            sample_rate: Sample rate of the reference audio.

        Returns:
            The saved VoiceClone object.
        """
        # Generate voice_id if not provided
        if not voice_id:
            voice_id = str(uuid.uuid4())

        # Save reference audio to file
        audio_filename = f"{voice_id}.wav"
        audio_path = self.store_path / audio_filename

        save_audio_to_file(reference_audio, sample_rate, audio_path, format="wav")

        # Create voice clone record
        voice = VoiceClone(
            voice_id=voice_id,
            name=name,
            reference_audio_path=str(audio_path.absolute()),
            reference_text=reference_text,
            created_at=datetime.utcnow().isoformat(),
            sample_rate=sample_rate,
            is_default=False,
            is_conditioned=False,
        )

        # Store in memory and persist index
        self._voices[voice_id] = voice
        self._save_index()

        logger.info(f"Saved voice clone: {name} ({voice_id})")
        return voice

    def get(self, voice_id: str) -> VoiceClone | None:
        """Get a voice clone by ID.

        Args:
            voice_id: Voice identifier to retrieve.

        Returns:
            VoiceClone object if found, None otherwise.
        """
        self._load_index()
        voice = self._voices.get(voice_id)
        if not voice and voice_id == DEFAULT_VOICE_ID:
            voice = self.load_default_reference_voice()
        return voice

    def get_reference_audio(self, voice_id: str) -> tuple[np.ndarray, int] | None:
        """Get the reference audio for a voice clone.

        Args:
            voice_id: Voice identifier.

        Returns:
            Tuple of (audio_data, sample_rate) or None if not found.
        """
        voice = self._voices.get(voice_id)
        if not voice:
            return None

        try:
            audio_data, sample_rate = load_wav_to_floats(voice.reference_audio_path)
            return audio_data, sample_rate
        except Exception as e:
            logger.error(f"Failed to load reference audio for {voice_id}: {e}")
            return None

    def get_reference_audio_base64(self, voice_id: str) -> str | None:
        """Get the reference audio as base64-encoded WAV data.

        Args:
            voice_id: Voice identifier.

        Returns:
            Base64-encoded WAV data or None if not found.
        """
        voice = self._voices.get(voice_id)
        if not voice:
            return None

        try:
            audio_path = Path(voice.reference_audio_path)
            if not audio_path.exists():
                return None

            with open(audio_path, "rb") as f:
                audio_bytes = f.read()
                return base64.b64encode(audio_bytes).decode("utf-8")
        except Exception as e:
            logger.error(f"Failed to load reference audio base64 for {voice_id}: {e}")
            return None

    def list_all(self) -> list[dict]:
        """List all voice clones.

        Returns:
            List of voice clone metadata dictionaries (without audio data).
        """
        self._load_index()
        self.load_default_reference_voice()
        # Deduplicate by voice_id to avoid showing multiple "Reference Voice" entries
        unique_voices = {}
        for voice in self._voices.values():
            unique_voices[voice.voice_id] = voice

        return [
            {
                "voice_id": voice.voice_id,
                "name": voice.name,
                "created_at": voice.created_at,
                "sample_rate": voice.sample_rate,
                "reference_text_preview": voice.reference_text[:100] + "..."
                if len(voice.reference_text) > 100
                else voice.reference_text,
                "is_default": voice.is_default,
                "has_ref": bool(voice.reference_audio_path) and bool(voice.reference_text),
                "is_conditioned": voice.is_conditioned,
            }
            for voice in unique_voices.values()
        ]

    def delete(self, voice_id: str) -> bool:
        """Delete a voice clone.

        Args:
            voice_id: Voice identifier to delete.

        Returns:
            True if deletion was successful, False otherwise.
        """
        voice = self._voices.get(voice_id)
        if not voice:
            return False

        try:
            # Delete audio file
            audio_path = Path(voice.reference_audio_path)
            if audio_path.exists():
                audio_path.unlink()

            # Remove from index
            del self._voices[voice_id]
            self._save_index()

            logger.info(f"Deleted voice clone: {voice_id}")
            return True

        except Exception as e:
            logger.error(f"Failed to delete voice clone {voice_id}: {e}")
            return False

    def delete_with_conditioning_clear(self, voice_id: str) -> bool:
        """Delete a voice clone and clear its conditioning state.

        Args:
            voice_id: Voice identifier to delete.

        Returns:
            True if deletion was successful, False otherwise.
        """
        # Clear conditioning state first
        self.clear_voice_conditioning(voice_id)
        return self.delete(voice_id)

    def update_name(self, voice_id: str, new_name: str) -> VoiceClone | None:
        """Update the name of a voice clone.

        Args:
            voice_id: Voice identifier.
            new_name: New display name.

        Returns:
            Updated VoiceClone object or None if not found.
        """
        voice = self._voices.get(voice_id)
        if not voice:
            return None

        voice.name = new_name
        self._save_index()
        return voice


# Global voice store instance
_voice_store: VoiceStore | None = None


def get_voice_store(store_path: str | Path | None = None) -> VoiceStore:
    """Get or create the global voice store instance.

    Args:
        store_path: Optional path override for the store.

    Returns:
        Global VoiceStore instance.
    """
    global _voice_store
    if _voice_store is None or store_path is not None:
        _voice_store = VoiceStore(store_path=store_path)
    return _voice_store
