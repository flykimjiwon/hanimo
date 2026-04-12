package skills

import (
	"strings"
	"testing"
)

func TestScanAndInvoke(t *testing.T) {
	reg := ScanSkills()
	if reg.Count() == 0 {
		t.Skip("no skills found")
	}
	t.Logf("loaded %d skills", reg.Count())

	toc := reg.TableOfContents()
	if !strings.Contains(toc, "/skill") {
		t.Error("TOC should contain /skill")
	}
	t.Logf("TOC:\n%s", toc)

	s := reg.Get("review-pr")
	if s == nil {
		t.Fatal("expected review-pr skill")
	}
	if s.Description == "" {
		t.Error("description empty")
	}
	if len(s.AllowedTools) == 0 {
		t.Error("allowed-tools empty")
	}
	t.Logf("skill: %s — %s (tools: %v)", s.Name, s.Description, s.AllowedTools)

	body := FormatSkillBody(s, "app.go")
	if !strings.Contains(body, "app.go") {
		t.Error("$ARGUMENTS not substituted")
	}
	t.Logf("body preview: %s", body[:min(len(body), 200)])
}

func min(a, b int) int {
	if a < b { return a }
	return b
}
