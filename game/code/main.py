from pathlib import Path

from pico2d import (
    SDL_KEYDOWN,
    SDL_QUIT,
    SDLK_ESCAPE,
    clear_canvas,
    close_canvas,
    delay,
    get_events,
    load_image,
    open_canvas,
    update_canvas,
)


WIDTH = 800
HEIGHT = 600
MAP_PATH = Path(__file__).resolve().parents[1] / "asset/map/stage/main/dungeon-room.png"


def main():
    open_canvas(WIDTH, HEIGHT)
    try:
        dungeon_map = load_image(str(MAP_PATH))
        while True:
            for event in get_events():
                if event.type == SDL_QUIT:
                    return
                if event.type == SDL_KEYDOWN and event.key == SDLK_ESCAPE:
                    return

            clear_canvas()
            dungeon_map.draw(WIDTH // 2, HEIGHT // 2)
            update_canvas()
            delay(1 / 60)
    finally:
        close_canvas()


if __name__ == "__main__":
    main()
