# 게임 데이터

프로젝트의 JSON 데이터를 모았습니다.

```text
metadata/
  character/
    sprites/     정적 시트·프레임 좌표와 목록, 9개
    idle/        최신 대기 모션 좌표·시간과 목록, 캐릭터별 레이어 설정, 17개
    attack/      궁수·석궁병·검사 16프레임 공격 좌표·시간, 원본과 제작 기록
    layers/      8명×3방향의 새 분리 원본·연결점·배치·원본 기준점과 목록, 11개
    direction/   배치 방향 선택 UI 정보, 1개
    skills.json  캐릭터 스킬 설계 데이터
  item/
    relics.json  유물 25종의 아이콘·시트 좌표·효과 정보
    effects.json 유물 효과의 수치와 발동 조건
  map/           전투·보스·특수 맵 78개의 좌표, 원본 출처, 배치와 목록
```

JSON의 `asset/...` 이미지 경로는 **`game/` 폴더**를 기준으로 읽습니다. 예를 들어 `asset/map/stage/main/cave/cave-0.png`의 실제 위치는 `game/asset/map/stage/main/cave/cave-0.png`입니다. `metadata/...` 데이터 경로는 저장소 루트 기준입니다.

이미지는 `game/asset/character/`, `game/asset/item/`, `game/asset/map/`에 있습니다. `game/code/main.py`는 맵 PNG를 불러오고, `IdleSprite`와 `ArcherSprite`는 대기·공격 JSON의 좌표와 시간을 읽습니다. 아래 `asset/...` 표기는 `game/`에 대한 상대 경로입니다.

## 캐릭터

플레이어 이미지와 분리 원본은 `asset/character/player/`에, 몬스터 걷기·공격 시트와 분리 원본은 `asset/character/monster/`에 둡니다. 몬스터 시트 경로와 재생 설정은 [monster-motion.json](character/monster-motion.json)에 있습니다.

`game/code/monster.py`의 `Monster`는 `race="monster"`이며 능력치, `moveSpeed`, 위치·방향, 걷기·공격 상태와 공통 전투 시간을 사용합니다. `map.spawn_monster()`가 출발점·가장 가까운 도달 가능 거점·고정 경로를 전달하고, 몬스터는 `spawnPos`, `goalPos`, `route`, `routeIndex`를 보관합니다. `update(battle_time)`은 `moveSpeed`(칸/초)에 따라 경유점을 순서대로 지나며 도착하면 `reachedGoal=True`가 됩니다. 이동 중 경로를 다시 찾지 않으며, 기록된 순간이동 구간은 벽을 가로질러 걷지 않고 즉시 건너갑니다.

몬스터의 기본 `moveSpeed`는 전투 시간 1초당 0.6칸이며, 생성 함수도 이 기본값을 사용합니다. 몬스터별 속도 지정은 그대로 허용합니다. 현재 프레임 번호를 저장하는 별도 필드는 없고, 각 몬스터의 `_animation_time`·`_state_started_at`으로 `motion_frame(frame_count, fps)`에서 번호를 계산합니다. 생성 시 `_walk_phase`를 한 번 무작위로 정해 걷기 시작 프레임을 분산합니다. 현재 16프레임 시트에서는 0~15 중 하나로 시작하며, 이후에는 전투 시간에 따라 순서대로 재생합니다. 같은 몬스터를 그릴 때마다 다시 무작위로 고르지 않으며 공격은 0번부터 시작합니다. 무작위 시작 위치는 이동 거리·속도 계산과 분리되어 있습니다.

전투에 들어가면 방의 몬스터 편성 수만큼 생성하고, 도달 가능한 입구들을 번갈아 사용합니다. `main.MONSTER_SPAWN_INTERVAL`은 기본 1초이며 이동·출현·애니메이션 모두 전투 배속을 따릅니다. 거점에 도착한 몬스터는 화면에서 제거하고 남은 적 수를 갱신합니다. 현재 연결 범위는 생성·경로 이동·도착까지이며 저지·피해·자동 승패 처리는 아직 없습니다.

