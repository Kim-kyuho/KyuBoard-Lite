# BoardMenu 상세설계

소스: `components/BoardMenu.tsx`

우측 상단 메뉴는 단일 보드 제목과 다음 동작을 순서대로 표시한다.

1. Export
2. Import
3. Compile to Markdown

Export는 카드 또는 드로잉 편집 중에 비활성화되며 이유를 메뉴 안에 표시한다. Import와 Export 전송 중에는 중복 요청을 막는다. 로그인과 보드 관리 메뉴는 없다.
