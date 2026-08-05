# BoardMarkdownView 상세설계

소스: `components/BoardMarkdownView.tsx`, `hooks/useBoardMarkdown.ts`, `lib/board-markdown.ts`

`BoardMarkdownView`는 현재 `BoardSnapshot`을 받아 브라우저에서 동기적으로 Markdown을 만든다. 서버 API나 DB 재조회는 없다.

## 컴파일

- Memo의 TipTap HTML은 Turndown으로 Markdown으로 변환한다.
- Memo 모서리와 겹치는 최상단 이미지, Mermaid, 표를 문서에 한 번씩 삽입한다.
- 이미지는 URL Markdown, Mermaid는 fenced code block, 표는 GFM table로 변환한다.
- Mermaid fenced block은 일반 Markdown과 분리해 `useMermaidRenderer`로 렌더링한다.

## 렌더와 다운로드

일반 구간은 `ReactMarkdown`과 GFM을 사용한다. 원본 HTML은 `rehypeRaw` 다음 `rehypeSanitize` 순서로 처리한다. 다운로드 버튼은 현재 컴파일 결과를 `board-{boardId}.md` 파일로 만든다.
