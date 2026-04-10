package ui

// Lang represents the UI language.
type Lang int

const (
	LangKorean Lang = iota
	LangEnglish
)

// CurrentLang holds the active language.
var CurrentLang = LangKorean

// Strings contains all translatable UI strings.
type Strings struct {
	SendMessage    string
	NewLine        string
	SwitchMode     string
	Menu           string
	Cancel         string
	Exit           string
	ClearScreen    string
	ToolOn         string
	ToolOff        string
	ModeSuper      string
	ModeDev        string // Deep Agent (name kept for backwards compat)
	ModePlan       string
	Language       string
	ModelSwitch    string
	ProviderSwitch string
	ModelList      string
	Help           string
	Config         string
	Save           string
	Load           string
	Search         string
	Usage          string
	Diagnostics    string
	AutoMode       string
	Remember       string
	Memories       string
	Theme          string
	Clear          string
}

// KO contains Korean UI strings.
var KO = Strings{
	SendMessage:    "Enter 전송",
	NewLine:        "Shift+Enter 줄바꿈",
	SwitchMode:     "Tab 모드전환",
	Menu:           "Esc 메뉴",
	Cancel:         "Esc 취소",
	Exit:           "Ctrl+C 종료",
	ClearScreen:    "Ctrl+L 초기화",
	ToolOn:         "도구:ON",
	ToolOff:        "도구:OFF",
	ModeSuper:      "Super",
	ModeDev:        "Deep Agent",
	ModePlan:       "Plan",
	Language:       "언어",
	ModelSwitch:    "모델 변경",
	ProviderSwitch: "프로바이더 변경",
	ModelList:      "사용 가능한 모델",
	Help:           "도움말",
	Config:         "설정 보기",
	Save:           "세션 저장",
	Load:           "세션 불러오기",
	Search:         "세션 검색",
	Usage:          "사용량",
	Diagnostics:    "코드 진단",
	AutoMode:       "자율 모드",
	Remember:       "메모리 저장",
	Memories:       "메모리 조회",
	Theme:          "테마 변경",
	Clear:          "대화 초기화",
}

// EN contains English UI strings.
var EN = Strings{
	SendMessage:    "Enter send",
	NewLine:        "Shift+Enter newline",
	SwitchMode:     "Tab switch mode",
	Menu:           "Esc menu",
	Cancel:         "Esc cancel",
	Exit:           "Ctrl+C exit",
	ClearScreen:    "Ctrl+L clear",
	ToolOn:         "Tool:ON",
	ToolOff:        "Tool:OFF",
	ModeSuper:      "Super",
	ModeDev:        "Deep Agent",
	ModePlan:       "Plan",
	Language:       "Language",
	ModelSwitch:    "Switch Model",
	ProviderSwitch: "Switch Provider",
	ModelList:      "Available Models",
	Help:           "Help",
	Config:         "Config",
	Save:           "Save Session",
	Load:           "Load Session",
	Search:         "Search Sessions",
	Usage:          "Usage",
	Diagnostics:    "Diagnostics",
	AutoMode:       "Auto Mode",
	Remember:       "Remember",
	Memories:       "Memories",
	Theme:          "Theme",
	Clear:          "Clear",
}

// T returns the current language's string set.
func T() Strings {
	if CurrentLang == LangEnglish {
		return EN
	}
	return KO
}

// ToggleLang switches between Korean and English.
func ToggleLang() {
	if CurrentLang == LangKorean {
		CurrentLang = LangEnglish
	} else {
		CurrentLang = LangKorean
	}
}

// LangLabel returns the display name of the current language.
func LangLabel() string {
	if CurrentLang == LangKorean {
		return "한국어"
	}
	return "English"
}
