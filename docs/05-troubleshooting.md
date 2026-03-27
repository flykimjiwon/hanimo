# modol 트러블슈팅 가이드

## 프로바이더 연결 경우의 수

### A. CLI 플래그 조합

| 입력 | 예시 | 동작 |
|------|------|------|
| 프로바이더만 | `modol -p openai` | 기본 모델 + 환경변수 키 |
| 프로바이더 + 모델 | `modol -p openai -m gpt-4.1` | 지정 모델 + 환경변수 키 |
| 프로바이더 + 키 | `modol -p deepseek -k sk-xxx` | 기본 모델 + 직접 키 |
| 프로바이더 + 모델 + 키 | `modol -p anthropic -m claude-opus-4 -k sk-ant-xxx` | 완전 지정 |
| URL만 | `modol -u http://서버:8000/v1` | custom 프로바이더, 기본 모델 |
| URL + 모델 | `modol -u http://서버:8000/v1 -m qwen3:30b` | 커스텀 서버 + 지정 모델 |
| URL + 키 + 모델 | `modol -u http://서버:8000/v1 -k token -m mymodel` | 완전 커스텀 |
| 프로바이더 + URL (프록시) | `modol -p openai -u http://proxy:3000/v1` | OpenAI SDK로 프록시 경유 |

### B. 환경변수 자동감지

| 변수 | 자동 인식 프로바이더 |
|------|---------------------|
| `OPENAI_API_KEY` | openai (gpt-4o-mini) |
| `ANTHROPIC_API_KEY` | anthropic (claude-sonnet-4) |
| `GOOGLE_API_KEY` | google (gemini-2.5-flash) |
| `DEEPSEEK_API_KEY` | deepseek (deepseek-chat) |
| `GROQ_API_KEY` | groq (qwen-qwq-32b) |
| `TOGETHER_API_KEY` | together (Qwen2.5-Coder-32B) |
| `OPENROUTER_API_KEY` | openrouter (deepseek-chat-v3:free) |
| `FIREWORKS_API_KEY` | fireworks (qwen2p5-coder-32b) |
| `MISTRAL_API_KEY` | mistral (codestral-latest) |
| `DEV_ANYWHERE_API_KEY` | 현재 프로바이더에 적용 |
| `DEV_ANYWHERE_BASE_URL` | 현재 프로바이더 baseURL 오버라이드 |
| `DEV_ANYWHERE_PROVIDER` | 프로바이더 오버라이드 |
| `DEV_ANYWHERE_MODEL` | 모델 오버라이드 |

### C. 설정 우선순위

```
CLI 플래그 (-p/-m/-k/-u) > 환경변수 > 프로젝트설정(.modol.json) > 유저설정(~/.modol/config.json) > 기본값
```

### D. 런타임 전환 명령

```
/provider deepseek          # 등록된 프로바이더 전환
/model codestral-latest     # 모델만 변경
/endpoint <url> [model] [key]  # 커스텀 엔드포인트 즉시 연결
```

---

## 알려진 이슈 & 해결

### 1. 응답이 늦게 나옴 (▌ 만 보임)

**원인**: deepseek-r1 등 CoT(Chain-of-Thought) 모델은 내부 추론 후 응답하므로 첫 토큰까지 수초~수십초 소요됨.

**확인 방법**:
```bash
# Ollama API 직접 테스트
curl http://localhost:11434/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{"model":"deepseek-r1:7b","messages":[{"role":"user","content":"hi"}],"stream":false}'
```

**해결**:
- 기다리면 응답이 옵니다 (CoT 모델 특성)
- 빠른 응답이 필요하면 비-CoT 모델 사용: `qwen2.5:7b`, `llama3.2`
- `/model qwen2.5:7b` 로 런타임 전환

### 2. `zsh: command not found: modol`

**원인**: 글로벌 CLI 등록이 안 된 상태.

**해결**:
```bash
cd modol
npm link
```

확인: `which modol` → `/Users/.../.npm-global/bin/modol`

### 3. Ollama 연결 실패 (ECONNREFUSED)

**원인**: Ollama 서버가 실행 중이 아님.

**해결**:
```bash
ollama serve    # Ollama 데몬 시작
ollama list     # 설치된 모델 확인
ollama pull qwen2.5:7b  # 모델 설치
```

### 4. 로컬 모델에서 도구(tool) 사용 안 됨

**원인**: 대부분의 로컬 모델은 OpenAI function calling을 지원하지 않음. modol는 로컬 프로바이더(ollama/vllm/lmstudio)에서 자동으로 tools:OFF.

**해결**:
- `/tools on` 으로 강제 활성화 가능 (모델이 지원할 경우)
- tool calling 지원 모델: `qwen2.5:7b` (부분), `qwen3-coder:30b` (양호)

### 5. 사내망 커스텀 엔드포인트 연결

**방법 1: CLI**
```bash
modol -u http://내부서버:8000/v1 -m mymodel -k 토큰
```

**방법 2: 프로젝트 설정**
```jsonc
// 프로젝트루트/.modol.json
{
  "provider": "custom",
  "model": "사내모델명",
  "providers": {
    "custom": {
      "baseURL": "http://내부서버:8000/v1",
      "apiKey": "사내토큰"
    }
  }
}
```

**방법 3: 런타임**
```
/endpoint http://내부서버:8000/v1 사내모델명 사내토큰
```

### 6. 토큰 사용량이 null로 표시됨

**원인**: Ollama의 OpenAI-compatible API는 usage 필드를 제공하지 않음.

**영향**: `/usage` 명령의 토큰 카운트가 0으로 표시됨. 기능에는 영향 없음.

---

## 개발 중 디버깅

```bash
# TypeScript 체크
npm run lint

# 빌드
npm run build

# 개발 모드 (tsx 직접 실행)
npm run dev

# Ollama API 직접 테스트
curl http://localhost:11434/v1/models
curl http://localhost:11434/v1/chat/completions \
  -d '{"model":"qwen2.5:7b","messages":[{"role":"user","content":"test"}]}'
```
