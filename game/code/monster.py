from dataclasses import dataclass, field
from math import floor, hypot, isfinite
import random
from typing import ClassVar

from character import Player


BLOCK_RADIUS = 0.45  # Contact half-width in tiles, inside the blocker's own cell.


def update_monsters(monsters, characters, now: float, *, blockers=None):
    """Update blocking, movement and attacks using the same battle clock."""
    ground_characters = characters if blockers is None else blockers
    blockers = [character for character in ground_characters
                if character.deployed and character.hp > 0 and character.canStop > 0]
    slots = {id(character): character.canStop for character in blockers}
    # Keep existing targets before considering any new arrivals.
    for monster in monsters:
        blocker = monster.blockedBy
        if blocker is None:
            continue
        if (monster.hp > 0 and not monster.reachedGoal
                and slots.get(id(blocker), 0) > 0
                and all(abs(a - b) <= BLOCK_RADIUS + 1e-9 for a, b in zip(monster.pos, blocker.pos))):
            slots[id(blocker)] -= 1
        else:
            monster.release_block(now)

    for monster in monsters:
        was_blocked = monster.blockedBy is not None
        available = [character for character in blockers if slots[id(character)] > 0]
        monster.update(now, blockers=available)
        if not was_blocked and monster.blockedBy is not None:
            slots[id(monster.blockedBy)] -= 1
        monster.try_attack(characters, now=now)


@dataclass(kw_only=True)
class Monster:
    race: ClassVar[str] = "monster"

    attackSpeed: float  # Attacks per second.
    damage: int
    hp: int
    attackDelay: float = 1.0  # Walking seconds after a free attack finishes.
    moveSpeed: float = 0.6  # Tiles per battle second.
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
    blockedBy: Player | None = field(default=None, init=False, repr=False, compare=False)
    _walk_phase: float = field(default_factory=lambda: random.random(), init=False, repr=False, compare=False)
    _movement_time: float | None = field(default=None, init=False, repr=False, compare=False)
    _animation_time: float = field(default=0.0, init=False, repr=False, compare=False)
    _state_started_at: float | None = field(default=None, init=False, repr=False, compare=False)
    _attack_ends_at: float | None = field(default=None, init=False, repr=False, compare=False)
    _next_attack_at: float = field(default=0.0, init=False, repr=False, compare=False)

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

    def attack_cells(self) -> set[tuple[int, int]]:
        """Rotate canonical range offsets around the monster's current tile."""
        x, y = (floor(value + 0.5) for value in self.pos)
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

    def try_attack(self, units, *, now: float) -> bool:
        """Start one free attack; blocked monsters already attack continuously."""
        if (self.hp <= 0 or self.reachedGoal or self.blockedBy is not None
                or self.state != "walk" or self.attackSpeed <= 0 or now < self._next_attack_at):
            return False
        cells = self.attack_cells()
        if not any(unit.race == "people" and unit.deployed and unit.hp > 0
                   and tuple(unit.pos) in cells for unit in units):
            return False
        self.set_state("attack", now=now)
        self._attack_ends_at = now + 1.0 / self.attackSpeed
        return True

    def release_block(self, now: float):
        self.blockedBy = None
        self.set_state("walk", now=now)
        self._next_attack_at = now + max(0.0, self.attackDelay)

    def _try_block(self, destination, blockers, now: float) -> bool:
        """Stop at the first contact along this segment, including zero movement."""
        closest = None
        for character in blockers:
            enter, leave = 0.0, 1.0
            for start, end, center in zip(self.pos, destination, character.pos):
                step = end - start
                if abs(step) <= 1e-12:
                    if abs(start - center) > BLOCK_RADIUS + 1e-9:
                        break
                else:
                    first = (center - BLOCK_RADIUS - start) / step
                    last = (center + BLOCK_RADIUS - start) / step
                    enter = max(enter, min(first, last))
                    leave = min(leave, max(first, last))
                if enter > leave:
                    break
            else:
                if closest is None or enter < closest[0]:
                    closest = (enter, character)
        if closest is None:
            return False
        fraction, blocker = closest
        self.pos = [start + (end - start) * fraction for start, end in zip(self.pos, destination)]
        self.blockedBy = blocker
        self._attack_ends_at = None
        if abs(blocker.pos[0] - self.pos[0]) > 1e-9:
            self.direction = "right" if blocker.pos[0] > self.pos[0] else "left"
        self.set_state("attack", now=now)
        return True

    def update(self, now: float, *, blockers=()):
        """Follow the assigned route once; never choose or recalculate a path here."""
        if not isfinite(now):
            raise ValueError("Battle time must be finite")
        if self._attack_ends_at is not None:
            if now < self._animation_time:
                self.set_state("walk", now=now)
                self._next_attack_at = now
            elif now >= self._attack_ends_at:
                finished_at = self._attack_ends_at
                self.set_state("walk", now=finished_at)
                self._next_attack_at = finished_at + max(0.0, self.attackDelay)
        elapsed = 0.0 if self._movement_time is None else max(0.0, now - self._movement_time)
        self._movement_time = now
        self.sync_animation_time(now)
        if not self.route or self.reachedGoal or self.hp <= 0 or self.blockedBy is not None:
            return
        if self._try_block(self.pos, blockers, now) or self.state != "walk" or self.moveSpeed <= 0:
            return

        remaining = elapsed * self.moveSpeed
        while self.routeIndex < len(self.route):
            target = self.route[self.routeIndex]
            if self.routeIndex in self.teleports:
                self.pos = target.copy()
                self.routeIndex += 1
                if self._try_block(self.pos, blockers, now):
                    return
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
            step = min(remaining, distance)
            destination = [self.pos[0] + dx * step / distance, self.pos[1] + dy * step / distance]
            if self._try_block(destination, blockers, now):
                return
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
        self.blockedBy = None
        self._attack_ends_at = None
        self._next_attack_at = battle_time
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
        if state != self.state or state == "walk":
            self._attack_ends_at = None
        if now is not None:
            self.sync_animation_time(now)
        if self._state_started_at is None or state != self.state:
            self._state_started_at = self._animation_time
        if state != self.state:
            self._movement_time = self._animation_time
        self.state = state

    def motion_frame(self, frame_count: int, fps: float, now: float | None = None) -> int:
        """Select a frame from the same battle clock used by player characters."""
        # Each spawn gets one fixed walking offset, never a new random frame per draw.
        offset = int(self._walk_phase * frame_count) if self.state == "walk" else 0
        if self._state_started_at is None:
            return offset
        if now is None:
            now = self._animation_time
        if self.state == "attack":
            fps = frame_count * self.attackSpeed
        return (int((now - self._state_started_at) * fps) + offset) % frame_count