검사, 수호기사, 궁수, 석궁병, 성직자, 약초사, 냉기술사, 그림자 도적의 8명입니다.

- `asset/character/player/main/<번호>-<캐릭터명>/skill/icon/`: 캐릭터별 스킬 아이콘 2개씩, 총 16개
- `asset/etc/direction/`: 상하좌우 배치 방향 선택 UI, 256×256 PNG와 통합 시트
- `asset/character/player/main/<번호>-<캐릭터명>/front/`: 정면 대기·공격 시트 2개
- `asset/character/player/main/<번호>-<캐릭터명>/back/`: 뒷면 대기·공격 시트 2개
- `asset/character/player/main/<번호>-<캐릭터명>/side/`: 오른쪽 측면 대기·공격 시트 2개
- `asset/character/player/main/<번호>-<캐릭터명>/skill/profile/deployment.png`: 배치 프로필 카드
- `asset/character/player/main/<번호>-<캐릭터명>/skill/profile/skill-card.png`: 스킬 프로필 카드
- `asset/character/player/icon/source/<캐릭터명>/`: 원본 개별 프레임과 정적 통합 시트 보관

각 방향 폴더에는 `idle-sheet.png`와 `attack-sheet.png`만 보관합니다. **궁수·석궁병·검사 공격은 각 방향 16프레임·16FPS·1초, 4열×4행의 1280×1280 PNG**입니다. 다른 5명의 공격은 기존 3프레임·960×320 시트를 유지합니다. 한 프레임은 모두 320×320입니다. `metadata/character/sprites/` JSON의 `directional_attack_sheets`에 방향별 공격 시트 경로와 좌표·시간을 정리했습니다. [궁수 제작 기록](character/attack/README.md), [석궁병 제작 기록](character/attack/crossbowman-connected.md), [검사 제작 기록](character/attack/swordsman.md)에 재생 데이터와 원본을 기록합니다.

전체 동료 목록 그림은 `asset/character/player/character-overview.png`, 검사 소개 그림은 `asset/character/player/main/0-swordsman/skill/profile/cover.png`입니다.

배치할 칸을 고르면 `asset/etc/direction/direction-idle.png`를 192×192로 표시합니다. 화살표 또는 중앙을 누르고 당기는 방향에 따라 `direction-up/down/left/right.png`로 바뀌며, 버튼을 놓을 때 방향과 코스트를 확정합니다. 중앙 20픽셀 안에서는 확정하지 않습니다. 우클릭·Esc·창 포커스 이탈은 선택을 취소합니다. 선택 중에는 절반 속도를 유지하고 기존에 설정한 전투 속도로 복귀합니다.

각 `Player.direction`은 `down/up/left/right` 중 하나입니다. 정면·뒷면·측면 시트를 연결하고 왼쪽은 측면을 좌우 반전합니다. 대기와 공격은 각 메타데이터의 실제 프레임 수를 사용합니다. `attackRange`는 아래를 향하는 원본 좌표를 유지하고 `attack_cells()`에서 현재 방향으로 회전한 칸을 계산합니다.

`main.py`는 몬스터 이동과 배치 입력 처리 후 배치된 캐릭터의 `update_state(monsters, now=battle_time)`를 호출합니다. 공격 판정은 `character.py`가 담당하며, `race == "monster"`이고 살아 있으며 거점에 도착하지 않은 대상의 연속 좌표를 칸 중심 기준으로 변환해 범위에 포함되는지 검사합니다. 상태가 바뀔 때만 모션 시작 시간을 갱신합니다. 공격은 실제 시트 프레임 수 × `attackSpeed`의 FPS로 반복하므로 `1 / attackSpeed`초에 한 번 재생하며, 0 이하는 공격하지 않습니다. 선택 여부와 무관하게 동작하고 공유 전투 시간의 감속·정지를 따릅니다.

