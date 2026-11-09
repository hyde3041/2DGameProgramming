# 석궁병 공격: 원본 부위 사용

**현행 버전은 몸통·팔·석궁의 찌그러짐을 수정한 [연결된 원본 자세 방식](crossbowman-connected.md)이다.** 아래는 팔·무기 조각을 따로 회전하던 이전 방식의 기록이다. 현재 재생성은 `prepare_crossbowman_connected.mjs` → `build_crossbowman_attack.mjs --apply`를 따른다.

사용자의 지적에 따라 새로 생성했던 상체 아틀라스를 현행 합성에서 제외했다. 원본 Idle의 머리·턱·옷깃을 같은 좌표와 RGBA로 유지하고 기존 Idle 및 기존 공격 원본의 팔·석궁·의상을 사용한다. 몸통을 확대하거나 새로 그린 상체에 머리를 맞추지 않는다.

- 앞·뒤·옆 각각 16장·16FPS·1초, 발사 07번, 한 번 재생 후 Idle 복귀.
- 4열×4행, 시트 1280×1280, 프레임 320×320, 투명 배경, 발 기준 (160, 288).
- 기존 Idle 00에서 팔과 석궁의 실제 픽셀을 분리해 회전한다. 뒷면은 기존 `icon/source/crossbowman/back/attack_01.png`의 조준 팔·석궁을 사용한다. 좌우 반전은 하지 않는다.
- 머리·턱과 분리 원본의 옷깃은 각 프레임에 원본 RGBA를 직접 복사한다. 목에 맞추기 위한 머리 이동·확대·축소를 하지 않는다.
- 내려간 무기가 가리던 옷과 스카프는 기존 `attack_01.png`의 같은 위치 픽셀로 복구한다. 작은 숨은 접합면은 기존 옷 픽셀로 보완한다. 새로 생성한 상체·다리·머리 보완 이미지는 읽지 않는다.
- 01·02·14·15에서 Idle 원본과 알파 혼합해 준비·복귀를 완화한다. 전신 크기와 발 위치는 고정한다.
- 볼트는 기존 프로젝트 부품의 시각 효과이다. 장전 장치의 별도 동작, 피해·투사체 물리는 아직 구현하지 않았다.

## 파일

- 게임: `game/asset/character/main/crossbowman/<front|back|side>/attack-sheet.png`
- 분리 부위: `game/asset/character/icon/layers/crossbowman/<방향>/attack/original-rig/`
- 연결점·원본 경로: [crossbowman-original-rig.json](crossbowman-original-rig.json)
- 게임 재생: [crossbowman.json](crossbowman.json)
- 미리보기: `game/asset/character/icon/preview/crossbowman-attack-original.mp4`
- ZIP: `.build/deliverables/crossbowman-attack-16frames-original-parts.zip`

분리 파일의 `base`는 정지한 몸과 하체, `head`는 기존 머리 및 옷깃, `moving`은 팔과 석궁, `under`는 가려진 접합면이다. 기존 정렬 원본과 24개 Idle 시트, 승인된 궁수는 수정하지 않는다. 이전 `source-v2/`의 생성 그림은 이력 보존용이며 현행 제작기에서 참조하지 않는다.

## 재생성

1. `node tools/prepare_crossbowman_original_attack.mjs`
2. `node tools/build_crossbowman_attack.mjs`: `.build/crossbowman-attack-original/`에 검사 출력
3. 원본 백업 후 `node tools/build_crossbowman_attack.mjs --apply`
4. `python tools/export_attack_sheets.py crossbowman`

게임은 `python game/code/main.py`, 1: 궁수, 2: 석궁병, 스페이스: 공격이다. Python의 기존 `load_image()`·`clip_draw()`·delta time 재생 구조는 그대로 사용한다.

교체 전 시트·설정·제작기, 픽셀 보존 검사와 실제 SDL 재생 검사는 저장소 옆 `.git-pull-backups/crossbowman-original-rig-20261105/`에 보관한다.

## 이번 수정의 검증

- 실제 pico2d/SDL에서 두 캐릭터의 총 6방향을 재생했다. 각각 16장 구분과 Idle 00으로의 정확한 복귀, 실제 main에서 1·2·스페이스 입력 및 정상 종료를 확인했다.
- 기존 단위 검사 10개 통과. Python 재생 코드는 이번 수정에서 바꾸지 않았다.
- 석궁병 3개 시트의 규격·투명도·16장 중복 없음을 검사했다. 머리·턱·옷깃의 원본 RGBA를 방향별 5,745 / 5,163 / 5,544픽셀에서 모든 프레임에 대조했다. 부츠 밑면도 고정했다.
- 보이는 `base`·`moving`·`head` 부위의 각 픽셀이 기존 Idle 또는 기존 공격 원본의 같은 좌표 RGBA에서 왔는지 검사했다.
- SHA-256으로 Idle 24개, 다른 공격 21개, 승인된 궁수 리소스 10개, 원본 104개, 기존 정렬 레이어 699개 보존을 확인했다.
- 실제 시트 기반 MP4(1200×340, 약 6.2초)의 디코딩과 재생, ZIP 내부 PNG와 게임 PNG의 바이트 일치를 확인했다.
