# KyuBoard Lite 기본 설계

## 제품 범위

KyuBoard Lite는 로그인과 보드 목록이 없는 단일 사용자·단일 보드 앱이다. `/`에서 고정 `board_id = 1`을 바로 열며 서버 데이터베이스나 파일 업로드 기능은 없다.

## 실행 구조

```text
Next.js page (/)
  └─ BoardClient (React state)
       ├─ 카드/드로잉 편집
       ├─ 클라이언트 Markdown 컴파일
       └─ browser-db client (RPC)
            └─ Web Worker
                 ├─ SQLite WASM in-memory DB
                 └─ IndexedDB (`kyuboard-lite/files/database`)
```

페이지는 정적으로 배포할 수 있다. CRUD 및 Export/Import를 포함한 데이터 작업에는 Next API Route나 서버 파일시스템을 사용하지 않는다. Worker는 작업을 순서대로 실행해 저장, Export, Import가 서로 끼어들지 않게 한다.

## 데이터 모델

| 테이블 | 내용 |
| --- | --- |
| `boards` | 단일 보드 제목과 크기 |
| `memos` | TipTap HTML, 색상, 위치, 크기, 레이어 |
| `images` | HTTP(S) URL, 라벨, 위치, 크기, 레이어 |
| `mermaids` | Mermaid 소스와 카드 geometry |
| `tables` | `TableSource` JSON과 카드 geometry |
| `drawings` | 보드별 `BoardStroke[]` JSON |

표와 드로잉 JSON은 SQLite `json_valid` CHECK와 Zod snapshot schema로 검증한다. 모든 카드 행은 보드 foreign key와 `ON DELETE CASCADE`를 사용한다.

## 저장 흐름

최초 진입 시 Worker가 WASM을 초기화하고 IndexedDB에 보존된 SQLite 파일 바이트를 deserialize한다. 데이터가 없으면 메모리 DB에 스키마와 기본 보드를 만든다. 이후 전체 snapshot을 React 상태로 전달한다.

카드 훅은 네트워크 요청 없이 React 상태를 갱신한다. `BoardClient`는 카드 편집이나 드로잉 모드가 아닐 때 변경된 전체 snapshot을 150ms debounce 후 하나의 SQLite 트랜잭션으로 저장한다. 드로잉 완료 시에도 같은 저장 흐름을 사용한다.

## 이미지 URL

이미지 버튼은 URL 입력 모달을 연다. 클라이언트가 원격 이미지의 자연 크기를 읽어 최대 400x300에 맞추며 실패하면 400x300을 사용한다. 지원 프로토콜은 `http:`와 `https:`뿐이다. 세이브 파일에는 URL만 들어가므로 원격 이미지가 사라지거나 핫링크를 막으면 표시되지 않을 수 있다.

## Export

Export 직전에 현재 snapshot 저장 RPC가 완료될 때까지 기다린 뒤 SQLite 메모리 DB를 serialize해 `kyuboard-lite.sqlite`로 다운로드한다. 카드 편집 또는 드로잉 모드 중에는 미완성 draft가 생길 수 있으므로 Export를 비활성화한다.

## Import

사용자가 현재 보드 교체를 확인하면 파일을 Worker로 전송하고 다음을 검증한다.

1. SQLite 헤더
2. `PRAGMA integrity_check`
3. `PRAGMA user_version`
4. 필수 테이블과 단일 `board_id = 1`
5. 모든 행의 타입, ID, geometry 및 보드 참조
6. 이미지 HTTP(S) URL
7. 표와 드로잉 JSON의 Zod schema

가져온 파일은 별도 임시 SQLite 메모리 DB로 열기 때문에 검증 실패 시 현재 상태가 유지된다. 검증된 snapshot만 현재 DB의 단일 트랜잭션으로 교체하고 serialize된 전체 SQLite 파일을 IndexedDB에 원자적으로 저장한다.

## 배포 및 보존 범위

Vercel에는 Next.js 정적 페이지, Worker JavaScript, `sqlite3.wasm`만 배포된다. 데이터는 배포 서버가 아니라 각 브라우저 origin의 IndexedDB에 있으므로 서버의 읽기 전용 파일시스템 문제가 없다.

브라우저 프로필·기기·origin 사이에는 자동 동기화되지 않는다. 사이트 데이터 삭제 시 작업 DB도 삭제되므로 사용자는 Export 파일을 별도 백업해야 한다. WebAssembly, Web Worker, IndexedDB를 지원하는 최신 브라우저가 필요하다.
