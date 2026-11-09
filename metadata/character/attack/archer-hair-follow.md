# 궁수 공격의 머리카락 반응

석궁병처럼 머리 모양도 동작에 따라 자연스럽게 달라지도록 해 달라는 요청에 맞춰 궁수의 머리 끝과 포니테일 반응을 보완했다. 석궁병과 검사, 기존 Idle은 유지한다.

## 적용

- 기존 고개 움직임·목 축·몸통·팔·활·화살 동작은 그대로다. 앞·뒤·옆 각각 16프레임·16FPS·1초, 07 발사와 원래 Idle 복귀를 유지한다.
- 내장 `image_gen`으로 기존 머리 그림의 당기기·발사 후 머리 끝 변화 2개씩을 편집했다. 생성된 전체 얼굴을 사용하지 않고, 원본 머리의 작은 머리카락 경계 마스크 안에서만 반영한다. 눈·입·피부와 금색 장식은 원본 RGBA를 보존한다.
- 03~07은 당기는 머리 끝 모양, 08~11은 발사 후 반응, 12~13은 되돌아오는 모양, 14~15는 원래 머리다. 머리 끝 자세끼리 교차 혼합하거나 머리를 늘이지 않는다. 기존 Idle 진입·복귀 가중치는 유지한다.
- 기존 포니테일 두 레이어를 고개 아래에 연결했다. 붙는 지점은 현재 고개를 정확히 따라가고, 늘어진 부분의 회전은 1.25프레임 지연된 고개 움직임을 70% 반영한다. 원래 포니테일 PNG는 수정하지 않는다.

## 파일

- 실제 게임: `game/asset/character/main/archer/<front|back|side>/attack-sheet.png`
- 머리 보완 그림·마스크: `game/asset/character/icon/layers/archer/<방향>/attack/hair/`
- 입력·편집 아틀라스: `game/asset/character/icon/layers/archer/attack/hair/source/`
- [전체 프롬프트·생성 모드·원본](archer-hair-sources.json)
- [그림 경로·등록 값·보호 영역·반응 설정](archer-hair-motion.json)
- 제작기: `tools/prepare_archer_attack_hair.mjs`, `tools/archer-attack-v2-renderer.js`, `tools/build_archer_attack_v2.mjs`

```text
node tools/prepare_archer_attack_hair.mjs
node tools/build_archer_attack.mjs --apply
python tools/export_attack_sheets.py archer
```

## 검증

- 기존 파일 1,148개를 SHA-256으로 보존했다. 기존 PNG 중 변경한 것은 궁수 공격 시트 3개다.
- 각 시트 1280×1280 RGBA, 4×4 칸, 각 320×320, 16장 모두 서로 다름. 원래 발 RGBA와 공격 첫 장의 Idle 00 일치를 확인했다.
- 보완 머리 그림은 편집 마스크 밖과 눈·입·장식 보호 영역의 RGBA가 원본과 같다.
- 기존 고개 변환 행렬 차이 0, 포니테일 결합점 오차 0, 길이·면적 오차는 2.3×10⁻¹⁶ 이하다. 늘이기나 부위별 크기 맞추기를 하지 않았다.
- 머리·포니테일 영역 밖의 최종 게임 픽셀 변경은 세 방향 모두 0이다. 몸·팔·활·화살의 실제 그리기 변환도 이전과 같다.
- 실제 pico2d/SDL에서 세 캐릭터×세 방향의 16장 출력·Idle 복귀와 main의 선택·공격·종료를 확인했다.

수정 전 리소스·제작기·설정과 검증 결과는 저장소 옆 `.git-pull-backups/archer-hair-follow-20261107/`에 보관한다.

- [수정 전후](../../../game/asset/character/icon/preview/archer-hair-follow-before-after.gif)
- [앞·뒤·옆](../../../game/asset/character/icon/preview/archer-attack-hair-follow.gif)
- [세 방향 확대 비교](../../../game/asset/character/icon/preview/archer-hair-follow-all-views-compare.gif)
- ZIP: `.build/deliverables/archer-attack-16frames-hair-follow.zip`
