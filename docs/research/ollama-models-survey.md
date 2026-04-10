# Ollama Models Survey 2024–2026

> 작성일: 2026-03-30  
> 목적: hanimo (오픈소스 AI 코딩 에이전트) 공식 지원 모델 선정  
> 기준 하드웨어: Apple M3 Max 36GB 통합 메모리  
> 출처: https://ollama.com/library (각 모델 페이지), 공식 릴리스 노트  

---

## 평가 기준 설명

| 항목 | 설명 |
|------|------|
| Tool calling | 함수 호출/에이전트 워크플로우 지원 여부 (hanimo 필수) |
| 코딩 | 코드 생성·수정·설명 품질 |
| 긴 컨텍스트 | 128K+ 토큰 지원 여부 |
| 로컬 실행 | M3 Max 36GB에서 Q4 기준 실행 가능 여부 |
| 한국어 | 한국어 입출력 품질 |
| 라이선스 | Apache 2.0 / MIT = 상업 사용 자유; Llama License / Gemma ToU = 일부 제한 |

**점수: 1(낮음) ~ 5(높음), 총점 /30**

---

## Tier 1 — hanimo-recommended

> 로컬 실행 가능(≤30B Q4), 에이전트 품질 확보, 도구 호출 안정적

| Model | Pull 이름 | Size | Q4 파일 | Context | Tool | License | 총점 | 용도 |
|-------|-----------|------|---------|---------|------|---------|------|------|
| Qwen3-Coder 30B | `qwen3-coder:30b` | 30B (MoE, 3.3B active) | 19GB | 256K (1M ext) | ✅ | Apache 2.0 | **28/30** | 코딩 에이전트 1순위 |
| Qwen3 30B | `qwen3:30b` | 30B (MoE, ~3B active) | 19GB | 256K | ✅ | Apache 2.0 | **27/30** | 범용 에이전트 |
| GPT-OSS 20B | `gpt-oss:20b` | 20B (MoE, 3.6B active) | 14GB | 128K | ✅ | Apache 2.0 | **27/30** | 추론+도구 호출 |
| Qwen2.5-Coder 32B | `qwen2.5-coder:32b` | 32B | 22GB | 32K | ✅ (verify) | Apache 2.0 | **26/30** | 코딩 특화 (HumanEval 92.7%) |
| Qwen3 32B | `qwen3:32b` | 32B | 20GB | 40K | ✅ | Apache 2.0 | **26/30** | 범용 고성능 |
| DeepSeek-R1 32B | `deepseek-r1:32b` | 32B | 20GB | 128K | ✅ (verify) | MIT | **25/30** | 추론·수학·코딩 |
| Gemma4 31B | `gemma4:31b` | 31B (dense) | 20GB | 256K | ✅ native | Apache 2.0 (verify) | **25/30** | 범용·멀티모달 |
| Devstral 24B | `devstral:24b` | 24B | 14GB | 128K | ✅ | Apache 2.0 | **25/30** | 코드베이스 에이전트 (SWE-Bench 46.8%) |
| Granite 3.3 8B | `granite3.3:8b` | 8B | 4.9GB | 128K | ✅ | Apache 2.0 | **24/30** | 엔터프라이즈 도구호출 |

---

## Tier 2 — Good for specific tasks

> 특정 사용 사례에 강점, 또는 소형(≤14B)으로 빠른 반응 필요 시

| Model | Pull 이름 | Size | Q4 파일 | Context | Tool | License | 총점 | 용도 |
|-------|-----------|------|---------|---------|------|---------|------|------|
| Qwen3 14B | `qwen3:14b` | 14B | 9.3GB | 40K | ✅ | Apache 2.0 | **23/30** | 경량 에이전트 |
| Qwen3 8B | `qwen3:8b` | 8B | 5.2GB | 40K | ✅ | Apache 2.0 | **22/30** | 경량 범용 |
| Qwen2.5-Coder 14B | `qwen2.5-coder:14b` | 14B | ~9GB | 32K | ✅ (verify) | Apache 2.0 | **22/30** | 경량 코딩 |
| Llama 3.3 70B | `llama3.3:70b` | 70B | 43GB ❌M3 | 128K | ✅ | Llama 3.3 License | **22/30** | 고성능 범용 (서버용) |
| Llama 3.1 8B | `llama3.1:8b` | 8B | 4.7GB | 128K | ✅ | Llama 3.1 License | **22/30** | 경량 도구 호출 |
| Phi-4 14B | `phi4:14b` | 14B | 9.1GB | 16K | ❌ | MIT (verify) | **21/30** | 수학·논리 추론 |
| Phi-4-mini 3.8B | `phi4-mini:latest` | ~3.8B | 2.5GB | 128K | ✅ | MIT (verify) | **21/30** | 초경량 도구 호출 |
| Gemma3 27B | `gemma3:27b` | 27B | 22.5GB | 128K | ❌ (verify) | Gemma ToU | **21/30** | 비전·멀티언어 |
| Gemma3 12B | `gemma3:12b` | 12B | 12.4GB | 128K | ❌ (verify) | Gemma ToU | **20/30** | 경량 비전 |
| Granite 3.1 Dense 8B | `granite3.1-dense:8b` | 8B | 5.0GB | 128K | ✅ | Apache 2.0 | **22/30** | RAG·도구 호출 |
| Mistral Nemo 12B | `mistral-nemo:12b` | 12B | 7.1GB | 128K | ❌ (verify) | Apache 2.0 | **20/30** | 범용 Mistral 계열 |
| DeepSeek-R1 14B | `deepseek-r1:14b` | 14B | 9.0GB | 128K | ❌ (verify) | MIT | **20/30** | 경량 추론 |
| DeepSeek-R1 8B | `deepseek-r1:8b` | 8B | 5.2GB | 128K | ❌ (verify) | MIT | **19/30** | 초경량 추론 |
| Devstral-Small-2 24B | `devstral-small-2:latest` | 24B | ~14GB | 128K | ✅ | verify | **23/30** | 코드베이스 에이전트 최신판 |
| Qwen3-VL 8B | `qwen3-vl:8b` | 8B | ~5GB | TBD | ✅ | Apache 2.0 | **21/30** | 비전+에이전트 |

