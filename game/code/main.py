from pathlib import Path

from pico2d import (
    SDL_KEYDOWN,
    SDL_QUIT,
    SDLK_ESCAPE,
    clear_canvas,
    close_canvas,
    delay,
    get_events,
    get_time,
    load_image,
    open_canvas,
    update_canvas,
)

from idle_sprite import IdleSprite


CANVAS_WIDTH = 800
CANVAS_HEIGHT = 600
MAP_PATH = (
    Path(__file__).resolve().parent
    / "game/asset/map/stage/main/dungeon-room.png"
)


def main():
    open_canvas(CANVAS_WIDTH, CANVAS_HEIGHT)

    try:
        map_image = load_image(str(MAP_PATH))
        archer = IdleSprite("archer", 208, 444, scale=0.5)
        previous_time = get_time()
        running = True

        while running:
            for event in get_events():
                if event.type == SDL_QUIT:
                    running = False
                elif event.type == SDL_KEYDOWN and event.key == SDLK_ESCAPE:
                    running = False

            if not running:
                break

            current_time = get_time()
            delta_time = current_time - previous_time
            previous_time = current_time
            archer.update(delta_time)

            clear_canvas()
            map_image.draw(CANVAS_WIDTH // 2, CANVAS_HEIGHT // 2)
            archer.draw()
            update_canvas()
            delay(0.01)
    finally:
        close_canvas()


if __name__ == "__main__":
    main()
