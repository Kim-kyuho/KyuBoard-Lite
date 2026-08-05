# BoardClient 상세설계

소스: `components/BoardClient.tsx`, `lib/browser-db/*`

`BoardClient`는 브라우저 SQLite에서 단일 보드 snapshot을 읽고 카드별 훅에 전달해 UI를 조립한다. 서버 props와 API 요청은 사용하지 않는다.

## 시작과 자동 저장

1. 마운트 후 `loadBoardState()`가 Worker를 시작한다.
2. Worker가 SQLite WASM을 초기화하고 IndexedDB의 SQLite 파일을 deserialize한다.
3. 저장된 전체 snapshot을 React 상태에 적용한 뒤 보드를 렌더링한다.
4. 상태가 바뀌고 편집/드로잉 중이 아니면 150ms 후 `replaceBoardState(snapshot)`으로 트랜잭션 저장한다.

초기화 실패 시 빈 보드로 조용히 진행하지 않고 브라우저 저장소 요구사항을 포함한 오류 화면을 표시한다.

## Export 잠금

다음 중 하나라도 참이면 `BoardMenu.exportDisabled`가 참이다.

```text
editingMemoId !== null
editingImageId !== null
editingMermaidId !== null
editingTableId !== null
drawingMode === true
```

Export는 먼저 현재 snapshot 저장을 기다린 후 SQLite 파일을 내보낸다. 잠금은 카드 내부 편집 상태가 collection 상태에 아직 반영되지 않은 시점의 불완전한 파일 생성을 막는다.

## Import

숨겨진 SQLite file input은 `useBoardTransfer`가 소유한다. Worker가 임시 DB에서 무결성, 버전, 필수 테이블, snapshot 내용을 검증하고 현재 DB를 교체한다. 검증 중 오류가 나면 현재 DB는 변경하지 않는다.
