# 커스텀 OpenAI 호환 서버 연결 가이드

> DGX SPARK, Team Ops, 사내 GPU 서버 등 OpenAI 호환 API를 hanimo에 연결하는 완벽한 가이드

---

## 개요

hanimo는 OpenAI API 호환 형식을 따르는 모든 서버를 지원합니다.

- **Ollama** (로컬)
- **vLLM** (프로덕션 GPU 서버)
- **DGX SPARK** (엔터프라이즈 클라우드)
- **Team Ops** (팀 협업 플랫폼)
- **LM Studio** (로컬 데스크톱)
- **LocalAI** (올인원 드롭인)
- 기타 `/v1/chat/completions` 엔드포인트를 제공하는 모든 서버

---

## 빠른 시작 (5분)

### 1단계: 설정 마법사 실행

```bash
hanimo --setup
```

### 2단계: 프로바이더 선택

```
선택 프로바이더를 고르세요:
  1) openai
  2) anthropic
  3) google
  ... (10개 이상)
  14) custom ← 이곳 선택
```

### 3단계: 서버 정보 입력

```
프로바이더 이름을 입력하세요: dgx-spark
엔드포인트 URL을 입력하세요: https://spark3-share.tech-2030.net/api/v1
API 키를 입력하세요 (선택): your-api-key-here
기본 모델을 입력하세요: gpt-oss:20b
```

### 4단계: 확인

```bash
hanimo
```

설정이 완료되었습니다. 즉시 hanimo가 DGX SPARK에 연결됩니다.

---

## 직접 설정 (Manual Config)

### 설정 파일 위치

```bash
~/.hanimo/config.json
```

### 최소 설정 (API 키 없음)

로컬 Ollama, vLLM, LM Studio 등:

```json
{
  "provider": "custom",
  "model": "qwen2.5:7b",
  "customProviders": [
    {
      "name": "local-ollama",
      "baseURL": "http://localhost:11434/v1",
      "models": ["qwen2.5:7b", "qwen3:30b", "llama2:13b"]
    }
  ]
}
```

### API 키가 있는 경우

DGX SPARK, Team Ops 등:

```json
{
  "provider": "custom",
  "model": "gpt-oss:20b",
  "customProviders": [
    {
      "name": "dgx-spark",
      "baseURL": "https://spark3-share.tech-2030.net/api/v1",
      "apiKey": "your-bearer-token-here",
      "models": [
        "gpt-oss:20b",
        "gpt-oss:120b",
        "mistral-small3.2:latest",
        "deepseek-v3:latest",
        "qwen2.5:32b-instruct",
        "qwen3-coder-next:q8_0"
      ]
    }
  ]
}
```

### 여러 모델 지원

프로바이더의 모든 모델 등록:

```json
{
  "provider": "dgx-spark",
  "model": "gpt-oss:20b",
  "customProviders": [
    {
      "name": "dgx-spark",
      "baseURL": "https://spark3-share.tech-2030.net/api/v1",
      "apiKey": "your-api-key",
      "models": [
        "gpt-oss:20b",
        "gpt-oss:120b",
        "mistral-small3.2:latest",
        "deepseek-v3:latest",
        "qwen2.5:32b-instruct",
        "qwen3-coder-next:q8_0"
      ]
    }
  ]
}
```

---

## 실제 설정 예시

### DGX SPARK (Ollama 기반)

```json
{
  "provider": "dgx-spark",
  "model": "gpt-oss:20b",
  "customProviders": [
    {
      "name": "dgx-spark",
      "baseURL": "https://spark3-share.tech-2030.net/api/v1",
      "apiKey": "your-bearer-token",
      "models": [
        "gpt-oss:20b",
        "gpt-oss:120b",
        "mistral-small3.2:latest",
        "deepseek-v3:latest",
        "qwen2.5:32b-instruct",
        "qwen3-coder-next:q8_0"
      ]
    }
  ]
}
```

필드 설명:

