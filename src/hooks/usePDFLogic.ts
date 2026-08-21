import { useState, useEffect, useRef, useCallback, useMemo } from "react";

interface WordToken { text: string; globalIdx: number; xPct: number; yPct: number; wPct: number; hPct: number; }
interface PageMeta { index: number; naturalW: number; naturalH: number; words: WordToken[]; }
interface WordOffset { index: number; charStart: number; text: string; }

const norm = (s: string) => s.replace(/^[^a-zA-Z0-9\u0080-\uFFFF]+|[^a-zA-Z0-9\u0080-\uFFFF]+$/g, "").toLowerCase();

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const cancelAll = (tasks: Map<number, any>) => { tasks.forEach(t => { try { t.cancel(); } catch {} }); tasks.clear(); };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractPageWords(item: any, vp: any, canon: string[], ci: { i: number }): WordToken[] {
  const rawStr: string = item.str ?? "";
  if (!rawStr.trim()) return [];
  const [va, vb, vc, vd, ve, vf] = vp.transform;
  const [, , , , tx, ty] = item.transform as number[];
  const cx = va * tx + vc * ty + ve, cy = vb * tx + vd * ty + vf, fontH = Math.abs(item.transform[3] * vd);
  if (fontH <= 0) return [];
  const itemW = (item.width ?? 0) * Math.abs(va), textTop = cy - fontH;
  if (textTop < -50 || cx < -50) return [];

  const out: WordToken[] = [];
  let xCursor = cx;
  for (const tok of rawStr.split(/(\s+)/)) {
    const isSpace = /^\s+$/.test(tok);
    const tokW = itemW * (tok.length / (rawStr.length || 1));
    if (!isSpace && tok.trim()) {
      const n = norm(tok);
      let gIdx = -1;
      if (n) {
        for (let j = ci.i; j < Math.min(ci.i + 8, canon.length); j++) {
          if (norm(canon[j]) === n) { gIdx = j; ci.i = j + 1; break; }
        }
      }
      if (gIdx >= 0) {
        out.push({
          text: tok, globalIdx: gIdx,
          xPct: Math.max(0, xCursor) / vp.width,
          yPct: Math.max(0, textTop) / vp.height,
          wPct: Math.min(tokW, vp.width - xCursor) / vp.width,
          hPct: Math.min(fontH / vp.height, 0.12),
        });
      }
    }
    xCursor += tokW;
  }
  return out;
}

