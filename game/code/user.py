from character import Player


MAX_COST = 99


class User:
    def __init__(self, hp: int = 0, money: int = 0, *, scene=None):
        self.pos: list[int] = []
        self.item: list = []
        self.character: list[Player] = []
        self.hp = hp
        self.money = money
        self.cost = 0
        self.scene = scene
        self.battle_room: int | None = None
        self._cost_updated_at: float | None = None

    def begin_battle(self, room: int, now: float):
        self.battle_room = room
        self.scene = 2
        self.cost = 0
        self._cost_updated_at = now

    def update_cost(self, now: float):
        if self._cost_updated_at is None:
            return
        gained = int(now - self._cost_updated_at)
        if gained > 0:
            self.cost = min(self.cost + gained, MAX_COST)
            self._cost_updated_at += gained

    def finish_battle(self, cleared: bool):
        if self.battle_room is None:
            return
        if cleared and self.battle_room not in self.pos:
            self.pos.append(self.battle_room)

        self.battle_room = None
        self._cost_updated_at = None
        self.scene = 1
