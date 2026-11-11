# 석궁병 몸통·팔·석궁 연결 수정

현행 v5는 기존 연결 자세에 실제 들기 중간 그림 3장씩을 추가한다. 최신 순서·적용·전체 프롬프트·검증은 [궁수·석궁병 움직임 보완](ranged-motion.md)을 따른다. 아래는 원본 연결 방식으로 복원했던 v4 단계의 이력이다.

2026-11-06 사용자가 몸통·팔·무기가 찌그러져 보인다고 지적하여 기존 원본 자세를 유지하는 방식으로 수정했다. 이전 합성은 Idle에서 분리한 팔·무기만 회전하고 다른 자세의 옷을 덧붙여, 실제 공격 원본과 팔·무기 관계가 달랐다.

현재는 `icon/source/crossbowman/<방향>/attack_01.png`, `attack_02.png`, `attack_03.png`와 기존 Idle 00의 **연결된 원본 그림**을 사용한다. 새 캐릭터나 새 상체 그림을 생성하지 않았다. 머리·몸통·양팔·석궁·옷의 상대적인 위치를 한 그림 안에 유지하고, 그 전체에 작은 이동·회전만 더한다. 가로·세로 배율은 모두 1이다. 기존 3개 공격 자세와 Idle을 시간에 따라 사용하므로 별도로 그린 자세가 16개인 것은 아니다. 서로 다른 16개 출력 프레임으로 준비·조준·발사·반동·복귀를 구성했다.

- **00~01** 준비, **02~06** 원본 조준 자세, **07~08** 원본 발사 자세와 작은 반동, **09~15** 회복·복귀.
- 앞·뒤·옆 각 16프레임·16FPS·1초. 시트 1280×1280, 4열×4행, 프레임 320×320, 투명 배경.
- 팔이나 석궁만 크게 들어 올리는 회전을 없애고 조준·반동 위주로 바꿨다. 서로 다른 자세를 반투명하게 겹쳐 보간하지 않는다.
- 발은 원래 Idle의 부츠 영역을 고정한다. 이전 스카프 조각이 발 원본에 섞이지 않게 구분했고, 고정된 발 바깥의 작은 부츠 잔여 조각을 정리했다.
- 발사 볼트는 실제 발사 자세의 총구에서 시작해 앞으로 이동한다. 실제 피해 판정은 기존처럼 아직 구현하지 않은 시각 효과다.

## 적용 파일

- 게임: `game/asset/character/player/main/3-crossbowman/<front|back|side>/attack-sheet.png`
- 연결된 원본·발: `game/asset/character/player/icon/layers/crossbowman/<방향>/attack/connected/`
- [원본 경로·시간·행렬](crossbowman-connected.json), [게임 프레임 좌표](crossbowman.json)
- [수정본 재생](../../../game/asset/character/player/icon/preview/crossbowman-attack-shape-fixed.mp4), [수정 전후 비교](../../../game/asset/character/player/icon/preview/crossbowman-shape-comparison.mp4)
- ZIP: `.build/deliverables/crossbowman-attack-16frames-shape-fixed.zip`

```text
node tools/prepare_crossbowman_connected.mjs
node tools/build_crossbowman_attack.mjs
node tools/build_crossbowman_attack.mjs --apply
python tools/export_attack_sheets.py crossbowman
```

검사 출력은 `.build/crossbowman-attack-connected/`이다. `--apply` 전 백업한다. 이전 `original-rig/`·`source-v2/`와 그 제작기는 이력으로 보존하며 현행 제작기에서 사용하지 않는다. Python의 기존 `AttackSprite`, `update(delta_time)`, `load_image()`, `clip_draw()` 연결은 그대로다.

## 검증

- 방향마다 4개 원본의 상단 281행, 359,680픽셀의 준비 단계 RGBA 일치를 검사했다. 머리·목·몸통·팔·석궁을 따로 잘라 크기나 위치를 맞추지 않는다.
- 48개 출력 프레임의 가로·세로 배율 1, 회전 행렬의 길이·직교성·면적 보존 오차 2.3×10⁻¹⁶ 이하를 확인했다.
- 시트 규격·투명 배경·16장 중복 없음과 첫 장의 Idle 00 일치, 원본 발 RGBA 고정을 확인했다.
- 실제 pico2d/SDL에서 궁수·석궁병 총 6방향 각각 16장 출력과 Idle 복귀, 실제 main의 선택·공격·정상 종료를 확인했다. 기존 단위 검사 10개 통과.
- SHA-256으로 Idle 24개, 다른 공격 21개, 원본 이미지 104개와 석궁병 기존 정렬 부위 87개 보존을 확인했다. 사용자가 선택한 궁수 버전도 그대로다.
- MP4의 실제 디코딩·재생과 ZIP의 PNG가 게임 PNG와 같은지 확인했다.

교체 전 시트·설정·미리보기·ZIP과 검사 결과는 저장소 옆 `.git-pull-backups/crossbowman-shape-20261106/`에 보관한다.
