from dataclasses import dataclass, field
from typing import ClassVar


@dataclass(kw_only=True)
class Player:
    race: ClassVar[str] = "people"
    direction: ClassVar[str] = "down"

    attackSpeed: float  # Attacks per second.
    damage: int
    hp: int
    cost: int
    pos: list[int] = field(default_factory=lambda: [0, 0])
    # Tile offsets from the player, with negative y pointing down.
    attackRange: list[list[int]] = field(default_factory=lambda: [[0, 0], [0, -1]])
    state: str = "idle"

    def update_state(self, units) -> str:
        """Select the motion using units with a race and tile position."""
        x, y = self.pos
        cells = {(x + dx, y + dy) for dx, dy in self.attackRange}
        attacking = any(unit.race == "monster" and tuple(unit.pos) in cells for unit in units)
        self.state = "attack" if attacking else "idle"
        return self.state
