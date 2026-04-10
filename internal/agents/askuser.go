package agents

import (
	"regexp"
	"strings"
)

// Marker strings that bracket an interactive ASK_USER request in an LLM
// response.
const (
	AskUserStartMarker = "[ASK_USER]"
	AskUserEndMarker   = "[/ASK_USER]"
)

// AskQuestionType differentiates the three interactive question styles.
type AskQuestionType int

const (
	AskTypeText AskQuestionType = iota
	AskTypeChoice
	AskTypeConfirm
)

// AskQuestion describes a single ASK_USER request parsed from model output.
type AskQuestion struct {
	Type     AskQuestionType
	Question string
	Options  []string // populated for choice + confirm
}

var askUserRegex = regexp.MustCompile(`(?s)\[ASK_USER\](.*?)\[/ASK_USER\]`)

// ParseAskUser extracts the first ASK_USER block from a response and returns
// the structured question. Returns nil if no marker is present.
func ParseAskUser(response string) *AskQuestion {
	matches := askUserRegex.FindStringSubmatch(response)
	if len(matches) < 2 {
		return nil
	}

	body := strings.TrimSpace(matches[1])
	lines := strings.Split(body, "\n")

	q := &AskQuestion{Type: AskTypeText}
	inOptions := false
	for _, raw := range lines {
		line := strings.TrimSpace(raw)
		if line == "" {
			continue
		}
		switch {
		case strings.HasPrefix(strings.ToLower(line), "question:"):
			q.Question = strings.TrimSpace(line[len("question:"):])
			inOptions = false
		case strings.HasPrefix(strings.ToLower(line), "type:"):
			t := strings.ToLower(strings.TrimSpace(line[len("type:"):]))
			switch t {
			case "choice":
				q.Type = AskTypeChoice
			case "confirm":
				q.Type = AskTypeConfirm
			default:
				q.Type = AskTypeText
			}
			inOptions = false
		case strings.HasPrefix(strings.ToLower(line), "options:"):
			inOptions = true
		case strings.HasPrefix(line, "- "):
			opt := strings.TrimSpace(line[2:])
			if opt != "" {
				q.Options = append(q.Options, opt)
			}
		default:
			if inOptions {
				q.Options = append(q.Options, line)
			} else if q.Question == "" {
				// Treat first non-keyed line as the question.
				q.Question = line
			}
		}
	}

	if q.Type == AskTypeConfirm && len(q.Options) == 0 {
		q.Options = []string{"Yes", "No"}
	}
	if q.Type == AskTypeChoice && len(q.Options) == 0 {
		// Degenerate case — fall back to text entry.
		q.Type = AskTypeText
	}
	return q
}

// StripAskUser removes ASK_USER blocks from the response so the remaining
// narrative can be shown to the user.
func StripAskUser(response string) string {
	return strings.TrimSpace(askUserRegex.ReplaceAllString(response, ""))
}

// FormatAnswer wraps the user's response for feeding back into the LLM.
func FormatAnswer(q *AskQuestion, answer string) string {
	if q == nil {
		return answer
	}
	switch q.Type {
	case AskTypeChoice:
		return "User selected: " + answer
	case AskTypeConfirm:
		return "User answered: " + answer
	default:
		return "User answered: " + answer
	}
}

// AskUserPromptSuffix is appended to system prompts to teach the LLM how and
// when to use ASK_USER.
const AskUserPromptSuffix = `

## Interactive Questions (ASK_USER)

You can pause execution to ask the user a clarifying question by emitting a
single ASK_USER block. Use this sparingly — only when requirements are
genuinely ambiguous, multiple valid approaches exist, or you are about to
make a significant, hard-to-reverse decision.

Format:

[ASK_USER]
question: What database should we use?
type: choice
options:
- PostgreSQL
- MySQL
- SQLite
[/ASK_USER]

Supported types:
- choice   — present options list, user picks one
- text     — free-form text answer
- confirm  — yes/no confirmation

Rules:
- Emit at most ONE ASK_USER block per response.
- Do NOT ask trivial questions you can answer yourself.
- After the user replies, continue the task using their answer.`
