class Player:
    def __init__(self, hp: int = 0, money: int = 0, *, scene=None):
        self.pos: list[int] = []
        self.item: list = []
        self.character: list = []
        self.hp = hp
        self.money = money
        self.scene = scene
        self.map: int = 0
        self.battle_room: int | None = None

    def finish_battle(self, cleared: bool):
        if self.battle_room is None:
            return
        if cleared and self.battle_room not in self.pos:
            self.pos.append(self.battle_room)

        self.battle_room = None
        self.map = 0
        self.scene = 1