---

## Tier 3 — Experimental / Large / Niche

> 36GB에서 실행 불가(70B+), 또는 특수 목적, 또는 오래된 모델

| Model | Pull 이름 | Size | Q4 파일 | Context | Tool | License | 비고 |
|-------|-----------|------|---------|---------|------|---------|------|
| GPT-OSS 120B | `gpt-oss:120b` | 120B (MoE, 5.1B active) | 65GB | 128K | ✅ | Apache 2.0 | 서버 전용 |
| DeepSeek-V3 671B | `deepseek-v3:671b` | 671B (MoE, 37B active) | 404GB | 160K | TBD | TBD | 서버 전용 |
| DeepSeek-R1 671B | `deepseek-r1:671b` | 671B | 404GB | 160K | TBD | MIT | 서버 전용 |
| Llama 4 Scout | `llama4:16x17b` | 109B (MoE, 17B active) | 67GB | 10M | TBD | Llama 4 License | 서버 전용, 10M context |
| Llama 4 Maverick | `llama4:128x17b` | 400B (MoE, 17B active) | 245GB | 1M | TBD | Llama 4 License | 서버 전용 |
| Qwen3 235B | `qwen3:235b` | 235B (MoE) | 142GB | 40K | ✅ | Apache 2.0 | 서버 전용 |
| Qwen3-Coder 480B | `qwen3-coder:480b` | 480B (MoE, 35B active) | 290GB | 256K | ✅ | Apache 2.0 | 서버 전용 |
| Gemma4 26B MoE | `gemma4:26b` | 26B (MoE, 4B active) | 18GB | 256K | ✅ native | verify | 로컬 가능 (verify) |
| Mixtral 8x7B | `mixtral:8x7b` | 47B (MoE, ~13B active) | 26GB | 32K | ❌ | open weights | 로컬 가능이나 구형 |
| Mixtral 8x22B | `mixtral:8x22b` | 141B (MoE, 39B active) | 80GB | 64K | ✅ | open weights | 서버 전용 |
| Llama 3.1 405B | `llama3.1:405b` | 405B | ~230GB | 128K | ✅ | Llama 3.1 License | 서버 전용 |
| Llama 3.1 70B | `llama3.1:70b` | 70B | 43GB | 128K | ✅ | Llama 3.1 License | 서버 전용 |
| Llama 3.2 Vision 90B | `llama3.2-vision:90b` | 90B | ~55GB | 128K | TBD | Llama 3.2 License | 서버 전용 |
| DeepSeek-Coder-V2 236B | `deepseek-coder-v2:236b` | 236B (MoE) | 133GB | 4K | TBD | TBD | 서버 전용, 컨텍스트 짧음 |
| Codestral 22B | `codestral:22b` | 22B | 13GB | 32K | ❌ | Non-Production | 비상업 라이선스 주의 |
| Nemotron-Cascade-2 30B | `nemotron-cascade-2:latest` | 30B (MoE, 3B active) | ~18GB | TBD | TBD | verify | 추론·에이전트 |
| Command-R 35B | `command-r:latest` | 35B | ~19GB | 128K | ✅ | verify | RAG·도구 호출 특화 |

---

## 패밀리별 상세

### Qwen (Alibaba)

> 한국어 지원 우수, Apache 2.0, tool calling 안정성 최상위 오픈소스  
> 출처: https://ollama.com/library/qwen3, https://ollama.com/library/qwen2.5, https://ollama.com/library/qwen2.5-coder, https://ollama.com/library/qwen3-coder, https://ollama.com/library/qwen3-vl

