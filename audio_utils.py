"""Audio utility functions for voice cloning.

This module provides audio processing utilities specifically for the voice_store.py
module. These functions are kept separate to avoid circular dependencies.
"""

import wave
from pathlib import Path

import numpy as np


def save_audio_to_file(audio_data: np.ndarray, sample_rate: int, output_path: str | Path, format: str = "wav") -> None:
    """Save audio data to a file.

    Args:
        audio_data: Audio samples as float32 numpy array.
        sample_rate: Sample rate of the audio.
        output_path: Path to save the audio file.
        format: Audio format (default: "wav").
    """
    output_path = Path(output_path)
    output_path.parent.mkdir(parents=True, exist_ok=True)

    if format.lower() == "wav":
        # Convert float32 [-1, 1] to int16
        audio_int16 = (audio_data * 32767).astype(np.int16)

        with wave.open(str(output_path), "wb") as wf:
            wf.setnchannels(1)  # Mono
            wf.setsampwidth(2)  # 2 bytes for int16
            wf.setframerate(sample_rate)
            wf.writeframes(audio_int16.tobytes())
    else:
        raise ValueError(f"Unsupported format: {format}")


def load_wav_to_floats(wav_path: str | Path) -> tuple[np.ndarray, int]:
    """Load an audio file and return float32 audio data.

    Supported formats include WAV, WebM, Opus, etc. (via librosa/audioread).

    Args:
        wav_path: Path to the audio file.

    Returns:
        Tuple of (audio_data, sample_rate) where audio_data is float32 in range [-1, 1].
    """
    import librosa
    wav_path = Path(wav_path)
    # librosa.load uses audioread which handles WebM/Opus/etc.
    # sr=None preserves the original sample rate.
    audio, sr = librosa.load(str(wav_path), sr=None)
    return audio, int(sr)
