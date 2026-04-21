

## 방 삭제 기능 추가

현재 강사가 소통방을 삭제할 수 있는 기능이 없습니다. 다음 기능을 추가합니다:

### 기능 설계
1. **삭제 권한**: `role === "instructor"` 인 사용자만 삭제 가능
2. **삭제 버튼 위치**: Room 페이지 헤더의 "나가기" 버튼 옆 (또는 추가 메뉴)
3. **확인 다이얼로그**: 삭제 전 "정말 삭제하시겠습니까?" 확인
4. **DB cascade**: `rooms` 테이블에 `ON DELETE CASCADE` 설정되어 있으면 연결된 messages/opinions/polls 자동 삭제

### 구현 내용
- `src/pages/Room.tsx`: 강사일 경우 "방 삭제" 버튼 추가 (빨간색 스타일)
- 삭제 확인 AlertDialog 추가
- `supabase.from("rooms").delete().eq("id", roomId)` 호출
- 삭제 성공 시 세션 클리어 + 홈으로 이동 + 토스트 알림

### UI/UX
- "나가기" 옆에 "삭제하기" 버튼 배치 (destructive 스타일 - 빨간색 pill-outline)
- 클릭 시 AlertDialog로 최종 확인
- 성공 시 룸 실시간 구독이 DELETE 이벤트 감지하여 자동 처리됨