| 필드 | 설명 | 예시 |
|------|------|------|
| `name` | 프로바이더 표시 이름 | `dgx-spark` |
| `baseURL` | OpenAI 호환 엔드포인트 | `https://spark3-share.tech-2030.net/api/v1` |
| `apiKey` | Bearer 토큰 (선택) | `sk-...` 또는 토큰 |
| `models` | 사용 가능 모델 목록 | 배열 형식 |

### 로컬 Ollama

```json
{
  "provider": "custom",
  "model": "qwen2.5:7b",
  "customProviders": [
    {
      "name": "local-ollama",
      "baseURL": "http://localhost:11434/v1",
      "models": ["qwen2.5:7b", "qwen2.5:32b", "deepseek-r1:70b"]
    }
  ]
}
```

### 사내 vLLM 서버

```json
{
  "provider": "custom",
  "model": "meta-llama/Llama-3.1-70B-Instruct",
  "customProviders": [
    {
      "name": "internal-vllm",
      "baseURL": "http://192.168.1.100:8000/v1",
      "models": [
        "meta-llama/Llama-3.1-70B-Instruct",
        "meta-llama/Llama-3.1-8B-Instruct"
      ]
    }
  ]
}
```

---

## 여러 서버 동시 등록 (customProviders)

한 설정 파일에서 여러 서버를 관리할 수 있습니다.

```json
{
  "provider": "dgx-spark",
  "model": "gpt-oss:20b",
  "customProviders": [
    {
      "name": "dgx-spark",
      "baseURL": "https://spark3-share.tech-2030.net/api/v1",
      "apiKey": "token-for-spark",
      "models": ["gpt-oss:20b", "gpt-oss:120b", "deepseek-v3:latest"]
    },
    {
      "name": "local-ollama",
      "baseURL": "http://localhost:11434/v1",
      "models": ["qwen2.5:7b", "llama2:13b"]
    },
    {
      "name": "internal-vllm",
      "baseURL": "http://192.168.1.100:8000/v1",
      "apiKey": "internal-token",
      "models": ["meta-llama/Llama-3.1-70B-Instruct"]
    }
  ]
}
```

### 서버 전환

**TUI에서 (실시간)**:

```
Esc → 프로바이더 선택 → dgx-spark 선택
```

또는:

```
/provider dgx-spark
```

**CLI에서**:

```bash
hanimo -p dgx-spark
```

---

## 모델 전환

### TUI 환경에서

**방법 1: Esc 메뉴**

```
Esc 누름 → 모델 선택 메뉴 → gpt-oss:120b 선택
```

**방법 2: 슬래시 명령**

```
/model gpt-oss:120b
```

### CLI 환경에서

```bash
hanimo -m gpt-oss:120b
hanimo -m deepseek-v3:latest
```

### 현재 모델 확인

TUI 상태 바에 표시됩니다:

```
[dgx-spark] model: gpt-oss:20b
```

---

## 연결 테스트

### 1단계: curl로 테스트 (권장)

DGX SPARK 테스트:

```bash
curl -X POST "https://spark3-share.tech-2030.net/api/v1/chat/completions" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-api-key-here" \
  -d '{
    "model": "gpt-oss:20b",
    "messages": [
      {"role": "user", "content": "hello"}
    ],
    "stream": false
  }'
```

기대 응답:

```json
{
  "id": "chatcmpl-...",
  "object": "chat.completion",
  "created": 1234567890,
  "model": "gpt-oss:20b",
  "choices": [
    {
      "index": 0,
      "message": {
        "role": "assistant",
        "content": "Hello! How can I help?"
      },
      "finish_reason": "stop"
    }
  ],
  "usage": {
    "prompt_tokens": 10,
    "completion_tokens": 10,
    "total_tokens": 20
  }
}
```

### 2단계: hanimo로 테스트

설정 후:

```bash
hanimo
```

간단한 메시지 입력:

```
사용자: hello
```

응답이 나오면 연결 성공입니다.

### 3단계: 모델 가용성 확인

