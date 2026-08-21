import { useState, useCallback, useRef, useEffect } from 'react';

export type TTSStatus = 'idle' | 'preparing' | 'playing' | 'paused' | 'done' | 'error';
export interface TTSVoice { name: string; lang: string; voiceURI: string; }

const ttsState = { currentUtterance: null as SpeechSynthesisUtterance | null };
const hasTTS = () => typeof window !== 'undefined' && 'speechSynthesis' in window;
const cancelSpeech = () => { window.speechSynthesis.cancel(); ttsState.currentUtterance = null; };

// detect language using lightweight stopword heuristic
const LANG_STOPWORDS: [string, RegExp][] = [
  ['en', /\b(the|is|in|and|of|to|a)\b/g],
  ['es', /\b(el|la|en|y|de|que|los)\b/g],
  ['fr', /\b(le|la|en|et|de|qui|les)\b/g],
  ['de', /\b(der|die|das|und|in|zu)\b/g],
  ['it', /\b(il|la|in|e|di|che|le)\b/g],
];
function detectLanguage(text: string): string {
  const sample = text.slice(0, 1000).toLowerCase();
  let best = 'en', max = 0;
  for (const [lang, re] of LANG_STOPWORDS) {
    const score = (sample.match(re) || []).length;
    if (score > max) { max = score; best = lang; }
  }
  return best;
}

// split text without losing any whitespace or punctuation, ensuring charIndex mapping is 100% exact.
function chunkText(text: string, maxWords = 35): string[] {
  const chunks: string[] = [];
  let chunkStart = 0, wordCount = 0, lastBoundary = 0;
  const wordRegex = /\S+\s*/g;
  let match;
  while ((match = wordRegex.exec(text)) !== null) {
    wordCount++;
    if (/[.!?\n]\s*$/.test(match[0])) lastBoundary = wordRegex.lastIndex;
    if (wordCount >= maxWords) {
      if (lastBoundary > chunkStart) {
        chunks.push(text.slice(chunkStart, lastBoundary));
        chunkStart = lastBoundary; wordRegex.lastIndex = chunkStart;
      } else {
        chunks.push(text.slice(chunkStart, wordRegex.lastIndex));
        chunkStart = wordRegex.lastIndex;
      }
      wordCount = 0; lastBoundary = chunkStart;
    }
  }
  if (chunkStart < text.length) chunks.push(text.slice(chunkStart));
  return chunks.filter(Boolean);
}

// cumulative char offset of each chunk plus total length
function computeChunkOffsets(chunks: string[]): { offsets: number[]; total: number } {
  const offsets: number[] = [];
  let total = 0;
  for (const c of chunks) { offsets.push(total); total += c.length; }
  return { offsets, total: total || 1 };
}

// index of the char where the Nth whitespace-delimited word starts
function charOffsetOfWord(text: string, wordIndex: number): number {
  let match, wi = 0;
  const wordRegex = /\S+/g;
  while ((match = wordRegex.exec(text)) !== null) { if (wi === wordIndex) return match.index; wi++; }
  return 0;
}

