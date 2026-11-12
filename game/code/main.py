from time import monotonic

from pico2d import (
    SDL_BUTTON_LEFT,
    SDL_KEYDOWN,
    SDL_MOUSEBUTTONDOWN,
    SDL_QUIT,
    SDLK_ESCAPE,
    SDLK_q,
    clear_canvas,
    close_canvas,
    delay,
    get_events,
    load_image,
    open_canvas,
    update_canvas,
)

import map as dungeon
from character import DEPLOYMENT_COSTS
from user import User


WIDTH = 800
HEIGHT = 600
TIME_SCALE = 1.0  # Battle speed: 0 pauses, 2 runs at double speed.
ASSET_DIRECTORY = dungeon.GAME_DIRECTORY / "asset"
TITLE_PATH = ASSET_DIRECTORY / "etc/title/title-screen.png"
UI_DIRECTORY = ASSET_DIRECTORY / "etc/ui"
PROFILE_DIRECTORY = ASSET_DIRECTORY / "character/player/main"


def draw_number(digits, number, right, y, width):
    x = right - width / 2
    for digit in reversed(str(number)):
        digits.clip_draw(int(digit) * 20, 0, 20, 32, x, y, width, width * 1.6)
        x -= width


def draw_battle_ui(panel, digits, cards, *, cost, defense_points, remaining_enemies):
    for index, (portrait, price) in enumerate(cards):
        portrait.opacify(1.0 if cost >= price else 0.5)
        portrait.draw(218 + 61 * index, 40, 56, 56)
    panel.draw(WIDTH // 2, HEIGHT // 2)

    draw_number(digits, remaining_enemies, 388, 570, 16)
    draw_number(digits, defense_points, 488, 570, 16)
    draw_number(digits, cost, 774, 40, 17)
    for index, (_, price) in enumerate(cards):
        draw_number(digits, price, 242 + 61 * index, 58, 9)


def main():
    user = User(hp=3, scene=0)
    title_image = None
    route_image = None
    hud_panel = None
    hud_digits = None
    cards = []
    visited_rooms = set()
    battle_time = 0.0
    previous_frame_time = 0.0
    open_canvas(WIDTH, HEIGHT)
    try:
        title_image = load_image(str(TITLE_PATH))
        hud_panel = load_image(str(UI_DIRECTORY / "battle-hud.png"))
        hud_digits = load_image(str(UI_DIRECTORY / "battle-hud-digits.png"))
        cards = [
            (load_image(str(PROFILE_DIRECTORY / name / "skill/profile/deployment-square.png")), price)
            for name, price in DEPLOYMENT_COSTS.items()
        ]
        while True:
            for event in get_events():
                if event.type == SDL_QUIT:
                    return
                if event.type == SDL_KEYDOWN:
                    if (
                        user.scene == 2
                        and event.key in (SDLK_ESCAPE, SDLK_q)
                    ):
                        user.finish_battle(cleared=event.key == SDLK_q)
                        dungeon.clear_map()
                        continue
                    if event.key == SDLK_ESCAPE:
                        return
                if user.scene == 0 and event.type in (SDL_KEYDOWN, SDL_MOUSEBUTTONDOWN):
                    route_image = dungeon.load_route()
                    title_image = None
                    user.scene = 1
                elif (
                    user.scene == 1
                    and event.type == SDL_MOUSEBUTTONDOWN
                    and event.button == SDL_BUTTON_LEFT
                ):
                    room_number = dungeon.room_at(event.x, event.y)
                    if room_number not in dungeon.visible_rooms(visited_rooms, user.pos):
                        continue

                    room = dungeon.route_rooms[room_number]
                    if (
                        room.map_type == dungeon.MapType.BATTLE
                        and room_number not in user.pos
                    ):
                        dungeon.load_map(room.map_index)
                        battle_time = 0.0
                        previous_frame_time = monotonic()
                        user.begin_battle(room_number, battle_time)
                    elif room.map_type in (
                        dungeon.MapType.START,
                        dungeon.MapType.SHOP,
                        dungeon.MapType.TREASURE,
                    ):
                        visited_rooms.add(room_number)

            clear_canvas()
            if user.scene == 0:
                title_image.draw(WIDTH // 2, HEIGHT // 2, WIDTH, HEIGHT)
            elif user.scene == 1:
                dungeon.draw_route(route_image, visited_rooms, user.pos)
            elif user.scene == 2:
                frame_now = monotonic()
                delta_time = (frame_now - previous_frame_time) * TIME_SCALE
                previous_frame_time = frame_now
                battle_time += delta_time
                user.update_battle(battle_time)
                dungeon.dungeon_map.draw(WIDTH // 2, HEIGHT // 2)
                room = dungeon.route_rooms[user.battle_room]
                draw_battle_ui(
                    hud_panel, hud_digits, cards,
                    cost=user.cost,
                    defense_points=user.hp,
                    remaining_enemies=sum(room.monsters.values()),
                )
            update_canvas()
            delay(1 / 60)
    finally:
        title_image = None
        route_image = None
        hud_panel = None
        hud_digits = None
        cards.clear()
        dungeon.clear_map()
        dungeon.route_cover = None
        close_canvas()


if __name__ == "__main__":
    main()
