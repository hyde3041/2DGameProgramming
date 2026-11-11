from pico2d import load_image

from character import DEPLOYMENT_COSTS
from map import GAME_DIRECTORY


UI_DIRECTORY = GAME_DIRECTORY / "asset/etc/ui"
PROFILE_DIRECTORY = GAME_DIRECTORY / "asset/character/player/main"

class BattleHUD:
    def __init__(self):
        self.panel = load_image(str(UI_DIRECTORY / "battle-hud.png"))
        self.digits = load_image(str(UI_DIRECTORY / "battle-hud-digits.png"))
        self.cards = [
            (load_image(str(PROFILE_DIRECTORY / name / "skill/profile/deployment-square.png")), price)
            for name, price in DEPLOYMENT_COSTS.items()
        ]

    def draw_number(self, number, right, y, width):
        x = right - width / 2
        for digit in reversed(str(number)):
            self.digits.clip_draw(int(digit) * 20, 0, 20, 32, x, y, width, width * 1.6)
            x -= width

    def draw(self, *, cost, defense_points, remaining_enemies):
        for index, (portrait, price) in enumerate(self.cards):
            portrait.opacify(1.0 if cost >= price else 0.5)
            portrait.draw(218 + 61 * index, 40, 56, 56)
        self.panel.draw(400, 300)

        self.draw_number(remaining_enemies, 388, 570, 16)
        self.draw_number(defense_points, 488, 570, 16)
        self.draw_number(cost, 774, 40, 17)
        for index, (_, price) in enumerate(self.cards):
            self.draw_number(price, 242 + 61 * index, 58, 9)