export function useTTS() {
  const [isSupported] = useState(hasTTS);
  const [status, setStatus] = useState<TTSStatus>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const [voices, setVoices] = useState<TTSVoice[]>([]);
  const [selectedVoiceURI, _setSelectedVoiceURI] = useState('');
  const [rate, _setRate] = useState(1.15), [pitch, _setPitch] = useState(0.7); // reading speed
  const [progress, setProgress] = useState(0);
  const [currentWord, setCurrentWord] = useState('');
  const [charIndex, setCharIndex] = useState(0);

  const defaultVoiceSetRef = useRef(false), chunksRef = useRef<string[]>([]), chunkOffsetsRef = useRef<number[]>([]), chunkTotalLenRef = useRef(1);
  const globalOffsetRef = useRef(0), chunkIndexRef = useRef(0), stoppedRef = useRef(false), rateRef = useRef(1.15), pitchRef = useRef(0.7);
  const voiceURIRef = useRef('');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const wakeLockRef = useRef<any>(null), silentAudioRef = useRef<HTMLAudioElement | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const restartTimeoutRef = useRef<any>(null), currentCharIndexRef = useRef(0);
  const progressBaseRef = useRef(0), progressScaleRef = useRef(1);

  useEffect(() => {
    // Removed silent audio hack
  }, []);

  const releaseWakeLock = useCallback(async () => {
    if (wakeLockRef.current) { try { await wakeLockRef.current.release(); } catch {} wakeLockRef.current = null; }
  }, []);
  const requestWakeLock = useCallback(async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (!wakeLockRef.current && typeof navigator !== 'undefined' && 'wakeLock' in navigator) { try { wakeLockRef.current = await (navigator as any).wakeLock.request('screen'); } catch {} }
  }, []);

  // play next part
  const speakChunk = useCallback(function speakChunk(index: number, offset: number = 0) {
    if (stoppedRef.current) return;
    const chunks = chunksRef.current;
    if (index >= chunks.length) {
      setStatus('done'); setProgress(100); setCurrentWord(''); ttsState.currentUtterance = null; releaseWakeLock(); return;
    }
    const originalText = chunks[index], text = originalText.substring(offset), utterance = new SpeechSynthesisUtterance(text);
    ttsState.currentUtterance = utterance; utterance.rate = rateRef.current; utterance.pitch = pitchRef.current; utterance.volume = 1.0;
    if (voiceURIRef.current) {
      const match = window.speechSynthesis.getVoices().find(v => v.voiceURI === voiceURIRef.current);
      if (match) utterance.voice = match;
    }
    utterance.onstart = () => {
      if (!stoppedRef.current) {
        setStatus('playing');
        chunkIndexRef.current = index; // track current chunk for resume-after-pause
      }
    };
    utterance.onboundary = (e) => {
      if (stoppedRef.current) return;
      if (e.name === 'word') {
        const trueCharIndex = e.charIndex + offset; currentCharIndexRef.current = trueCharIndex;
        const charsBefore = chunkOffsetsRef.current[index] || 0;
        setCharIndex(globalOffsetRef.current + charsBefore + trueCharIndex);
        setProgress(Math.min(100, Math.max(0, (progressBaseRef.current + ((charsBefore + trueCharIndex) / Math.max(1, chunkTotalLenRef.current)) * progressScaleRef.current) * 100)));
        const match = originalText.substring(trueCharIndex).match(/^[^\s.,!?]+/);
        if (match) setCurrentWord(match[0]);
      }
    };
    utterance.onend = () => {
      if (stoppedRef.current) return;
      setProgress(Math.min(100, Math.max(0, (progressBaseRef.current + ((index + 1) / chunks.length) * progressScaleRef.current) * 100)));
      currentCharIndexRef.current = 0; setCharIndex(0); setTimeout(() => speakChunk(index + 1, 0), 30);
    };
    utterance.onerror = (e) => {
      if (stoppedRef.current || e.error === 'interrupted' || e.error === 'canceled') return;
      setStatus('error'); setErrorMsg(`Speech error: ${e.error}. Try a shorter document or a different browser.`); ttsState.currentUtterance = null; releaseWakeLock();
    };
    requestWakeLock(); window.speechSynthesis.speak(utterance);
  }, [requestWakeLock, releaseWakeLock]);

  const pause = useCallback(() => {
    if (!hasTTS()) return;
    // Use robust cancel instead of buggy window.speechSynthesis.pause()
    stoppedRef.current = true; 
    cancelSpeech(); 
    setStatus('paused'); 
    releaseWakeLock();
  }, [releaseWakeLock]);

  const resume = useCallback(() => {
    if (!hasTTS()) return;
    stoppedRef.current = false;
    setStatus('playing'); 
    requestWakeLock();
    // Re-create a fresh utterance perfectly starting from the exact character offset we left off at
    speakChunk(chunkIndexRef.current, currentCharIndexRef.current);
  }, [speakChunk, requestWakeLock]);

  const stop = useCallback(() => {
    if (!hasTTS()) return;
    stoppedRef.current = true; cancelSpeech();
    setStatus('idle'); setProgress(0); setCurrentWord(''); chunkIndexRef.current = 0; currentCharIndexRef.current = 0; setCharIndex(0); releaseWakeLock();
  }, [releaseWakeLock]);

  // shared setup for speak/speakFromWord: cancel current speech, mark preparing, run prepFn after a short delay
  const beginSpeaking = useCallback((prepFn: () => void) => {
    stoppedRef.current = true; cancelSpeech();
    setStatus('preparing'); setErrorMsg('');
    setTimeout(() => { stoppedRef.current = false; prepFn(); }, 100);
  }, []);

  const applySettingChange = useCallback(() => {
    if (status === 'playing') {
      cancelSpeech(); stoppedRef.current = false;
      if (restartTimeoutRef.current) clearTimeout(restartTimeoutRef.current);
      restartTimeoutRef.current = setTimeout(() => speakChunk(chunkIndexRef.current, currentCharIndexRef.current), 150);
    }
  }, [status, speakChunk]);

  const setRate = useCallback((newRate: number) => { _setRate(newRate); rateRef.current = newRate; applySettingChange(); }, [applySettingChange]);
  const setPitch = useCallback((newPitch: number) => { _setPitch(newPitch); pitchRef.current = newPitch; applySettingChange(); }, [applySettingChange]);
  const setSelectedVoiceURI = useCallback((newURI: string) => { _setSelectedVoiceURI(newURI); voiceURIRef.current = newURI; applySettingChange(); }, [applySettingChange]);

  const speak = useCallback((text: string) => {
    if (!hasTTS()) return (setStatus('error'), setErrorMsg('Not supported.'));
    if (!text.trim()) return;
    setProgress(0); progressBaseRef.current = 0; progressScaleRef.current = 1; globalOffsetRef.current = 0;
    beginSpeaking(() => {
      const lang = detectLanguage(text);
      if (voices.length > 0) {
        const match = voices.find(v => v.lang.toLowerCase().startsWith(lang));
        if (match && !selectedVoiceURI.includes(match.voiceURI)) { setSelectedVoiceURI(match.voiceURI); voiceURIRef.current = match.voiceURI; }
      }
      const chunks = chunkText(text, 35);
      chunksRef.current = chunks;
      const { offsets, total } = computeChunkOffsets(chunks);
      chunkOffsetsRef.current = offsets;        // was missing — caused progress to stay at 0
      chunkTotalLenRef.current = total;         // was missing — caused progress calc to divide by 1
      chunkIndexRef.current = 0;
      speakChunk(0);
    });
  }, [voices, selectedVoiceURI, speakChunk, beginSpeaking, setSelectedVoiceURI]);

  // speak starting from a specific word index in the original text
  const speakFromWord = useCallback((text: string, wordIndex: number) => {
    if (!hasTTS() || !text.trim()) return;
    const charOffset = charOffsetOfWord(text, wordIndex);
    const sliced = text.slice(charOffset);
    progressBaseRef.current = charOffset / (text.length || 1); progressScaleRef.current = sliced.length / (text.length || 1); globalOffsetRef.current = charOffset;
    setProgress(progressBaseRef.current * 100);
    beginSpeaking(() => {
      const chunks = chunkText(sliced, 35); chunksRef.current = chunks;
      const { offsets, total } = computeChunkOffsets(chunks);
      chunkOffsetsRef.current = offsets; chunkTotalLenRef.current = total; chunkIndexRef.current = 0; speakChunk(0);
    });
  }, [speakChunk, beginSpeaking]);

  const seek = useCallback((pct: number) => {
    if (!chunksRef.current.length) return;
    const targetIndex = Math.max(0, Math.min(chunksRef.current.length - 1, Math.floor((pct / 100) * chunksRef.current.length)));
    chunkIndexRef.current = targetIndex; setProgress(pct);
    if (status === 'playing' || status === 'paused') {
      if (restartTimeoutRef.current) clearTimeout(restartTimeoutRef.current);
      restartTimeoutRef.current = setTimeout(() => { cancelSpeech(); stoppedRef.current = false; setTimeout(() => speakChunk(targetIndex), 50); }, 400); // wait for slider stop
    }
  }, [status, speakChunk]);

  // load voices
  useEffect(() => {
    if (!hasTTS()) return setErrorMsg('Speech Synthesis not supported in this browser.');
    const loadVoices = () => {
      const v = window.speechSynthesis.getVoices();
      if (v.length > 0) {
        setVoices(v.map(voice => ({ name: voice.name, lang: voice.lang, voiceURI: voice.voiceURI })));
        if (!defaultVoiceSetRef.current) {
          const engVoice = v.find(voice => voice.lang.startsWith("en-US") || voice.lang.startsWith("en")) || v.find(voice => voice.default) || v[0];
          setSelectedVoiceURI(engVoice.voiceURI); voiceURIRef.current = engVoice.voiceURI; defaultVoiceSetRef.current = true;
        }
      }
    };
    loadVoices(); window.speechSynthesis.onvoiceschanged = loadVoices;
  }, [setSelectedVoiceURI]);

  // ensure TTS stopped and wakelock released on unmount
  useEffect(() => { return () => { if (hasTTS()) window.speechSynthesis.cancel(); releaseWakeLock(); }; }, [releaseWakeLock]);

  // handle external pauses
  useEffect(() => { if (status === 'playing' && hasTTS() && window.speechSynthesis.paused) { setStatus('paused'); stoppedRef.current = true; } }, [status, speakChunk]);

  return { isSupported, status, errorMsg, voices, selectedVoiceURI, setSelectedVoiceURI, rate, setRate, pitch, setPitch, progress, currentWord, charIndex, speak, speakFromWord, pause, resume, stop, seek };
}