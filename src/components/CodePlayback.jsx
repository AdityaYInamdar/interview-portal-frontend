import { useState, useEffect, useRef, useCallback } from 'react'
import Editor from '@monaco-editor/react'
import api from '../services/api'

// ── CodePlayback — inline YouTube-style code timeline ────────────────────────
// Embeds directly inside a coding question card.
// Drag the scrub bar to any timestamp and watch the candidate code char-by-char.

const SPEEDS = [0.25, 0.5, 1, 2, 5]

// Convert 0-indexed line+col to a character offset inside `code`
function lineColToOffset(lines, line0, col0) {
  let offset = 0
  const safeLen = Math.min(line0, lines.length)
  for (let i = 0; i < safeLen; i++) offset += (lines[i] ?? '').length + 1 // +1 for \n
  return offset + Math.max(0, col0)
}

// Apply one stored Monaco change to the current code string.
// Events are stored with content = JSON string {sl,sc,el,ec,v}.
// Init event (event_type==='init' or sl===-1) sets the code completely.
function applyEvent(currentCode, event) {
  if (!event.content) return currentCode
  let data
  try { data = JSON.parse(event.content) } catch { return currentCode }
  const { sl, sc, el, ec, v } = data
  // Init sentinel: replace everything
  if (sl === -1 || event.event_type === 'init') return v ?? currentCode
  const lines = currentCode.split('\n')
  const from  = lineColToOffset(lines, sl, sc)
  const to    = lineColToOffset(lines, el, ec)
  return currentCode.slice(0, from) + (v ?? '') + currentCode.slice(to)
}

function fmt(totalSecs) {
  const s = Math.max(0, Math.round(totalSecs))
  return `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`
}

