# ImageCard 상세설계

소스: `components/ImageCard.tsx`, `hooks/useImageCard.ts`, `hooks/useBoardImages.ts`

이미지 카드는 업로드 파일이 아니라 HTTP(S) URL, 선택적 라벨, 위치, 크기, 레이어를 가진다.

- 이미지 도구 버튼은 `ImageUrlModal`을 연다.
- URL을 검증하고 로컬 양수 ID를 할당해 컬렉션에 추가한 뒤 바로 편집 상태로 연다.
- 원격 이미지의 자연 크기를 최대 400x300으로 축소해 초기 크기를 정한다.
- 로드 실패 시 400x300을 사용한다.
- `<img>`로 브라우저가 URL을 직접 로드하므로 Next 이미지 프록시와 호스트 allowlist를 사용하지 않는다.
- 외부 클릭으로 편집을 끝낼 때 최신 위치와 크기를 React 상태에 반영하고 `BoardClient` autosave가 SQLite에 저장한다.
- 삭제는 로컬 컬렉션과 SQLite 행만 지우며 외부 이미지 원본에는 영향을 주지 않는다.
