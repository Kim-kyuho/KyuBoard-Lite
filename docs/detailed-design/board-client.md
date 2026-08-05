# BoardClient 상세설계

소스: `components/BoardClient.tsx`

`BoardClient`는 서버가 SQLite에서 읽은 단일 보드의 카드 컬렉션을 각 전용 훅에 전달하고 보드 UI를 조립한다.

## 주요 상태

- `menuOpen`, `markdownViewOpen`
- 카드별 편집 ID
- `drawingMode`
- 이미지 URL 모달
- 검색, 포커스, 줌, 패닝 상태

로그인 상태는 존재하지 않으며 모든 카드는 편집 가능하다.

## Export 잠금

다음 중 하나라도 참이면 `BoardMenu.exportDisabled`가 참이다.

```text
editingMemoId !== null
editingImageId !== null
editingMermaidId !== null
editingTableId !== null
drawingMode === true
```

이는 편집 종료 전에 로컬 draft가 SQLite보다 앞서는 상황에서 불완전한 save file이 만들어지는 것을 막는다.

## Import

숨겨진 SQLite 파일 input은 `useBoardTransfer`가 소유한다. 사용자가 교체를 확인하면 `/api/save/import`에 multipart로 전송하고 성공 후 페이지 전체를 reload한다.