`monster.update_monsters(monsters, characters, now)`는 각 캐릭터의 `canStop` 한도 안에서 기존 `Monster.blockedBy` 관계를 먼저 유지한 뒤 새 접촉을 배정합니다. `main.py`는 `tileType == 1`인 지상 캐릭터만 전달하며, 함수에서 배치 여부·생존·양수 저지수를 검사합니다. 몬스터 이동 선분과 캐릭터 중심 ±0.45칸의 접촉 영역을 검사하므로 큰 시간 간격에도 통과하지 않고, 순간이동은 건너뛴 구간이 아닌 도착 위치만 검사합니다. 저지된 적은 `attack` 모션으로 정지하며 캐릭터 사망·철수·이동·저지수 감소로 해제되면 `walk`로 돌아갑니다. 정지했던 시간을 이동 거리로 누적하지 않습니다. 저지된 적이 사라지면 다음 갱신에 그 자리를 재사용합니다.

`attack_cells(pos=..., direction=...)`는 배치 미리보기용 좌표·방향을 받아 실제 캐릭터 상태를 바꾸지 않고 범위를 계산합니다. `main.py`는 기존 `asset/map/stage/main/range-overlay.png`를 해당 칸의 윗면 다각형에 맞춰 그립니다. 카드를 끌어 배치할 칸을 고르는 동안에는 숨기고, 칸에 놓은 뒤 방향을 고를 때 표시합니다. 배치 확정 시 선택과 사거리 표시를 해제하며, 배치된 캐릭터의 몸·서 있는 칸을 다시 클릭하면 표시합니다. 맵 밖 칸은 제외하고 같은 칸은 한 번만 그립니다. 높은 발판에 가려지는 낮은 칸의 범위는 발판 위로 겹쳐 표시하지 않습니다. 캐릭터별 기존 `attackRange` 수치는 변경하지 않았습니다.

사거리 확인에는 코스트를 차감하지 않으며, 캐릭터를 선택한 동안은 배치 미리보기와 동일하게 전투 시간이 절반 속도로 흐릅니다. `main.py`의 `TIME_SCALE × DRAG_TIME_SCALE`을 한 번만 적용하므로 선택한 캐릭터를 바꾸어도 감속이 중복되지 않습니다. 코스트 증가·몬스터 이동과 출현·애니메이션은 같은 전투 시간을 따릅니다. 빈 곳 클릭·우클릭·Esc·창 포커스 해제로 표시를 닫으면 설정된 속도로 복귀하며 새 카드를 끌거나 전투를 끝낼 때 선택을 초기화합니다. 배치 미리보기 중 반속도와 방향 확정 조작은 기존 동작을 유지합니다.

`Player.canStop`은 캐릭터가 동시에 저지할 수 있는 몬스터 수를 저장하는 정수이며 기본값은 1입니다. 캐릭터마다 `canStop=0`, `canStop=2`처럼 지정할 수 있고, 0은 저지 불가를 뜻합니다. 현재는 수치만 저장하며 실제 몬스터 저지 처리는 아직 연결하지 않았습니다.

각 캐릭터의 `allowedTiles` 리스트에 설치 가능한 타일 타입을 저장합니다. `[1]`은 1층 전용, `[2]`는 2층 전용, `[1, 2]`는 두 층 모두 허용하며, `[]`는 설치 불가입니다. `character.py`의 `DEPLOYMENT_TILES`에서 초기값을 정하고 캐릭터마다 별도 리스트로 복사합니다. 현재 궁수·석궁병·성직자·약초사·냉기술사는 `[2]`, 검사·수호기사·그림자 도적은 기존 설정을 유지한 `[1, 2]`입니다. 배치 판정은 역할명 대신 해당 캐릭터의 `allowedTiles` 값과 타일 타입을 비교합니다.

