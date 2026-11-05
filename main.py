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


CANVAS_WIDTH = 800
CANVAS_HEIGHT = 600
MAP_PATH = (
    Path(__file__).resolve().parent
    / "asset/map/dungeon-room.png"
)


def main():
    open_canvas(CANVAS_WIDTH, CANVAS_HEIGHT)

    try:
        map_image = load_image(str(MAP_PATH))
        running = True

        while running:
            for event in get_events():
                if event.type == SDL_QUIT:
                    running = False
                elif event.type == SDL_KEYDOWN and event.key == SDLK_ESCAPE:
                    running = False

            if not running:
                break

            clear_canvas()
            map_image.draw(CANVAS_WIDTH // 2, CANVAS_HEIGHT // 2)
            update_canvas()
            delay(0.01)
    finally:
        close_canvas()


if __name__ == "__main__":
    main()