| Model | Pull 이름 | Params | Context | Tool | Vision | 출시 | License |
|-------|-----------|--------|---------|------|--------|------|---------|
| Qwen3 0.6B | `qwen3:0.6b` | 0.6B | 40K | ✅ | ❌ | 2025-Q2 | Apache 2.0 |
| Qwen3 1.7B | `qwen3:1.7b` | 1.7B | 40K | ✅ | ❌ | 2025-Q2 | Apache 2.0 |
| Qwen3 4B | `qwen3:4b` | 4B | 256K | ✅ | ❌ | 2025-Q2 | Apache 2.0 |
| Qwen3 8B | `qwen3:8b` | 8B | 40K | ✅ | ❌ | 2025-Q2 | Apache 2.0 |
| Qwen3 14B | `qwen3:14b` | 14B | 40K | ✅ | ❌ | 2025-Q2 | Apache 2.0 |
| Qwen3 30B | `qwen3:30b` | 30B (MoE) | 256K | ✅ | ❌ | 2025-Q2 | Apache 2.0 |
| Qwen3 32B | `qwen3:32b` | 32B | 40K | ✅ | ❌ | 2025-Q2 | Apache 2.0 |
| Qwen3 235B | `qwen3:235b` | 235B (MoE) | 40K | ✅ | ❌ | 2025-Q2 | Apache 2.0 |
| Qwen3.5 (multi) | `qwen3.5:*` | 0.8B–122B | TBD | ✅ | verify | 2025-Q4 | Apache 2.0 |
| Qwen2.5 0.5B | `qwen2.5:0.5b` | 0.5B | 32K | ❌ | ❌ | 2024-Q3 | Apache 2.0 |
| Qwen2.5 7B | `qwen2.5:7b` | 7B | 32K (128K base) | ❌ | ❌ | 2024-Q3 | Apache 2.0 |
| Qwen2.5 14B | `qwen2.5:14b` | 14B | 32K | ❌ | ❌ | 2024-Q3 | Apache 2.0 |
| Qwen2.5 32B | `qwen2.5:32b` | 32B | 32K | ❌ | ❌ | 2024-Q3 | Apache 2.0 |
| Qwen2.5 72B | `qwen2.5:72b` | 72B | 32K | ❌ | ❌ | 2024-Q3 | Qwen License |
| Qwen2.5-Coder 0.5B | `qwen2.5-coder:0.5b` | 0.5B | 32K | verify | ❌ | 2024-Q4 | Apache 2.0 |
| Qwen2.5-Coder 7B | `qwen2.5-coder:7b` | 7B | 32K | verify | ❌ | 2024-Q4 | Apache 2.0 |
| Qwen2.5-Coder 14B | `qwen2.5-coder:14b` | 14B | 32K | verify | ❌ | 2024-Q4 | Apache 2.0 |
| Qwen2.5-Coder 32B | `qwen2.5-coder:32b` | 32B | 32K | verify | ❌ | 2024-Q4 | Apache 2.0 |
| Qwen3-Coder 30B | `qwen3-coder:30b` | 30B (MoE, 3.3B active) | 256K (1M ext) | ✅ | ❌ | 2025-Q3 | verify |
| Qwen3-Coder 480B | `qwen3-coder:480b` | 480B (MoE, 35B active) | 256K | ✅ | ❌ | 2025-Q3 | verify |
| Qwen3-VL 2B | `qwen3-vl:2b` | 2B | TBD | ✅ | ✅ | 2025-Q3 | Apache 2.0 |
| Qwen3-VL 8B | `qwen3-vl:8b` | 8B | TBD | ✅ | ✅ | 2025-Q3 | Apache 2.0 |
| Qwen3-VL 235B | `qwen3-vl:235b` | 235B | TBD | ✅ | ✅ | 2025-Q3 | Apache 2.0 |

**hanimo 추천**: `qwen3-coder:30b` (코딩 에이전트), `qwen3:30b` (범용 에이전트), `qwen3:8b` (경량 로컬)

---

### Llama (Meta)

> 광범위한 에코시스템, 도구 호출 지원, 라이선스는 Llama 커뮤니티 라이선스  
> 출처: https://ollama.com/library/llama3, https://ollama.com/library/llama3.1, https://ollama.com/library/llama3.2, https://ollama.com/library/llama3.3, https://ollama.com/library/llama4

| Model | Pull 이름 | Params | Context | Tool | Vision | 출시 | License |
|-------|-----------|--------|---------|------|--------|------|---------|
| Llama 3 8B | `llama3:8b` | 8B | 8K | ❌ | ❌ | 2024-04 | Meta Llama 3 |
| Llama 3 70B | `llama3:70b` | 70B | 8K | ❌ | ❌ | 2024-04 | Meta Llama 3 |
| Llama 3.1 8B | `llama3.1:8b` | 8B | 128K | ✅ | ❌ | 2024-07 | Llama 3.1 License |
| Llama 3.1 70B | `llama3.1:70b` | 70B | 128K | ✅ | ❌ | 2024-07 | Llama 3.1 License |
| Llama 3.1 405B | `llama3.1:405b` | 405B | 128K | ✅ | ❌ | 2024-07 | Llama 3.1 License |
| Llama 3.2 1B | `llama3.2:1b` | 1B | 128K | ✅ | ❌ | 2024-09 | Llama 3.2 License |
| Llama 3.2 3B | `llama3.2:3b` | 3B | 128K | ✅ | ❌ | 2024-09 | Llama 3.2 License |
| Llama 3.2 Vision 11B | `llama3.2-vision:11b` | 11B | 128K | TBD | ✅ | 2024-09 | Llama 3.2 License |
| Llama 3.2 Vision 90B | `llama3.2-vision:90b` | 90B | 128K | TBD | ✅ | 2024-09 | Llama 3.2 License |
| Llama 3.3 70B | `llama3.3:70b` | 70B | 128K | ✅ | ❌ | 2024-12 | Llama 3.3 License |
| Llama 4 Scout | `llama4:16x17b` | 109B (MoE, 16x17B) | 10M | TBD | ✅ | 2025-Q1 | Llama 4 License |
| Llama 4 Maverick | `llama4:128x17b` | 400B (MoE, 128x17B) | 1M | TBD | ✅ | 2025-Q1 | Llama 4 License |