// find nearest wordOffsets index matching needle, searching outward from a hint
function matchInRange(wordOffsets: WordOffset[], needle: string, from: number, to: number): number {
  for (let i = Math.max(0, from); i <= Math.min(wordOffsets.length - 1, to); i++) {
    if (norm(wordOffsets[i].text) === needle) return i;
  }
  return -1;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function usePDFLogic(file: File, extractedText: string, tts: any, onClose: () => void, zoom: number) {
  const [pageMetas, setPageMetas] = useState<PageMeta[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadErr, setLoadErr] = useState("");
  const [activeWordIdx, setActiveWordIdx] = useState(-1);
  const [userScrolled, setUserScrolled] = useState(false);
  const [showScrollBtn, setShowScrollBtn] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const pageRefs = useRef<(HTMLDivElement | null)[]>([]);
  const canvasRefs = useRef<(HTMLCanvasElement | null)[]>([]);
  const activeWordRef = useRef<HTMLSpanElement | null>(null);
  const scrollTORef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pdfDocRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const renderTasks = useRef<Map<number, any>>(new Map());
  const renderPending = useRef<Set<number>>(new Set());
  const lastActiveRef = useRef(-1);
  const initialScrollDone = useRef(false);

  const resetScrollState = useCallback(() => { setUserScrolled(false); setShowScrollBtn(false); }, []);

  // load pdf and extract words
  useEffect(() => {
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true); setLoadErr("");
    (async () => {
      try {
        const pdfjsLib = (window as any).pdfjsLib;
        const doc = await pdfjsLib.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        if (cancelled) return (doc as any).destroy();
        pdfDocRef.current = doc; setTotalPages(doc.numPages);

        const canon = extractedText.split(/\s+/).filter(Boolean);
        const ci = { i: 0 };
        const metas: PageMeta[] = [];

        for (let pi = 0; pi < doc.numPages; pi++) {
          if (cancelled) break;
          const page = await doc.getPage(pi + 1);
          const vp = page.getViewport({ scale: 1 });
          const tc = await page.getTextContent();
          page.cleanup();
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const pageWords = (tc.items as any[]).flatMap(item => extractPageWords(item, vp, canon, ci));
          metas.push({ index: pi, naturalW: vp.width, naturalH: vp.height, words: pageWords });
        }

        if (!cancelled) {
          setPageMetas(metas);
          pageRefs.current = new Array(doc.numPages).fill(null);
          canvasRefs.current = new Array(doc.numPages).fill(null);
          setLoading(false);
        }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } catch (e: any) {
        if (!cancelled) { setLoadErr(e.message || "Failed to load PDF"); setLoading(false); }
      }
    })();
    return () => { cancelled = true; cancelAll(renderTasks.current); };
  }, [file, extractedText]);

  // render pdf pages
  const renderPage = useCallback(async (pi: number, scale: number) => {
    const doc = pdfDocRef.current, canvas = canvasRefs.current[pi];
    if (!doc || !canvas || renderPending.current.has(pi)) return;
    renderPending.current.add(pi);
    const prev = renderTasks.current.get(pi);
    if (prev) { try { prev.cancel(); } catch {} }
    try {
      const page = await doc.getPage(pi + 1), vp = page.getViewport({ scale }), dpr = window.devicePixelRatio || 1;
      canvas.width = vp.width * dpr; canvas.height = vp.height * dpr;
      canvas.style.width = vp.width + "px"; canvas.style.height = vp.height + "px";
      const ctx = canvas.getContext("2d")!; ctx.scale(dpr, dpr);
      const task = page.render({ canvasContext: ctx, viewport: vp });
      renderTasks.current.set(pi, task); await task.promise; page.cleanup();
    } catch {}
    renderTasks.current.delete(pi); renderPending.current.delete(pi);
  }, []);

  useEffect(() => {
    if (!pageMetas.length || !pdfDocRef.current) return;
    cancelAll(renderTasks.current); renderPending.current.clear();
    pageMetas.forEach((_, i) => renderPage(i, zoom));
  }, [zoom, pageMetas, renderPage]);

  // track active word based on TTS
  const wordOffsets = useMemo(() => {
    const arr: WordOffset[] = [];
    let match, idx = 0;
    const regex = /\S+/g;
    while ((match = regex.exec(extractedText)) !== null) arr.push({ index: idx++, charStart: match.index, text: match[0] });
    return arr;
  }, [extractedText]);

  useEffect(() => {
    if (tts.status !== "playing" || !tts.currentWord || !wordOffsets.length) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (tts.status !== "playing") { setActiveWordIdx(-1); lastActiveRef.current = -1; }
      return;
    }
    const needle = norm(tts.currentWord);
    if (!needle) return;

    const startIdx = Math.max(0, lastActiveRef.current);
    let found = matchInRange(wordOffsets, needle, startIdx, startIdx + 8);
    if (found === -1) found = matchInRange(wordOffsets, needle, startIdx - 4, startIdx - 1);

    // fallback using charIndex if completely lost
    if (found === -1) {
      let approxWordIdx = 0;
      for (let i = 0; i < wordOffsets.length; i++) {
        if (wordOffsets[i].charStart <= tts.charIndex) approxWordIdx = i; else break;
      }
      let minDist = Infinity;
      for (let i = Math.max(0, approxWordIdx - 6); i <= Math.min(wordOffsets.length - 1, approxWordIdx + 6); i++) {
        if (norm(wordOffsets[i].text) === needle) {
          const dist = Math.abs(i - approxWordIdx);
          if (dist < minDist) { minDist = dist; found = i; }
        }
      }
    }
    if (found !== -1) { setActiveWordIdx(found); lastActiveRef.current = found; }
  }, [tts.currentWord, tts.charIndex, tts.status, wordOffsets]);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { if (tts.status === "idle" || tts.status === "done") setActiveWordIdx(-1); }, [tts.status]);

  // scroll to active word
  useEffect(() => {
    if (!activeWordRef.current || userScrolled || !containerRef.current) return;
    const elRect = activeWordRef.current.getBoundingClientRect();
    const cRect = containerRef.current.getBoundingClientRect();
    const elCenter = elRect.top + elRect.height / 2, cCenter = cRect.top + cRect.height / 2;
    if (!initialScrollDone.current) {
      activeWordRef.current.scrollIntoView({ behavior: "instant", block: "center" });
      initialScrollDone.current = true;
    } else if (Math.abs(elCenter - cCenter) > cRect.height * 0.25) {
      activeWordRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [activeWordIdx, userScrolled]);

  // detect user scroll + current page tracking
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onUserScroll = () => {
      if (tts.status !== "playing") return;
      setUserScrolled(true); setShowScrollBtn(true);
      if (scrollTORef.current) clearTimeout(scrollTORef.current);
      scrollTORef.current = setTimeout(() => setShowScrollBtn(false), 5000);
    };
    const onScroll = () => {
      const mid = el.scrollTop + el.clientHeight * 0.35;
      for (let i = pageRefs.current.length - 1; i >= 0; i--) {
        if (pageRefs.current[i] && pageRefs.current[i]!.offsetTop <= mid) { setCurrentPage(i + 1); break; }
      }
    };
    el.addEventListener("wheel", onUserScroll, { passive: true });
    el.addEventListener("touchmove", onUserScroll, { passive: true });
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      el.removeEventListener("wheel", onUserScroll);
      el.removeEventListener("touchmove", onUserScroll);
      el.removeEventListener("scroll", onScroll);
    };
  }, [tts.status]);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { if (tts.status !== "playing") resetScrollState(); }, [tts.status, resetScrollState]);

  const resumeAutoScroll = useCallback(() => {
    resetScrollState();
    activeWordRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [resetScrollState]);

  const goToPage = useCallback((n: number) => {
    const p = Math.max(1, Math.min(totalPages, n));
    setCurrentPage(p);
    if (pageRefs.current[p - 1] && containerRef.current) {
      containerRef.current.scrollTo({ top: pageRefs.current[p - 1]!.offsetTop - 24, behavior: "smooth" });
    }
  }, [totalPages]);

  const handleWordClick = useCallback((idx: number) => {
    lastActiveRef.current = idx;
    tts.speakFromWord(extractedText, idx);
    resetScrollState();
  }, [tts, extractedText, resetScrollState]);

  // handle keyboard shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === "INPUT" || tag === "SELECT") return;
      if (e.key === "Escape") return onClose();
      if (e.key === " ") {
        e.preventDefault();
        if (tts.status === "playing") tts.pause();
        else if (tts.status === "paused") tts.resume();
        else tts.speak(extractedText);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [tts, extractedText, onClose]);

  return { pageMetas, currentPage, totalPages, loading, loadErr, activeWordIdx, showScrollBtn, containerRef, pageRefs, canvasRefs, activeWordRef, resumeAutoScroll, goToPage, handleWordClick };
}