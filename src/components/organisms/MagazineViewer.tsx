"use client";

import { useEffect, useRef, useState, useMemo } from "react";
import { PageFlip } from "page-flip";
import { RiInformationLine, RiCloseLine, RiFocus3Line } from "@remixicon/react";


import { Header } from "../molecules/Header";
import { Controls } from "../molecules/Controls";
import { LoadingOverlay } from "../atoms/LoadingOverlay";
import { ReaderSidebar } from "./ReaderSidebar";

declare global {
  interface Window { pdfjsLib: any; }
}

const PDF_FILE = "/datamaze/datamaze.pdf";
const PAGE_WIDTH = 595;
const PAGE_HEIGHT = 842;
// render pages this many ahead/behind current spread
const PRELOAD_AHEAD = 3;
const KEEP_WINDOW = 5; // unload pages outside current ± this

interface WordToken { text: string; globalIdx: number; xPct: number; yPct: number; wPct: number; hPct: number; }
interface WordOffset { index: number; charStart: number; text: string; }

const norm = (s: string) => s.replace(/^[^a-zA-Z0-9\u0080-\uFFFF]+|[^a-zA-Z0-9\u0080-\uFFFF]+$/g, "").toLowerCase();

function processPageItems(items: any[]) {
  const valid = items.filter(item => {
    if (typeof item.str !== "string") return false;
    const y = item.transform[5];
    const s = item.str.trim();
    // Ignore pure numbers (page numbers) near the bottom of the page
    if (y < 80 && /^(\d+|page\s*\d+)$/i.test(s)) return false;
    return true;
  });

  valid.sort((a, b) => {
    const yA = a.transform[5];
    const yB = b.transform[5];
    // If Y is roughly the same (within 5 points), sort by X (left to right)
    if (Math.abs(yA - yB) < 5) {
      return a.transform[4] - b.transform[4];
    }
    return yB - yA; // Sort top-to-bottom
  });

  // Fix abbreviations for TTS
  valid.forEach(item => {
    item.str = item.str
      .replace(/\bDr\b/g, "Doctor")
      .replace(/\bMr\b/g, "Mister")
      .replace(/\bMrs\b/g, "Missus")
      .replace(/\bMs\b/g, "Miss")
      .replace(/\bvs\b/g, "versus");
  });

  return valid;
}

