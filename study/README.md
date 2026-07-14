# 🛠️ Git & Claude Code 시작하기 (실습 정리)

> Mac(macOS) 환경 기준으로, **Git 설치 → Claude Code 설치 및 GitHub 연동 → 기본 셋팅**까지
> 처음부터 끝까지 따라 할 수 있게 정리한 실습 아카이브입니다.

---

## 목차
1. [Git 설치](#1-git-설치)
2. [Claude Code 설치 및 GitHub 연동](#2-claude-code-설치-및-github-연동)
3. [기본 셋팅 방법 (일상 작업 흐름)](#3-기본-셋팅-방법-일상-작업-흐름)

---

## 1. Git 설치

Git은 코드·문서의 변경 이력을 관리하고 GitHub와 주고받게 해주는 도구입니다.

### 1-1. 이미 설치돼 있는지 확인

터미널에 입력:

```bash
git --version
```

- `git version 2.xx.x` 처럼 버전이 나오면 → **이미 설치됨** (다음 단계로)
- `command not found` 가 나오면 → 아래로 진행

> 💡 macOS에는 Xcode Command Line Tools를 통해 Git이 기본 포함된 경우가 많습니다.

### 1-2. 설치하기 (없을 경우)

```bash
xcode-select --install
```

창이 뜨면 안내에 따라 설치하면 됩니다.

### 1-3. 사용자 정보 설정 (최초 1회)

커밋에 "누가 작업했는지" 기록되는 정보입니다.

```bash
git config --global user.name "본인이름"
git config --global user.email "본인이메일@example.com"
```

확인:

```bash
git config --global user.name
git config --global user.email
```

---

## 2. Claude Code 설치 및 GitHub 연동

### 2-1. Claude Code란?

터미널에서 말(자연어)로 시키면 파일 수정, 커밋·푸시, 배포까지 대신 해주는 AI 코딩 도구입니다.
Claude Code는 CLI(터미널), 데스크톱 앱, 웹, IDE 확장으로 사용할 수 있습니다.

> 설치·로그인 방법은 공식 문서를 참고하세요 → <https://docs.claude.com/claude-code>

### 2-2. GitHub 연동 — SSH 키 만들기

GitHub에 안전하게 접속하기 위해 **SSH 키**(비밀번호 없이 인증하는 열쇠)를 만듭니다.

**① 기존 키가 있는지 먼저 확인** (있으면 덮어쓰지 말 것)

```bash
ls -al ~/.ssh
```

**② 새 키 생성 (ed25519 방식 권장)**

```bash
ssh-keygen -t ed25519 -C "본인이메일@example.com"
```

- 저장 위치를 묻는 질문 → 그냥 `Enter` (기본값)
- 암호(passphrase) → 비워두려면 `Enter` 두 번

**③ 공개키(공유해도 되는 열쇠)를 복사**

```bash
pbcopy < ~/.ssh/id_ed25519.pub
```

> `id_ed25519`(개인키)는 **절대 공유 금지**, `id_ed25519.pub`(공개키)만 GitHub에 등록합니다.

**④ GitHub에 공개키 등록**

GitHub 웹에서:
`Settings → SSH and GPG keys → New SSH key` → 방금 복사한 내용 붙여넣기 → 저장

**⑤ 연결 테스트**

```bash
ssh -T git@github.com
```

`Hi 내아이디! You've successfully authenticated...` 메시지가 나오면 **성공**입니다.
(뒤에 "does not provide shell access"는 정상 문구이니 걱정 마세요.)

---

## 3. 기본 셋팅 방법 (일상 작업 흐름)

### 3-1. 저장소 가져오기 (Clone)

GitHub의 저장소를 내 컴퓨터로 복사해옵니다.

```bash
cd ~/Documents
git clone git@github.com:본인아이디/저장소이름.git
```

### 3-2. 핵심 작업 흐름: `add → commit → push`

로컬에서 파일을 수정한 뒤 **GitHub에 올리는 3단계**입니다.
(⚠️ 자동으로 올라가지 않습니다. 아래를 실행해야 반영돼요.)

```bash
git add .                          # ① 변경사항 담기
git commit -m "무엇을 바꿨는지 메모"   # ② 기록으로 저장
git push                           # ③ GitHub로 전송
```

| 단계 | 명령 | 의미 |
|---|---|---|
| ① 담기 | `git add` | 올릴 변경사항을 선택 |
| ② 저장 | `git commit` | 변경을 하나의 기록으로 확정 |
| ③ 전송 | `git push` | GitHub(원격)에 반영 |

> 💡 Claude Code를 쓰면 **"깃허브에 올려줘"** 한마디로 위 3단계를 대신 해줍니다.

### 3-3. 폴더(디렉터리) 추가하기

Git은 **빈 폴더를 추적하지 않습니다.** 폴더 안에 파일이 최소 1개 있어야 올라갑니다.

```bash
mkdir 새폴더이름
# 폴더 안에 파일을 하나 만든 뒤
git add 새폴더이름/
git commit -m "새폴더 추가"
git push
```

### 3-4. 최신 상태로 맞추기 (Pull)

다른 곳에서 변경된 내용을 내 컴퓨터로 받아옵니다.

```bash
git pull
```

---

## 📌 자주 쓰는 명령 요약

| 하고 싶은 것 | 명령 |
|---|---|
| 버전 확인 | `git --version` |
| 저장소 복사 | `git clone <주소>` |
| 현재 상태 보기 | `git status` |
| 변경 담기 | `git add .` |
| 기록 저장 | `git commit -m "메모"` |
| GitHub에 올리기 | `git push` |
| 최신 내용 받기 | `git pull` |
| 커밋 이력 보기 | `git log --oneline` |

---

## ✅ 한눈 요약

1. **Git 설치** → `git --version`으로 확인, 없으면 `xcode-select --install`, 사용자 정보 설정
2. **Claude Code + GitHub 연동** → SSH 키(ed25519) 생성 → 공개키 GitHub 등록 → `ssh -T git@github.com`로 확인
3. **기본 셋팅** → `clone`으로 가져오고, `add → commit → push`로 올리고, 폴더는 파일과 함께 추가

> 이 문서는 실제 실습 과정을 정리한 아카이브입니다.
> 처음이라도 위 순서대로 하면 GitHub에 내 작업을 올릴 수 있습니다. 🚀
