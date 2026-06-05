# Supabase 내기 방 설정 추가 SQL

SQL Editor에서 아래 SQL을 실행하세요.

```sql
alter table bowling_rooms
add column if not exists bet_amount integer default 0;

alter table bowling_rooms
add column if not exists bet_rule text default 'winner_takes_rank_penalty';

alter table bowling_room_results
add column if not exists bet_amount integer default 0;

alter table bowling_room_results
add column if not exists settlement jsonb default '[]'::jsonb;
```

현재 프론트 반영 내용:
- 방 만들기 시 내기 금액 선택
- 내기 없이 / 1,000 / 2,000 / 5,000 / 10,000 / 직접 입력
- 천원 단위 보정
- 실시간 점수판에서 현재 순위 기준 임시 정산 표시
- 1등 수령, 2등 1배 지급, 3등 2배 지급, 4등 3배 지급 방식
```
