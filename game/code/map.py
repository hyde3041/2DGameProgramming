import json
import random
from dataclasses import dataclass, field
from enum import IntEnum
from pathlib import Path

from pico2d import load_image


class MapType(IntEnum):
    START = 0
    BATTLE = 1
    SHOP = 2
    TREASURE = 3
    BOSS = 4


class TileType(IntEnum):
    BLOCKED = 0
    GROUND = 1
    ELEVATED = 2


@dataclass
class Room:
    map_type: MapType
    left: int
    top: int
    map_index: int | None = None
    monsters: dict[str, int] = field(default_factory=dict)
    shop_items: list[int] = field(default_factory=list)
    treasure_items: list[int] = field(default_factory=list)


GAME_DIRECTORY = Path(__file__).resolve().parents[1]
METADATA_DIRECTORY = GAME_DIRECTORY.parent / "metadata"
MAP_ASSET_DIRECTORY = GAME_DIRECTORY / "asset/map"
MAP_DIRECTORY = MAP_ASSET_DIRECTORY / "stage/main/cave"
ROUTE_DIRECTORY = MAP_ASSET_DIRECTORY / "field/main"
ROUTE_COVER_PATH = MAP_ASSET_DIRECTORY / "field/icon/empty.png"
ROUTE_LAYOUTS = json.loads(
    (METADATA_DIRECTORY / "map/cave-routes.json").read_text(encoding="utf-8")
)
MAP_MANIFEST = {
    entry["number"]: entry
    for entry in json.loads(
        (METADATA_DIRECTORY / "map/manifest.json").read_text(encoding="utf-8")
    )["maps"]
}
BATTLE_MAP_NUMBERS = [
    number for number, entry in MAP_MANIFEST.items() if entry["category"] == "battle"
]
BOSS_MAP_NUMBERS = [
    number for number, entry in MAP_MANIFEST.items() if entry["category"] == "boss"
]
RELIC_NUMBERS = [
    relic["number"]
    for relic in json.loads(
        (METADATA_DIRECTORY / "item/relics.json").read_text(encoding="utf-8")
    )["relics"]
]
START_ROOM_NUMBER = 0
ROOM_SIZE = ROUTE_LAYOUTS["room_size"]
BATTLE_ROOM_COUNT = sum(
    room_type == MapType.BATTLE for room_type, _, _ in ROUTE_LAYOUTS["routes"][0]
)

GOBLIN = "goblin-scout"
SKELETON = "armored-skeleton"
GUARDIAN = "ancient-guardian"

# Provisional counts for our monsters, independent of the source game's waves.
CAVE_MONSTERS = {
    number: (
        {GUARDIAN: 1}
        if entry["category"] == "boss"
        else {GOBLIN: 5 + entry["tier"], SKELETON: max(0, entry["tier"] - 1)}
    )
    for number, entry in MAP_MANIFEST.items()
}

map_list = random.sample(BATTLE_MAP_NUMBERS, BATTLE_ROOM_COUNT)
map_index = map_list[0]
map_type = MapType.START
dungeon_map = None
battle_cells = {}
battle_grid = {}
route_rooms: list[Room] = []
route_links = []
route_cover = None

def load_map(index=None, map_kind=MapType.BATTLE):
    global dungeon_map, map_index, map_type, battle_cells, battle_grid

    index = map_index if index is None else index
    entry = MAP_MANIFEST[index]
    dungeon_map = load_image(str(GAME_DIRECTORY / entry["file"]))
    layout = json.loads(
        (GAME_DIRECTORY.parent / entry["metadata"]).read_text(encoding="utf-8")
    )
    # Match character coordinates: negative y points down the grid.
    battle_cells = {(cell["column"], -cell["row"]): cell for cell in layout["cells"]}
    battle_grid = layout["grid"]
    map_index = index
    map_type = map_kind
    return dungeon_map


def clear_map():
    global dungeon_map, map_type

    dungeon_map = None
    battle_cells.clear()
    battle_grid.clear()
    map_type = MapType.START


def cell_at(x, y):
    """Find the visible tile under a mouse position (top-left origin)."""
    # The last drawn (front/right) cell wins when two surfaces share an edge.
    for pos, cell in reversed(list(battle_cells.items())):
        left, top, width, height = cell["surface_rect"]
        polygon = cell.get("surface_polygon")
        if polygon is None:
            if left <= x < left + width and top <= y < top + height:
                return pos
            continue
        if not (left <= x <= left + width and top <= y <= top + height):
            continue
        # Projected tile tops are convex quads; their bounding-box corners can
        # lie outside the visible surface, so test every edge as well.
        sides = []
        for index, (x1, y1) in enumerate(polygon):
            x2, y2 = polygon[(index + 1) % len(polygon)]
            sides.append((x2 - x1) * (y - y1) - (y2 - y1) * (x - x1))
        if all(side >= -1e-7 for side in sides) or all(side <= 1e-7 for side in sides):
            return pos
    return None


def can_place(pos, characters, character):
    cell = battle_cells.get(pos)
    return (
        cell is not None
        and cell["tileType"] in (TileType.GROUND, TileType.ELEVATED)
        and cell["tileType"] in character.allowedTiles
        and not any(member.deployed and tuple(member.pos) == pos for member in characters)
    )


def load_route():
    global route_rooms, route_links, route_cover

    routes = ROUTE_LAYOUTS["routes"]
    route_index = random.randrange(len(routes))
    rooms = [Room(MapType(kind), left, top) for kind, left, top in routes[route_index]]
    battles = sorted(
        (room for room in rooms if room.map_type == MapType.BATTLE),
        key=lambda room: (room.top, room.left),
    )
    for room, index in zip(battles, map_list, strict=True):
        room.map_index = index
        room.monsters = CAVE_MONSTERS[index].copy()

    relics = random.sample(RELIC_NUMBERS, 4)
    for room in rooms:
        if room.map_type == MapType.SHOP:
            room.shop_items = relics[:3]
        elif room.map_type == MapType.TREASURE:
            room.treasure_items = relics[3:]
        elif room.map_type == MapType.BOSS:
            room.map_index = random.choice(BOSS_MAP_NUMBERS)
            room.monsters = CAVE_MONSTERS[room.map_index].copy()

    image = load_image(str(ROUTE_DIRECTORY / f"cave-route-{route_index}.png"))
    cover = load_image(str(ROUTE_COVER_PATH))
    route_rooms = rooms
    route_links = ROUTE_LAYOUTS["links"][route_index]
    route_cover = cover
    return image


def room_at(x, y):
    for number, room in enumerate(route_rooms):
        if (
            room.left <= x < room.left + ROOM_SIZE
            and room.top <= y < room.top + ROOM_SIZE
        ):
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

    for number, room in enumerate(route_rooms):
        if number not in visible:
            cover(room.left, room.top)

    for first, second in route_links:
        if first in visible and second in visible:
            continue
        first_room = route_rooms[first]
        second_room = route_rooms[second]
        x1, y1 = first_room.left, first_room.top
        x2, y2 = second_room.left, second_room.top
        if y1 == y2:
            cover(min(x1, x2) + ROOM_SIZE, y1, abs(x2 - x1) - ROOM_SIZE)
        else:
            cover(x1, min(y1, y2) + ROOM_SIZE, ROOM_SIZE, abs(y2 - y1) - ROOM_SIZE)

    if cleared:
        route_cover.opacify(0.5)
        for number in cleared:
            room = route_rooms[number]
            cover(room.left, room.top)
        route_cover.opacify(1.0)
