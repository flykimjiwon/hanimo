import { EditorView, gutter, GutterMarker } from '@codemirror/view'
import { StateField, StateEffect } from '@codemirror/state'

/**
 * Hash-anchor gutter — visual indicator showing which lines are currently
 * locked by an in-progress hashline_edit. Each marker shows a 🔒 icon plus
 * a 4-char anchor like "a3f9", communicating the brand promise:
 * "Agent can't silently overwrite your edits."
 *
 * Data flow:
 *   1. Backend hashline_edit emits a "hash:anchor" Wails event with
 *      { line: number, hash: string }.
 *   2. App.tsx subscribes to the event and dispatches setHashAnchorsEffect
 *      on the editor view.
 *   3. This gutter renders the marker for any active anchor.
 *
 * Anchors auto-clear after a short timeout (handled by the dispatcher) so
 * the gutter shows what's *currently* in progress, not history.
 */

export interface HashAnchor {
  line: number   // 1-based line number
  hash: string   // short anchor (e.g. "a3f9")
}

export const setHashAnchorsEffect = StateEffect.define<HashAnchor[]>()

class HashAnchorMarker extends GutterMarker {
  constructor(readonly hash: string) { super() }
  override eq(other: GutterMarker): boolean {
    return other instanceof HashAnchorMarker && other.hash === this.hash
  }
  override toDOM(): HTMLElement {
    const wrap = document.createElement('span')
    wrap.title = `Hash-anchored edit · anchor ${this.hash}`
    wrap.style.cssText = [
      'display:inline-flex',
      'align-items:center',
      'gap:2px',
      'font-family:var(--font-code, monospace)',
      'font-size:9px',
      'color:var(--accent, #f5a623)',
      'padding:0 2px',
    ].join(';')
    wrap.innerHTML = `<span style="font-size:10px;line-height:1">🔒</span><span>${this.hash}</span>`
    return wrap
  }
}

interface AnchorState {
  byLine: Map<number, string>
}

const hashAnchorField = StateField.define<AnchorState>({
  create: () => ({ byLine: new Map() }),
  update(state, tr) {
    let next = state
    for (const e of tr.effects) {
      if (e.is(setHashAnchorsEffect)) {
        const m = new Map<number, string>()
        for (const a of e.value) m.set(a.line, a.hash)
        next = { byLine: m }
      }
    }
    return next
  },
})

/**
 * Public extension factory. Drop into the CodeMirror extensions array.
 */
export function hashAnchorGutter() {
  return [
    hashAnchorField,
    gutter({
      class: 'cm-hash-anchor-gutter',
      lineMarker(view: EditorView, blockInfo) {
        const state = view.state.field(hashAnchorField, false)
        if (!state || state.byLine.size === 0) return null
        const lineNumber = view.state.doc.lineAt(blockInfo.from).number
        const hash = state.byLine.get(lineNumber)
        return hash ? new HashAnchorMarker(hash) : null
      },
      lineMarkerChange: (update) => update.transactions.some(tr => tr.effects.some(e => e.is(setHashAnchorsEffect))),
      initialSpacer: () => new HashAnchorMarker('····'),
    }),
    EditorView.baseTheme({
      '.cm-hash-anchor-gutter': {
        background: 'var(--bg-activity)',
        borderRight: '1px solid var(--border)',
        minWidth: '38px',
      },
    }),
  ]
}

/**
 * Convenience helper for App.tsx event subscriber.
 */
export function setHashAnchors(view: EditorView, anchors: HashAnchor[]) {
  view.dispatch({ effects: setHashAnchorsEffect.of(anchors) })
}
