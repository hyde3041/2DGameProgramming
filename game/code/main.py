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
from player import Player


WIDTH = 800
HEIGHT = 600
TITLE_PATH = Path(__file__).resolve().parents[1] / "asset/etc/title/title-screen.png"


def main():
    player = Player(scene=0)
    title_image = None
    route_image = None
    visited_rooms = set()
    open_canvas(WIDTH, HEIGHT)
    try:
        title_image = load_image(str(TITLE_PATH))
        while True:
            for event in get_events():
                if event.type == SDL_QUIT:
                    return
                if event.type == SDL_KEYDOWN:
                    if player.scene == 2 and event.key in (SDLK_ESCAPE, SDLK_q):
                        player.finish_battle(cleared=event.key == SDLK_q)
                        dungeon.dungeon_map = None
                        continue
                    if event.key == SDLK_ESCAPE:
                        return
                if player.scene == 0 and event.type in (SDL_KEYDOWN, SDL_MOUSEBUTTONDOWN):
                    route_image = dungeon.load_route()
                    title_image = None
                    player.scene = 1
                elif (
                    player.scene == 1
                    and event.type == SDL_MOUSEBUTTONDOWN
                    and event.button == SDL_BUTTON_LEFT
                ):
                    room = dungeon.room_at(event.x, event.y)
                    if room not in dungeon.visible_rooms(visited_rooms, player.pos):
                        continue

                    if room in dungeon.battle_rooms and room not in player.pos:
                        dungeon.load_map(dungeon.battle_rooms[room])
                        player.battle_room = room
                        player.map = dungeon.BATTLE_ROOM_TYPE
                        player.scene = 2
                    elif dungeon.route_rooms[room][0] in (0, 2, 3):
                        visited_rooms.add(room)

            clear_canvas()
            if player.scene == 0:
                title_image.draw(WIDTH // 2, HEIGHT // 2, WIDTH, HEIGHT)
            elif player.scene == 1:
                dungeon.draw_route(route_image, visited_rooms, player.pos)
            else:
                dungeon.dungeon_map.draw(WIDTH // 2, HEIGHT // 2)
            update_canvas()
            delay(1 / 60)
    finally:
        player.map = 0
        title_image = None
        route_image = None
        dungeon.dungeon_map = None
        dungeon.route_cover = None
        close_canvas()


if __name__ == "__main__":
    main()