function extractPageWords(item: any, vp: any, canon: string[], ci: { i: number }): WordToken[] {
  const rawStr: string = item.str ?? "";
  if (!rawStr.trim()) return [];
  const [va, vb, vc, vd, ve, vf] = vp.transform;
  const [, , , , tx, ty] = item.transform as number[];
  const cx = va * tx + vc * ty + ve, cy = vb * tx + vd * ty + vf;
  const fontH = Math.abs(item.transform[3] * vd) || (item.height * Math.abs(vd)) || 12;
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

function matchInRange(wordOffsets: WordOffset[], needle: string, from: number, to: number): number {
  for (let i = Math.max(0, from); i <= Math.min(wordOffsets.length - 1, to); i++) {
    if (norm(wordOffsets[i].text) === needle) return i;
  }
  return -1;
}

export function MagazineViewer({
  onToggleReader,
  readerMode,
  tts,
  extractedText,
  onExtractedText,
}: {
  onToggleReader?: () => void;
  readerMode?: boolean;
  tts?: any;
  extractedText?: string;
  onExtractedText?: (text: string) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const pageFlipRef = useRef<PageFlip | null>(null);

  const [loadingText, setLoadingText] = useState("Connecting to magazine...");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const [currentPage, setCurrentPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);

  const [activeWordIdx, setActiveWordIdx] = useState(-1);
  const lastActiveRef = useRef(-1);

  const pageWordsRef = useRef<Record<number, WordToken[]>>({});
  const activeWordRefs = useRef<Record<number, HTMLSpanElement | null>>({});

  // track current page in a ref so readerMode toggle can restore position
  const currentPageRef = useRef(0);

  // guard: don't fire multiple auto-turns while one flip animation is in progress
  const isFlippingRef = useRef(false);
  const lastAutoTurnRef = useRef(0); // timestamp of last auto-turn

  // KEY FIX: keep extractedText in a ref so the init effect can read its latest
  // value without having extractedText in its dependency array (which caused re-init crash)
  const extractedTextRef = useRef(extractedText ?? "");
  extractedTextRef.current = extractedText ?? "";

  const onExtractedTextRef = useRef(onExtractedText);
  onExtractedTextRef.current = onExtractedText;

  const ttsRef = useRef(tts);
  ttsRef.current = tts;

  const readerModeRef = useRef(readerMode ?? false);
  readerModeRef.current = readerMode ?? false;

  // hint toast shown once when reader mode first activates
  const [showHint, setShowHint] = useState(false);
  const hintShownRef = useRef(false);

  const pageInfo = currentPage === 0 ? "Cover" : (currentPage + 1 <= totalPages ? `Pages ${currentPage} – ${currentPage + 1}` : `Page ${currentPage}`);
  const statusStr = isLoading ? "Preparing..." : "Ready";
  const prevDisabled = currentPage <= 0;
  const nextDisabled = currentPage >= totalPages - 1;

  // Track if user manually navigated away from audio page
  const [isUntethered, setIsUntethered] = useState(false);
  const isUntetheredRef = useRef(false);
  const audioPageRef = useRef(-1);
  const setUntetheredRef = useRef((val: boolean) => {
    setIsUntethered(val);
    isUntetheredRef.current = val;
  });
  setUntetheredRef.current = (val: boolean) => {
    setIsUntethered(val);
    isUntetheredRef.current = val;
  };

  // keep ref in sync for use inside stable callbacks (no re-render needed)
  currentPageRef.current = currentPage;

  const wordOffsets = useMemo(() => {
    if (!extractedText) return [];
    const arr: WordOffset[] = [];
    let match, idx = 0;
    const regex = /\S+/g;
    while ((match = regex.exec(extractedText)) !== null) arr.push({ index: idx++, charStart: match.index, text: match[0] });
    return arr;
  }, [extractedText]);

  // TTS word highlight sync + auto page turn
  useEffect(() => {
    if (!tts || tts.status !== "playing" || !tts.currentWord || !wordOffsets.length) {
      if (tts && tts.status !== "playing") { setActiveWordIdx(-1); lastActiveRef.current = -1; }
      return;
    }
    const needle = norm(tts.currentWord);
    if (!needle) return;

    const startIdx = Math.max(0, lastActiveRef.current);
    let found = matchInRange(wordOffsets, needle, startIdx, startIdx + 8);
    if (found === -1) found = matchInRange(wordOffsets, needle, startIdx - 4, startIdx - 1);

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
    if (found !== -1) {
      setActiveWordIdx(found);
      lastActiveRef.current = found;

      // auto page turn — find which PDF page this word is on
      const pageEntry = Object.entries(pageWordsRef.current).find(([, words]) => words.some(w => w.globalIdx === found));
      if (pageEntry && pageFlipRef.current) {
        const pIdx = parseInt(pageEntry[0]); // 0-based (pageWordsRef key = pageNum - 1)
        audioPageRef.current = pIdx; // Always track where the audio currently is
        
        // DO NOT FORCE AUTO-TURN IF USER MANUALLY NAVIGATED AWAY!
        if (isUntetheredRef.current) return;

        const curr = pageFlipRef.current.getCurrentPageIndex();
        const needsTurn = pIdx < curr || pIdx > curr + 1;
        // cooldown: wait for previous flip animation to finish (flippingTime = 700ms) + buffer
        const now = Date.now();
        if (needsTurn && !isFlippingRef.current && now - lastAutoTurnRef.current > 1200) {
          isFlippingRef.current = true;
          lastAutoTurnRef.current = now;
          if (pIdx > curr + 1) {
            pageFlipRef.current.flipNext("bottom");
          } else {
            pageFlipRef.current.flipPrev("top");
          }
          // release flip guard after animation completes
          setTimeout(() => { isFlippingRef.current = false; }, 800);
        }
      }
    }
  }, [tts?.currentWord, tts?.charIndex, tts?.status, wordOffsets]);

  // ONE-TIME init effect — no extractedText dep (uses ref instead)
  useEffect(() => {
    let isCancelled = false;
    let pollInterval: any;

    async function init() {
      try {
        setLoadingText("Downloading magazine...");
        const response = await fetch(PDF_FILE);
        if (!response.ok) throw new Error("PDF download failed.");

        const pdfData = await response.arrayBuffer();
        setLoadingText("Waiting for PDF engine...");

        await new Promise<void>((resolve) => {
          if (window.pdfjsLib) return resolve();
          pollInterval = setInterval(() => {
            if (window.pdfjsLib) { clearInterval(pollInterval); resolve(); }
          }, 100);
        });
        if (isCancelled) return;

        window.pdfjsLib.GlobalWorkerOptions.workerSrc =
          "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js";

        setLoadingText("Opening PDF...");
        const pdf = await window.pdfjsLib.getDocument({
          data: pdfData,
          disableFontFace: true,   // skip embedded font parsing → no glyf/cmap errors
          useSystemFonts: true,    // fall back to OS fonts
          cMapUrl: "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/cmaps/",
          cMapPacked: true,
          standardFontDataUrl: "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/standard_fonts/",
        }).promise;

        const total = pdf.numPages;
        if (total < 1) throw new Error("The PDF contains no pages.");
        if (isCancelled) return;

        setTotalPages(total);

        const pageElements: HTMLElement[] = [];
        const spinner = `<div class="w-8 h-8 border-4 border-gray-200 border-t-indigo-500 rounded-full animate-spin"></div>`;

        for (let i = 1; i <= total; i++) {
          const page = document.createElement("div");
          page.className = "magazine-page relative w-full h-full bg-white overflow-hidden shadow-[inset_0_0_15px_rgba(0,0,0,.14)] flex items-center justify-center";
          page.style.backfaceVisibility = "hidden";
          page.style.webkitBackfaceVisibility = "hidden";
          page.innerHTML = spinner;
          pageElements.push(page);
        }

        if (!containerRef.current) return;

        const pf = new PageFlip(containerRef.current, {
          width: PAGE_WIDTH,
          height: PAGE_HEIGHT,
          size: "stretch",
          minWidth: 280,
          maxWidth: 900,
          minHeight: 396,
          maxHeight: 1260,
          usePortrait: true,
          showCover: true,
          drawShadow: false,
          flippingTime: 700,       // snappier flip
          useMouseEvents: true,
          mobileScrollSupport: false,
          disableFlipByClick: false,
          startPage: 0,
          autoSize: true,
        });

        pf.loadFromHTML(pageElements);
        pageFlipRef.current = pf;
        setIsLoading(false);

        // Background text extraction — reads from ref so no state dep loop
        const doExtract = onExtractedTextRef.current && !extractedTextRef.current;
        if (doExtract) {
          setTimeout(async () => {
            try {
              const pagesText: string[] = [];
              for (let i = 1; i <= total; i++) {
                if (isCancelled) return;
                const p = await pdf.getPage(i);
                const content = await p.getTextContent();
                const text = processPageItems(content.items)
                  .map(x => x.str)
                  .join(" ")
                  .trim();
                pagesText.push(text);
                await new Promise(r => setTimeout(r, 8));
              }
              const fullText = pagesText.filter(Boolean).join("\n\n");
              extractedTextRef.current = fullText;
              onExtractedTextRef.current?.(fullText);
              // now pre-extract word positions for ALL pages so auto-turn works everywhere
              const canonWords = fullText.split(/\s+/).filter(Boolean);
              preExtractAllWordPositions(canonWords);
            } catch (e) {
              console.error("BG extract error:", e);
            }
          }, 300);
        } else if (extractedTextRef.current) {
          // text already available — pre-extract positions immediately after visual render starts
          const canonWords = extractedTextRef.current.split(/\s+/).filter(Boolean);
          setTimeout(() => preExtractAllWordPositions(canonWords), 1000);
        }

        const rendered = new Set<number>();
        const rendering = new Set<number>(); // tracks in-flight renders

        // build word overlay spans for a page and append to DOM
        const appendTextLayer = (page: HTMLElement, pageNum: number) => {
          const pageWords = pageWordsRef.current[pageNum - 1];
          if (!pageWords || pageWords.length === 0) return;
          const textLayer = document.createElement("div");
          textLayer.className = "pdf-text-layer absolute inset-0 w-full h-full pointer-events-none";

          // Brutal bubble-phase blocker: prevents ANY interaction from reaching PageFlip while listening
          const stopBubble = (e: Event) => {
            if (readerModeRef.current) e.stopPropagation();
          };
          ["pointerdown", "pointermove", "pointerup", "mousedown", "mousemove", "mouseup", "touchstart", "touchmove", "touchend"].forEach(ev => {
            textLayer.addEventListener(ev, stopBubble, { passive: false });
          });

          pageWords.forEach((word: WordToken) => {
            const span = document.createElement("span");
            span.className = "pdf-word absolute bg-yellow-400/0 transition-colors duration-200 cursor-pointer pointer-events-auto rounded";
            span.style.left = `${word.xPct * 100}%`;
            span.style.top = `${word.yPct * 100}%`;
            span.style.width = `${word.wPct * 100}%`;
            span.style.height = `${word.hPct * 100}%`;
            span.dataset.idx = word.globalIdx.toString();
            span.onclick = (e) => {
              e.stopPropagation();
              const currentTts = ttsRef.current;
              if (!currentTts || !readerModeRef.current) return;
              setUntetheredRef.current(false);
              lastActiveRef.current = word.globalIdx;
              currentTts.speakFromWord(extractedTextRef.current, word.globalIdx);
            };
            textLayer.appendChild(span);
            activeWordRefs.current[word.globalIdx] = span;
          });
          page.appendChild(textLayer);
        };
        // pre-extract word positions for ALL pages sequentially with ONE shared ci.
        // Must run pages 1→N in order so globalIdx is correct for every page.
        // renderPage no longer does word extraction — all word mapping happens here.
        const preExtractAllWordPositions = async (canonWords: string[]) => {
          if (!canonWords.length) return;
          const ci = { i: 0 }; // single shared index, advances page by page
          for (let i = 1; i <= total; i++) {
            if (isCancelled) return;
            try {
              const pdfPage = await pdf.getPage(i);
              const tc = await pdfPage.getTextContent();
              const words = processPageItems(tc.items).flatMap((item: any) =>
                extractPageWords(item, pdfPage.getViewport({ scale: 1.5 }), canonWords, ci)
              );
              // overwrite any partial data from renderPage (it used wrong ci)
              pageWordsRef.current[i - 1] = words;
              await new Promise(r => setTimeout(r, 5)); // yield to browser
            } catch {}
          }
        };

        const renderPage = async (i: number) => {
          if (i < 1 || i > total || rendered.has(i) || rendering.has(i) || isCancelled) return;
          rendering.add(i);
          const page = pageElements[i - 1];
          try {
            const pdfPage = await pdf.getPage(i);
            const viewport = pdfPage.getViewport({ scale: 1.5 });
            const canvas = document.createElement("canvas");
            canvas.width = viewport.width;
            canvas.height = viewport.height;
            const context = canvas.getContext("2d");

            if (context) {
              try {
                await pdfPage.render({ canvasContext: context, viewport }).promise;
                if (isCancelled) { rendering.delete(i); return; }
                canvas.toBlob((blob) => {
                  if (!blob || isCancelled) { rendering.delete(i); return; }
                  const url = URL.createObjectURL(blob);
                  const img = new Image();
                  img.src = url;
                  img.style.cssText = "position:absolute;inset:0;width:100%;height:100%";
                  img.className = "pointer-events-none select-none";

                  requestAnimationFrame(() => {
                    if (isCancelled) { URL.revokeObjectURL(url); rendering.delete(i); return; }
                    page.innerHTML = "";
                    page.appendChild(img);
                    appendTextLayer(page, i);
                    rendered.add(i);
                    rendering.delete(i);
                  });
                }, "image/jpeg", 0.88);
              } catch (renderErr) {
                console.warn("Page render error", i, renderErr);
                rendering.delete(i);
              }
            } else {
              rendering.delete(i);
            }
            // NOTE: word extraction intentionally removed from here.
            // preExtractAllWordPositions handles all pages in order with correct ci.
          } catch (e) {
            console.error("Critical page error", i, e);
            rendering.delete(i);
          }
        };

        // render first spread immediately
        for (const p of [1, 2, 3, 4]) await renderPage(p);

        pf.on("flip", (e: any) => {
          const pageIdx = e.data as number;
          setCurrentPage(pageIdx);
          const p = pageIdx + 1;

          // fire-and-forget: don't block the event handler
          for (let n = p - 1; n <= p + PRELOAD_AHEAD + 1; n++) renderPage(n);

          // unload distant pages to prevent canvas memory limit
          for (let i = 1; i <= total; i++) {
            if ((i < p - KEEP_WINDOW || i > p + KEEP_WINDOW) && rendered.has(i) && !rendering.has(i)) {
              rendered.delete(i);
              const img = pageElements[i - 1].querySelector("img");
              if (img?.src.startsWith("blob:")) URL.revokeObjectURL(img.src);
              pageElements[i - 1].innerHTML = spinner;
            }
          }
        });

        pf.on("changeState", () => setCurrentPage(pf.getCurrentPageIndex()));
        setCurrentPage(0);

      } catch (err: any) {
        if (!isCancelled) setError(err.message || "An error occurred.");
      }
    }

    init();

    return () => {
      isCancelled = true;
      clearInterval(pollInterval);
      if (pageFlipRef.current) { pageFlipRef.current.destroy(); pageFlipRef.current = null; }
      // revoke any blob URLs to prevent memory leak
      if (containerRef.current) {
        containerRef.current.querySelectorAll<HTMLImageElement>("img[src^='blob:']").forEach(img => URL.revokeObjectURL(img.src));
      }
    };
  }, []); // INTENTIONALLY EMPTY — extractedText accessed via ref only

  // apply/remove TTS highlight class
  useEffect(() => {
    Object.values(activeWordRefs.current).forEach(el => {
      el?.classList.remove("bg-yellow-400/40", "ring-2", "ring-yellow-400/50");
    });
    if (activeWordIdx >= 0) {
      activeWordRefs.current[activeWordIdx]?.classList.add("bg-yellow-400/40", "ring-2", "ring-yellow-400/50");
    }
  }, [activeWordIdx]);

  // keyboard navigation
  useEffect(() => {
    const handle = (e: KeyboardEvent) => {
      if (!pageFlipRef.current) return;
      const pf = pageFlipRef.current;
      const curr = pf.getCurrentPageIndex();
      if (e.key === "ArrowRight" && curr < totalPages - 1) { e.preventDefault(); pf.flipNext("bottom"); }
      if (e.key === "ArrowLeft" && curr > 0) { e.preventDefault(); pf.flipPrev("top"); }
    };
    document.addEventListener("keydown", handle);
    return () => document.removeEventListener("keydown", handle);
  }, [totalPages]);

  // Block PageFlip drag and hover when in reader mode.
  // PageFlip uses Pointer Events API (pointerdown/pointermove) for corner-hover detection,
  // so we must block both mouse AND pointer events at capture phase.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const block = (e: Event) => {
      if (!readerModeRef.current) return;
      const target = e.target as Element;
      // allow word-span clicks through for TTS jump — block everything else
      if (!target.closest(".pdf-word")) {
        e.preventDefault();
        e.stopPropagation();
      }
    };

    const events = [
      "mousedown", "mousemove", "mouseup", "click",
      "pointerdown", "pointermove", "pointerup",
      "touchstart", "touchmove", "touchend"
    ] as const;
    events.forEach(ev => container.addEventListener(ev, block, { capture: true, passive: false }));

    return () => {
      events.forEach(ev => container.removeEventListener(ev, block, { capture: true }));
    };
  }, []); // stable — reads readerModeRef on each event


  // When reader mode sidebar appears/disappears, PageFlip fires a resize+changeState
  // that resets getCurrentPageIndex() to 0. Restore the saved page after layout settles.
  useEffect(() => {
    if (!pageFlipRef.current) return;
    const pf = pageFlipRef.current;
    
    // Natively turn off page flipping interactions in reader mode
    try {
      if ((pf as any).updateFromOptions) {
        (pf as any).updateFromOptions({ useMouseEvents: !readerMode });
      } else {
        (pf as any).getSettings().useMouseEvents = !readerMode;
      }
    } catch {}

    const saved = currentPageRef.current;
    // wait for sidebar CSS transition + PageFlip resize to settle
    const t = setTimeout(() => {
      if (pageFlipRef.current && currentPageRef.current !== saved) {
        pageFlipRef.current.turnToPage(saved);
      }
    }, 350);
    return () => clearTimeout(t);
  }, [readerMode]);

  // Keep PageFlip's internal math in sync with the actual CSS size.
  // When the sidebar collapses/expands, the flex container size changes without a window resize.
  // If we don't update(), PageFlip's polygon math produces NaNs and crashes the PDF (black screen).
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    let timeout: any;
    const ro = new ResizeObserver(() => {
      clearTimeout(timeout);
      timeout = setTimeout(() => {
        if (pageFlipRef.current) {
          const pf = pageFlipRef.current;
          const saved = currentPageRef.current;
          (pf as any).update();
          // update() often resets the page to 0, so restore it
          if (pf.getCurrentPageIndex() !== saved) {
            pf.turnToPage(saved);
          }
        }
      }, 350); // wait for CSS transition to finish
    });
    ro.observe(el);
    return () => {
      ro.disconnect();
      clearTimeout(timeout);
    };
  }, []);

  // show hint toast the first time reader mode turns on
  useEffect(() => {
    if (readerMode && !hintShownRef.current) {
      hintShownRef.current = true;
      setShowHint(true);
      const t = setTimeout(() => setShowHint(false), 5000);
      return () => clearTimeout(t);
    }
    if (!readerMode) setShowHint(false);
  }, [readerMode]);

  const handleFirst = () => pageFlipRef.current?.turnToPage(0);
  const handleLast = () => pageFlipRef.current?.turnToPage(totalPages - 1);
  const handlePrev = () => { if (pageFlipRef.current?.getCurrentPageIndex() ?? 0 > 0) pageFlipRef.current?.flipPrev("top"); };
  const handleNext = () => { if ((pageFlipRef.current?.getCurrentPageIndex() ?? totalPages) < totalPages - 1) pageFlipRef.current?.flipNext("bottom"); };

  return (
    <>
      {isLoading && <LoadingOverlay text={loadingText} error={error} />}
      <Header status={statusStr} onToggleReader={onToggleReader} readerMode={readerMode} ttsSupported={tts?.isSupported !== false} />

      <div className="flex-1 flex overflow-hidden w-full h-full">
        <div className="flex-1 flex flex-col relative bg-black h-full min-w-0">
          <div className="flex-1 w-full flex items-center justify-center overflow-hidden p-4 sm:p-6 relative">
            {/* data-reading disables PageFlip corner-hover CSS via globals.css */}
            <div
              ref={containerRef}
              className="relative w-full h-full max-w-[1250px] max-h-[900px]"
              data-reading={readerMode ? "true" : undefined}
            />

            {/* hint toast — shown once on first reader mode activation */}
            {showHint && (
              <div
                className="fixed bottom-24 left-1/2 -translate-x-1/2 w-[calc(100%-2rem)] max-w-[320px] bg-[#313033] text-[#F4EFF4] text-[13px] px-3 py-2.5 rounded-[4px] shadow-lg flex items-center gap-2 animate-fade-in pointer-events-none select-none z-[9999] md:bottom-8 md:rounded-md md:w-max"
                role="status"
                aria-live="polite"
              >
                <RiInformationLine className="text-[#D0BCFF] shrink-0 w-4 h-4 md:w-5 md:h-5" />
                <span className="flex-1 leading-snug font-normal tracking-wide text-xs md:text-sm">
                  Tap any word to read from that point
                </span>
                <button
                  className="shrink-0 text-[#D0BCFF] hover:text-[#E8DEF8] hover:bg-white/10 font-medium text-xs px-2 py-1 rounded-sm pointer-events-auto transition-colors uppercase tracking-widest"
                  onClick={() => setShowHint(false)}
                  aria-label="Dismiss hint"
                >
                  OK
                </button>
              </div>
            )}
            {isUntethered && readerMode && tts?.status === "playing" && (
              <button
                onClick={() => {
                  setUntetheredRef.current(false);
                  if (audioPageRef.current !== -1 && pageFlipRef.current) {
                    pageFlipRef.current.turnToPage(audioPageRef.current);
                  }
                }}
                className="fixed bottom-36 left-1/2 -translate-x-1/2 bg-[#D0BCFF] text-[#381E72] hover:bg-[#E8DEF8] px-4 py-2.5 rounded-full shadow-lg z-[9999] animate-fade-in flex items-center gap-2 font-semibold text-sm transition-colors md:bottom-20 pointer-events-auto"
              >
                <RiFocus3Line size={18} /> Return to audio
              </button>
            )}
          </div>
          {!readerMode && (
            <Controls
              pageInfo={pageInfo}
              onFirst={handleFirst}
              onPrev={handlePrev}
              onNext={handleNext}
              onLast={handleLast}
              prevDisabled={prevDisabled}
              nextDisabled={nextDisabled}
            />
          )}
        </div>

        {readerMode && tts && (
          <ReaderSidebar 
            tts={tts} 
            textToSpeak={extractedText || ""} 
            currentPage={currentPage + 1}
            totalPages={totalPages}
            goToPage={(n) => {
              setUntetheredRef.current(true);
              pageFlipRef.current?.turnToPage(n - 1);
            }}
            onNextPage={() => {
              setUntetheredRef.current(true);
              handleNext();
            }}
            onPrevPage={() => {
              setUntetheredRef.current(true);
              handlePrev();
            }}
          />
        )}
      </div>
    </>
  );
}