```bash
curl -X GET "https://spark3-share.tech-2030.net/api/v1/models" \
  -H "Authorization: Bearer your-api-key-here"
```

응답 예시:

```json
{
  "object": "list",
  "data": [
    {"id": "gpt-oss:20b", "object": "model", "owned_by": "ollama"},
    {"id": "gpt-oss:120b", "object": "model", "owned_by": "ollama"},
    {"id": "deepseek-v3:latest", "object": "model", "owned_by": "ollama"}
  ]
}
```

---

## API 키 관리

### Bearer 토큰 설정

DGX SPARK나 Team Ops에서 발급받은 토큰:

```json
{
  "customProviders": [
    {
      "name": "dgx-spark",
      "baseURL": "https://spark3-share.tech-2030.net/api/v1",
      "apiKey": "your-bearer-token-here",
      "models": [...]
    }
  ]
}
```

### 환경변수로 관리 (권장)

민감한 정보는 환경변수로 관리하세요:

```bash
export DGX_SPARK_TOKEN="your-bearer-token"
```

그 후 config.json에서:

```json
{
  "customProviders": [
    {
      "name": "dgx-spark",
      "baseURL": "https://spark3-share.tech-2030.net/api/v1",
      "apiKey": "${DGX_SPARK_TOKEN}",
      "models": [...]
    }
  ]
}
```

또는 직접 파일 대신 환경변수로만 설정:

```bash
export HANIMO_CUSTOM_BASEURL="https://spark3-share.tech-2030.net/api/v1"
export HANIMO_CUSTOM_APIKEY="your-token"
export HANIMO_CUSTOM_MODEL="gpt-oss:20b"
hanimo
```

---

## 문제 해결 (Troubleshooting)

### 1. 연결 실패: `ECONNREFUSED`

**증상**: 서버 연결 거부

**진단**:

```bash
# 서버 접근성 확인
curl -v https://spark3-share.tech-2030.net/api/v1/models
```

**해결**:

1. URL 확인: `https://` vs `http://` 확인
2. 포트 확인: 기본값이 `/api/v1`인지 확인
3. 네트워크: 방화벽, VPN, 프록시 확인
4. 서버 상태: DGX SPARK 관리자에게 서버 상태 확인

---

### 2. 인증 실패: `401 Unauthorized`

**증상**: API 키 오류

**진단**:

```bash
curl -H "Authorization: Bearer your-api-key" \
  https://spark3-share.tech-2030.net/api/v1/models
```

**해결**:

1. API 키 확인: 정확히 복사했는지 확인
2. 만료 여부: 토큰 만료 여부 확인
3. 형식 확인: Bearer 토큰 앞에 "Bearer " 포함되는지 확인

config.json:

```json
{
  "apiKey": "your-token-without-Bearer-prefix"
}
```

---

### 3. 모델을 찾을 수 없음: `404 Not Found`

**증상**: 지정한 모델이 없음

**진단**:

```bash
curl https://spark3-share.tech-2030.net/api/v1/models \
  -H "Authorization: Bearer your-api-key"
```

**해결**:

1. 모델 이름 확인: 정확한 모델명 사용
2. customProviders에 등록: models 배열에 추가
3. 모델 풀 확인: `ollama list` (로컬) 또는 서버 관리자 확인

---

### 4. 응답이 매우 느림

**증상**: 첫 토큰까지 10초 이상 소요

**원인**:

- `deepseek-r1` 같은 Chain-of-Thought 모델: 내부 추론에 시간 소요
- 서버 과부하: 많은 동시 요청
- 모델 크기: 120B 이상 모델은 느릴 수 있음

**해결**:

1. 다른 모델 시도:

```bash
hanimo -m gpt-oss:20b
```

2. 서버 상태 확인: 관리자에게 부하 상태 문의
3. 기다리기: CoT 모델은 정상 동작

---

### 5. `tools` (function calling) 작동 안 함

**증상**: 도구 호출이 실패함

**원인**: 로컬 모델은 OpenAI function calling을 지원하지 않을 수 있음

