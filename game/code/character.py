from dataclasses import dataclass, field
from typing import ClassVar


# Fixed deployment prices for the available character profiles.
DEPLOYMENT_COSTS = {
    "0-swordsman": 5,
    "1-guardian": 7,
    "2-archer": 6,
    "3-crossbowman": 8,
    "4-cleric": 6,
    "5-herbalist": 5,
    "6-frost-mage": 8,
    "7-shadow-thief": 7,
}


@dataclass(kw_only=True)
class Player:
    race: ClassVar[str] = "people"

    attackSpeed: float  # Attacks per second.
    damage: int
    hp: int
    cost: int
    profile: str = ""
    direction: str = "down"
    deployed: bool = False
    pos: list[int] = field(default_factory=lambda: [0, 0])
    # Canonical offsets while facing down, with negative y pointing down.
    attackRange: list[list[int]] = field(default_factory=lambda: [[0, 0], [0, -1]])
    state: str = "idle"
    _animation_time: float = field(default=0.0, init=False, repr=False, compare=False)
    _state_started_at: float | None = field(default=None, init=False, repr=False, compare=False)

    def reset_animation(self, battle_time: float):
        self.state = "idle"
        self._animation_time = battle_time
        self._state_started_at = battle_time

    def sync_animation_time(self, battle_time: float):
        if self._state_started_at is None or battle_time < self._animation_time:
            self._state_started_at = battle_time
        self._animation_time = battle_time

    def attack_cells(self) -> set[tuple[int, int]]:
        """Return world cells for the current facing without changing attackRange."""
        x, y = self.pos
        cells = set()
        for dx, dy in self.attackRange:
            if self.direction == "up":
                dx, dy = -dx, -dy
            elif self.direction == "right":
                dx, dy = -dy, dx
            elif self.direction == "left":
                dx, dy = dy, -dx
            cells.add((x + dx, y + dy))
        return cells

    def update_state(self, units, *, now: float | None = None) -> str:
        """Select a motion. In combat, now is the shared battle time in seconds."""
        if now is not None:
            self.sync_animation_time(now)
        cells = self.attack_cells()
        attacking = any(unit.race == "monster" and tuple(unit.pos) in cells for unit in units)
        state = "attack" if attacking else "idle"
        if self._state_started_at is None or state != self.state:
            self._state_started_at = self._animation_time
        self.state = state
        return self.state

    def motion_frame(self, frame_count: int, fps: float, now: float | None = None) -> int:
        """Select a sprite frame from the synchronized battle time."""
        if self._state_started_at is None:
            return 0
        if now is None:
            now = self._animation_time
        if self.state == "attack":
            fps = frame_count * self.attackSpeed
        return int((now - self._state_started_at) * fps) % frame_count
