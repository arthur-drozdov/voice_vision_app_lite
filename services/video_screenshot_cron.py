"""Video screenshot cron job for capturing camera frames.

This module provides a background task that captures video frames from a camera
feed at regular intervals and saves them to disk for the CameraVision tool to use.

This mirrors the old implementation where video frames were captured and saved
for the CameraVision tool to analyze.

The frame capture can be triggered via:
1. WebSocket endpoint that receives video frames from the client
2. Direct camera access (if opencv is available)

The saved frames are stored as JPG files that can be read by the CameraVision tool.
"""

import asyncio
import base64
import logging
import os
from datetime import datetime
from typing import Callable

logger = logging.getLogger(__name__)


class VideoScreenshotCron:
    """Background task that captures video frames at regular intervals.

    This class manages a background task that:
    1. Receives video frames via WebSocket endpoint
    2. Saves the latest frame to disk as JPG
    3. Makes the frame available for the CameraVision tool

    The CameraVision tool reads from the same file path to provide
    image context to the LLM.
    """

    def __init__(
        self,
        output_path: str = "latest_frame.jpg",
        interval_seconds: int = 2,
    ):
        """Initialize the video screenshot cron job.

        Args:
            output_path: Path where the latest frame will be saved.
                        Defaults to "latest_frame.jpg" in the current directory.
            interval_seconds: Minimum interval between frame saves.
                            Frames arriving faster than this will be throttled.
        """
        self.output_path = output_path
        self.interval = interval_seconds
        self.running = False
        self._task: asyncio.Task | None = None
        self._frame_buffer: bytes | None = None
        self._last_save_time: float = 0
        self._lock = asyncio.Lock()
        self._frame_callbacks: list[Callable[[str], None]] = []

    def register_frame_callback(self, callback: Callable[[str], None]) -> None:
        """Register a callback to be called when a new frame is saved.

        Args:
            callback: Function to call with the frame path as argument.
        """
        self._frame_callbacks.append(callback)

    async def start(self) -> None:
        """Start the cronjob - capture frames indefinitely.

        This starts the background task that manages frame saving.
        The actual frame data comes from the WebSocket endpoint or
        direct camera access.
        """
        if self.running:
            logger.warning("[video] VideoScreenshotCron already running")
            return

        self.running = True
        logger.info(f"[video] VideoScreenshotCron started (output: {self.output_path})")

    async def stop(self) -> None:
        """Stop the cronjob."""
        self.running = False
        if self._task and not self._task.done():
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass
        logger.info("[video] VideoScreenshotCron stopped")

    async def receive_frame(self, video_base64: str, format: str = "jpeg") -> dict:
        """Receive and save a video frame from the client.

        This method is called by the WebSocket endpoint when the client
        sends a video frame. The frame is saved to disk for the
        CameraVision tool to read.

        Args:
            video_base64: Base64 encoded image data.
            format: Image format (jpeg, png, etc.).

        Returns:
            Dictionary with save status.
        """
        try:
            # Decode base64 image data
            image_data = base64.b64decode(video_base64)

            async with self._lock:
                # Throttle saves based on interval
                current_time = asyncio.get_event_loop().time()
                if current_time - self._last_save_time < self.interval:
                    # Update buffer but don't save yet
                    self._frame_buffer = image_data
                    return {"status": "buffered", "saved": False}

                # Save the frame
                await self._save_frame(image_data)
                self._last_save_time = current_time
                self._frame_buffer = None

                # Notify callbacks
                for callback in self._frame_callbacks:
                    try:
                        callback(self.output_path)
                    except Exception as e:
                        logger.error(f"[video] Callback error: {e}")

                return {"status": "saved", "saved": True}

        except Exception as e:
            logger.error(f"[video] Failed to save frame: {e}")
            return {"status": "error", "error": str(e)}

    async def _save_frame(self, image_data: bytes) -> None:
        """Save image data to disk.

        Args:
            image_data: Raw image bytes to save.
        """
        try:
            # Ensure directory exists
            output_dir = os.path.dirname(self.output_path)
            if output_dir and not os.path.exists(output_dir):
                os.makedirs(output_dir, exist_ok=True)

            # Write image data
            with open(self.output_path, "wb") as f:
                f.write(image_data)

            logger.debug(f"[video] Frame saved: {self.output_path}")

        except Exception as e:
            logger.error(f"[video] Failed to write frame: {e}")
            raise

    def get_frame_path(self) -> str:
        """Get the path where the latest frame is saved.

        Returns:
            Path to the latest frame file.
        """
        return self.output_path

    def frame_exists(self) -> bool:
        """Check if a frame file exists.

        Returns:
            True if the frame file exists, False otherwise.
        """
        return os.path.exists(self.output_path)

    async def __aenter__(self) -> "VideoScreenshotCron":
        """Async context manager entry."""
        await self.start()
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb) -> None:
        """Async context manager exit."""
        await self.stop()


# Global instance for use across the application
_cron_instance: VideoScreenshotCron | None = None


def get_video_screenshot_cron(
    output_path: str = "latest_frame.jpg",
    interval_seconds: int = 2,
) -> VideoScreenshotCron:
    """Get or create the global VideoScreenshotCron instance.

    Args:
        output_path: Path where frames should be saved.
        interval_seconds: Interval between frame saves.

    Returns:
        The global VideoScreenshotCron instance.
    """
    global _cron_instance
    if _cron_instance is None:
        _cron_instance = VideoScreenshotCron(
            output_path=output_path,
            interval_seconds=interval_seconds,
        )
    return _cron_instance


async def start_video_cron(
    output_path: str = "latest_frame.jpg",
    interval_seconds: int = 2,
) -> VideoScreenshotCron:
    """Start the global video screenshot cron job.

    Args:
        output_path: Path where frames should be saved.
        interval_seconds: Interval between frame saves.

    Returns:
        The started VideoScreenshotCron instance.
    """
    global _cron_instance
    _cron_instance = VideoScreenshotCron(
        output_path=output_path,
        interval_seconds=interval_seconds,
    )
    await _cron_instance.start()
    return _cron_instance


async def stop_video_cron() -> None:
    """Stop the global video screenshot cron job."""
    global _cron_instance
    if _cron_instance:
        await _cron_instance.stop()
        _cron_instance = None
