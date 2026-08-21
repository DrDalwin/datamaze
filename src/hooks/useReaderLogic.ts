import { useState, useEffect, useRef, useCallback, useMemo } from "react";

interface Word { text: string; index: number; isWhitespace: boolean; }
type SegType = "heading1" | "heading2" | "heading3" | "p" | "code" | "blockquote" | "blank";
interface Segment { words: Word[]; type: SegType; }
interface WordOffset { index: number; charStart: number; text: string; }

const norm = (s: string) => s.replace(/^[^a-zA-Z0-9\u0080-\uFFFF]+|[^a-zA-Z0-9\u0080-\uFFFF]+$/g, "").toLowerCase();

// prefix -> segment type. order matters (### before ##).
const PREFIX_RULES: { type: SegType; re: RegExp }[] = [
  { type: "heading3", re: /^(\s*)###\s/ },
  { type: "heading2", re: /^(\s*)##\s/ },
  { type: "heading1", re: /^(\s*)#\s/ },
  { type: "blockquote", re: /^(\s*)>\s/ },
  { type: "p", re: /^(\s*)[-*+]\s/ },
  { type: "p", re: /^(\s*)\d+\.\s/ },
];

function classifyLine(line: string, trimmed: string): { type: SegType; content: string; offset: number } {
  if (/^```/.test(trimmed)) return { type: "code", content: line, offset: 0 };
  for (const { type, re } of PREFIX_RULES) {
    if (re.test(trimmed)) {
      const content = line.replace(re, "$1");
      return { type, content, offset: line.length - content.length };
    }
  }
  return { type: "p", content: line, offset: 0 };
}

function tokenizeLine(content: string, charStart: number, wordIndex: number, wordOffsets: WordOffset[]): Word[] {
  const words: Word[] = [];
  let cursor = charStart;
  for (const tok of content.split(/(\s+)/)) {
    if (!tok) continue;
    const isWS = /^\s+$/.test(tok);
    words.push({ text: tok, index: isWS ? -1 : wordIndex, isWhitespace: isWS });
    if (!isWS) wordOffsets.push({ index: wordIndex++, charStart: cursor, text: tok });
    cursor += tok.length;
  }
  return words;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function useReaderLogic(sourceText: string, tts: any, onClose: () => void) {
  const [activeWordIdx, setActiveWordIdx] = useState(-1);
  const [userScrolled, setUserScrolled] = useState(false);
  const [showScrollBtn, setShowScrollBtn] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const activeWordRef = useRef<HTMLSpanElement | null>(null);
  const scrollTORef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastActiveRef = useRef(-1);
  const initialScrollDone = useRef(false);

  const resetScrollState = useCallback(() => { setUserScrolled(false); setShowScrollBtn(false); }, []);

// parse text into segments and words
  const { cleanText, segments, wordOffsets } = useMemo(() => {
    const cleanLines: string[] = [], segments: Segment[] = [], wordOffsets: WordOffset[] = [];
    let cleanLen = 0, wordIndex = 0;
    for (const line of sourceText.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed) { segments.push({ words: [], type: "blank" }); cleanLines.push(""); cleanLen += 1; continue; }
      const { type, content } = classifyLine(line, trimmed);
      cleanLines.push(content);
      const words = tokenizeLine(content, cleanLen, wordIndex, wordOffsets);
      wordIndex += words.filter(w => !w.isWhitespace).length;
      segments.push({ words, type });
      cleanLen += content.length + 1;
    }
    return { cleanText: cleanLines.join("\n"), segments, wordOffsets };
  }, [sourceText]);

  // track active word based on TTS
  useEffect(() => {
    if (tts.status !== "playing" || !tts.currentWord || !wordOffsets.length) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (tts.status !== "playing") { setActiveWordIdx(-1); lastActiveRef.current = -1; }
      return;
    }
    const needle = norm(tts.currentWord);
    if (!needle) return;

    const startIdx = Math.max(0, lastActiveRef.current);
    const matchInRange = (from: number, to: number) => {
      for (let i = Math.max(0, from); i <= Math.min(wordOffsets.length - 1, to); i++) {
        if (norm(wordOffsets[i].text) === needle) return i;
      }
      return -1;
    };

    let found = matchInRange(startIdx, startIdx + 8);
    if (found === -1) found = matchInRange(startIdx - 4, startIdx - 1);

    // fallback using charIndex if completely lost (e.g. user clicked seek)
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

  // scroll active word into view
  useEffect(() => {
    if (!activeWordRef.current || userScrolled || !containerRef.current) return;
    const elRect = activeWordRef.current.getBoundingClientRect();
    const cRect = containerRef.current.getBoundingClientRect();
    const elCenter = elRect.top + elRect.height / 2;
    const cCenter = cRect.top + cRect.height / 2;

    if (!initialScrollDone.current) {
      activeWordRef.current.scrollIntoView({ behavior: "instant", block: "center" });
      initialScrollDone.current = true;
    } else if (Math.abs(elCenter - cCenter) > cRect.height * 0.25) {
      activeWordRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [activeWordIdx, userScrolled]);

  // detect user scroll
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onUserScroll = () => {
      if (tts.status !== "playing") return;
      setUserScrolled(true);
      setShowScrollBtn(true);
      if (scrollTORef.current) clearTimeout(scrollTORef.current);
      scrollTORef.current = setTimeout(() => setShowScrollBtn(false), 5000);
    };
    el.addEventListener("wheel", onUserScroll, { passive: true });
    el.addEventListener("touchmove", onUserScroll, { passive: true });
    return () => {
      el.removeEventListener("wheel", onUserScroll);
      el.removeEventListener("touchmove", onUserScroll);
    };
  }, [tts.status]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (tts.status !== "playing") resetScrollState();
  }, [tts.status, resetScrollState]);

  const resumeAutoScroll = useCallback(() => {
    resetScrollState();
    activeWordRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [resetScrollState]);

  const handleWordClick = useCallback((idx: number) => {
    if (idx < 0) return;
    lastActiveRef.current = idx;
    tts.speakFromWord(cleanText, idx);
    resetScrollState();
  }, [tts, cleanText, resetScrollState]);

  // keyboard shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === "INPUT" || tag === "SELECT" || tag === "TEXTAREA") return;
      if (e.key === "Escape") return onClose();
      if (e.key === " ") {
        e.preventDefault();
        if (tts.status === "playing") tts.pause();
        else if (tts.status === "paused") tts.resume();
        else tts.speak(cleanText);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [tts, cleanText, onClose]);

  return { cleanText, segments, activeWordIdx, showScrollBtn, containerRef, activeWordRef, resumeAutoScroll, handleWordClick };
}