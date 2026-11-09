class Player:
    def __init__(self, hp: int = 0, money: int = 0, *, scene=None):
        self.pos: list[int] = []
        self.item: list = []
        self.character: list = []
        self.hp = hp
        self.money = money
        self.scene = scene
        