**주의**: Llama 라이선스는 MAU 7억 이상 제품에 별도 허가 필요. 대부분 스타트업에는 문제 없음.  
**hanimo 추천**: `llama3.1:8b` (경량 도구 호출), `llama3.3:70b` (서버 전용 고성능)

---

### Gemma (Google)

> 출처: https://ollama.com/library/gemma2, https://ollama.com/library/gemma3, https://ollama.com/library/gemma4

| Model | Pull 이름 | Params | Context | Tool | Vision | 출시 | License |
|-------|-----------|--------|---------|------|--------|------|---------|
| Gemma2 2B | `gemma2:2b` | 2B | TBD | ❌ | ❌ | 2024-06 | Gemma ToU |
| Gemma2 9B | `gemma2:9b` | 9B | TBD | ❌ | ❌ | 2024-06 | Gemma ToU |
| Gemma2 27B | `gemma2:27b` | 27B | TBD | ❌ | ❌ | 2024-06 | Gemma ToU |
| Gemma3 270M | `gemma3:270m` | 270M | 32K | ❌ | ❌ | 2025-03 | Gemma ToU |
| Gemma3 1B | `gemma3:1b` | 1B | 32K | ❌ | ❌ | 2025-03 | Gemma ToU |
| Gemma3 4B | `gemma3:4b` | 4B | 128K | ❌ | ✅ | 2025-03 | Gemma ToU |
| Gemma3 12B | `gemma3:12b` | 12B | 128K | ❌ | ✅ | 2025-03 | Gemma ToU |
| Gemma3 27B | `gemma3:27b` | 27B | 128K | ❌ | ✅ | 2025-03 | Gemma ToU |
| Gemma4 E2B | `gemma4:e2b` | ~2B | 128K | ✅ native | ✅ | 2025-Q4 | verify |
| Gemma4 E4B | `gemma4:e4b` | ~4B | 128K | ✅ native | ✅ | 2025-Q4 | verify |
| Gemma4 26B | `gemma4:26b` | 26B (MoE, 4B active) | 256K | ✅ native | ✅ | 2025-Q4 | verify |
| Gemma4 31B | `gemma4:31b` | 31B (dense) | 256K | ✅ native | ✅ | 2025-Q4 | verify |

**주의**: Gemma Terms of Use는 Apache 2.0이 아님. 상업 사용 가능하나 Google 약관 준수 필요.  
**주목**: Gemma4 31B — AIME 2026 89.2%, LiveCodeBench 80.0%, Codeforces ELO 2150. 매우 강력.  
**hanimo 추천**: `gemma4:31b` (고성능 로컬), `gemma3:12b` (경량 비전)

---

### Mistral (Mistral AI)

> 출처: https://ollama.com/library/mistral, https://ollama.com/library/mistral-nemo, https://ollama.com/library/codestral, https://ollama.com/library/mixtral

| Model | Pull 이름 | Params | Context | Tool | Vision | 출시 | License |
|-------|-----------|--------|---------|------|--------|------|---------|
| Mistral 7B v0.3 | `mistral:7b` | 7B | 32K | ✅ (v0.3+) | ❌ | 2024-05 | Apache 2.0 |
| Mistral Nemo 12B | `mistral-nemo:12b` | 12B | 128K | ❌ verify | ❌ | 2024-07 | Apache 2.0 |
| Codestral 22B | `codestral:22b` | 22B | 32K | ❌ (known issue) | ❌ | 2024-05 | **Non-Production** ⚠️ |
| Mixtral 8x7B | `mixtral:8x7b` | 47B (MoE) | 32K | ❌ | ❌ | 2023-12 | open weights |
| Mixtral 8x22B | `mixtral:8x22b` | 141B (MoE, 39B active) | 64K | ✅ native | ❌ | 2024-04 | open weights |
| Devstral 24B | `devstral:24b` | 24B | 128K | ✅ | ❌ | 2025-05 | Apache 2.0 |
| Devstral-Small-2 24B | `devstral-small-2:latest` | 24B | 128K | ✅ | ❌ | 2025-12 | verify |
| Devstral-2 123B | `devstral-2:latest` | 123B | TBD | ✅ | ❌ | 2025-12 | verify |
| Ministral-3 3B | `ministral-3:3b` | 3B | TBD | ✅ | ❌ | 2025 | verify |
| Ministral-3 8B | `ministral-3:8b` | 8B | TBD | ✅ | ❌ | 2025 | verify |

