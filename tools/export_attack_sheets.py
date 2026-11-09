"""Package the current game sheets without resampling any image."""
import json
import struct
import sys
import zipfile
from pathlib import Path

root = Path(__file__).resolve().parents[1]
character = sys.argv[1]
if character not in ("archer", "crossbowman", "swordsman"):
    raise ValueError("Unsupported character")
metadata = json.loads((root / f"metadata/character/attack/{character}.json").read_text(encoding="utf-8"))
assert metadata["frames_per_direction"] == 16
output = root / f".build/deliverables/{character}-attack-16frames.zip"
output.parent.mkdir(parents=True, exist_ok=True)
images = {}
for direction, animation in metadata["animations"].items():
    view = "side" if direction == "right" else direction
    images[f"{view}/attack-sheet.png"] = (root / "game" / animation["file"]).read_bytes()
    assert struct.unpack(">II", images[f"{view}/attack-sheet.png"][16:24]) == (1280, 1280)
    assert len(animation["frames"]) == 16
for direction, file in metadata.get("effect", {}).get("sheets", {}).items():
    view = "side" if direction == "right" else direction
    images[f"{view}/slash-effect-sheet.png"] = (root / "game" / file).read_bytes()
    assert struct.unpack(">II", images[f"{view}/slash-effect-sheet.png"][16:24]) == (1280, 1280)
with zipfile.ZipFile(output, "w", compression=zipfile.ZIP_DEFLATED) as archive:
    for name, data in images.items():
        archive.writestr(name, data)
    readme = "3 directions: front, back, side\n16 frames per sheet, 4 columns x 4 rows\nSheet: 1280x1280 RGBA PNG; cell: 320x320\nRow-major order; 16 FPS, 1 second, play once then return to Idle\nFoot pivot: (160,288), top-left coordinates\n"
    if metadata.get("effect"):
        readme += "The slash is already included in attack-sheet.png.\nslash-effect-sheet.png is the separate reusable source effect; do not draw it twice.\n"
    archive.writestr("README.txt", readme)
with zipfile.ZipFile(output) as archive:
    assert archive.testzip() is None
    for name, data in images.items():
        assert archive.read(name) == data
print(output)
