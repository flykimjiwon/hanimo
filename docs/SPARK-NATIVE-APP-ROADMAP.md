# Spark Native App Roadmap

DGX Spark Gemma4 클라이언트의 네이티브 앱 확장 계획

## Current: Go CLI + Web UI (v1)

- **파일**: `cmd/spark/main.go`
- **빌드**: `go build -o spark ./cmd/spark/`
- **실행**: `./spark` → `http://localhost:9800`
- **모델**: gemma4:31b (deep), gemma4:26b (fast, default)
- **기능**: 스트리밍 채팅, 모델 선택, Deep Think 모드

## Phase 2: macOS Native App (SwiftUI)

### 목표
네이티브 macOS 앱으로 시스템 통합 및 UX 강화

### 기술 스택
- SwiftUI + async/await
- URLSession SSE streaming
- SwiftData (채팅 히스토리 영구 저장)

### 핵심 기능
| 기능 | 설명 |
|------|------|
| 네이티브 채팅 UI | macOS 디자인 가이드라인 준수 |
| 메뉴바 앱 | 상단 메뉴바에서 빠른 질의 (Spotlight 스타일) |
| Markdown 렌더링 | 코드 블록 syntax highlighting (Highlightr) |
| 키보드 단축키 | Cmd+N 새 채팅, Cmd+Enter 전송 등 |
| 채팅 히스토리 | SwiftData로 로컬 저장 + 검색 |
| 시스템 프롬프트 커스텀 | 사용자별 persona 설정 |
| 다중 모델 전환 | 31b/26b 원클릭 전환 |
| Export | 채팅을 Markdown/PDF로 내보내기 |

### 아키텍처
```
SparkApp/
├── SparkApp.swift           # @main, WindowGroup + MenuBarExtra
├── Models/
│   ├── ChatMessage.swift    # SwiftData @Model
│   ├── Conversation.swift   # 대화 세션
│   └── SparkConfig.swift    # API 설정 (endpoint, key, models)
├── Services/
│   ├── SparkAPIClient.swift # URLSession + SSE streaming
│   └── ModelManager.swift   # 모델 목록 관리
├── ViewModels/
│   └── ChatViewModel.swift  # @Observable, 채팅 로직
├── Views/
│   ├── ChatView.swift       # 메인 채팅 화면
│   ├── MessageBubble.swift  # 메시지 버블
│   ├── SidebarView.swift    # 대화 목록
│   ├── MenuBarView.swift    # 메뉴바 팝오버
│   └── SettingsView.swift   # 설정 화면
└── Resources/
    └── Assets.xcassets
```

### 배포
- Xcode 프로젝트 or Swift Package (SPM)
- macOS 14+ (Sonoma) 타겟
- 코드 사이닝: Developer ID (직접 배포) 또는 Mac App Store
- Sparkle framework로 자동 업데이트 (직접 배포 시)

## Phase 3: iOS / iPadOS App

### 목표
모바일에서도 Spark 접근 가능하게

### 추가 고려사항
| 항목 | macOS와 차이점 |
|------|---------------|
| UI 레이아웃 | NavigationSplitView (iPad), NavigationStack (iPhone) |
| 입력 | 소프트 키보드 대응, 음성 입력 통합 |
| 네트워크 | 백그라운드 fetch 제한, 네트워크 상태 감지 |
| 저장 | iCloud sync (CloudKit) 로 기기간 히스토리 공유 |
| 알림 | 긴 응답 완료 시 로컬 푸시 알림 |
| 위젯 | iOS 위젯으로 빠른 질의 |
| Shortcuts | Siri Shortcuts 통합 |
| Share Extension | 다른 앱에서 텍스트 → Spark로 전달 |

### 공유 코드 전략
```
SparkKit/                    # Swift Package (공유 로직)
├── Sources/SparkKit/
│   ├── API/
│   │   ├── SparkAPIClient.swift
│   │   └── Models.swift
│   ├── Storage/
│   │   └── ChatStorage.swift
│   └── Config/
│       └── SparkConfig.swift
├── Package.swift
└── Tests/

SparkMac/                    # macOS 앱 (SparkKit 의존)
SparkMobile/                 # iOS 앱 (SparkKit 의존)
```

### 배포
- iOS 17+ 타겟
- TestFlight → App Store
- 또는 Enterprise 배포 (사내용)

## Phase 4: 통합 확장

| 확장 | 설명 |
|------|------|
| watchOS | Apple Watch 컴패니언 (음성 질의) |
| visionOS | Vision Pro 공간 채팅 UI |
| Safari Extension | 웹페이지 컨텍스트 → Spark 질의 |
| Xcode Source Extension | 코드 선택 → Spark에 질문 |

## API 정보 (공통)

```
Endpoint : https://spark3-share.tech-2030.net/api/v1
Auth     : Bearer f0a26c072bd83b635a4daad40a51be068bb80d5a7540adfe
Models   : gemma4:31b (main/deep), gemma4:26b (fast/default)
Protocol : OpenAI-compatible (chat/completions, models, embeddings)
```

## 우선순위 요약

```
v1  [DONE]  Go 단일 바이너리 (CLI + Web UI)
v2  [NEXT]  macOS SwiftUI 네이티브 앱
v3          iOS/iPadOS 앱 + iCloud sync
v4          watchOS / visionOS / Extensions
```
