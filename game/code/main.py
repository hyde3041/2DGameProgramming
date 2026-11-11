from pathlib import Path

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
from battle_preview import BattlePreview
from user import User


WIDTH = 800
HEIGHT = 600
TITLE_PATH = Path(__file__).resolve().parents[1] / "asset/etc/title/title-screen.png"


def main():
    user = User(scene=0)
    title_image = None
    route_image = None
    battle_preview = None
    visited_rooms = set()
    open_canvas(WIDTH, HEIGHT)
    try:
        title_image = load_image(str(TITLE_PATH))
        while True:
            for event in get_events():
                if event.type == SDL_QUIT:
                    return
                if event.type == SDL_KEYDOWN:
                    if (
                        dungeon.map_type == dungeon.MapType.BATTLE
                        and event.key in (SDLK_ESCAPE, SDLK_q)
                    ):
                        user.finish_battle(cleared=event.key == SDLK_q)
                        battle_preview = None
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
                        battle_preview = BattlePreview(room)
                        user.battle_room = room_number
                        user.scene = 2
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
            else:
                dungeon.dungeon_map.draw(WIDTH // 2, HEIGHT // 2)
                battle_preview.draw()
            update_canvas()
            delay(1 / 60)
    finally:
        title_image = None
        route_image = None
        battle_preview = None
        dungeon.clear_map()
        dungeon.route_cover = None
        close_canvas()


if __name__ == "__main__":
    main()