설치할 수 없는 타입에 놓으면 방향 선택으로 넘어가지 않고 비용 차감 없이 취소됩니다. 배치 가능 칸 표시, 미리보기, 드롭과 방향 확정은 모두 같은 판정을 사용합니다.

8명 모두 방향별 16프레임·16FPS, 한 주기 1초입니다. 시트는 4열×4행의 1280×1280, 프레임은 기존과 같은 320×320입니다. 총 24개 시트에 384프레임을 저장합니다. 발 기준점은 왼쪽 위 원점에서 (160, 288)입니다. 메타데이터에서 `right` 방향으로 기록된 이미지는 `side/`에 있습니다. 전체 목록의 시간 설정은 `manifest.json`의 `timing_by_character`와 각 캐릭터 JSON을 확인합니다.

8명 모두 원본 스프라이트의 비율과 위치를 기준으로 다시 정렬했습니다. 보이는 얼굴·머리·몸통·팔·다리·의상·장비는 원본 픽셀과 좌표를 유지합니다. 재작화된 부위는 머리와 팔 아래에 가려진 목·어깨 등 연결부를 완성하는 데 사용합니다. 이전 재작화 과정에서 달라진 얼굴 크기, 발 간격, 무기 위치를 그대로 사용하지 않습니다.

현재 원본은 `asset/character/player/icon/layers/<캐릭터>/<방향>/aligned/`입니다. 부위별 완성 원본 PNG와 `visible/`(원본 표면), `hidden/`(가려진 부분)을 함께 저장합니다. 실제 재생은 JSON의 `idle_order` 순서로 숨은 부분을 먼저 그리고 원본 표면을 그립니다. 임의 순서로 완성 PNG를 겹치지 않습니다. 부위 PNG는 320×320이며 기준점은 (160, 288)입니다. 원본과 공격 시트, 이전 재작화 원본은 보존합니다.

`metadata/character/layers/reference-alignment.json`에는 원본의 목·허리·어깨·손 좌표와 무기 영역을 기록합니다. `layers/<캐릭터>.json`에는 부위 파일, 완성 원본, 가려진 부분, 그리는 순서, 검사 결과를 기록합니다. 24방향 모두 원본 표면의 RGBA 픽셀과 좌표가 보존되는지 확인했습니다.

**8명 모두 새 대기를 적용했습니다.** 8명 모두 최신 요청에 맞춰 16프레임·16FPS로 통일했습니다. 한 주기는 1초입니다. 몸통은 작게 이동·회전하고 머리와 팔은 시차를 두어 반응합니다. 팔은 각 어깨를 회전축으로 사용하여 떨어지지 않습니다. 활·검·지팡이·물약 등은 잡고 있는 손과 같은 변환을 사용하고, 방패는 방패를 잡는 팔을 따릅니다. 머리카락과 옷자락은 추가 지연을 사용합니다. 발 레이어는 고정합니다. 사각형 영역을 얼려 옷자락이나 무기를 잘라내지 않습니다.

재생 중 모든 부위는 크기 변화 없이 이동·회전만 사용합니다. 0초의 자세는 원본 좌표이고 1초의 자세와 이어집니다. 121개 시점에서 어깨·목 연결, 손과 무기의 연결, 단위 크기와 발 고정을 검사합니다. 최종 합성에서 검 등이 신발 앞을 지나갈 수 있으므로 발 고정은 다리 레이어 단독 출력과 변환도 함께 확인합니다.

제공된 `Amiya_(Medic).webm`, `Amiya_(Medic)_Skin_1.webm`을 프레임별로 확인하고 몸통·팔·머리·옷자락이 차례로 반응하는 방식을 참고했습니다. 해당 캐릭터의 디자인을 게임 리소스로 사용하지 않았습니다.

