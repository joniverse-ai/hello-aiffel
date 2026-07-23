# 코더 설명 스크립트 — 단정 · Danjeong

레포: https://github.com/joniverse-ai/danjeong
라이브: https://joniverse-ai.github.io/danjeong/

---

## 1. 완성된 코드 — 완성도 (3분)

### 프로젝트 소개
"단정은 B2B 프리미엄 답례 선물 셀렉트샵입니다. 기업 총무 담당자가 VIP 답례 선물을 상황별로 고르고 문의할 수 있는 사이트예요."

### 라이브 사이트 시연 (화면 공유)

**① 상품 카탈로그** — Gift 섹션
- "계약 감사 / 임원 축하 / 명절 인사" 3개 탭 클릭해서 전환
- "전체 / 티 / 커피 / 페어링" 서브 필터 클릭
- 상품 카드 클릭 → 모달에서 상세 정보(구성, 가격, MOQ) 확인

**② 문의 폼** — 상품 모달 내 "주문 문의" 버튼
- 회사명, 담당자명, 이메일 등 입력 → "문의 보내기" 클릭
- Supabase DB에 실시간 저장됨

**③ 회원 시스템** — 우상단 "Log in" 클릭
- 로그인 / 회원가입 전환
- 로그인 후 "My page"로 변경 → 프로필 수정, 문의 내역 조회 가능

**④ 기타 기능**
- 히어로 캐러셀 자동 슬라이드 (3초)
- 상품 캐러셀 자동 핑퐁 + 수동 경계 정지
- 이벤트/공지사항 모달
- Language 드롭다운, SNS 모달

---

## 2. 체크리스트 — 문제 해결 (4분)

### ① 비밀값을 코드에 직접 안 적고 환경변수로 뺐는가?

"Supabase publishable key만 프론트엔드에 넣었습니다. 이 키는 Supabase가 공개용으로 설계한 키라서 노출되어도 괜찮아요. 실제 관리자 키(service_role key)는 코드에 포함하지 않았습니다."

```javascript
// index.html:320-323
var supabase = window.supabase.createClient(
  'https://ntfalfubipeehucwmysx.supabase.co',
  'sb_publishable_...'  // publishable key — 공개용, service_role key 미포함
);
```

### ② 가격·수량·권한 같은 검증을 백엔드에서 하는가?

"현재는 프로토타입이라 결제 기능이 없고, 문의 기반 수동 처리입니다. 가격은 프론트엔드 상품 데이터에 표시용으로만 있고 실제 결제 로직이 없어서, 프론트에서 가격을 조작해도 실질적 피해가 없는 구조예요. 향후 PG 결제 연동 시에는 반드시 서버 사이드 검증을 추가할 계획입니다."

### ③ Supabase를 쓴다면 RLS를 켜고 정책을 넣었는가?

"네, 두 테이블 모두 RLS를 켜고 정책을 설정했습니다."

**profiles 테이블:**
- 본인 프로필 조회 (SELECT) — `auth.uid() = id`
- 본인 프로필 생성 (INSERT) — `auth.uid() = id`
- 본인 프로필 수정 (UPDATE) — `auth.uid() = id`

**inquiries 테이블:**
- 누구나 문의 등록 (INSERT) — `true` (비로그인도 가능)
- 본인 문의 조회 (SELECT) — `auth.uid() = user_id`

### ④ 로그인이 필요한 데이터에 권한 확인(인가)이 들어가는가?

"마이페이지에서 프로필 조회/수정과 문의 내역 조회는 로그인 상태에서만 접근 가능하고, RLS가 `auth.uid()` 기준으로 본인 데이터만 반환합니다. 다른 유저의 데이터는 볼 수 없어요."

```javascript
// index.html:855 — 본인 프로필만 조회
supabase.from('profiles').select('*').eq('id', currentUser.id).single()

// index.html:905 — 본인 문의만 조회
supabase.from('inquiries').select('*').eq('user_id', currentUser.id)
```

"프론트에서 `.eq('id', currentUser.id)`로 필터하고, 설령 이걸 우회하더라도 RLS가 서버 측에서 차단합니다."

### ⑤ 사용하는 무료 티어의 한도와 요금 알림을 아는가?

"Supabase Free 티어를 사용 중이고, 주요 한도는 이렇습니다:"
- DB: 500MB 스토리지
- Auth: 월 50,000 MAU
- API: 초당 요청 제한 있음
- **7일 미활동 시 프로젝트 자동 일시정지** (이미 한 번 경험함)
- 요금 알림: Supabase 대시보드에서 사용량 확인 가능, 프로젝트 설정에서 이메일 알림 설정

---

## 3. 회고 — 정리 (3분)

### 배운 점
- Supabase Auth + RLS + 트리거를 조합한 백엔드 구성 방법을 배웠다
- publishable key vs service_role key의 보안 구분을 이해하게 됐다
- SECURITY DEFINER의 역할을 알게 됐다 — 회원가입 시 트리거가 RLS에 막히는 문제를 이걸로 해결했다
- 프레임워크 없이 순수 HTML/CSS/JS로 싱글페이지 앱을 만들어보니, 프레임워크가 왜 필요한지 체감했다

### 아쉬운 점
- 상품 이미지가 전부 Unsplash 플레이스홀더 — 실제 촬영 사진이 필요하다
- 검색 기능은 UI만 있고 실제 동작하지 않는다
- 다국어(EN) 토글은 만들었지만 번역 콘텐츠를 아직 넣지 못했다
- 결제 시스템이 없어서 문의 기반 수동 처리밖에 안 된다

### 느낀 점
- 비전공자도 AI 도구를 활용하면 백엔드 연동까지 가능한 프로토타입을 만들 수 있다는 걸 직접 경험했다
- PRD(기획서)를 먼저 정리하고 코딩하니 방향이 흔들리지 않았다
- 실제 배포하고 사용해보니 "동작하는 코드"와 "좋은 코드"는 다르다는 걸 느꼈다

### 어려웠던 점
- 회원가입 500 에러 디버깅이 가장 어려웠다 — Supabase Auth 로그에서 `"current transaction is aborted"` 메시지를 보고, 트리거 → RLS 충돌이라는 원인을 찾는 데 시간이 걸렸다
- RLS 정책 설계가 처음이라 어떤 테이블에 어떤 조건을 넣어야 하는지 감이 없었다
- index.html 하나에 1,000줄 넘는 코드가 들어가니 파일 관리가 점점 힘들었다
- GitHub Pages 배포 과정에서 deploy 폴더를 별도 git repo로 관리하는 구조가 처음엔 헷갈렸다
