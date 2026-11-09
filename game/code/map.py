import json
import random
from pathlib import Path

from pico2d import load_image


GAME_DIRECTORY = Path(__file__).resolve().parents[1]
MAP_ASSET_DIRECTORY = GAME_DIRECTORY / "asset/map"
MAP_DIRECTORY = MAP_ASSET_DIRECTORY / "stage/main/cave"
ROUTE_DIRECTORY = MAP_ASSET_DIRECTORY / "field/main"
ROUTE_COVER_PATH = MAP_ASSET_DIRECTORY / "field/icon/empty.png"
ROUTE_LAYOUTS = json.loads(
    (GAME_DIRECTORY.parent / "metadata/map/cave-routes.json").read_text(encoding="utf-8")
)
BATTLE_ROOM_TYPE = 1
START_ROOM_NUMBER = 0
ROOM_SIZE = ROUTE_LAYOUTS["room_size"]
BATTLE_ROOM_COUNT = sum(
    room_type == BATTLE_ROOM_TYPE for room_type, _, _ in ROUTE_LAYOUTS["routes"][0]
)

map_list = random.sample(range(20), BATTLE_ROOM_COUNT)
map_index = map_list[0]
dungeon_map = None
battle_rooms = {}
route_rooms = []
route_links = []
route_cover = None

def load_map(index=None):
    global dungeon_map, map_index

    index = map_index if index is None else index
    dungeon_map = load_image(str(MAP_DIRECTORY / f"cave-{index}.png"))
    map_index = index
    return dungeon_map


def load_route():
    global battle_rooms, route_rooms, route_links, route_cover

    routes = ROUTE_LAYOUTS["routes"]
    route_index = random.randrange(len(routes))
    rooms = routes[route_index]
    battles = sorted(
        (number for number, (kind, _, _) in enumerate(rooms) if kind == BATTLE_ROOM_TYPE),
        key=lambda number: (rooms[number][2], rooms[number][1]),
    )
    assigned_maps = dict(zip(battles, map_list, strict=True))
    image = load_image(str(ROUTE_DIRECTORY / f"cave-route-{route_index}.png"))
    cover = load_image(str(ROUTE_COVER_PATH))
    battle_rooms = assigned_maps
    route_rooms = rooms
    route_links = ROUTE_LAYOUTS["links"][route_index]
    route_cover = cover
    return image


def room_at(x, y):
    for number, (_, left, top) in enumerate(route_rooms):
        if left <= x < left + ROOM_SIZE and top <= y < top + ROOM_SIZE:
            return number
    return None


def visible_rooms(visited, cleared):
    opened = visited.union(cleared)
    visible = opened | {START_ROOM_NUMBER}
    for first, second in route_links:
        if first in opened:
            visible.add(second)
        if second in opened:
            visible.add(first)
    return visible


def draw_route(image, visited, cleared):
    image.draw(image.w // 2, image.h // 2)
    visible = visible_rooms(visited, cleared)

    def cover(left, top, width=ROOM_SIZE, height=ROOM_SIZE):
        route_cover.draw(left + width / 2, image.h - top - height / 2, width, height)

    for number, (_, left, top) in enumerate(route_rooms):
        if number not in visible:
            cover(left, top)

    for first, second in route_links:
        if first in visible and second in visible:
            continue
        _, x1, y1 = route_rooms[first]
        _, x2, y2 = route_rooms[second]
        if y1 == y2:
            cover(min(x1, x2) + ROOM_SIZE, y1, abs(x2 - x1) - ROOM_SIZE)
        else:
            cover(x1, min(y1, y2) + ROOM_SIZE, ROOM_SIZE, abs(y2 - y1) - ROOM_SIZE)

    if cleared:
        route_cover.opacify(0.5)
        for number in cleared:
            _, left, top = route_rooms[number]
            cover(left, top)
        route_cover.opacify(1.0)
