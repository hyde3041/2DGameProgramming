from character import Player


MAX_COST = 99
costCount = 1  # Seconds between cost increases. Must be positive.


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
        for character in self.character:
            character.deployed = False
            character.reset_animation(now)

    def can_deploy(self, character: Player) -> bool:
        return (
            self.scene == 2
            and any(member is character for member in self.character)
            and not character.deployed
            and self.cost >= character.cost
        )

    def deploy_character(self, character: Player, pos, now: float) -> bool:
        if not self.can_deploy(character):
            return False
        position = list(pos)
        if any(member.deployed and member.pos == position for member in self.character):
            return False
        self.cost -= character.cost
        character.pos = position
        character.deployed = True
        character.reset_animation(now)
        return True

    def update_battle(self, now: float):
        self.update_cost(now)
        for character in self.character:
            character.sync_animation_time(now)

    def update_cost(self, now: float):
        if self._cost_updated_at is None:
            return
        gained = int((now - self._cost_updated_at) / costCount)
        if gained > 0:
            self.cost = min(self.cost + gained, MAX_COST)
            self._cost_updated_at += gained * costCount

    def finish_battle(self, cleared: bool):
        if self.battle_room is None:
            return
        if cleared and self.battle_room not in self.pos:
            self.pos.append(self.battle_room)

        self.battle_room = None
        self._cost_updated_at = None
        self.scene = 1
        for character in self.character:
            character.deployed = False
            character.reset_animation(0.0)