**해결**:

1. 모델 호환성 확인:
   - `gpt-oss` 계열: 제한적 지원
   - `qwen3-coder`: 양호
   - `deepseek`: 제한적

2. 강제 활성화 (모델이 지원할 경우):

```
/tools on
```

3. 도구 비활성화:

```
/tools off
```

---

### 6. 스트리밍 응답이 끊김

**증상**: 응답 중간에 중단됨

**진단**:

```bash
curl -X POST "https://spark3-share.tech-2030.net/api/v1/chat/completions" \
  -H "Authorization: Bearer your-api-key" \
  -d '{
    "model": "gpt-oss:20b",
    "messages": [{"role": "user", "content": "write 100 words"}],
    "stream": true
  }'
```

**해결**:

1. 타임아웃 확인: config.json shell.timeout 증가

```json
{
  "shell": {
    "timeout": 60000
  }
}
```

2. 네트워크 안정성: 연결 상태 확인
3. 서버 로그: 서버 측 에러 확인

---

### 7. `customProviders` 로드 안 됨

**증상**: 설정 파일이 있는데 프로바이더가 안 보임

**확인**:

```bash
cat ~/.hanimo/config.json | jq .customProviders
```

**해결**:

1. JSON 문법 확인: 들여쓰기, 쉼표 확인
2. 파일 재로드:

```bash
hanimo --setup
```

3. 캐시 초기화:

```bash
rm -rf ~/.hanimo/cache
hanimo
```

---

## 고급 설정

### 우선순위 (Priority) 설정

같은 모델이 여러 서버에 있을 때, 우선 순서를 정할 수 있습니다:

```json
{
  "endpoints": [
    {
      "name": "dgx-spark",
      "provider": "custom",
      "baseURL": "https://spark3-share.tech-2030.net/api/v1",
      "apiKey": "your-token",
      "priority": 10
    },
    {
      "name": "local-ollama",
      "provider": "custom",
      "baseURL": "http://localhost:11434/v1",
      "priority": 5
    }
  ]
}
```

높은 숫자일수록 우선됩니다.

### 프로토콜 선택

기본값은 OpenAI 호환:

```json
{
  "customProviders": [
    {
      "name": "my-server",
      "baseURL": "https://...",
      "protocol": "openai"
    }
  ]
}
```

Anthropic 프로토콜 (Claude 호환):

```json
{
  "customProviders": [
    {
      "name": "my-anthropic-server",
      "baseURL": "https://...",
      "protocol": "anthropic"
    }
  ]
}
```

---

## 마이그레이션 체크리스트

다른 도구에서 hanimo로 전환할 때:

- [ ] DGX SPARK 엔드포인트 URL 확인
- [ ] API 키/토큰 준비
- [ ] 필요한 모델 목록 작성
- [ ] `hanimo --setup` 실행
- [ ] `curl`로 연결 테스트
- [ ] hanimo에서 간단한 메시지 테스트
- [ ] TUI에서 모델 전환 테스트
- [ ] config.json에 다른 모델 추가

---

## 추가 리소스

### 공식 문서

- [Ollama API](https://github.com/ollama/ollama/blob/main/docs/api.md)
- [vLLM API](https://docs.vllm.ai/en/latest/serving/openai_compatible_server.html)
- [OpenAI API 호환 명세](https://platform.openai.com/docs/guides/function-calling)

### 지원되는 모델

DGX SPARK에서 사용 가능:

- `gpt-oss:20b` — 일반 목적 (빠른 응답)
- `gpt-oss:120b` — 복잡한 작업
- `mistral-small3.2:latest` — 경량 모델
- `deepseek-v3:latest` — 추론 중심
- `qwen2.5:32b-instruct` — 지시 따르기 우수
- `qwen3-coder-next:q8_0` — 코드 생성

### 더 알아보기

- [05-troubleshooting.md](./05-troubleshooting.md) — 일반 트러블슈팅
- [04-deployment.md](./04-deployment.md) — 배포 시나리오