원본 정렬은 Node.js와 `sharp`가 있는 환경에서 `node tools/align_character_layers.mjs <검사 폴더> [캐릭터 ID]`로 재생성합니다. 시트는 `sharp`, `playwright`, Chrome이 있는 환경에서 `node tools/build_archer_idle.mjs <출력 폴더> [캐릭터 ID]`로 생성합니다. 캐릭터 ID를 생략하면 궁수입니다. 이 도구는 각 레이어 설정의 실제 프레임 수와 FPS를 읽습니다. 현재 8명 모두 16개 시점의 서로 다른 동작을 새로 렌더링하며, 기존 게임 시트를 자동으로 덮어쓰지 않습니다.

`idle_sprite.py`와 `attack_sprite.py`는 JSON의 실제 FPS와 프레임 수를 사용합니다. `update(delta_time)`만 시간을 진행시키며, `draw()`는 현재 프레임을 `clip_draw()`로 표시합니다. 렌더링 횟수가 달라도 같은 경과 시간에는 같은 프레임을 표시합니다. `main.py`는 맵의 높은 칸 중심 (208, 444)에 선택한 캐릭터를 표시합니다. 1은 궁수, 2는 석궁병, 3은 검사입니다.

현재 프로젝트에는 Walk·Run과 충돌 판정이 아직 없습니다. 궁수·석궁병·검사의 공격 시트 총 9개를 16프레임으로 교체했고, 원본 개별 공격 프레임과 다른 5명의 공격 15개는 보존했습니다. 스페이스바로 공격을 한 번 재생한 뒤 Idle로 돌아갑니다. 화살·볼트·베기는 공격 그림의 연출이며 실제 피해 계산은 아직 없습니다.

## 아이템

유물 아이콘 파일에는 0부터 24까지 번호를 붙입니다. 유물 아이콘 25개는 `asset/item/`의 개별 256×256 투명 PNG입니다. `atlas.png`는 5열×5행, 1280×1280 시트이며, `overview.png`는 전체 목록 이미지입니다.

[유물 효과표](../docs/유물효과.md)에 수치·적용 대상·발동 조건을 정리했습니다. 수치는 첫 플레이테스트용 설계 값이며, 초기 구현 목표 6종과 확장 19종을 함께 보관합니다.

## 맵

`asset/map/field/`에는 탐험 지도와 화면 시안을, `asset/map/stage/main/`에는 전투 맵을, `asset/map/stage/icon/`에는 지형 타일과 오브젝트를 모았습니다.

`asset/map/field/icon/`의 탐험 지도 타일은 모두 여백 없는 64×64입니다. 전투 방(`battle-room.png`), 기본 방(`basic-room.png`), 좌우 연결선(`path-horizontal.png`), 상하 연결선(`path-vertical.png`), 빈 배경(`empty.png`)의 5종이며, 연결선은 타일 끝까지 이어집니다.

