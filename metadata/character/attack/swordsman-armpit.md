# 검사 후면: 빨간 원의 어깨 아래 틈 보완

사용자가 표시한 위치에 맞춰, 팔을 올렸을 때 드러나는 어깨 아래 연결면을 추가했다. 선택한 망토 수정본의 16프레임·16FPS·1초 동작과 검 궤적, 이펙트, 손목 0도는 유지한다.

## 실제 적용

- 별도 숨은 그림: `game/asset/character/player/icon/layers/swordsman/back/attack/armpit/armpit-fill.png`
- 실제 게임 시트: `game/asset/character/player/main/0-swordsman/back/attack-sheet.png`
- 원본 몸통·팔·머리·검·Idle PNG는 수정하지 않았다. 작은 연결면을 몸통 뒤에 그리며 몸통의 이동·회전만 따른다. 늘이기나 팔 재분할을 하지 않는다.
- 첫 공격 프레임에도 연결면의 마스크 안에서만 보완 결과를 반영한다. 기존 Idle 시트와 Python의 재생·상태 전환 코드는 보존한다.

## 제작 자료

내장 `image_gen`으로 기존 몸통의 가려진 접속면을 편집했다. 전체 생성 그림으로 캐릭터를 교체하지 않고, 생성된 어두운 의상 표면을 320×320 좌표계의 작은 마스크에 등록해 별도 투명 레이어로 적용한다. 보완 레이어는 208개 픽셀의 알파 영역을 가진다.

- [정확한 프롬프트 2회와 생성 원본](swordsman-armpit-sources.json)
- [적용 경로·마스크·등록 값](swordsman-armpit.json)
- 입력·수정 원본·위치 가이드: `game/asset/character/player/icon/layers/swordsman/back/attack/armpit/source/`

```text
node tools/prepare_swordsman_armpit.mjs
node tools/prepare_swordsman_motion.mjs
node tools/build_swordsman_attack.mjs --apply --back-only
python tools/export_attack_sheets.py swordsman
```

## 검증

- 세 방향의 프레임별 회전·이동 값, 어깨축, 기존 부위 SHA-256이 수정 전과 같다.
- 후면 이펙트 17개를 포함해 기존 파일 353개의 SHA-256이 같다. 바뀐 기존 게임 PNG는 후면 공격 시트 하나다.
- 변경 픽셀은 보완 레이어의 투영 범위 안에만 있다. 보완 표면 안에 남은 투명 구멍은 16장 모두 0개다.
- 04·05·06·07·08에서 비어 있던 픽셀을 각각 36·57·69·72·59개 채웠다.
- 실제 pico2d/SDL에서 세 캐릭터×세 방향의 16프레임 출력과 Idle 복귀, main의 캐릭터 선택·공격·종료를 확인했다. 30·60·144회 업데이트에서도 검사 공격은 1초에 완료된다.
- 망토 누락과 셀 가장자리 잘림은 0개다.

수정 전 리소스·제작기·설정과 검증 결과는 저장소 옆 `.git-pull-backups/swordsman-armpit-gap-20261106/`에 보관한다.
