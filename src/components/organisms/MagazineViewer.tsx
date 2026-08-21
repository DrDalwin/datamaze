"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { PageFlip } from "page-flip";

import { Header } from "../molecules/Header";
import { Controls } from "../molecules/Controls";
import { LoadingOverlay } from "../atoms/LoadingOverlay";

declare global {
  interface Window {
    pdfjsLib: any;
  }
}

const PDF_FILE = "./datamaze.pdf";
const PAGE_WIDTH = 595;
const PAGE_HEIGHT = 842;

export function MagazineViewer({ onToggleReader }: { onToggleReader?: () => void }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const pageFlipRef = useRef<PageFlip | null>(null);

  const [loadingText, setLoadingText] = useState("Connecting to magazine...");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const [currentPage, setCurrentPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);

  const pageInfo = currentPage === 0 ? "Cover" : (currentPage + 1 <= totalPages ? `Pages ${currentPage} – ${currentPage + 1}` : `Page ${currentPage}`);
  const statusStr = isLoading ? "Preparing..." : (currentPage === 0 ? "Ready" : `Page ${currentPage} / ${totalPages}`);
  const prevDisabled = currentPage <= 0;
  const nextDisabled = currentPage >= totalPages - 1;

  useEffect(() => {
    let isCancelled = false;
    let pollInterval: any;

    async function init() {
      try {
        setLoadingText("Downloading magazine...");
        const response = await fetch(PDF_FILE, { cache: "no-cache" });
        if (!response.ok) {
          throw new Error(`PDF download failed.<br><br>HTTP Status: ${response.status}<br><br>Requested file:<br>${PDF_FILE}`);
        }

        const pdfData = await response.arrayBuffer();
        if (pdfData.byteLength < 100) {
          throw new Error(`The file downloaded is too small.<br><br>Size: ${pdfData.byteLength} bytes`);
        }

        const headerBytes = new Uint8Array(pdfData.slice(0, 5));
        const header = new TextDecoder().decode(headerBytes);
        if (header !== "%PDF-") {
          throw new Error(`Invalid PDF header: <b>${header.replace(/</g, "&lt;")}</b>`);
        }

        setLoadingText("Waiting for PDF engine...");
        
        // Wait for pdfjsLib to be loaded from CDN
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
        const pdf = await window.pdfjsLib.getDocument({ data: pdfData }).promise;
        const total = pdf.numPages;
        if (total < 1) throw new Error("The PDF contains no pages.");

        setTotalPages(total);
        if (isCancelled) return;

        const pageElements: HTMLElement[] = [];

        for (let i = 1; i <= total; i++) {
          const page = document.createElement("div");
          page.className = "magazine-page relative w-full h-full bg-white overflow-hidden shadow-[inset_0_0_15px_rgba(0,0,0,.14)] flex items-center justify-center";
          // Optional loading spinner for blank pages
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
          usePortrait: false,
          showCover: true,
          drawShadow: true,
          maxShadowOpacity: 0.55,
          flippingTime: 900,
          useMouseEvents: true,
          mobileScrollSupport: false,
          disableFlipByClick: false,
          startPage: 0,
          autoSize: true,
        });

        pf.loadFromHTML(pageElements);
        pageFlipRef.current = pf;
        
        setIsLoading(false); // Book visible instantly!

        const rendered = new Set<number>();
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
            if (context) await pdfPage.render({ canvasContext: context, viewport }).promise;
            page.innerHTML = ""; // remove spinner
            page.appendChild(canvas);
          } catch (e) {
            rendered.delete(i);
          }
        };

        // Initially render first few pages
        [1, 2, 3, 4].forEach(renderPage);

        pf.on("flip", (e: any) => {
          setCurrentPage(e.data);
          // Render current page + next two + previous
          const p = e.data + 1; // pageFlip is 0-indexed, pdf is 1-indexed
          [p, p + 1, p + 2, p + 3, p - 1, p - 2].forEach(renderPage);
        });
        pf.on("changeState", () => setCurrentPage(pf.getCurrentPageIndex()));
        setCurrentPage(0);

      } catch (err: any) {
        if (!isCancelled) {
          setError(err.message || "An error occurred.");
        }
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
  }, []);

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
      <Header status={statusStr} onToggleReader={onToggleReader} />
      <div className="w-full h-[calc(100vh-118px)] max-[700px]:h-[calc(100vh-110px)] flex items-center justify-center overflow-hidden">
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
    </>
  );
}
