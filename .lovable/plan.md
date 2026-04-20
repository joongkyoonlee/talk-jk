
## 교육 소통방 (CDSA 스타일 리메이크)

업로드한 HTML을 React + Lovable Cloud(Supabase) 기반으로 재구축하고, **cdsa.kr의 따뜻한 베이지/세리프 럭셔리 톤**을 입힙니다.

### 디자인 시스템 (cdsa.kr 참고)
- **배경**: 따뜻한 아이보리 `#F5EFE4` 톤
- **포인트**: 딥 브라운/블랙 `#1A1614` (Pill 버튼), 살짝의 골드 액센트
- **타이포**: 헤딩은 한글 세리프 (Noto Serif KR), 본문은 산세리프 (Pretendard / Inter)
- **버튼**: 완전 둥근 pill 형태, 얇은 보더 또는 다크 솔리드
- **카드**: 흰색 배경 + 부드러운 라운드(20px) + 미세 섀도우
- 상단 미니 EXECUTIVE 라운지 띠 + 심플 네비게이션

### 화면 구성

**1. 홈 (Hero)**
- "CITIZEN DATA SCIENTIST ASSOCIATION" 스타일의 작은 라벨 → "EDU REALTIME ROOM"
- 큰 세리프 타이틀: "교육 소통방, 실시간으로 함께"
- 서브 카피 + 두 개의 pill CTA: "소통방 만들기", "패스코드로 입장"
- 아래로 두 카드 폼: 방 만들기 / 입장하기

**2. 룸 화면**
- Sticky 상단바: 교육 제목 / 방 이름 / 패스코드 / 닉네임 / 역할 + 나가기
- Pill 형태 탭 4개: **메시지 · 의견 · 익명투표 · 참여자**
- **메시지 탭**: 좌측 공지 + 메시지 리스트 / 우측 강사 입력 폼(공지/일반 선택, 텍스트, 이미지 업로드 ≤20MB), 공지 고정 폼
- **의견 탭**: 카테고리(질문/건의/느낀점) + 본문 등록, 우측 의견 카드 목록
- **익명투표 탭**: 강사는 질문+보기 N개 생성/마감 토글, 학습자는 1회 투표, 결과 막대그래프(참여 인원·퍼센트)
- **참여자 탭**: 본인 닉네임/역할/clientId 안내

### 핵심 기능
- **세션**: sessionStorage에 `{roomId, passcode, nickname, role, clientId}` 저장 → 새로고침 시 자동 재입장
- **방 생성**: 4자리 랜덤 패스코드 자동 발급, 강사 자동 배정
- **입장**: 패스코드 + 닉네임 + 역할(학습자/강사) 선택
- **실시간**: Supabase Realtime 채널로 messages/opinions/polls/poll_options/poll_votes/rooms 변경 구독 → 즉시 UI 갱신
- **이미지 업로드**: Storage 버킷 `room-images`(public) 사용, jpeg/png/webp/gif, 20MB 제한
- **익명 투표 집계**: poll_votes를 poll별로 카운트, voter_client_id 기준 1인 1표
- **공지 고정**: rooms.notice 업데이트 → 메시지 탭 상단 노출
- 토스트 알림, 한국어 날짜 포맷

### 백엔드 (Lovable Cloud)
- 첨부 SQL 스키마 그대로 마이그레이션: `rooms, messages, opinions, polls, poll_options, poll_votes`
- 데모 정책 그대로(공개 select/insert/update/delete) — 단, 보안 경고를 README/UI에 명시
- Realtime publication에 6개 테이블 추가
- Storage 버킷 `room-images` (public read)

### 폴더 구조
- `pages/Index.tsx` (홈), `pages/Room.tsx` (룸)
- `components/room/` : MessageList, MessageComposer, OpinionPanel, PollPanel, ParticipantPanel, RoomHeader
- `lib/session.ts`, `lib/supabase.ts` (자동 생성된 client 사용)
- `index.css` + `tailwind.config.ts`에 cdsa 색상 토큰/세리프 폰트 등록

구현 승인 시 Lovable Cloud를 활성화해 스키마/스토리지/Realtime을 구성하고 위 화면을 만들겠습니다.
