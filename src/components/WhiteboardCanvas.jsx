// ─── WhiteboardCanvas ────────────────────────────────────────────────────────
// Production-quality collaborative whiteboard canvas component.
// Supports: pen, eraser, line, rectangle, circle, arrow, text tools.
// Real-time collaboration via parent-controlled callbacks / imperative ref API.
// ─────────────────────────────────────────────────────────────────────────────
import { useState, useEffect, useRef, useCallback, forwardRef, useImperativeHandle } from 'react';

// ─── Constants ───────────────────────────────────────────────────────────────
const BG_COLOR = '#1e1e2e';
const uid = () =>
  Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);

const PALETTE = [
  '#ffffff', '#f87171', '#fb923c', '#fbbf24', '#a3e635',
  '#34d399', '#22d3ee', '#60a5fa', '#a78bfa', '#f472b6',
  '#1f2937', '#ef4444', '#f97316', '#10b981', '#3b82f6',
  '#8b5cf6',
];

const STROKE_SIZES = [
  { value: 2,  dot: 4  },
  { value: 4,  dot: 7  },
  { value: 8,  dot: 11 },
  { value: 16, dot: 16 },
];

const FONT_SIZES = [12, 14, 18, 24, 32, 48, 64];

// ─── SVG Tool Icons ───────────────────────────────────────────────────────────
const PenIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="w-4 h-4">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
      d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
  </svg>
);
const EraserIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="w-4 h-4">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
      d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
  </svg>
);
const LineIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="w-4 h-4">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 19L19 5" />
  </svg>
);
const RectIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="w-4 h-4">
    <rect x="3" y="5" width="18" height="14" rx="2" strokeWidth={2} />
  </svg>
);
const CircleIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="w-4 h-4">
    <circle cx="12" cy="12" r="9" strokeWidth={2} />
  </svg>
);
const ArrowIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="w-4 h-4">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
      d="M17 8l4 4m0 0l-4 4m4-4H3" />
  </svg>
);
const TextIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="w-4 h-4">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
      d="M4 6h16M4 12h10M4 18h6" />
  </svg>
);
const UndoIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="w-4 h-4">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
      d="M3 10h10a8 8 0 018 8v2M3 10l6 6M3 10l6-6" />
  </svg>
);
const RedoIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="w-4 h-4">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
      d="M21 10H11a8 8 0 00-8 8v2M21 10l-6 6M21 10l-6-6" />
  </svg>
);
const TrashIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="w-4 h-4">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
      d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
  </svg>
);
const ExportIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="w-4 h-4">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
      d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
  </svg>
);

const TOOLS = [
  { id: 'pen',    label: 'Pen (P)',       Icon: PenIcon    },
  { id: 'eraser', label: 'Eraser (E)',    Icon: EraserIcon },
  { id: 'line',   label: 'Line (L)',      Icon: LineIcon   },
  { id: 'rect',   label: 'Rectangle (R)', Icon: RectIcon   },
  { id: 'circle', label: 'Circle (C)',    Icon: CircleIcon },
  { id: 'arrow',  label: 'Arrow (A)',     Icon: ArrowIcon  },
  { id: 'text',   label: 'Text (T)',      Icon: TextIcon   },
];

const TOOL_KEYS = { p: 'pen', e: 'eraser', l: 'line', r: 'rect', c: 'circle', a: 'arrow', t: 'text' };

// ─── Rendering Utilities ──────────────────────────────────────────────────────
function drawSmoothPath(ctx, points) {
  if (!points || points.length === 0) return;
  ctx.beginPath();
  if (points.length === 1) {
    ctx.arc(points[0].x, points[0].y, ctx.lineWidth / 2, 0, Math.PI * 2);
    ctx.fill();
    return;
  }
  ctx.moveTo(points[0].x, points[0].y);
  if (points.length === 2) {
    ctx.lineTo(points[1].x, points[1].y);
    ctx.stroke();
    return;
  }
  for (let i = 1; i < points.length - 1; i++) {
    const mx = (points[i].x + points[i + 1].x) / 2;
    const my = (points[i].y + points[i + 1].y) / 2;
    ctx.quadraticCurveTo(points[i].x, points[i].y, mx, my);
  }
  ctx.lineTo(points[points.length - 1].x, points[points.length - 1].y);
  ctx.stroke();
}