**주의**: Codestral은 **Mistral AI Non-Production License** — 상업 제품에 내장 불가. hanimo에는 부적합.  
**hanimo 추천**: `devstral:24b` (코드베이스 탐색+에이전트), `mistral:7b` (경량)

---

### DeepSeek (DeepSeek AI)

> 출처: https://ollama.com/library/deepseek-r1, https://ollama.com/library/deepseek-v3, https://ollama.com/library/deepseek-coder-v2

| Model | Pull 이름 | Params | Context | Tool | Vision | 출시 | License |
|-------|-----------|--------|---------|------|--------|------|---------|
| DeepSeek-R1 1.5B | `deepseek-r1:1.5b` | 1.5B | 128K | ❌ verify | ❌ | 2025-01 | MIT |
| DeepSeek-R1 7B | `deepseek-r1:7b` | 7B | 128K | ❌ verify | ❌ | 2025-01 | MIT |
| DeepSeek-R1 8B (Llama distill) | `deepseek-r1:8b` | 8B | 128K | ❌ verify | ❌ | 2025-01 | MIT+Llama3.1 |
| DeepSeek-R1 14B | `deepseek-r1:14b` | 14B | 128K | ❌ verify | ❌ | 2025-01 | MIT |
| DeepSeek-R1 32B | `deepseek-r1:32b` | 32B | 128K | ❌ verify | ❌ | 2025-01 | MIT |
| DeepSeek-R1 70B (Llama distill) | `deepseek-r1:70b` | 70B | 128K | ❌ verify | ❌ | 2025-01 | MIT+Llama3.3 |
| DeepSeek-R1 671B | `deepseek-r1:671b` | 671B | 160K | ❌ verify | ❌ | 2025-01 | MIT |
| DeepSeek-V3 671B | `deepseek-v3:671b` | 671B (MoE, 37B active) | 160K | ❌ verify | ❌ | 2024-12 | verify |
| DeepSeek-Coder-V2 16B | `deepseek-coder-v2:16b` | 16B (MoE) | 160K | ❌ verify | ❌ | 2024-05 | verify |
| DeepSeek-Coder-V2 236B | `deepseek-coder-v2:236b` | 236B (MoE) | 4K ⚠️ | ❌ verify | ❌ | 2024-05 | verify |

**주의**: DeepSeek-R1 계열은 reasoning (chain-of-thought) 모델. Tool calling은 별도 검증 필요.  
**주의**: DeepSeek-Coder-V2 236B는 컨텍스트 4K로 매우 짧음 — 실용성 낮음.  
**hanimo 추천**: `deepseek-r1:32b` (추론·수학 집중 작업), `deepseek-coder-v2:16b` (코딩+긴 컨텍스트)

---

### Phi (Microsoft)

> 출처: https://ollama.com/library/phi3, https://ollama.com/library/phi4

| Model | Pull 이름 | Params | Context | Tool | Vision | 출시 | License |
|-------|-----------|--------|---------|------|--------|------|---------|
| Phi-3 Mini 3.8B | `phi3:mini` | 3.8B | 128K | ❌ | ❌ | 2024-04 | MIT |
| Phi-3 Medium 14B | `phi3:medium` | 14B | 128K | ❌ | ❌ | 2024-04 | MIT |
| Phi-3.5 Mini 3.8B | `phi3.5:3.8b` | 3.8B | 128K | ❌ | ❌ | 2024-08 | MIT |
| Phi-4 14B | `phi4:14b` | 14B | 16K ⚠️ | ❌ | ❌ | 2024-12 | MIT (verify) |
| Phi-4-mini | `phi4-mini:latest` | ~3.8B | 128K | ✅ | ❌ | 2025-02 | MIT (verify) |

**주의**: Phi-4의 16K 컨텍스트는 복잡한 코딩 작업에 제약. Phi-4-mini는 128K + tool calling으로 경량 에이전트에 적합.  
**hanimo 추천**: `phi4-mini` (초경량 도구 호출 에이전트)

---

### Command-R (Cohere)

> 출처: https://ollama.com/library/command-r

| Model | Pull 이름 | Params | Context | Tool | Vision | 출시 | License |
|-------|-----------|--------|---------|------|--------|------|---------|
| Command-R | `command-r:latest` | ~35B | 128K | ✅ | ❌ | 2024-03 | verify |
| Command-R+ | `command-r-plus:latest` | ~104B | 128K | ✅ | ❌ | 2024-04 | verify |

**특징**: RAG·도구 호출에 특화 설계. 한국어 지원 수준 verify 필요.

---

### GPT-OSS (OpenAI)

> 출처: https://ollama.com/library/gpt-oss, https://openai.com/index/introducing-gpt-oss/

| Model | Pull 이름 | Params | Context | Tool | Vision | 출시 | License |
|-------|-----------|--------|---------|------|--------|------|---------|
| GPT-OSS 20B | `gpt-oss:20b` | 21B (MoE, 3.6B active) | 128K | ✅ native | ❌ | 2025-Q2 | **Apache 2.0** |
| GPT-OSS 120B | `gpt-oss:120b` | 117B (MoE, 5.1B active) | 128K | ✅ native | ❌ | 2025-Q2 | **Apache 2.0** |

