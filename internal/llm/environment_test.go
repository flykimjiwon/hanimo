package llm

import (
	"fmt"
	"testing"
)

func TestProbeEnvironment(t *testing.T) {
	results := ProbeEnvironment()
	fmt.Println(FormatEnvironmentContext(results))
	avail := 0
	for _, r := range results {
		if r.Available {
			avail++
		}
	}
	t.Logf("detected %d/%d tools", avail, len(results))
}
