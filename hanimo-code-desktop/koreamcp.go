package main

// Phase 19 — Korea MCP catalog.
//
// hanimo's Korean-market wedge: ship a curated catalogue of 30+ MCP servers
// that target Korea-specific services (law / public data / finance /
// real-estate / maps / tourism / weather / Korean-NLP / collaboration).
//
// Source: https://github.com/darjeeling/awesome-mcp-korea (CC0)
//
// V1 scope: surface metadata + GitHub link in SettingsPanel. Actual install
// is still manual (user copies to ~/.hanimo/config.yaml mcp.servers per
// each repo's README). One-click install is a future phase — install
// commands and env vars vary too much across the catalogue to encode here
// without per-repo verification.

// KoreaMCPEntry is one curated MCP server entry.
type KoreaMCPEntry struct {
	Name        string `json:"name"`        // canonical short name
	Category    string `json:"category"`    // e.g. "법률" | "지도" | "금융"
	Description string `json:"description"` // 1-line Korean summary
	URL         string `json:"url"`         // upstream GitHub
	Stack       string `json:"stack"`       // hint: "npx" | "uvx" | "go" | "python"
}

// koreaMCPCatalog is curated from awesome-mcp-korea (2026-04-25 snapshot).
// Entries are kept short — full setup instructions live at the URL.
var koreaMCPCatalog = []KoreaMCPEntry{
	// 📜 Legal & Government
	{Name: "korean-law-mcp", Category: "법률·정부", Description: "국가법령정보 OpenAPI — 법령·판례·행정규칙 검색", URL: "https://github.com/chrisryugj/korean-law-mcp", Stack: "npx"},
	{Name: "assembly-api-mcp", Category: "법률·정부", Description: "국회 OpenAPI — 의원·의안·일정·청원·NABO", URL: "https://github.com/hollobit/assembly-api-mcp", Stack: "uvx"},
	{Name: "law-mcp", Category: "법률·정부", Description: "open.law.go.kr 한국 법령 데이터", URL: "https://github.com/finalchild/law-mcp", Stack: "npx"},
	{Name: "LexLink-ko-mcp", Category: "법률·정부", Description: "법령·판례 시맨틱 검색 (aiSearch)", URL: "https://github.com/rabqatab/LexLink-ko-mcp", Stack: "uvx"},

	// 🛒 Commerce
	{Name: "daiso-mcp", Category: "커머스", Description: "다이소 매장·재고·가격 조회", URL: "https://github.com/Mythicquark/daiso-mcp", Stack: "npx"},
	{Name: "kr-pc-deals-mcp", Category: "커머스", Description: "다나와·컴퓨존 PC 부품 최저가/호환성", URL: "https://github.com/edward-kim-dev/kr-pc-deals-mcp", Stack: "npx"},

	// 🏦 Finance & Tax
	{Name: "KIS_MCP_Server", Category: "금융", Description: "한국투자증권 REST — 국내·해외 주식 시세·주문", URL: "https://github.com/koreainvestment/KIS_MCP_Server", Stack: "python"},
	{Name: "korea-stock-analyzer-mcp", Category: "금융", Description: "한국 주식 재무·기술지표·DCF·뉴스 통합 분석", URL: "https://github.com/korea-stock-analyzer-mcp", Stack: "uvx"},
	{Name: "korea-stock-mcp", Category: "금융", Description: "DART + KRX 공시·재무제표·주가", URL: "https://github.com/korea-stock-mcp", Stack: "uvx"},
	{Name: "pykrx-mcp", Category: "금융", Description: "KOSPI·KOSDAQ·KONEX 시세·재무·수급·공매도", URL: "https://github.com/pykrx-mcp", Stack: "uvx"},

	// 🏠 Real Estate
	{Name: "real-estate-mcp", Category: "부동산", Description: "국토부·온비드·청약홈 매매·전월세·청약", URL: "https://github.com/real-estate-mcp", Stack: "npx"},
	{Name: "mcp-kr-realestate", Category: "부동산", Description: "국토부 실거래가 + ECOS 통합 분석", URL: "https://github.com/mcp-kr-realestate", Stack: "uvx"},
	{Name: "A2A-MCP-RealEstate", Category: "부동산", Description: "투자가치·삶의질 종합 평가", URL: "https://github.com/A2A-MCP-RealEstate", Stack: "uvx"},

	// 🗺 Maps & Address
	{Name: "navermap-mcp-server", Category: "지도·주소", Description: "네이버 클라우드 Maps — 지오코딩·경로·정적지도", URL: "https://github.com/navermap-mcp-server", Stack: "npx"},
	{Name: "kakao-navigation-mcp-server", Category: "지도·주소", Description: "카카오모빌리티 — 위치검색·도보·자동차 길찾기", URL: "https://github.com/kakao-navigation-mcp-server", Stack: "npx"},
	{Name: "kakao-api-mcp-server", Category: "지도·주소", Description: "카카오맵 + Daum 검색 — 장소·좌표·웹·블로그", URL: "https://github.com/jeong-sik/kakao-api-mcp-server", Stack: "npx"},
	{Name: "mcp-naver-map", Category: "지도·주소", Description: "NCP Geolocation + Directions15", URL: "https://github.com/mcp-naver-map", Stack: "npx"},

	// 🔎 Search & Trends
	{Name: "naver-search-mcp", Category: "검색·트렌드", Description: "네이버 검색 + 데이터랩 트렌드", URL: "https://github.com/naver-search-mcp", Stack: "npx"},
	{Name: "py-mcp-naver-search", Category: "검색·트렌드", Description: "네이버 검색 결과를 LLM-friendly 구조화", URL: "https://github.com/py-mcp-naver-search", Stack: "uvx"},

	// 🌏 Tourism
	{Name: "mcp-korea-tourism-api", Category: "관광·여행", Description: "한국관광공사 TourAPI — 관광지·행사·숙박·맛집", URL: "https://github.com/mcp-korea-tourism-api", Stack: "npx"},
	{Name: "mcp-visit-korea", Category: "관광·여행", Description: "지역·키워드·위치 기반 관광 정보", URL: "https://github.com/mcp-visit-korea", Stack: "uvx"},

	// 📊 Public Data
	{Name: "korea-stats-mcp", Category: "공공데이터", Description: "KOSIS OpenAPI — 한국 통계 자연어 검색", URL: "https://github.com/korea-stats-mcp", Stack: "uvx"},
	{Name: "data-go-mcp-servers", Category: "공공데이터", Description: "data.go.kr — 사업자등록·조달·금융 다수 패키지", URL: "https://github.com/data-go-mcp-servers", Stack: "npx"},
	{Name: "data4library-mcp", Category: "공공데이터", Description: "도서관정보나루 — 검색·대출·독서 통계", URL: "https://github.com/data4library-mcp", Stack: "uvx"},
	{Name: "k-mfds-fooddb-mcp-server", Category: "공공데이터", Description: "식약처 식품영양성분 DB", URL: "https://github.com/k-mfds-fooddb-mcp-server", Stack: "npx"},
	{Name: "k-targo-subway-mcp-server", Category: "공공데이터", Description: "TAGO 지하철정보 — 역검색·시간표", URL: "https://github.com/k-targo-subway-mcp-server", Stack: "npx"},
	{Name: "be-node-seoul-data-mcp", Category: "공공데이터", Description: "서울시 공공데이터 (지하철·문화행사 등)", URL: "https://github.com/be-node-seoul-data-mcp", Stack: "npx"},
	{Name: "opendata-mcp", Category: "공공데이터", Description: "공공데이터포털 OpenAPI 검색 + 표준 호출", URL: "https://github.com/opendata-mcp", Stack: "uvx"},

	// 🌦 Weather
	{Name: "KMA-WEATHER-MCP", Category: "기상", Description: "기상청 단기예보 — 현재 + 예보", URL: "https://github.com/KMA-WEATHER-MCP", Stack: "npx"},
	{Name: "korea_weather", Category: "기상", Description: "기상청 단기예보 한국 날씨", URL: "https://github.com/korea_weather", Stack: "uvx"},

	// 🔤 Korean NLP
	{Name: "ko-stdict-mcp", Category: "한국어 NLP", Description: "표준국어대사전 SQLite — 표제어·뜻풀이·발음·용례", URL: "https://github.com/ko-stdict-mcp", Stack: "npx"},
	{Name: "kordoc", Category: "한국어 NLP", Description: "HWP/HWPX/PDF 파싱 — 텍스트·표·양식", URL: "https://github.com/kordoc", Stack: "uvx"},
	{Name: "mcp-korean-spell", Category: "한국어 NLP", Description: "한국어 맞춤법·문법 교정", URL: "https://github.com/mcp-korean-spell", Stack: "npx"},

	// 🤝 Collaboration
	{Name: "dooray-mcp", Category: "협업", Description: "Dooray 업무·댓글·마일스톤·태그·메신저 (32 도구)", URL: "https://github.com/kwanok/dooray-mcp", Stack: "npx"},
	{Name: "naver-works-mcp", Category: "협업", Description: "네이버 웍스 (Naver Works) API", URL: "https://github.com/hyeri0903/naver-works-mcp", Stack: "npx"},
}

// koreaMCPCategoryOrder defines the display order in the UI — keeps grouping
// stable across refreshes regardless of map iteration order.
var koreaMCPCategoryOrder = []string{
	"법률·정부",
	"공공데이터",
	"금융",
	"부동산",
	"지도·주소",
	"검색·트렌드",
	"관광·여행",
	"기상",
	"한국어 NLP",
	"커머스",
	"협업",
}

// GetKoreaMCPCatalog is the Wails binding the SettingsPanel calls. Returns
// entries pre-sorted by category order then name.
func (a *App) GetKoreaMCPCatalog() []KoreaMCPEntry {
	// Cheap O(n*m) sort — 35 entries, 11 categories — keeps the data file
	// readable instead of carrying a sort-key field per row.
	out := make([]KoreaMCPEntry, 0, len(koreaMCPCatalog))
	for _, cat := range koreaMCPCategoryOrder {
		for _, e := range koreaMCPCatalog {
			if e.Category == cat {
				out = append(out, e)
			}
		}
	}
	return out
}

// GetKoreaMCPCategories returns the canonical category order for UI grouping.
func (a *App) GetKoreaMCPCategories() []string {
	return koreaMCPCategoryOrder
}
