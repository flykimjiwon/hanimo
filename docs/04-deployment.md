# 내부망/외부망 배포 분석

> 클라우드 API (외부망) vs 에어갭/사내망 (내부망) 배포 가능성, 비용, 성능, 설정 방법

---

## 아키텍처 개요

```
┌──────────────────────────────────────────────┐
│        hanimo 멀티에이전트 시스템          │
├───────────────────┬──────────────────────────┤
│   외부망 모드       │     내부망 모드             │
│   (인터넷 연결)     │     (에어갭/사내망)          │
├───────────────────┼──────────────────────────┤
│ api.openai.com    │ internal-vllm:8000       │
│ api.anthropic.com │ internal-ollama:11434    │
│ gemini API        │ internal-localai:8080    │
│ open.bigmodel.cn  │ llama.cpp-server:8080    │
│ openrouter.ai     │ azure-private-endpoint   │
└───────────────────┴──────────────────────────┘

모드 전환: 환경변수 하나로
$ export OPENAI_BASE_URL=http://internal-vllm:8000/v1
```

---

## 시나리오 1: 외부망 (클라우드 API)

### 프로바이더 비교

| 프로바이더 | 입력 $/M | 출력 $/M | Rate Limit (Tier1) | 한국 | 데이터 학습 |
|-----------|---------|---------|-------------------|:----:|-----------|
| **Gemini Flash** | $0.10 | **$0.40** | 2K RPM / 4M TPM | O | 유료=안 함 |
| GPT-4o-mini | $0.15 | $0.60 | 500 RPM / 2M TPM | O | API=안 함 |
| GPT-4o | $2.50 | $10.00 | 500 RPM / 500K TPM | O | API=안 함 |
| GLM-4.5 | $2.20 | $8.90 | - | O* | - |
| Claude Sonnet 4 | $3.00 | **$15.00** | 50 RPM / 50K TPM | O | API=안 함 |

> *GLM: 해외 가격 30~100% 인상 (2026 초). 중국 데이터센터 경유로 지연 높음.

### Rate Limit 상세 (OpenAI)

| Tier | 조건 | RPM | TPM |
|------|------|-----|-----|
| Free | $0 | 3 | 40K |
| Tier 1 | $5 입금 | 500 | 500K |
| Tier 2 | $50 사용 | 5,000 | 2M |
| Tier 4 | $250 사용 | 10,000 | 10M |
| Enterprise | 커스텀 | 커스텀 | 커스텀 |

### 데이터 프라이버시

- **OpenAI API**: 기본적으로 학습에 사용하지 않음. ChatGPT Pro/Team은 Consumer — 수동 옵트아웃 필요.
- **Claude API/Enterprise**: 기본 학습 안 함. HIPAA 준비 (Enterprise).
- **Gemini 무료 tier**: **Google 제품 개선에 사용됨**. 유료 Tier 1 = 비공개. 무료 tier로 사내 코드 전송 금지.
- **GLM/Zhipu**: 문서 확인 필요.

### 한국 접근성

모든 주요 프로바이더 한국에서 접근 가능. 서울 지연 ~80~120ms (CDN 기준).

---

## 시나리오 2: 내부망 (에어갭/사내망)

### 서빙 프레임워크 비교

| 프레임워크 | 동시 처리 | GPU 필요 | OpenAI 호환 | 셋업 | 추천 |
|-----------|----------|---------|------------|------|------|
| **vLLM** | **793 t/s** | O | O | 중 | **프로덕션 멀티유저** |
| **Ollama** | 41 t/s (동시) | O (또는 M-chip) | O | **쉬움** | 1인 개발/테스트 |
| **llama.cpp** | 중간 | CPU 가능 | O | 중 | CPU 전용 환경 |
| **LocalAI** | 중간 | 선택 | O | 쉬움 | 올인원 드롭인 |
| ~~TGI~~ | - | O | O | 중 | ~~유지보수 모드 (2025.12)~~ |

> vLLM이 동시 처리에서 Ollama 대비 **19.3배** 빠름.