**특징**:
- MoE 가중치 MXFP4 양자화로 20B는 16GB에서 실행 가능
- Full chain-of-thought 접근 (reasoning 과정 완전 공개)
- Configurable reasoning effort (low/medium/high)
- GPT-OSS-20B ≈ o3-mini 성능, GPT-OSS-120B ≈ o4-mini 성능
- Apache 2.0으로 상업 사용 자유

**hanimo 추천**: `gpt-oss:20b` (Tier 1, M3 Max에서 실행 가능)

---

### Granite (IBM)

> 출처: https://ollama.com/library/granite3.3, https://ollama.com/library/granite3.1-dense

| Model | Pull 이름 | Params | Context | Tool | Vision | 출시 | License |
|-------|-----------|--------|---------|------|--------|------|---------|
| Granite 3.1 Dense 2B | `granite3.1-dense:2b` | 2B | 128K | ✅ | ❌ | 2024-12-18 | Apache 2.0 |
| Granite 3.1 Dense 8B | `granite3.1-dense:8b` | 8B | 128K | ✅ | ❌ | 2024-12-18 | Apache 2.0 |
| Granite 3.3 2B | `granite3.3:2b` | 2B | 128K | ✅ | ❌ | 2025-04-16 | Apache 2.0 |
| Granite 3.3 8B | `granite3.3:8b` | 8B | 128K | ✅ | ❌ | 2025-04-16 | Apache 2.0 |
| Granite Embedding 278M | `granite-embedding:278m` | 278M | TBD | ❌ | ❌ | 2024 | Apache 2.0 |

**특징**: Apache 2.0 완전 오픈, 엔터프라이즈 도구 호출, FIM(Fill-in-Middle) 코드 완성 지원, 12개 언어(영·독·불·한 포함).  
**hanimo 추천**: `granite3.3:8b` (경량 Apache 2.0 도구 호출)

---

### NovaSky / Nvidia Nemotron

> 출처: https://ollama.com/library/nemotron-cascade-2

| Model | Pull 이름 | Params | Context | Tool | Vision | 출시 | License |
|-------|-----------|--------|---------|------|--------|------|---------|
| Nemotron-Cascade-2 30B | `nemotron-cascade-2:latest` | 30B (MoE, 3B active) | TBD | ✅ | ❌ | 2025 | verify |
| Nemotron-3-Nano 4B | `nemotron-3-nano:4b` | 4B | TBD | ✅ | ❌ | 2025 | verify |
| Nemotron-3-Nano 30B | `nemotron-3-nano:30b` | 30B | TBD | ✅ | ❌ | 2025 | verify |
| Nemotron-3-Super 120B | `nemotron-3-super:latest` | 120B (MoE, 12B active) | TBD | ✅ | ❌ | 2025 | verify |

**주목**: Nemotron-Cascade-2는 2025 IMO·IOI 금메달급 수학·알고리즘 성능 주장.

---

### SmolLM2 (HuggingFace)

> 출처: https://ollama.com/library/smollm2

| Model | Pull 이름 | Params | Context | Tool | License |
|-------|-----------|--------|---------|------|---------|
| SmolLM2 135M | `smollm2:135m` | 135M | TBD | ❌ | Apache 2.0 |
| SmolLM2 360M | `smollm2:360m` | 360M | TBD | ❌ | Apache 2.0 |
| SmolLM2 1.7B | `smollm2:1.7b` | 1.7B | TBD | ❌ | Apache 2.0 |

**용도**: 온디바이스 초경량, edge deployment.

---

### StarCoder2 (BigCode)

> 출처: https://ollama.com/library/starcoder2

| Model | Pull 이름 | Params | Context | Tool | License |
|-------|-----------|--------|---------|------|---------|
| StarCoder2 3B | `starcoder2:3b` | 3B | 16K | ❌ | verify |
| StarCoder2 7B | `starcoder2:7b` | 7B | 16K | ❌ | verify |
| StarCoder2 15B | `starcoder2:15b` | 15B | 16K | ❌ | verify |

**특징**: 600+ 프로그래밍 언어(15B 기준), 4조+ 토큰 학습. Tool calling 없음, 컨텍스트 짧음.  
**hanimo 용도**: FIM(Fill-in-Middle) 코드 자동완성 특화 백엔드로만 활용 가능.

---

### CodeLlama (Meta)

> 출처: https://ollama.com/library/codellama

| Model | Pull 이름 | Params | Context | Tool | License |
|-------|-----------|--------|---------|------|---------|
| CodeLlama 7B | `codellama:7b` | 7B | 16K | ❌ | Llama 2 |
| CodeLlama 13B | `codellama:13b` | 13B | 16K | ❌ | Llama 2 |
| CodeLlama 34B | `codellama:34b` | 34B | 16K | ❌ | Llama 2 |
| CodeLlama 70B | `codellama:70b` | 70B | 16K | ❌ | Llama 2 |

**주의**: Llama 2 기반 구형 모델. Qwen2.5-Coder 또는 DeepSeek-Coder-V2로 대체 권장.