export default function CodePlayback({ sessionId, questionId, language, onClose }) {
  const [events, setEvents]         = useState([])
  const [loading, setLoading]       = useState(true)
  const [error, setError]           = useState(null)
  const [currentIdx, setCurrentIdx] = useState(0)
  const [playing, setPlaying]       = useState(false)
  const [speed, setSpeed]           = useState(1)
  const [code, setCode]             = useState('')
  const [hovering, setHovering]     = useState(false)
  const [hoverPct, setHoverPct]     = useState(null)

  const intervalRef = useRef(null)
  const barRef      = useRef(null)
  const dragging    = useRef(false)
  // Refs that mirror code/currentIdx state — used inside the playback interval
  // to avoid calling setCode as a side-effect inside setCurrentIdx updater
  // (which would double-apply events in React StrictMode).
  const codeRef       = useRef('')
  const currentIdxRef = useRef(0)

  // Load activity log
  const load = useCallback(async () => {
    try {
      setLoading(true); setError(null)
      const res = await api.get(`/sessions/admin/session/${sessionId}/activity/${questionId}`)
      const evts = res.data || []
      setEvents(evts)
      setCurrentIdx(0)
      currentIdxRef.current = 0
      // Derive initial code from the first event (init sentinel)
      let initCode = ''
      if (evts.length > 0) {
        const first = evts[0]
        if (first.content) {
          try {
            const d = JSON.parse(first.content)
            initCode = d.v ?? ''
          } catch { initCode = first.content }
        }
      }
      codeRef.current = initCode
      setCode(initCode)
    } catch (err) {
      setError(err?.response?.data?.detail || 'Failed to load activity log')
    } finally { setLoading(false) }
  }, [sessionId, questionId])

  useEffect(() => { load() }, [load])

  // Seek to exact index — replay all events from 0 (no snapshots needed)
  const goToIndex = useCallback((targetIdx) => {
    if (events.length === 0) return
    const idx = Math.max(0, Math.min(targetIdx, events.length - 1))
    let reconstructed = ''
    for (let i = 0; i <= idx; i++) reconstructed = applyEvent(reconstructed, events[i])
    codeRef.current = reconstructed
    currentIdxRef.current = idx
    setCode(reconstructed)
    setCurrentIdx(idx)
  }, [events])

  // Playback loop — uses refs to avoid side effects inside state updaters
  useEffect(() => {
    if (!playing) { clearInterval(intervalRef.current); return }
    const msPerEvent = Math.max(30, 180 / speed)
    intervalRef.current = setInterval(() => {
      const next = currentIdxRef.current + 1
      if (next >= events.length) {
        setPlaying(false)
        return
      }
      const newCode = applyEvent(codeRef.current, events[next])
      codeRef.current = newCode
      currentIdxRef.current = next
      setCode(newCode)
      setCurrentIdx(next)
    }, msPerEvent)
    return () => clearInterval(intervalRef.current)
  }, [playing, speed, events])

  const togglePlay = () => {
    if (currentIdx >= events.length - 1) { goToIndex(0); setTimeout(() => setPlaying(true), 40) }
    else setPlaying(p => !p)
  }

  // Timeline drag
  const pctFromClientX = useCallback((clientX) => {
    if (!barRef.current) return 0
    const rect = barRef.current.getBoundingClientRect()
    return Math.max(0, Math.min(1, (clientX - rect.left) / rect.width))
  }, [])

  const seekToPct = useCallback((pct) => {
    goToIndex(Math.round(pct * (events.length - 1)))
    setPlaying(false)
  }, [events.length, goToIndex])

  const onBarMouseDown = (e) => { e.preventDefault(); dragging.current = true; seekToPct(pctFromClientX(e.clientX)) }
  const onBarMouseMove = (e) => { const p = pctFromClientX(e.clientX); setHoverPct(p); if (dragging.current) seekToPct(p) }
  const onBarMouseUp   = (e) => { if (dragging.current) { seekToPct(pctFromClientX(e.clientX)); dragging.current = false } }
  const onBarMouseLeave = () => { setHovering(false); setHoverPct(null); dragging.current = false }

  // Derived values
  const currentEvent  = events[currentIdx]
  const tsStart       = events[0]?.ts
  const tsEnd         = events[events.length - 1]?.ts
  const elapsed       = currentEvent && tsStart ? (currentEvent.ts - tsStart) / 1000 : 0
  const totalSec      = tsStart && tsEnd ? (tsEnd - tsStart) / 1000 : 0
  const progressPct   = events.length > 1 ? (currentIdx / (events.length - 1)) * 100 : 0
  const pasteMarkers  = events.map((e, i) => ({ i, pct: (i / Math.max(1, events.length - 1)) * 100 })).filter((_, i) => events[i]?.is_paste)
  const hoverTimeSec  = hoverPct != null && totalSec ? hoverPct * totalSec : null
  const lang          = language || currentEvent?.language || 'javascript'

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.65)' }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-4xl rounded-2xl border border-gray-800 bg-gray-950 overflow-hidden flex flex-col"
        style={{ maxHeight: '90vh' }}
        onClick={e => e.stopPropagation()}
      >

      {/* Header bar */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-800 bg-gray-900 shrink-0">
        <svg className="w-4 h-4 text-indigo-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <span className="text-sm font-semibold text-white">Code Playback</span>
        {currentEvent?.is_paste && (
          <span className="ml-2 text-xs bg-orange-500/20 text-orange-300 px-2 py-0.5 rounded-full font-medium">⚠ Paste detected</span>
        )}
        <div className="flex-1" />
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-white transition-colors"
          title="Close"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center gap-2 py-10 text-gray-500">
          <div className="w-4 h-4 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
          <span className="text-xs">Loading activity log…</span>
        </div>
      )}

      {/* Error */}
      {!loading && error && (
        <div className="flex flex-col items-center justify-center py-10 px-4 text-center">
          <p className="text-xs text-red-400 font-medium">{error}</p>
          <p className="text-xs text-gray-600 mt-1">Activity data may not be available for this submission.</p>
          <button onClick={load} className="mt-3 text-xs text-indigo-400 hover:text-indigo-300 underline">Retry</button>
        </div>
      )}

      {/* Empty */}
      {!loading && !error && events.length === 0 && (
        <div className="flex flex-col items-center justify-center py-10 px-4 text-center">
          <svg className="w-10 h-10 text-gray-700 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <p className="text-xs font-medium text-gray-400">No activity log for this question</p>
          <p className="text-xs text-gray-600 mt-1">Activity is captured only for tests taken after this feature was enabled. Ask the candidate to retake the test to see playback.</p>
        </div>
      )}

      {/* Playback UI */}
      {!loading && !error && events.length > 0 && (
        <>
          {/* YouTube-style timeline */}
          <div className="px-4 pt-3 pb-1 bg-gray-900">
            <div
              ref={barRef}
              className="relative cursor-pointer select-none"
              style={{ paddingTop: '8px', paddingBottom: '8px' }}
              onMouseEnter={() => setHovering(true)}
              onMouseLeave={onBarMouseLeave}
              onMouseMove={onBarMouseMove}
              onMouseDown={onBarMouseDown}
              onMouseUp={onBarMouseUp}
            >
              {/* Track */}
              <div
                className="relative w-full rounded-full bg-gray-700 transition-all duration-100"
                style={{ height: hovering ? '6px' : '3px' }}
              >
                {/* Buffered bg */}
                <div className="absolute inset-y-0 left-0 w-full rounded-full bg-gray-600" />
                {/* Played */}
                <div className="absolute inset-y-0 left-0 rounded-full bg-indigo-500 transition-none" style={{ width: `${progressPct}%` }} />
                {/* Hover preview */}
                {hoverPct != null && (
                  <div className="absolute inset-y-0 left-0 rounded-full bg-indigo-400/25 pointer-events-none" style={{ width: `${hoverPct * 100}%` }} />
                )}
                {/* Paste markers */}
                {pasteMarkers.map(m => (
                  <div
                    key={m.i}
                    className="absolute bottom-full mb-0.5 w-0.5 rounded-full bg-orange-400 pointer-events-none"
                    style={{ left: `${m.pct}%`, height: '6px', transform: 'translateX(-50%)' }}
                    title="Paste detected"
                  />
                ))}
                {/* Thumb */}
                <div
                  className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 rounded-full bg-white shadow pointer-events-none transition-all duration-100"
                  style={{ left: `${progressPct}%`, width: hovering ? '13px' : '0px', height: hovering ? '13px' : '0px' }}
                />
              </div>
              {/* Hover timestamp bubble */}
              {hovering && hoverTimeSec != null && (
                <div
                  className="absolute -top-7 -translate-x-1/2 bg-gray-800 text-white text-xs px-2 py-0.5 rounded pointer-events-none whitespace-nowrap"
                  style={{ left: `${hoverPct * 100}%` }}
                >
                  {fmt(hoverTimeSec)}
                </div>
              )}
            </div>

            {/* Controls row */}
            <div className="flex items-center gap-3 mt-0.5 pb-2">
              {/* Play/Pause */}
              <button
                onClick={togglePlay}
                className="w-7 h-7 flex items-center justify-center rounded-full bg-indigo-600 hover:bg-indigo-500 text-white transition-colors shrink-0"
              >
                {playing ? (
                  <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" /></svg>
                ) : (
                  <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
                )}
              </button>
              {/* Time */}
              <span className="text-xs font-mono text-gray-400 tabular-nums">{fmt(elapsed)} / {fmt(totalSec)}</span>
              {/* Event counter */}
              <span className="text-xs text-gray-600">{currentIdx + 1}/{events.length}</span>
              <div className="flex-1" />
              {/* Paste legend */}
              {pasteMarkers.length > 0 && (
                <div className="flex items-center gap-1 text-xs text-orange-400 shrink-0">
                  <span className="inline-block w-2 h-2 rounded-full bg-orange-400" />
                  {pasteMarkers.length} paste{pasteMarkers.length !== 1 ? 's' : ''}
                </div>
              )}
              {/* Speed */}
              <div className="flex items-center gap-0.5 shrink-0">
                {SPEEDS.map(s => (
                  <button
                    key={s}
                    onClick={() => setSpeed(s)}
                    className={`px-1.5 py-0.5 rounded text-xs font-medium transition-colors ${speed === s ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:text-white hover:bg-gray-700'}`}
                  >
                    {s}×
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Monaco editor */}
          <div style={{ height: '380px' }}>
            <Editor
              height="100%"
              language={lang}
              value={code}
              theme="vs-dark"
              options={{
                readOnly: true,
                minimap: { enabled: false },
                fontSize: 13,
                scrollBeyondLastLine: false,
                wordWrap: 'on',
                lineNumbers: 'on',
                domReadOnly: true,
                cursorBlinking: 'solid',
              }}
            />
          </div>
        </>
      )}
      </div>
    </div>
  )
}