function drawArrowHead(ctx, x1, y1, x2, y2, width) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len < 1) return;
  const angle = Math.atan2(dy, dx);
  const headLen = Math.max(14, width * 5);
  const headAngle = Math.PI / 6;
  ctx.beginPath();
  ctx.moveTo(x2, y2);
  ctx.lineTo(
    x2 - headLen * Math.cos(angle - headAngle),
    y2 - headLen * Math.sin(angle - headAngle)
  );
  ctx.lineTo(
    x2 - headLen * Math.cos(angle + headAngle),
    y2 - headLen * Math.sin(angle + headAngle)
  );
  ctx.closePath();
  ctx.fill();
}

/** Render a single stroke onto the provided Canvas 2D context. */
function renderStroke(ctx, stroke, bgColor = BG_COLOR) {
  if (!stroke) return;
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  const { tool, color, width } = stroke;

  switch (tool) {
    case 'pen': {
      ctx.globalCompositeOperation = 'source-over';
      ctx.strokeStyle = color;
      ctx.fillStyle  = color;
      ctx.lineWidth  = width;
      drawSmoothPath(ctx, stroke.points);
      break;
    }
    case 'eraser': {
      // Draw over with background color — simplest correct approach
      ctx.globalCompositeOperation = 'source-over';
      ctx.strokeStyle = bgColor;
      ctx.fillStyle  = bgColor;
      ctx.lineWidth  = width;
      drawSmoothPath(ctx, stroke.points);
      break;
    }
    case 'line': {
      ctx.globalCompositeOperation = 'source-over';
      ctx.strokeStyle = color;
      ctx.lineWidth   = width;
      ctx.beginPath();
      ctx.moveTo(stroke.x1, stroke.y1);
      ctx.lineTo(stroke.x2, stroke.y2);
      ctx.stroke();
      break;
    }
    case 'rect': {
      ctx.globalCompositeOperation = 'source-over';
      ctx.strokeStyle = color;
      ctx.lineWidth   = width;
      const rw = stroke.x2 - stroke.x1;
      const rh = stroke.y2 - stroke.y1;
      if (stroke.fill) {
        ctx.fillStyle = color + '30';
        ctx.fillRect(stroke.x1, stroke.y1, rw, rh);
      }
      ctx.strokeRect(stroke.x1, stroke.y1, rw, rh);
      break;
    }
    case 'circle': {
      ctx.globalCompositeOperation = 'source-over';
      ctx.strokeStyle = color;
      ctx.lineWidth   = width;
      const cx = (stroke.x1 + stroke.x2) / 2;
      const cy = (stroke.y1 + stroke.y2) / 2;
      const rx = Math.abs(stroke.x2 - stroke.x1) / 2;
      const ry = Math.abs(stroke.y2 - stroke.y1) / 2;
      ctx.beginPath();
      ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
      if (stroke.fill) {
        ctx.fillStyle = color + '30';
        ctx.fill();
      }
      ctx.stroke();
      break;
    }
    case 'arrow': {
      ctx.globalCompositeOperation = 'source-over';
      ctx.strokeStyle = color;
      ctx.fillStyle   = color;
      ctx.lineWidth   = width;
      ctx.beginPath();
      ctx.moveTo(stroke.x1, stroke.y1);
      ctx.lineTo(stroke.x2, stroke.y2);
      ctx.stroke();
      drawArrowHead(ctx, stroke.x1, stroke.y1, stroke.x2, stroke.y2, width);
      break;
    }
    case 'text': {
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = color;
      ctx.font = `${stroke.fontSize || 18}px Inter, ui-sans-serif, sans-serif`;
      ctx.fillText(stroke.text || '', stroke.x, stroke.y);
      break;
    }
    default:
      break;
  }
  ctx.restore();
}