---

### 임베딩 전용 모델

> 코딩 에이전트에서 코드 검색(RAG) 파이프라인 구성 시 사용

| Model | Pull 이름 | Params | Dimensions | Context | License |
|-------|-----------|--------|------------|---------|---------|
| nomic-embed-text | `nomic-embed-text:latest` | 137M | TBD | 8K | verify |
| mxbai-embed-large | `mxbai-embed-large:latest` | TBD | TBD | TBD | verify |
| granite-embedding 30M | `granite-embedding:30m` | 30M | TBD | TBD | Apache 2.0 |
| granite-embedding 278M | `granite-embedding:278m` | 278M | TBD | TBD | Apache 2.0 |
| nomic-embed-text-v2-moe | `nomic-embed-text-v2-moe:latest` | TBD | TBD | TBD | verify |

---

## 코딩 특화 모델 비교

| Model | HumanEval | SWE-Bench | Aider | 컨텍스트 | M3 36GB | License |
|-------|-----------|-----------|-------|---------|---------|---------|
| Qwen3-Coder 30B | TBD | TBD | TBD | 256K | ✅ 19GB | verify |
| Qwen2.5-Coder 32B | 92.7% | TBD | 73.7 | 32K | ✅ 22GB | Apache 2.0 |
| Devstral 24B | TBD | 46.8% | TBD | 128K | ✅ 14GB | Apache 2.0 |
| Devstral-Small-2 24B | TBD | TBD | TBD | 128K | ✅ 14GB | verify |
| DeepSeek-Coder-V2 16B | TBD | TBD | TBD | 160K | ✅ 8.9GB | verify |
| StarCoder2 15B | TBD | TBD | TBD | 16K | ✅ ~9GB | verify |
| CodeLlama 34B | TBD | TBD | TBD | 16K | ✅ 20GB | Llama 2 |
| Codestral 22B | TBD | TBD | TBD | 32K | ✅ 13GB | **Non-Prod** ⚠️ |

---

## 비전 지원 모델

| Model | Pull 이름 | Params | Context | 비전 기능 | M3 36GB |
|-------|-----------|--------|---------|---------|---------|
| Gemma4 31B | `gemma4:31b` | 31B | 256K | 이미지 | ✅ 20GB |
| Gemma4 26B | `gemma4:26b` | 26B MoE | 256K | 이미지 | ✅ 18GB |
| Gemma3 27B | `gemma3:27b` | 27B | 128K | 이미지 | ✅ 22.5GB |
| Gemma3 12B | `gemma3:12b` | 12B | 128K | 이미지 | ✅ 12.4GB |
| Gemma3 4B | `gemma3:4b` | 4B | 128K | 이미지 | ✅ ~3GB |
| Qwen3-VL 8B | `qwen3-vl:8b` | 8B | TBD | 이미지+GUI 에이전트 | ✅ ~5GB |
| Qwen3-VL 2B | `qwen3-vl:2b` | 2B | TBD | 이미지+GUI | ✅ ~1.5GB |
| Llama 3.2 Vision 11B | `llama3.2-vision:11b` | 11B | 128K | 이미지 | ✅ ~7GB |
| Llama 3.2 Vision 90B | `llama3.2-vision:90b` | 90B | 128K | 이미지 | ❌ 55GB |
| Llama 4 Scout | `llama4:16x17b` | 109B MoE | 10M | 이미지 | ❌ 67GB |
| Kimi-K2.5 | `kimi-k2.5:latest` | TBD | TBD | 이미지+멀티모달 | TBD |

---

## M3 Max 36GB 실행 가능 여부 (Q4 기준)

> Apple M3 Max 36GB 통합 메모리. 운영체제 오버헤드 ~4-6GB 차감 시 실질 ~30GB 사용 가능.

### 확실히 실행 가능 (≤22GB)

| Model | Q4 파일 크기 | 여유 메모리 |
|-------|------------|-----------|
| Qwen3-Coder 30B | 19GB | ~11GB |
| GPT-OSS 20B | 14GB | ~16GB |
| Devstral 24B | 14GB | ~16GB |
| Qwen3 32B | 20GB | ~10GB |
| Qwen2.5-Coder 32B | ~22GB | ~8GB |
| DeepSeek-R1 32B | 20GB | ~10GB |
| Gemma4 31B | 20GB | ~10GB |
| Gemma3 27B | 22.5GB | ~7.5GB |
| Phi-4 14B | 9.1GB | ~21GB |
| Qwen3 14B | 9.3GB | ~21GB |
| Mistral Nemo 12B | 7.1GB | ~23GB |
| DeepSeek-Coder-V2 16B | 8.9GB | ~21GB |
| Llama 3.1 8B | 4.7GB | ~25GB |
| Qwen3 8B | 5.2GB | ~25GB |
| Granite 3.3 8B | 4.9GB | ~25GB |
| Phi-4-mini | 2.5GB | ~28GB |

### 불가능 (>30GB, 서버 전용)

