import json
import math
from pathlib import Path

from pico2d import load_image


PROJECT_ROOT = Path(__file__).resolve().parent


class IdleSprite:
    """A foot-anchored sprite; animation time advances only in update()."""

    def __init__(self, character_id, x, y, scale=1.0, direction="front"):
        metadata_path = PROJECT_ROOT / "metadata/character/idle" / f"{character_id}.json"
        with metadata_path.open(encoding="utf-8") as file:
            self.metadata = json.load(file)

        self.x, self.y = x, y
        self.scale = scale
        self.elapsed = 0.0
        self.fps = self.metadata["fps"]
        self._images = {}
        self.set_direction(direction)

    def set_direction(self, direction):
        direction = "right" if direction == "side" else direction
        if direction not in self.metadata["animations"]:
            raise ValueError(f"Unsupported direction: {direction}")

        animation = self.metadata["animations"][direction]
        if direction not in self._images:
            self._images[direction] = load_image(str(PROJECT_ROOT / animation["file"]))
        self.direction = direction
        self.animation = animation
        self.frame_count = len(animation["frames"])
        self.cycle_seconds = self.frame_count / self.fps
        self.elapsed %= self.cycle_seconds

    @property
    def frame(self):
        # Keep exact loop boundaries stable despite accumulated float rounding.
        return int(self.elapsed * self.fps + 1e-9) % self.frame_count

    def update(self, delta_time):
        if not math.isfinite(delta_time) or delta_time < 0:
            raise ValueError("delta_time must be finite and non-negative")
        self.elapsed = (self.elapsed + delta_time) % self.cycle_seconds

    def draw(self):
        left, bottom, width, height = self.animation["frames"][self.frame]["pico2d_rect"]
        pivot_x, pivot_y = self.metadata["pivot"]
        center_x = self.x + (width / 2 - pivot_x) * self.scale
        center_y = self.y + (pivot_y - height / 2) * self.scale
        self._images[self.direction].clip_draw(
            left, bottom, width, height,
            center_x, center_y, width * self.scale, height * self.scale,
        )
