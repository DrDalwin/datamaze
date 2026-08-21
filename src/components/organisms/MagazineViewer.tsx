"use client";

import { useEffect, useRef, useState, useMemo, useCallback } from "react";
import { PageFlip } from "page-flip";

import { Header } from "../molecules/Header";
import { Controls } from "../molecules/Controls";
import { LoadingOverlay } from "../atoms/LoadingOverlay";
import { ReaderSidebar } from "./ReaderSidebar";

declare global {
  interface Window {
    pdfjsLib: any;
  }
}

const PDF_FILE = "/datamaze/datamaze.pdf";
const PAGE_WIDTH = 595;
const PAGE_HEIGHT = 842;

interface WordToken { text: string; globalIdx: number; xPct: number; yPct: number; wPct: number; hPct: number; }
interface WordOffset { index: number; charStart: number; text: string; }

const norm = (s: string) => s.replace(/^[^a-zA-Z0-9\u0080-\uFFFF]+|[^a-zA-Z0-9\u0080-\uFFFF]+$/g, "").toLowerCase();

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
  onExtractedText
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

  const pageInfo = currentPage === 0 ? "Cover" : (currentPage + 1 <= totalPages ? `Pages ${currentPage} – ${currentPage + 1}` : `Page ${currentPage}`);
  const statusStr = isLoading ? "Preparing..." : "Ready";
  const prevDisabled = currentPage <= 0;
  const nextDisabled = currentPage >= totalPages - 1;

  const wordOffsets = useMemo(() => {
    if (!extractedText) return [];
    const arr: WordOffset[] = [];
    let match, idx = 0;
    const regex = /\S+/g;
    while ((match = regex.exec(extractedText)) !== null) arr.push({ index: idx++, charStart: match.index, text: match[0] });
    return arr;
  }, [extractedText]);

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
      
      const pageIndex = Object.entries(pageWordsRef.current).find(([, words]) => words.some(w => w.globalIdx === found))?.[0];
      if (pageIndex && pageFlipRef.current) {
        const pIdx = parseInt(pageIndex);
        const curr = pageFlipRef.current.getCurrentPageIndex();
        if (pIdx < curr || pIdx > curr + 1) {
          pageFlipRef.current.turnToPage(pIdx % 2 === 0 ? pIdx : pIdx - 1);
        }
      }
    }
  }, [tts?.currentWord, tts?.charIndex, tts?.status, wordOffsets]);

  useEffect(() => {
    let isCancelled = false;
    let pollInterval: any;

    async function init() {
      try {
        setLoadingText("Downloading magazine...");
        const response = await fetch(PDF_FILE);
        if (!response.ok) throw new Error(`PDF download failed.`);

        const pdfData = await response.arrayBuffer();
        setLoadingText("Waiting for PDF engine...");
        
        await new Promise<void>((resolve) => {
          if (window.pdfjsLib) return resolve();
          pollInterval = setInterval(() => {
            if (window.pdfjsLib) {
              clearInterval(pollInterval);
              resolve();
            }
          }, 100);
        });

        window.pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js`;

        setLoadingText("Opening PDF...");
        const pdf = await window.pdfjsLib.getDocument({ 
          data: pdfData,
          disableFontFace: true,
          cMapUrl: "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/cmaps/",
          cMapPacked: true,
          standardFontDataUrl: "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/standard_fonts/"
        }).promise;
        const total = pdf.numPages;
        if (total < 1) throw new Error("The PDF contains no pages.");

        setTotalPages(total);
        if (isCancelled) return;

        const pageElements: HTMLElement[] = [];

        for (let i = 1; i <= total; i++) {
          const page = document.createElement("div");
          page.className = "magazine-page relative w-full h-full bg-white overflow-hidden shadow-[inset_0_0_15px_rgba(0,0,0,.14)] flex items-center justify-center";
          page.innerHTML = `<div class="w-8 h-8 border-4 border-gray-200 border-t-indigo-500 rounded-full animate-spin"></div>`;
          if (i === 1 || i === total) page.dataset.density = "hard";
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
          drawShadow: false, // disabled to prevent 3D GPU crashes on some devices
          flippingTime: 900,
          useMouseEvents: true,
          mobileScrollSupport: false,
          disableFlipByClick: false,
          startPage: 0,
          autoSize: true,
        });

        pf.loadFromHTML(pageElements);
        pageFlipRef.current = pf;

        setIsLoading(false);

        // background text extraction so Audio mode is instant
        if (onExtractedText && !extractedText) {
          setTimeout(async () => {
            try {
              const pagesText: string[] = [];
              for (let i = 1; i <= total; i++) {
                if (isCancelled) return;
                const p = await pdf.getPage(i);
                const content = await p.getTextContent();
                const text = (content.items as any[]).filter(x => typeof x.str === 'string').map(x => x.str).join(' ').trim();
                pagesText.push(text);
                await new Promise(r => setTimeout(r, 10)); // yield to render tasks
              }
              const fullText = pagesText.filter(Boolean).join('\n\n');
              onExtractedText(fullText);
            } catch (e) {
              console.error("BG Extract Error:", e);
            }
          }, 500);
        }

        const rendered = new Set<number>();
        const canon = extractedText ? extractedText.split(/\s+/).filter(Boolean) : [];
        const canonIndex = { i: 0 };

        const renderPage = async (i: number) => {
          if (i < 1 || i > total || rendered.has(i) || isCancelled) return;
          rendered.add(i);
          const page = pageElements[i - 1];
          try {
            const pdfPage = await pdf.getPage(i);
            const viewport = pdfPage.getViewport({ scale: 1.5 });
            const canvas = document.createElement("canvas");
            canvas.width = viewport.width;
            canvas.height = viewport.height;
            canvas.style.position = "absolute";
            canvas.style.inset = "0";
            canvas.style.width = "100%";
            canvas.style.height = "100%";
            canvas.style.display = "block";
            const context = canvas.getContext("2d");
            
            page.innerHTML = ""; 
            page.appendChild(canvas);

            if (context) {
              try {
                await pdfPage.render({ canvasContext: context, viewport }).promise;
                const img = document.createElement("img");
                img.src = canvas.toDataURL("image/jpeg", 0.8);
                img.style.position = "absolute";
                img.style.inset = "0";
                img.style.width = "100%";
                img.style.height = "100%";
                img.className = "pointer-events-none"; // avoid drag issues
                page.innerHTML = "";
                page.appendChild(img);
              } catch (renderError) {
                console.warn("Render error on page", i, renderError);
              }
            }

            let pageWords = pageWordsRef.current[i - 1];
            if (canon.length > 0 && !pageWords) {
              const tc = await pdfPage.getTextContent();
              pageWords = tc.items.flatMap((item: any) => extractPageWords(item, pdfPage.getViewport({ scale: 1.5 }), canon, canonIndex));
              pageWordsRef.current[i - 1] = pageWords;
            }

            if (pageWords && pageWords.length > 0) {
              const textLayer = document.createElement("div");
              textLayer.className = "pdf-text-layer absolute inset-0 w-full h-full pointer-events-none";
              
              pageWords.forEach((word: WordToken) => {
                const span = document.createElement("span");
                span.className = "pdf-word absolute bg-yellow-400/0 transition-colors duration-200 cursor-pointer pointer-events-auto rounded";
                span.style.left = `${word.xPct * 100}%`;
                span.style.top = `${word.yPct * 100}%`;
                span.style.width = `${word.wPct * 100}%`;
                span.style.height = `${word.hPct * 100}%`;
                span.dataset.idx = word.globalIdx.toString();
                
                span.onclick = () => {
                  if (tts) {
                    lastActiveRef.current = word.globalIdx;
                    tts.speakFromWord(extractedText, word.globalIdx);
                  }
                };

                textLayer.appendChild(span);
                activeWordRefs.current[word.globalIdx] = span;
              });
              
              page.appendChild(textLayer);
            }

          } catch (e) {
            console.error("Critical error on page", i, e);
          }
        };

        const initialPages = async () => {
          for (const p of [1, 2, 3, 4]) {
            await renderPage(p);
          }
        };
        initialPages();

        pf.on("flip", async (e: any) => {
          setCurrentPage(e.data);
          const p = e.data + 1;
          for (const pageNum of [p, p + 1, p + 2, p + 3, p - 1, p - 2]) {
            await renderPage(pageNum);
          }
          // Cleanup distant canvases to prevent browser canvas memory limit crashes (black screen)
          for (let i = 1; i <= total; i++) {
            if (i < p - 4 || i > p + 4) {
              if (rendered.has(i)) {
                rendered.delete(i);
                pageElements[i - 1].innerHTML = `<div class="w-8 h-8 border-4 border-gray-200 border-t-indigo-500 rounded-full animate-spin"></div>`;
              }
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
      if (pollInterval) clearInterval(pollInterval);
      if (pageFlipRef.current) {
        pageFlipRef.current.destroy();
        pageFlipRef.current = null;
      }
    };
  }, [extractedText]);

  useEffect(() => {
    Object.values(activeWordRefs.current).forEach(el => {
      if (el) el.classList.remove('bg-yellow-400/40', 'ring-2', 'ring-yellow-400/50');
    });
    
    if (activeWordIdx >= 0 && activeWordRefs.current[activeWordIdx]) {
      const el = activeWordRefs.current[activeWordIdx];
      if (el) el.classList.add('bg-yellow-400/40', 'ring-2', 'ring-yellow-400/50');
    }
  }, [activeWordIdx]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!pageFlipRef.current) return;
      const pf = pageFlipRef.current;
      const current = pf.getCurrentPageIndex();
      
      if (e.key === "ArrowRight" && current < totalPages - 1) {
        e.preventDefault();
        pf.flipNext("bottom");
      }
      if (e.key === "ArrowLeft" && current > 0) {
        e.preventDefault();
        pf.flipPrev("top");
      }
    };
    
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [totalPages]);

  const handleFirst = () => pageFlipRef.current?.turnToPage(0);
  const handleLast = () => pageFlipRef.current?.turnToPage(totalPages - 1);
  const handlePrev = () => {
    if (pageFlipRef.current && pageFlipRef.current.getCurrentPageIndex() > 0) {
      pageFlipRef.current.flipPrev("top");
    }
  };
  const handleNext = () => {
    if (pageFlipRef.current && pageFlipRef.current.getCurrentPageIndex() < totalPages - 1) {
      pageFlipRef.current.flipNext("bottom");
    }
  };

  return (
    <>
      {isLoading && <LoadingOverlay text={loadingText} error={error} />}
      <Header status={statusStr} onToggleReader={onToggleReader} readerMode={readerMode} />
      
      {readerMode && tts && (
        <div className="w-full h-[4px] bg-white/5 cursor-pointer group flex-shrink-0 relative z-10 shadow-[0_2px_15px_rgba(0,0,0,0.8)]" onClick={e => {
          const r = e.currentTarget.getBoundingClientRect();
          tts.seek(Math.round(((e.clientX - r.left) / r.width) * 100));
        }}>
          <div className="h-full bg-indigo-500 group-hover:bg-indigo-400 transition-[width] duration-300 ease-linear" style={{ width: `${tts.progress}%` }} />
        </div>
      )}

      <div className="flex-1 flex overflow-hidden w-full h-full">
        <div className="flex-1 flex flex-col relative bg-black h-full">
          <div className="flex-1 w-full flex items-center justify-center overflow-hidden pt-6 pb-6">
            <div 
              ref={containerRef} 
              className="relative w-[92vw] max-w-[1250px] h-[88vh] max-h-[900px] max-[700px]:w-[96vw] max-[700px]:h-[82vh]" 
            />
          </div>
          <Controls
            pageInfo={pageInfo}
            onFirst={handleFirst}
            onPrev={handlePrev}
            onNext={handleNext}
            onLast={handleLast}
            prevDisabled={prevDisabled}
            nextDisabled={nextDisabled}
          />
        </div>
        
        {readerMode && tts && (
          <ReaderSidebar
            tts={tts}
            textToSpeak={extractedText || ""}
          />
        )}
      </div>
    </>
  );
}