| Model | Q4 파일 크기 | 이유 |
|-------|------------|------|
| Llama 3.3 70B | 43GB | 메모리 초과 |
| Llama 3.1 70B | 43GB | 메모리 초과 |
| GPT-OSS 120B | 65GB | 메모리 초과 |
| Llama 4 Scout | 67GB | 메모리 초과 |
| DeepSeek-V3 671B | 404GB | 메모리 초과 |
| DeepSeek-R1 671B | 404GB | 메모리 초과 |

> **참고**: Mixtral 8x7B (26GB)는 M3 Max 36GB에서 실행 가능하나 성능 대비 가성비 낮음.

---

## hanimo 최종 추천 모델 목록

### 기본 번들 (4종)

| 우선순위 | Model | 이유 |
|---------|-------|------|
| 1순위 | `qwen3-coder:30b` | 코딩 에이전트 특화, 256K context, MoE 효율, tool calling 안정 |
| 2순위 | `gpt-oss:20b` | OpenAI 품질 로컬 추론, 128K, tool calling native, Apache 2.0 |
| 3순위 | `devstral:24b` | SWE-Bench #1 오픈소스, 코드베이스 탐색+편집 특화 |
| 4순위 | `qwen3:8b` | 경량 범용 에이전트, 빠른 반응, 256K 서브셋 |

### 선택적 지원 (용도별)

| 용도 | 추천 모델 |
|------|---------|
| 수학·추론 집중 | `deepseek-r1:32b` |
| 비전+코딩 | `gemma4:31b` |
| RAG 파이프라인 임베딩 | `nomic-embed-text` |
| 초경량 에이전트 (≤3GB) | `phi4-mini` |
| 엔터프라이즈 Apache 2.0 | `granite3.3:8b` |
| 서버 고성능 | `llama3.3:70b` (서버 배포 시) |

---

## 라이선스 요약

| 라이선스 | 상업 사용 | 수정/배포 | 해당 모델 |
|---------|---------|---------|---------|
| Apache 2.0 | ✅ 자유 | ✅ 자유 | Qwen3, GPT-OSS, Granite, Devstral, Mistral 7B |
| MIT | ✅ 자유 | ✅ 자유 | DeepSeek-R1, Phi-3/4 (verify) |
| Llama License | ✅ (MAU 7억 미만) | 제한적 | Llama 3.x, 4 |
| Gemma ToU | ✅ (Google 약관 내) | 제한적 | Gemma2, Gemma3, Gemma4 |
| Mistral Non-Production | ❌ 상업 불가 | ❌ | Codestral |

---

## 버전 / 신선도 참고

- 2025년 이후 출시 모델: Qwen3 계열, GPT-OSS, Gemma4, Devstral-Small-2, Granite 3.3, Nemotron-Cascade-2
- 2024년 출시 모델: Qwen2.5 계열, Llama 3.1/3.2/3.3, DeepSeek-R1/V3, Phi-4, Mistral Nemo, Granite 3.1
- 2023년 이전 / 구형: CodeLlama, Mixtral 8x7B, Llama 3 (비권장)

---

## 출처

- Ollama Library: https://ollama.com/library
- Ollama Tool Calling Models: https://ollama.com/search?c=tools
- Qwen3: https://ollama.com/library/qwen3
- Qwen2.5: https://ollama.com/library/qwen2.5
- Qwen2.5-Coder: https://ollama.com/library/qwen2.5-coder
- Qwen3-Coder: https://ollama.com/library/qwen3-coder
- Qwen3-VL: https://ollama.com/library/qwen3-vl
- Llama 3.1: https://ollama.com/library/llama3.1
- Llama 3.2: https://ollama.com/library/llama3.2
- Llama 3.3: https://ollama.com/library/llama3.3
- Llama 4: https://ollama.com/library/llama4
- Gemma3: https://ollama.com/library/gemma3
- Gemma4: https://ollama.com/library/gemma4
- DeepSeek-R1: https://ollama.com/library/deepseek-r1
- DeepSeek-V3: https://ollama.com/library/deepseek-v3
- DeepSeek-Coder-V2: https://ollama.com/library/deepseek-coder-v2
- Phi-4: https://ollama.com/library/phi4
- Phi-4-mini: https://ollama.com/library/phi4-mini
- Mistral: https://ollama.com/library/mistral
- Mistral Nemo: https://ollama.com/library/mistral-nemo
- Codestral: https://ollama.com/library/codestral
- Mixtral: https://ollama.com/library/mixtral
- Devstral: https://ollama.com/library/devstral
- GPT-OSS: https://ollama.com/library/gpt-oss
- GPT-OSS 발표: https://openai.com/index/introducing-gpt-oss/
- Granite 3.3: https://ollama.com/library/granite3.3
- Granite 3.1 Dense: https://ollama.com/library/granite3.1-dense
- StarCoder2: https://ollama.com/library/starcoder2
- CodeLlama: https://ollama.com/library/codellama
- Command-R: https://ollama.com/library/command-r
- nomic-embed-text: https://ollama.com/library/nomic-embed-text
- VRAM 요구사항: https://localllm.in/blog/ollama-vram-requirements-for-local-llms
- Best Ollama Models 2026: https://www.morphllm.com/best-ollama-models
