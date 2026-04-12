package knowledge

import (
	"strings"
	"testing"
)

func TestKnowledgeSearchE2E(t *testing.T) {
	GlobalIndex = ScanUserDocs()
	if GlobalIndex.Count() == 0 {
		t.Skip("no knowledge docs")
	}

	// 1. TOC 포함 확인
	toc := GlobalIndex.TableOfContents()
	if !strings.Contains(toc, "knowledge_search") {
		t.Error("TOC should mention knowledge_search tool")
	}

	// 2. 한국어 검색
	r := GlobalIndex.Search("엔드포인트 응답", 3)
	if len(r) == 0 {
		t.Error("한국어 검색 실패: '엔드포인트 응답'")
	} else {
		t.Logf("한국어 검색 OK: %s", r[0].Title)
	}

	// 3. 영어 검색
	r2 := GlobalIndex.Search("$state $derived", 3)
	if len(r2) == 0 {
		t.Error("영어 검색 실패: '$state $derived'")
	} else {
		t.Logf("영어 검색 OK: %s", r2[0].Title)
	}

	// 4. FormatSearchResults 렌더링
	out := FormatSearchResults(r2, "$state")
	if !strings.Contains(out, "발견") {
		t.Error("FormatSearchResults 결과에 '발견' 없음")
	}
	t.Logf("결과 렌더:\n%s", out[:min(len(out), 300)])

	// 5. ReadFull
	content, ok := GlobalIndex.ReadFull(r2[0].Path)
	if !ok || content == "" {
		t.Error("ReadFull 실패")
	}
	t.Logf("ReadFull 길이: %d bytes", len(content))

	// 6. 빈 결과
	r3 := GlobalIndex.Search("zzzznonexistent", 3)
	empty := FormatSearchResults(r3, "zzz")
	if !strings.Contains(empty, "검색 결과가 없습니다") {
		t.Error("빈 결과 메시지 없음")
	}
}

func min(a, b int) int {
	if a < b { return a }
	return b
}
