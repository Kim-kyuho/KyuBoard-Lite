# KyuBoard Lite 기본 설계

## 제품 범위

KyuBoard Lite는 로그인과 보드 목록이 없는 단일 사용자·단일 보드 애플리케이션이다. `/`에서 고정 `board_id = 1`을 바로 연다. 메모, 이미지 URL, Mermaid, 표, 드로잉을 로컬 SQLite에 저장하며 SQLite 파일 자체를 세이브 파일로 Export/Import한다.

## 실행 구조

```text
Browser
  ├─ /                         BoardClient
  ├─ /api/{card type}         카드 CRUD
  ├─ /api/cards/layer         레이어 변경
  ├─ /api/drawings/1          드로잉 저장
  ├─ /api/boards/1/markdown   Markdown 컴파일
  └─ /api/save/{export,import}
             │
             └─ data/kyuboard.sqlite
```

`lib/db/index.ts`가 SQLite 연결을 프로세스 단위 singleton으로 유지한다. WAL, foreign key, busy timeout을 활성화하고 최초 실행 시 스키마와 기본 보드를 생성한다.

## 데이터 모델

| 테이블 | 내용 |
| --- | --- |
| `boards` | 단일 보드 제목과 크기 |
| `memos` | TipTap HTML, 색상, 위치, 크기, 레이어 |
| `images` | HTTP(S) URL, 라벨, 위치, 크기, 레이어 |
| `mermaids` | Mermaid 소스와 카드 geometry |
| `tables` | `TableSource` JSON과 카드 geometry |
| `drawings` | 보드별 `BoardStroke[]` JSON |

표와 드로잉 JSON은 SQLite `json_valid` CHECK와 Import 시 Zod 스키마로 이중 검증한다. 모든 카드 행은 보드 foreign key와 `ON DELETE CASCADE`를 사용한다.

## 이미지 URL

이미지 버튼은 파일 선택기가 아니라 URL 입력 모달을 연다. 클라이언트가 원격 이미지의 자연 크기를 읽어 최대 400x300에 맞추며 실패하면 400x300을 사용한다. 서버는 URL 문자열만 저장하고 원격 이미지를 다운로드하거나 프록시하지 않는다.

지원 프로토콜은 `http:`와 `https:`뿐이다. 원격 URL이 사라지거나 핫링크를 막으면 카드 이미지는 표시되지 않을 수 있으며 세이브 파일에는 이미지 바이너리가 포함되지 않는다.

## Export

Export는 활성 SQLite 연결의 online backup으로 일관된 snapshot을 만들고 `kyuboard-lite.sqlite`로 다운로드한다. 카드 편집 또는 드로잉 모드 중에는 아직 DB에 반영되지 않은 draft가 있을 수 있으므로 Export 버튼을 비활성화한다.

## Import

Import 전에 현재 보드를 교체한다는 확인을 받는다. 서버는 다음 순서로 파일을 검증한다.

1. 최대 50MiB 및 SQLite 헤더
2. `PRAGMA integrity_check`
3. `PRAGMA user_version`
4. 필수 테이블과 단일 `board_id = 1`
5. 모든 행의 타입과 geometry
6. 이미지 HTTP(S) URL
7. 표와 드로잉 JSON의 Zod 스키마

검증이 끝난 데이터만 한 SQLite 트랜잭션에서 현재 보드와 교체한다. 실패 시 현재 상태는 유지된다. 성공 후 브라우저를 새로고침해 서버 상태를 다시 읽는다.

## 배포 제약

SQLite는 로컬 실행 또는 영속 volume을 가진 단일 서버에 맞는다. 여러 서버 인스턴스나 파일 시스템이 임시인 서버리스 환경에는 적합하지 않다. Docker Compose는 `/app/data`에 `kyuboard_data` volume을 연결한다.