---

### Ollama — 완전 오프라인 설정

```bash
# 1. 인터넷 연결 PC에서 모델 다운로드
ollama pull deepseek-r1:70b
ollama pull qwen2.5-coder:32b
# 모델 위치: ~/.ollama/models/ → USB/아티팩트 서버로 이동

# 2. 에어갭 서버에서 실행 (인터넷 불필요)
export OLLAMA_HOST=0.0.0.0:11434
export OLLAMA_MODELS=/data/models/ollama
ollama serve

# 3. 방화벽 강제 (아웃바운드 차단)
# iptables -A OUTPUT -p tcp --dport 443 -m owner --uid-owner ollama -j DROP

# 4. 클라이언트 연결
export OPENAI_BASE_URL=http://internal-gpu-server:11434/v1
```

**Ollama는 최초 모델 다운로드 후 전화걸기(phone-home) 없음.** 100% 오프라인.

---

### vLLM — 프로덕션 멀티유저 설정

```bash
# 서버 시작 (4x GPU)
python -m vllm.entrypoints.openai.api_server \
  --model meta-llama/Llama-3.3-70B-Instruct \
  --host 0.0.0.0 --port 8000 \
  --tensor-parallel-size 4

# 클라이언트 설정
export OPENAI_BASE_URL=http://internal-vllm:8000/v1
export OPENAI_API_KEY=any-string  # 내부망에선 검증 안 함
```

- PagedAttention으로 GPU 메모리 19~27% 절약 (vs TGI)
- 단일 A100-80GB: 70B 모델 ~120-200 t/s

---

### llama.cpp — CPU 전용 + 자체 서명 인증서

```bash
# 서버 (CPU only + HTTPS)
./llama-server \
  -m /data/models/qwen2.5-coder-7b-q4_k_m.gguf \
  --host 0.0.0.0 --port 8080 \
  --ssl_cert /etc/ssl/internal-ca.pem \
  --ssl_key  /etc/ssl/internal-key.pem \
  -c 8192 -np 4  # 컨텍스트 + 병렬 슬롯
```

---

### LocalAI — 올인원 드롭인

```bash
docker run -d --gpus all \
  -p 8080:8080 \
  -v /data/models:/models \
  -e MODELS_PATH=/models \
  localai/localai:latest-gpu-nvidia-cuda-12
# /v1/chat/completions, /v1/embeddings, /v1/images
# API 키 인증, 유저 쿼터, RBAC — 프로덕션 준비됨
```

---

### 프라이빗 클라우드 (VPC 격리)

| 서비스 | VPC 방식 | 한국 리전 | 모델 | 자체 서명 인증서 |
|--------|---------|----------|------|----------------|
| **Azure OpenAI** | Private Link | Korea Central | GPT-4o, o-series | Azure App Gateway |
| **AWS Bedrock** | PrivateLink | ap-northeast-2 | Claude, Llama, Titan | ACM Private CA |
| **Google Vertex AI** | VPC-SC + PSC | asia-northeast3 | Gemini, Claude, Llama | CA Service |

> OpenAI, Anthropic 자체는 VPC 피어링 미지원 → **Azure/AWS/GCP를 통해 우회**.

---

## 클라우드 vs 로컬 모델 성능

| 모델 | 위치 | 코딩 점수 | 비용 |
|------|------|----------|------|
| GPT-4o | 클라우드 | **88** | $10/M 출력 |
| Claude Sonnet 4 | 클라우드 | 85 | $15/M 출력 |
| **DeepSeek R1-0528** | **로컬 가능** | **84** | 하드웨어만 |
| Kimi K2.5 | 로컬 가능 | ~83 | 하드웨어만 |
| Llama 3.3 70B | 로컬 가능 | 71 | 하드웨어만 |

> **클라우드 최고(88) vs 로컬 최고(84) = 4점 차이.** 일상 코딩의 70~80%는 로컬로 충분.

---

## 설정 패턴

### 환경변수로 내부/외부 전환

