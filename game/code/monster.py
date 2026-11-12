from dataclasses import dataclass, field
from math import hypot, isfinite
from typing import ClassVar


@dataclass(kw_only=True)
class Monster:
    race: ClassVar[str] = "monster"

    attackSpeed: float  # Attacks per second.
    damage: int
    hp: int
    moveSpeed: float = 1.0  # Tiles per second.
    profile: str = ""
    pos: list[float] = field(default_factory=lambda: [0.0, 0.0])
    direction: str = "right"
    # Canonical offsets while facing down, with negative y pointing down.
    attackRange: list[list[int]] = field(default_factory=lambda: [[0, 0], [0, -1]])
    state: str = "walk"
    spawnPos: list[float] = field(default_factory=list, init=False)
    goalPos: list[float] = field(default_factory=list, init=False)
    route: list[list[float]] = field(default_factory=list, init=False)
    teleports: set[int] = field(default_factory=set, init=False)
    routeIndex: int = field(default=0, init=False)
    reachedGoal: bool = field(default=False, init=False)
    _movement_time: float | None = field(default=None, init=False, repr=False, compare=False)
    _animation_time: float = field(default=0.0, init=False, repr=False, compare=False)
    _state_started_at: float | None = field(default=None, init=False, repr=False, compare=False)

    def assign_route(self, start, goal, route, now: float, *, teleports=()):
        """Accept one map-selected route in logical (column, -row) coordinates."""
        points = [list(point) for point in route]
        spawn, destination = list(start), list(goal)
        if not points or any(len(point) != 2 or not all(isfinite(v) for v in point)
                             for point in [spawn, destination, *points]):
            raise ValueError("Monster route must contain finite two-coordinate points")
        if points[0] != spawn or points[-1] != destination or not isfinite(now):
            raise ValueError("Monster route must start at spawn and end at goal")
        teleport_indices = set(teleports)
        if any(type(index) is not int or not 1 <= index < len(points) for index in teleport_indices):
            raise ValueError("Teleport indices must identify destination waypoints after spawn")
        self.spawnPos = spawn
        self.goalPos = destination
        self.route = points
        self.teleports = teleport_indices
        self.pos = spawn.copy()
        self.routeIndex = 1
        self.reachedGoal = False
        self.reset_animation(now)

    def update(self, now: float):
        """Follow the assigned route once; never choose or recalculate a path here."""
        if not isfinite(now):
            raise ValueError("Battle time must be finite")
        elapsed = 0.0 if self._movement_time is None else max(0.0, now - self._movement_time)
        self._movement_time = now
        self.sync_animation_time(now)
        if not self.route or self.reachedGoal or self.hp <= 0 or self.state != "walk" or self.moveSpeed <= 0:
            return

        remaining = elapsed * self.moveSpeed
        while self.routeIndex < len(self.route):
            target = self.route[self.routeIndex]
            if self.routeIndex in self.teleports:
                self.pos = target.copy()
                self.routeIndex += 1
                continue
            dx, dy = target[0] - self.pos[0], target[1] - self.pos[1]
            distance = hypot(dx, dy)
            if distance <= 1e-9:
                self.pos = target.copy()
                self.routeIndex += 1
                continue
            if remaining <= 0:
                break
            if dx:
                self.direction = "right" if dx > 0 else "left"
            if remaining + 1e-9 >= distance:
                self.pos = target.copy()
                self.routeIndex += 1
                remaining = max(0.0, remaining - distance)
            else:
                self.pos[0] += dx * remaining / distance
                self.pos[1] += dy * remaining / distance
                break
        if self.routeIndex >= len(self.route):
            self.pos = self.goalPos.copy()
            self.reachedGoal = True

    def reset_animation(self, battle_time: float):
        self.state = "walk"
        self._movement_time = battle_time
        self._animation_time = battle_time
        self._state_started_at = battle_time

    def sync_animation_time(self, battle_time: float):
        if self._state_started_at is None or battle_time < self._animation_time:
            self._state_started_at = battle_time
        self._animation_time = battle_time

    def set_state(self, state: str, *, now: float | None = None):
        """Switch between the existing walk and attack motions."""
        if state not in ("walk", "attack"):
            raise ValueError("Monster state must be 'walk' or 'attack'")
        if now is not None:
            self.sync_animation_time(now)
        if self._state_started_at is None or state != self.state:
            self._state_started_at = self._animation_time
        if state != self.state:
            self._movement_time = self._animation_time
        self.state = state

    def motion_frame(self, frame_count: int, fps: float, now: float | None = None) -> int:
        """Select a frame from the same battle clock used by player characters."""
        if self._state_started_at is None:
            return 0
        if now is None:
            now = self._animation_time
        if self.state == "attack":
            fps = frame_count * self.attackSpeed
        return int((now - self._state_started_at) * fps) % frame_count
