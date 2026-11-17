from dataclasses import dataclass
from math import floor, hypot
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from monster import Monster


# Frame indices refer to the 16-frame attack sheets.
ATTACK_HIT_FRAMES = {
    "0-swordsman": 10,
    "1-guardian": 8,
    "2-archer": 7,
    "3-crossbowman": 7,
    "4-cleric": 7,
    "5-herbalist": 8,
    "6-frost-mage": 10,
    "7-shadow-thief": 7,
    "9-whitehair": 7,
}

# Profiles in this table launch single-target projectiles. Speed is in tiles/second.
PROJECTILE_SPEEDS = {
    "2-archer": 9.0,
    "3-crossbowman": 12.0,
    "4-cleric": 6.0,
    "5-herbalist": 5.0,
    "6-frost-mage": 7.0,
}

HIT_EFFECT_DURATION = 0.20


@dataclass
class Projectile:
    profile: str
    pos: tuple[float, float]
    heading: tuple[float, float]
    target: "Monster"
    source_pos: tuple[float, float]
    damage: int
    direction: str
    speed: float

    def advance(self, elapsed: float) -> bool:
        """Move toward the locked target and report whether the shot arrived."""
        dx = self.target.pos[0] - self.pos[0]
        dy = self.target.pos[1] - self.pos[1]
        distance = hypot(dx, dy)
        if distance:
            self.heading = (dx / distance, dy / distance)
        step = self.speed * elapsed
        if distance <= step:
            self.pos = tuple(self.target.pos)
            return True
        x, y = self.pos
        vx, vy = self.heading
        self.pos = (x + vx * step, y + vy * step)
        return False


@dataclass(frozen=True)
class HitEffect:
    profile: str
    pos: tuple[float, float]
    started_at: float
    duration: float
    direction: str


class PlayerCombat:
    """Resolve player hits and projectile travel on the same clock as the sprites."""

    def __init__(self):
        self.projectiles: list[Projectile] = []
        self.effects: list[HitEffect] = []
        self._last_time: float | None = None
        self._hit_cycles: dict[int, int] = {}

    def clear(self):
        self.projectiles.clear()
        self.effects.clear()
        self._hit_cycles.clear()
        self._last_time = None

    def _hit(self, target: "Monster", damage: int, profile: str, direction: str, now: float):
        target.hp = max(0, target.hp - damage)
        self.effects.append(HitEffect(profile, tuple(target.pos), now, HIT_EFFECT_DURATION, direction))

    def _advance_projectiles(self, monsters, elapsed: float, now: float):
        active_targets = {id(monster) for monster in monsters if monster.hp > 0 and not monster.reachedGoal}
        flying = []
        for projectile in self.projectiles:
            target = projectile.target
            if id(target) not in active_targets or target.hp <= 0:
                continue
            if elapsed > 0 and projectile.advance(elapsed):
                self._hit(target, projectile.damage, projectile.profile, projectile.direction, now)
            else:
                flying.append(projectile)
        self.projectiles[:] = flying

    def _launch(self, character, targets, speed: float):
        x, y = character.pos
        target = min(targets, key=lambda unit: (unit.pos[0] - x)**2 + (unit.pos[1] - y)**2)
        dx, dy = target.pos[0] - x, target.pos[1] - y
        distance = hypot(dx, dy)
        heading = (dx / distance, dy / distance) if distance else (0.0, 0.0)
        self.projectiles.append(Projectile(
            profile=character.profile, pos=(x, y), heading=heading, target=target,
            source_pos=(x, y), damage=max(0, character.damage),
            direction=character.direction, speed=speed,
        ))

    def update(self, characters, monsters, now: float):
        if self._last_time is not None and now < self._last_time:
            self.clear()
        elapsed = 0.0 if self._last_time is None else now - self._last_time
        self._last_time = now
        self.effects[:] = [effect for effect in self.effects if now - effect.started_at < effect.duration]
        self._advance_projectiles(monsters, elapsed, now)

        for character in characters:
            identity = id(character)
            if not character.deployed or character.hp <= 0:
                self._hit_cycles.pop(identity, None)
                continue
            if character.state != "attack":
                # Idle also covers reset_animation() on a retreat and redeploy.
                self._hit_cycles.pop(identity, None)
            if character.update_state(monsters, now=now) != "attack":
                self._hit_cycles.pop(identity, None)
                continue

            hit_phase = ATTACK_HIT_FRAMES.get(character.profile, 8) / 16
            hit_cycle = floor(character.attack_cycles(now) - hit_phase + 1e-9)
            if hit_cycle <= self._hit_cycles.get(identity, -1):
                continue
            self._hit_cycles[identity] = hit_cycle
            # A slow frame only resolves the latest hit, rather than replaying missed cycles.
            targets = character.targets_in_range(monsters)
            speed = PROJECTILE_SPEEDS.get(character.profile)
            if speed is not None:
                self._launch(character, targets, speed)
            else:
                for target in targets:
                    self._hit(target, max(0, character.damage), character.profile, character.direction, now)