```bash
# === 외부망 (집/카페) ===
export OPENAI_BASE_URL=https://api.openai.com/v1
export OPENAI_API_KEY=sk-proj-...

# === 내부망 (사내) ===
export OPENAI_BASE_URL=http://internal-vllm:8000/v1
export OPENAI_API_KEY=internal-key
# 코드 변경 없이 동일 도구 사용
```

### OpenCode 설정 파일

```json
{
  "providers": {
    "internal-vllm": {
      "type": "openai-compatible",
      "baseURL": "http://internal-vllm:8000/v1",
      "apiKey": "internal-key"
    },
    "ollama-internal": {
      "type": "openai-compatible",
      "baseURL": "http://internal-gpu:11434/v1",
      "apiKey": "ollama"
    }
  },
  "model": "internal-vllm::deepseek-r1:70b"
}
```

### aider 설정

```bash
aider --openai-api-base http://internal-vllm:8000/v1 \
      --openai-api-key internal-key \
      --model openai/deepseek-r1:70b
```

---

## 자체 서명 인증서 (사내 CA)

```bash
# Node.js
export NODE_EXTRA_CA_CERTS=/etc/ssl/internal-ca.pem

# Python
export SSL_CERT_FILE=/etc/ssl/internal-ca.pem
export REQUESTS_CA_BUNDLE=/etc/ssl/internal-ca.pem

# Go
# 시스템 인증서 풀에 추가:
# cp internal-ca.pem /usr/local/share/ca-certificates/
# update-ca-certificates
```

---

## 에어갭 패키지 설치

### npm (Node.js 도구)

```bash
# 인터넷 PC — Verdaccio 미러
docker run -d -p 4873:4873 -v /data/verdaccio:/verdaccio/storage verdaccio/verdaccio
npm set registry http://verdaccio:4873
npm install opencode  # 캐시됨

# 에어갭 PC
npm install --registry http://verdaccio:4873 --prefer-offline
```

### Go 모듈 (Go 도구)

```bash
# 인터넷 PC
go mod vendor && tar czf vendor.tgz vendor/ go.mod go.sum

# 에어갭 PC
export GOFLAGS=-mod=vendor
export GOPROXY=off
export GONOSUMCHECK=*
go build ./...
```

---

## 추천 배포 매트릭스

| 시나리오 | 스택 | 비용 | 프라이버시 |
|---------|------|------|----------|
| **소규모 팀, 인터넷 OK** | GPT-4o-mini or Gemini Flash + OpenCode 포크 | $0.40~0.60/M | API=학습 안 함 |
| **최고 품질 클라우드** | Claude Sonnet 4 via AWS Bedrock | $15/M | VPC 격리 |
| **한국 엔터프라이즈** | Azure OpenAI Private Link (Korea Central) | 엔터프라이즈 | 완전 VPC |
| **에어갭 멀티유저** | vLLM + DeepSeek R1 70B (4x A100) | HW만 | 100% 온프레미스 |
| **에어갭 개인 맥북** | Ollama + DeepSeek-Coder 6.7B | 무료 | 100% 로컬 |
| **CPU 전용 에어갭** | LocalAI + llama.cpp + Qwen2.5-Coder 7B | HW만 | 100% 온프레미스 |
| **하이브리드** | OpenCode + `OPENAI_BASE_URL` 전환 | 혼합 | 설정 가능 |

---

## 참고 제약사항

1. 처리량(t/s)은 하드웨어 의존적. vLLM 793 t/s = 멀티 A100. 단일 A100 = 120~200 t/s.
2. 벤치마크 점수는 프롬프팅 전략에 따라 3~8점 편차.
3. GLM/Zhipu 가격 2026 초 30~100% 인상. 공식 대시보드에서 확인.
4. 한국 지연 80~120ms는 CDN 패턴 기반 추정. 직접 측정 아님.
5. TGI는 2025.12 유지보수 모드. 신규 배포는 vLLM 추천.

---

*분석 일시: 2026-03-26*
