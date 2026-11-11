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
