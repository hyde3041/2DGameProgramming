import json
from dataclasses import dataclass
from time import monotonic
from typing import ClassVar

from pico2d import load_image

from character import Player
from map import GAME_DIRECTORY, METADATA_DIRECTORY, Room


SCALE = 0.5
APPROACH_SECONDS = 1.2
PREVIEW_SECONDS = 3.0


@dataclass
class Monster:
    race: ClassVar[str] = "monster"
    pos: tuple[int, int]


def read_metadata(path):
    return json.loads((METADATA_DIRECTORY / path).read_text(encoding="utf-8"))


def draw_frame(image, rect, pivot, feet):
    left, bottom, width, height = rect
    x = feet[0] + (width / 2 - pivot[0]) * SCALE
    y = feet[1] + (pivot[1] - height / 2) * SCALE
    image.clip_draw(left, bottom, width, height, x, y, width * SCALE, height * SCALE)


class BattlePreview:
    def __init__(self, room: Room):
        layout = read_metadata(f"map/cave-{room.map_index}.json")
        cells = {(cell["column"], -cell["row"]): cell for cell in layout["cells"]}
        candidates = []
        for (x, y), cell in cells.items():
            start = cells.get((x - 1, y - 1))
            end = cells.get((x, y - 1))
            if (
                cell["deployable"] and start and end
                and start["walkable"] and end["walkable"]
                and cell["height_level"] == start["height_level"] == end["height_level"]
            ):
                candidates.append((x, y))
        x, y = min(candidates, key=lambda pos: abs(pos[0] - 5) + abs(pos[1] + 2))

        self.player = Player(attackSpeed=1.0, damage=10, hp=40, cost=0, pos=[x, y])
        self.player_feet = cells[x, y]["pico2d_center"]
        self.monster_start = (x - 1, y - 1)
        self.monster_end = (x, y - 1)
        self.monster = Monster(self.monster_start)
        self.start_feet = cells[self.monster_start]["pico2d_center"]
        self.end_feet = cells[self.monster_end]["pico2d_center"]

        self.player_animations = {}
        for state in ("idle", "attack"):
            metadata = read_metadata(f"character/{state}/swordsman.json")
            animation = metadata["animations"]["front"]
            image = load_image(str(GAME_DIRECTORY / animation["file"]))
            frames = [frame["pico2d_rect"] for frame in animation["frames"]]
            self.player_animations[state] = (image, frames, metadata["pivot"], metadata["fps"])

        monster_metadata = read_metadata("character/monster-motion.json")
        monster_id = next(iter(room.monsters))
        spec = monster_metadata["monsters"][monster_id]
        self.monster_image = load_image(str(GAME_DIRECTORY / spec["walk_sheet"]))
        self.monster_fps = spec["walk_fps"]
        self.monster_frame_size = monster_metadata["frame_size"]
        self.monster_frame_count = monster_metadata["frame_count"]
        self.monster_columns = monster_metadata["columns"]
        self.monster_pivot = monster_metadata["pivot"]
        self.started_at = self.state_started_at = monotonic()

    def draw(self):
        now = monotonic()
        phase = (now - self.started_at) % PREVIEW_SECONDS
        moving = phase < APPROACH_SECONDS
        self.monster.pos = self.monster_start if moving else self.monster_end
        previous_state = self.player.state
        state = self.player.update_state((self.monster,))
        if state != previous_state:
            self.state_started_at = now

        image, frames, pivot, fps = self.player_animations[state]
        if state == "attack":
            fps = len(frames) * self.player.attackSpeed
        frame = int((now - self.state_started_at) * fps) % len(frames)
        draw_frame(image, frames[frame], pivot, self.player_feet)

        progress = min(phase / APPROACH_SECONDS, 1.0)
        feet = (self.start_feet[0] + (self.end_feet[0] - self.start_feet[0]) * progress,
                self.end_feet[1])
        frame = int(phase * self.monster_fps) % self.monster_frame_count if moving else 0
        width, height = self.monster_frame_size
        left = frame % self.monster_columns * width
        bottom = self.monster_image.h - (frame // self.monster_columns + 1) * height
        draw_frame(self.monster_image, (left, bottom, width, height), self.monster_pivot, feet)
