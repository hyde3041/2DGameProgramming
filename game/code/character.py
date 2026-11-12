from dataclasses import dataclass, field
from math import floor
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

# Allowed tile types: 1 = ground, 2 = elevated.
DEPLOYMENT_TILES = {
    "0-swordsman": [1, 2],
    "1-guardian": [1, 2],
    "2-archer": [2],
    "3-crossbowman": [2],
    "4-cleric": [2],
    "5-herbalist": [2],
    "6-frost-mage": [2],
    "7-shadow-thief": [1, 2],
}


@dataclass(kw_only=True)
class Player:
    race: ClassVar[str] = "people"

    attackSpeed: float  # Attacks per second.
    damage: int
    hp: int
    cost: int
    maxHp: int | None = None
    mp: float = 0.0
    maxMp: float = 100.0
    mpRegen: float = 1.0  # MP per battle second while deployed and alive.
    canStop: int = 1  # Maximum monsters this character can block; 0 disables blocking.
    redeployDelay: float = 10.0  # Battle seconds before returning after withdrawal.
    allowedTiles: list[int] = field(default_factory=lambda: [1, 2])
    profile: str = ""
    direction: str = "down"  # Per-character facing: down, up, left, or right.
    deployed: bool = False
    pos: list[int] = field(default_factory=lambda: [0, 0])
    # Canonical offsets while facing down, with negative y pointing down.
    attackRange: list[list[int]] = field(default_factory=lambda: [[0, 0], [0, -1]])
    state: str = "idle"
    _animation_time: float = field(default=0.0, init=False, repr=False, compare=False)
    _state_started_at: float | None = field(default=None, init=False, repr=False, compare=False)
    _redeploy_ready_at: float = field(default=0.0, init=False, repr=False, compare=False)
    _mp_updated_at: float | None = field(default=None, init=False, repr=False, compare=False)

    def __post_init__(self):
        if self.maxHp is None:
            self.maxHp = max(0, self.hp)

    def update_mp(self, now: float):
        elapsed = 0.0 if self._mp_updated_at is None else max(0.0, now - self._mp_updated_at)
        self._mp_updated_at = now
        if self.deployed and self.hp > 0:
            self.mp = min(max(0.0, self.maxMp), max(0.0, self.mp) + elapsed * max(0.0, self.mpRegen))

    def redeploy_remaining(self, now: float | None = None) -> float:
        if now is None:
            now = self._animation_time
        return max(0.0, self._redeploy_ready_at - now)

    def reset_animation(self, battle_time: float):
        self.state = "idle"
        self._mp_updated_at = battle_time
        self._animation_time = battle_time
        self._state_started_at = battle_time

    def sync_animation_time(self, battle_time: float):
        if self._state_started_at is None or battle_time < self._animation_time:
            self._state_started_at = battle_time
        self._animation_time = battle_time

    def attack_cells(self, *, pos=None, direction=None) -> set[tuple[int, int]]:
        """Return attack cells, optionally previewing another position or facing."""
        x, y = self.pos if pos is None else pos
        direction = self.direction if direction is None else direction
        cells = set()
        for dx, dy in self.attackRange:
            if direction == "up":
                dx, dy = -dx, -dy
            elif direction == "right":
                dx, dy = -dy, dx
            elif direction == "left":
                dx, dy = dy, -dx
            cells.add((x + dx, y + dy))
        return cells

    def update_state(self, units, *, now: float | None = None) -> str:
        """Select a motion. In combat, now is the shared battle time in seconds."""
        if now is not None:
            self.sync_animation_time(now)
        cells = self.attack_cells()
        # Moving monsters have fractional positions; each integer is a tile center.
        attacking = self.attackSpeed > 0 and any(
            unit.race == "monster"
            and getattr(unit, "hp", 1) > 0
            and not getattr(unit, "reachedGoal", False)
            and (floor(unit.pos[0] + 0.5), floor(unit.pos[1] + 0.5)) in cells
            for unit in units
        )
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