`asset/map/stage/main/cave/`의 맵은 [PRTS.Map rogue_4](https://map.ark-nights.com/areas/rogue_4)의 공개 타일 데이터를 기존 광산 타일 그림으로 재구성한 `cave-0.png`~`cave-77.png`입니다. 일반 43개, 보스 21개, 특수 14개이며 모두 800×600입니다. 동일한 원본 파일을 공유하는 긴급 난이도 49개는 중복 생성하지 않고 각 맵의 `source.aliases`에 기록합니다.

원본의 행·열 수, 지상·고지대, 배치 가능 여부, 출입구와 순간이동 위치를 유지합니다. 칸 크기와 시작 좌표는 화면과 HUD 여백에 맞춰 맵별로 계산하며 `grid`에 저장합니다. 캐릭터의 논리 좌표는 `(column, -row)`입니다.

각 `cave-N.json`의 `cells`에는 설치 타입을 `tileType`으로 저장합니다. `0`은 설치 불가, `1`은 1층, `2`는 2층이며 코드에서는 `map.TileType.BLOCKED/GROUND/ELEVATED`로도 참조할 수 있습니다. 이전 `deployable`·`placement` 필드는 이 값으로 통합했습니다. `0`은 캐릭터의 허용 목록에 넣어도 설치할 수 없으며, 다른 캐릭터가 점유한 칸도 설치할 수 없습니다. `walkable`은 몬스터의 통행 여부로 별도 유지합니다.

전투 맵 78개는 비스듬한 시점과 [단차 참고 그림](map/reference/raised-edge-reference.png)을 기준으로 표시합니다. 뒤쪽 폭은 앞쪽의 0.86배, 깊이는 기본 칸 크기의 0.82배이며 `grid.projection`에 저장합니다. 2층(`tileType=2`)은 기본 칸 크기의 0.25배 높이로 올립니다. 모든 2층은 같은 높이이며 연결된 2층 사이에는 벽을 그리지 않고, 외곽 앞면·옆면에만 어두운 수직 면과 접촉 그림자를 표시합니다. 현재 1층은 매끈한 회색 바닥, 2층은 밝고 따뜻한 회색 석판과 얇은 철제 테두리로 구분하며, 주변은 짙은 청회색 암반과 낮은 벽으로 둘러쌉니다. 논리적인 `height_level`과 배치 속성은 유지합니다. 포털은 바닥에 눕히지 않고 세워 그립니다.

`cells.base_polygon`은 높이 적용 전 바닥 좌표, `surface_polygon`은 실제 윗면의 네 꼭짓점이고 `pico2d_surface_polygon`은 윗면 좌표를 왼쪽 아래 원점으로 변환한 값입니다. `vertical_faces`는 드러난 수직 면, `visual_elevation`은 원근을 적용한 화면상 높이입니다. 클릭 판정과 배치 테두리는 올라간 윗면을 사용하며 수직 면을 누르면 배치하지 않습니다. 캐릭터의 발은 윗면의 `pico2d_center`에서 화면상 칸 높이의 18%만큼 아래에 놓고, 드래그 배치 미리보기와 방향 선택도 같은 윗면을 기준으로 합니다. `perspective_scale`에 따라 원근 크기만 조절하여 신체 비율을 유지합니다. `surface_rect`는 윗면 다각형을 포함하는 사각형이며 클릭 판정의 빠른 제외에 사용합니다.

`manifest.json`이 맵 선택 목록입니다. 약도의 전투방 12개는 일반 맵 43개에서, 보스방은 보스 맵 21개에서 선택합니다. 특수 맵 14개는 데이터와 이미지로 보관하며 일반 전투방에서는 추첨하지 않습니다. 몬스터 종류와 수는 현재 게임의 임시 설정이며 원작의 적 편성을 가져오지 않습니다.

각 JSON의 `source`에는 원본 페이지·데이터 URL과 SHA-256을 기록했습니다. `routes`는 원본의 이동·대기·순간이동 체크포인트를 위쪽 원점 좌표로 변환한 데이터이며 설치물용 더미 경로는 제외합니다. 원작의 특수 타일 효과와 설치물은 `source_tile_key`, `source_blackboard`, `source_predefines`에 기록하며 실제 특수 효과는 아직 구현하지 않았습니다.

지상 몬스터의 실제 경로는 맵을 읽을 때 `walkable` 칸의 상하좌우 연결과 원본 WALK 경로에 명시된 순간이동 연결을 사용해 계산·보관합니다. 걸어야 하는 칸 수가 가장 적은 도착 거점을 선택하고 캐릭터 배치에 따라 우회하지 않습니다. 원본의 대기 연출·경유점 순서를 그대로 재생하는 방식은 아닙니다. 명시된 입구가 없는 보스맵은 기록된 WALK 시작점을 사용합니다. 일반 43개·보스 21개 모두 지상 경로가 있으며, 비행 전용 특수 맵 `cave-77`에는 지상 몬스터를 생성하지 않습니다.

다시 생성하려면 `python tools/import_rogue4_maps.py --fetch --output .build/clean-maps`로 공개 데이터를 받아 좌표를 만들고, `python tools/render_cave_maps.py .build/clean-maps --overview`로 PNG를 만듭니다. 이미 받은 데이터를 사용할 때는 `--fetch`를 생략합니다. 실제 적용 전에 기존 이미지와 JSON을 백업합니다. 2026-11-12 교체 전 20개 맵은 `.build/backups/maps-before-rogue4-20261112-102930/`, 시점 변경 전 78개 맵은 `.build/backups/maps-before-oblique-20261112-110006/`에 보관했습니다.

층별 명암과 재질 구분을 강화하기 전 맵 78개와 전체 목록 이미지는 `.build/backups/maps-before-floor-contrast-20261112-132155/`에 보관했습니다. 이 변경에서는 이미지와 렌더링 색상만 수정했으며 타일 타입·좌표·경로 JSON은 보존했습니다.

단차 적용 전 맵 이미지·좌표 JSON·목록 159개 파일은 `.build/backups/maps-before-raised-20261112-132923/`에 보관했습니다. 현재 버전은 2층 윗면과 수직 면의 화면 좌표를 갱신했으며, 타일 타입·몬스터 통행 여부·경로·출입구는 그대로 유지합니다.

이전 배경 `asset/map/stage/background/cave-mine.png`와 [배경 제작 기록](map/cave-background.json)은 제작 이력으로 보관합니다. 배경 최초 적용 전 맵 78개와 목록 이미지는 `.build/backups/maps-before-background-20261112-134707/`에 있습니다. 배경만 추가한 단계에서는 78개 보드 내부 픽셀이 동일했으며 배치 좌표·경로 JSON은 수정하지 않았습니다.

이전 거친 재질은 `asset/map/stage/icon/mine/`와 [재질 제작 기록](map/cave-materials.json)에 보관합니다. 해당 단계 교체 전 79개 맵 이미지는 `.build/backups/maps-before-material-blend-20261112-135300/`에 있습니다.

현재는 [승인한 깔끔한 시안](map/reference/clean-enclosed-approved.png)을 78개 전투 맵에 적용합니다. `asset/map/stage/background/cave-clean.png`와 `asset/map/stage/icon/clean/`의 매끈한 재질 4종·투명 소품 4종을 사용합니다. `tools/cave_scenery.py`는 각 맵의 이동·배치가 불가능한 일반 막힌 칸만 골라 낮은 벽·간격을 둔 조명·격자 통로·암반·설비를 배치합니다. 장식은 이동·배치·특수 타일의 윗면, 단차의 수직 면과 포털 그림을 침범하지 않으며, 소품은 원래 비율로 그립니다. 장식용 벽은 배치 가능한 추가 층이 아닙니다. 최종 배경·지형·장식·포털을 800×600 PNG로 합성하여 게임에서 그대로 불러옵니다.

원본 아틀라스·전체 생성 프롬프트·추출 좌표·재생성 방법은 [현재 제작 기록](map/clean-enclosed-style.json)에, 맵별 장식 수와 이미지·좌표 파일 해시는 [78개 맵 검증 기록](map/clean-enclosed-validation.json)에 있습니다. 이전 맵 이미지 79개와 렌더러는 `.build/backups/maps-before-clean-enclosed-20261112-140414/`에 보관했습니다. 타일 좌표·단차·배치 타입·경로 JSON은 변경하지 않았습니다. 56개 테스트와 실제 게임의 방향 선택·배치 10개 시나리오를 통과했습니다.

- `asset/map/stage/icon/`: 공통·테마별 지형 타일
- `asset/map/stage/icon/objects/`: 적 출현 지점, 도착 지점, 횃불과 창문
- `asset/map/stage/main/range-overlay.png`: 한 칸 크기의 반투명 공격 범위 타일
- `asset/map/stage/main/overview.png`: 맵 78개 목록 이미지

좌표의 `atlas_rect`와 `rect`는 왼쪽 위 원점이며, `pico2d_rect`와 `pico2d_center`는 왼쪽 아래 원점을 씁니다.