// ─────────────────────────────────────────────────────────────────────────────
// WhiteboardCanvas Component
// ─────────────────────────────────────────────────────────────────────────────
const WhiteboardCanvas = forwardRef(function WhiteboardCanvas(
  { onStroke, onUndo, onClear, readOnly = false },
  ref
) {
  // ── Tool / color / size state ─────────────────────────────────────────────
  const [tool, setTool]               = useState('pen');
  const [color, setColor]             = useState('#ffffff');
  const [strokeWidth, setStrokeWidth] = useState(4);
  const [fill, setFill]               = useState(false);
  const [fontSize, setFontSize]       = useState(18);

  // ── Text input overlay ────────────────────────────────────────────────────
  const [textState, setTextState] = useState({ visible: false, x: 0, y: 0, value: '' });
  const textInputRef = useRef(null);

  // ── Canvas refs ───────────────────────────────────────────────────────────
  const containerRef    = useRef(null);
  const mainCanvasRef   = useRef(null);  // committed strokes
  const overlayCanvasRef = useRef(null); // live preview
  const dprRef          = useRef(window.devicePixelRatio || 1);

  // ── Stroke history ────────────────────────────────────────────────────────
  const strokesRef    = useRef([]);   // committed history
  const redoStackRef  = useRef([]);   // redo buffer (cleared on new stroke)

  // ── Drawing state ─────────────────────────────────────────────────────────
  const isDrawingRef     = useRef(false);
  const activeStrokeRef  = useRef(null);
  const rafRef           = useRef(null);

  // ── Current tool/color/size accessible in callbacks ──────────────────────
  const toolRef         = useRef(tool);
  const colorRef        = useRef(color);
  const widthRef        = useRef(strokeWidth);
  const fillRef         = useRef(fill);
  const fontSizeRef     = useRef(fontSize);
  useEffect(() => { toolRef.current = tool; },        [tool]);
  useEffect(() => { colorRef.current = color; },       [color]);
  useEffect(() => { widthRef.current = strokeWidth; }, [strokeWidth]);
  useEffect(() => { fillRef.current = fill; },         [fill]);
  useEffect(() => { fontSizeRef.current = fontSize; }, [fontSize]);

  // ── Setup a single canvas with DPR awareness ──────────────────────────────
  const setupCanvas = useCallback((canvas) => {
    if (!canvas || !containerRef.current) return;
    const dpr = window.devicePixelRatio || 1;
    dprRef.current = dpr;
    const w = containerRef.current.offsetWidth;
    const h = containerRef.current.offsetHeight;
    canvas.width  = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    canvas.style.width  = w + 'px';
    canvas.style.height = h + 'px';
    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }, []);

  // ── Clear overlay canvas ─────────────────────────────────────────────────
  const clearOverlay = useCallback(() => {
    const canvas = overlayCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const w = canvas.width / dprRef.current;
    const h = canvas.height / dprRef.current;
    ctx.clearRect(0, 0, w, h);
  }, []);

  // ── Redraw all committed strokes onto the main canvas ─────────────────────
  const redrawAll = useCallback((extraStroke = null) => {
    const canvas = mainCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const w   = canvas.width  / dprRef.current;
    const h   = canvas.height / dprRef.current;
    // Background fill
    ctx.fillStyle = BG_COLOR;
    ctx.fillRect(0, 0, w, h);
    // Render committed strokes
    strokesRef.current.forEach(s => renderStroke(ctx, s, BG_COLOR));
    // Render optional in-progress preview
    if (extraStroke) renderStroke(ctx, extraStroke, BG_COLOR);
  }, []);

  // ── Initialize / resize canvases ──────────────────────────────────────────
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const init = () => {
      setupCanvas(mainCanvasRef.current);
      setupCanvas(overlayCanvasRef.current);
      redrawAll();
    };
    init();

    const ro = new ResizeObserver(() => { init(); });
    ro.observe(container);
    return () => ro.disconnect();
  }, [setupCanvas, redrawAll]);

  // ── Auto-focus text input when it appears ─────────────────────────────────
  useEffect(() => {
    if (textState.visible && textInputRef.current) {
      textInputRef.current.focus();
    }
  }, [textState.visible]);

  // ── Keyboard shortcuts ────────────────────────────────────────────────────
  useEffect(() => {
    if (readOnly) return;
    const onKeyDown = (e) => {
      // Don't intercept when typing in inputs
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

      // Tool shortcuts
      if (!e.ctrlKey && !e.metaKey) {
        const mapped = TOOL_KEYS[e.key.toLowerCase()];
        if (mapped) { setTool(mapped); return; }
      }
      // Ctrl+Z — undo
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        undoStroke();
      }
      // Ctrl+Shift+Z / Ctrl+Y — redo
      if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
        e.preventDefault();
        redoStroke();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [readOnly]);

  // ── Helper: canvas-relative pointer coordinates ───────────────────────────
  const getCoords = useCallback((e) => {
    const canvas = overlayCanvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const src  = e.touches ? e.touches[0] : e;
    return { x: src.clientX - rect.left, y: src.clientY - rect.top };
  }, []);

  // ── Commit a finished stroke ──────────────────────────────────────────────
  const commitStroke = useCallback((stroke) => {
    if (!stroke) return;
    strokesRef.current = [...strokesRef.current, stroke];
    redoStackRef.current = []; // new action clears redo
    // Render onto main canvas
    const ctx = mainCanvasRef.current?.getContext('2d');
    if (ctx) renderStroke(ctx, stroke, BG_COLOR);
    clearOverlay();
    onStroke?.(stroke);
  }, [clearOverlay, onStroke]);

  // ── Undo / redo ───────────────────────────────────────────────────────────
  const undoStroke = useCallback(() => {
    if (strokesRef.current.length === 0) return;
    const last = strokesRef.current[strokesRef.current.length - 1];
    strokesRef.current = strokesRef.current.slice(0, -1);
    redoStackRef.current = [last, ...redoStackRef.current];
    redrawAll();
    onUndo?.(last.id);
  }, [redrawAll, onUndo]);

  const redoStroke = useCallback(() => {
    if (redoStackRef.current.length === 0) return;
    const [next, ...rest] = redoStackRef.current;
    redoStackRef.current = rest;
    strokesRef.current = [...strokesRef.current, next];
    const ctx = mainCanvasRef.current?.getContext('2d');
    if (ctx) renderStroke(ctx, next, BG_COLOR);
    onStroke?.(next); // send to peers (as a new stroke)
  }, [onStroke]);

  const clearAll = useCallback(() => {
    strokesRef.current  = [];
    redoStackRef.current = [];
    redrawAll();
    onClear?.();
  }, [redrawAll, onClear]);

  // ── Text commit ───────────────────────────────────────────────────────────
  const submitText = useCallback(() => {
    const { x, y, value } = textState;
    setTextState({ visible: false, x: 0, y: 0, value: '' });
    if (!value.trim()) return;
    const stroke = {
      id: uid(), tool: 'text',
      color: colorRef.current, x, y,
      text: value, fontSize: fontSizeRef.current,
    };
    commitStroke(stroke);
  }, [textState, commitStroke]);

  // ── Pointer event handlers ────────────────────────────────────────────────
  const handlePointerDown = useCallback((e) => {
    if (readOnly) return;
    if (e.button === 2) return;
    e.preventDefault();

    const { x, y } = getCoords(e);
    const t = toolRef.current;

    if (t === 'text') {
      setTextState({ visible: true, x, y, value: '' });
      return;
    }

    isDrawingRef.current  = true;
    const strokeId        = uid();

    if (t === 'pen' || t === 'eraser') {
      activeStrokeRef.current = {
        id: strokeId, tool: t,
        color: colorRef.current, width: widthRef.current,
        points: [{ x, y }],
      };
    } else {
      activeStrokeRef.current = {
        id: strokeId, tool: t,
        color: colorRef.current, width: widthRef.current,
        fill: fillRef.current,
        x1: x, y1: y, x2: x, y2: y,
      };
    }
  }, [readOnly, getCoords]);

  const handlePointerMove = useCallback((e) => {
    if (!isDrawingRef.current || !activeStrokeRef.current) return;
    e.preventDefault();

    const { x, y } = getCoords(e);
    const stroke   = activeStrokeRef.current;

    if (stroke.tool === 'pen' || stroke.tool === 'eraser') {
      stroke.points.push({ x, y });

      // Incremental draw on overlay (or main for eraser)
      if (stroke.tool === 'eraser') {
        // For eraser: redraw main with live preview to show erase effect
        if (rafRef.current) cancelAnimationFrame(rafRef.current);
        rafRef.current = requestAnimationFrame(() => {
          redrawAll(stroke);
        });
      } else {
        // For pen: draw only the latest segment on overlay (efficient)
        const pts = stroke.points;
        if (pts.length >= 2) {
          const canvas = overlayCanvasRef.current;
          if (!canvas) return;
          const ctx = canvas.getContext('2d');
          ctx.save();
          ctx.lineCap   = 'round';
          ctx.lineJoin  = 'round';
          ctx.strokeStyle = stroke.color;
          ctx.fillStyle   = stroke.color;
          ctx.lineWidth   = stroke.width;
          const i = pts.length - 2;
          ctx.beginPath();
          if (pts.length === 2) {
            ctx.moveTo(pts[0].x, pts[0].y);
            ctx.lineTo(pts[1].x, pts[1].y);
          } else {
            const prevMid = { x: (pts[i - 1].x + pts[i].x) / 2, y: (pts[i - 1].y + pts[i].y) / 2 };
            const currMid = { x: (pts[i].x + pts[i + 1].x) / 2, y: (pts[i].y + pts[i + 1].y) / 2 };
            ctx.moveTo(prevMid.x, prevMid.y);
            ctx.quadraticCurveTo(pts[i].x, pts[i].y, currMid.x, currMid.y);
          }
          ctx.stroke();
          ctx.restore();
        }
      }
    } else {
      // Shape: update end point, redraw preview on overlay
      stroke.x2 = x;
      stroke.y2 = y;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(() => {
        clearOverlay();
        const canvas = overlayCanvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        renderStroke(ctx, stroke, BG_COLOR);
      });
    }
  }, [getCoords, clearOverlay, redrawAll]);

  const handlePointerUp = useCallback((e) => {
    if (!isDrawingRef.current || !activeStrokeRef.current) return;
    e.preventDefault();
    isDrawingRef.current = false;

    const stroke = activeStrokeRef.current;
    activeStrokeRef.current = null;

    // Update final coordinates for shapes
    if (e.type !== 'touchend' && stroke.tool !== 'pen' && stroke.tool !== 'eraser') {
      const { x, y } = getCoords(e);
      stroke.x2 = x;
      stroke.y2 = y;
    }

    // Validate: skip trivial shapes
    if (
      stroke.tool !== 'pen' && stroke.tool !== 'eraser' &&
      Math.abs((stroke.x2 ?? 0) - (stroke.x1 ?? 0)) < 3 &&
      Math.abs((stroke.y2 ?? 0) - (stroke.y1 ?? 0)) < 3
    ) {
      clearOverlay();
      return;
    }

    // For eraser: do a full redraw to finalize
    if (stroke.tool === 'eraser') {
      strokesRef.current = [...strokesRef.current, stroke];
      redoStackRef.current = [];
      redrawAll();
      clearOverlay();
      onStroke?.(stroke);
      return;
    }

    commitStroke(stroke);
  }, [getCoords, clearOverlay, commitStroke, redrawAll, onStroke]);

  // ── Imperative API (for parent / InterviewRoom) ───────────────────────────
  useImperativeHandle(ref, () => ({
    /** Apply a stroke received from a remote peer */
    applyStroke(stroke) {
      strokesRef.current = [...strokesRef.current, stroke];
      const ctx = mainCanvasRef.current?.getContext('2d');
      if (ctx) renderStroke(ctx, stroke, BG_COLOR);
    },
    /** Undo a specific stroke by ID (remote undo) */
    applyUndo(strokeId) {
      strokesRef.current = strokesRef.current.filter(s => s.id !== strokeId);
      redrawAll();
    },
    /** Clear the entire board (remote clear) */
    applyClear() {
      strokesRef.current  = [];
      redoStackRef.current = [];
      redrawAll();
    },
    /** Replace full state (late-join sync) */
    applyStrokes(strokes) {
      strokesRef.current  = strokes;
      redoStackRef.current = [];
      redrawAll();
    },
    /** Get current strokes snapshot (for sync to late joiners) */
    getStrokes() {
      return [...strokesRef.current];
    },
  }), [redrawAll]);

  // ── Cursor ────────────────────────────────────────────────────────────────
  const cursor = readOnly ? 'default'
    : tool === 'eraser' ? `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='${strokeWidth * 2 + 4}' height='${strokeWidth * 2 + 4}'%3E%3Ccircle cx='${strokeWidth + 2}' cy='${strokeWidth + 2}' r='${strokeWidth}' fill='none' stroke='white' stroke-width='1.5'/%3E%3C/svg%3E") ${strokeWidth + 2} ${strokeWidth + 2}, cell`
    : tool === 'text' ? 'text'
    : 'crosshair';

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full select-none bg-[#1e1e2e]">

      {/* ── Toolbar ─────────────────────────────────────────────────────── */}
      {!readOnly && (
        <div className="shrink-0 flex items-center gap-2 px-3 py-2 bg-gray-900 border-b border-gray-800 flex-wrap">

          {/* Tools */}
          <div className="flex items-center gap-1 pr-2 border-r border-gray-700">
            {TOOLS.map(({ id, label, Icon }) => (
              <button
                key={id}
                title={label}
                onClick={() => setTool(id)}
                className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all ${
                  tool === id
                    ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-900/40'
                    : 'text-gray-400 hover:text-white hover:bg-gray-800'
                }`}
              >
                <Icon />
              </button>
            ))}
          </div>

          {/* Color palette */}
          <div className="flex items-center gap-1 pr-2 border-r border-gray-700 flex-wrap max-w-xs">
            {PALETTE.map(c => (
              <button
                key={c}
                onClick={() => setColor(c)}
                title={c}
                className={`rounded-full transition-all shrink-0 ${
                  color === c
                    ? 'ring-2 ring-white ring-offset-1 ring-offset-gray-900 scale-110'
                    : 'hover:scale-110'
                }`}
                style={{ backgroundColor: c, width: 16, height: 16 }}
              />
            ))}
            {/* Custom color picker */}
            <label
              title="Custom color"
              className="w-4 h-4 rounded-full border border-dashed border-gray-500 flex items-center justify-center cursor-pointer hover:border-white overflow-hidden shrink-0"
            >
              <input
                type="color"
                value={color}
                onChange={e => setColor(e.target.value)}
                className="opacity-0 absolute w-0 h-0"
              />
              <span className="text-[8px] text-gray-400">+</span>
            </label>
          </div>

          {/* Stroke sizes */}
          <div className="flex items-center gap-1 pr-2 border-r border-gray-700">
            {STROKE_SIZES.map(({ value, dot }) => (
              <button
                key={value}
                title={`${value}px`}
                onClick={() => setStrokeWidth(value)}
                className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all ${
                  strokeWidth === value
                    ? 'bg-indigo-600'
                    : 'hover:bg-gray-800'
                }`}
              >
                <div
                  className="rounded-full bg-current"
                  style={{ width: dot, height: dot, color: 'white' }}
                />
              </button>
            ))}
          </div>

          {/* Fill toggle — rect & circle only */}
          {(tool === 'rect' || tool === 'circle') && (
            <button
              onClick={() => setFill(f => !f)}
              title="Toggle shape fill"
              className={`px-2.5 py-1 text-xs rounded-lg transition-colors border ${
                fill
                  ? 'bg-indigo-600 border-indigo-500 text-white'
                  : 'border-gray-700 text-gray-400 hover:border-gray-500 hover:text-gray-200'
              }`}
            >
              Fill
            </button>
          )}

          {/* Font size — text tool only */}
          {tool === 'text' && (
            <select
              value={fontSize}
              onChange={e => setFontSize(Number(e.target.value))}
              className="bg-gray-800 border border-gray-700 text-white text-xs px-2 py-1 rounded-lg focus:outline-none focus:border-indigo-500"
            >
              {FONT_SIZES.map(s => (
                <option key={s} value={s}>{s}px</option>
              ))}
            </select>
          )}

          {/* Color preview chip */}
          <div
            className="w-6 h-6 rounded-md border border-gray-600 shrink-0"
            style={{ backgroundColor: color }}
            title="Active color"
          />

          {/* Right actions */}
          <div className="flex items-center gap-1 ml-auto">
            <button
              onClick={undoStroke}
              title="Undo (Ctrl+Z)"
              className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg transition-colors"
            >
              <UndoIcon /> Undo
            </button>
            <button
              onClick={redoStroke}
              title="Redo (Ctrl+Y)"
              className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg transition-colors"
            >
              <RedoIcon /> Redo
            </button>
            <button
              onClick={clearAll}
              title="Clear board"
              className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs bg-red-900/60 hover:bg-red-800 text-red-300 rounded-lg transition-colors"
            >
              <TrashIcon /> Clear
            </button>
            <button
              onClick={() => {
                // Export: compose bg + strokes onto a fresh canvas
                const main = mainCanvasRef.current;
                if (!main) return;
                const link = document.createElement('a');
                link.download = `whiteboard-${Date.now()}.png`;
                link.href = main.toDataURL('image/png');
                link.click();
              }}
              title="Export as PNG"
              className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg transition-colors"
            >
              <ExportIcon /> Export
            </button>
          </div>
        </div>
      )}

      {/* ── Canvas area ──────────────────────────────────────────────────── */}
      <div ref={containerRef} className="flex-1 relative overflow-hidden">
        {/* Subtle dot grid */}
        <div
          className="absolute inset-0 opacity-10 pointer-events-none"
          style={{
            backgroundImage: 'radial-gradient(circle, #6366f1 1px, transparent 1px)',
            backgroundSize: '32px 32px',
          }}
        />

        {/* Main canvas: committed strokes */}
        <canvas
          ref={mainCanvasRef}
          className="absolute inset-0"
          style={{ touchAction: 'none' }}
        />

        {/* Overlay canvas: live preview + event capture */}
        <canvas
          ref={overlayCanvasRef}
          className="absolute inset-0"
          style={{ cursor, touchAction: 'none' }}
          onMouseDown={handlePointerDown}
          onMouseMove={handlePointerMove}
          onMouseUp={handlePointerUp}
          onMouseLeave={handlePointerUp}
          onTouchStart={handlePointerDown}
          onTouchMove={handlePointerMove}
          onTouchEnd={handlePointerUp}
        />

        {/* Floating text input */}
        {textState.visible && (
          <div
            className="absolute z-20 pointer-events-auto"
            style={{ left: textState.x, top: textState.y - fontSize - 4 }}
          >
            <input
              ref={textInputRef}
              type="text"
              value={textState.value}
              onChange={e => setTextState(s => ({ ...s, value: e.target.value }))}
              onKeyDown={e => {
                if (e.key === 'Enter') { e.preventDefault(); submitText(); }
                if (e.key === 'Escape') setTextState({ visible: false, x: 0, y: 0, value: '' });
              }}
              onBlur={submitText}
              placeholder="Type & press Enter"
              className="min-w-[120px] bg-transparent outline-none border-0 border-b-2 border-dashed border-indigo-400 px-1 pb-0.5"
              style={{
                color,
                fontSize: fontSize + 'px',
                fontFamily: 'Inter, ui-sans-serif, sans-serif',
                caretColor: color,
              }}
            />
          </div>
        )}

        {/* Read-only badge for candidates */}
        {readOnly && (
          <div className="absolute top-3 left-1/2 -translate-x-1/2 bg-gray-900/80 backdrop-blur text-gray-300 text-xs px-4 py-1.5 rounded-full flex items-center gap-2 pointer-events-none">
            <span className="w-2 h-2 rounded-full bg-indigo-400 animate-pulse" />
            Whiteboard — view only
          </div>
        )}
      </div>
    </div>
  );
});

export default WhiteboardCanvas;
