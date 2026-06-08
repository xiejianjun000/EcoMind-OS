import { useState, useRef, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Mic, MicOff } from "lucide-react"

interface VoiceInputButtonProps {
  onResult: (text: string) => void
  disabled?: boolean
}

export function VoiceInputButton({ onResult, disabled }: VoiceInputButtonProps) {
  const [isListening, setIsListening] = useState(false)
  const [isSupported] = useState(() =>
    typeof window !== 'undefined' &&
    ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window)
  )
  const recognitionRef = useRef<any>(null)

  const startListening = useCallback(() => {
    if (!isSupported) return
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    const rec = new SpeechRecognition()
    rec.lang = 'zh-CN'
    rec.interimResults = false
    rec.maxAlternatives = 1

    rec.onresult = (event: any) => {
      const text = event.results[0][0].transcript
      onResult(text)
    }
    rec.onerror = () => setIsListening(false)
    rec.onend = () => setIsListening(false)

    recognitionRef.current = rec
    rec.start()
    setIsListening(true)
  }, [isSupported, onResult])

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop()
      setIsListening(false)
    }
  }, [])

  if (!isSupported) return null

  return (
    <Button
      variant={isListening ? "destructive" : "outline"}
      size="icon"
      disabled={disabled}
      onMouseDown={startListening}
      onMouseUp={stopListening}
      onMouseLeave={() => isListening && stopListening()}
      title={isListening ? "松开停止录音" : "按住录音"}
      className={isListening ? "animate-pulse" : ""}
    >
      {isListening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
    </Button>
  )
}

// ─── TTS 语音播报（后端 Edge 神经网络 + 浏览器回退）─────────────

export interface BroadcasterConfig {
  voice?: string
  contentType?: string
  onStart?: () => void
  onEnd?: () => void
  onError?: (err: Error) => void
}

let _currentAudio: HTMLAudioElement | null = null
let _isSpeaking = false

export function getIsSpeaking(): boolean {
  return _isSpeaking
}

export async function speakText(
  text: string,
  config?: BroadcasterConfig
): Promise<void> {
  if (typeof window === 'undefined') return

  stopSpeaking()
  _isSpeaking = true

  const cleanText = text
    .replace(/\*\*/g, '')
    .replace(/#{1,6}\s*/g, '')
    .replace(/`[^`]+`/g, '')
    .replace(/\|.*?\|/g, '')
    .trim()

  if (!cleanText) {
    _isSpeaking = false
    return
  }

  const contentType = config?.contentType ?? detectContentType(text)
  const voice = config?.voice

  try {
    config?.onStart?.()

    const res = await fetch('/api/media/broadcast', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: cleanText,
        content_type: contentType,
        ...(voice ? { voice } : {}),
      }),
    })

    if (!res.ok) {
      throw new Error(`播报服务返回 ${res.status}`)
    }

    const blob = await res.blob()
    if (blob.size === 0) throw new Error('音频数据为空')

    const url = URL.createObjectURL(blob)
    const audio = new Audio(url)
    _currentAudio = audio

    audio.onended = () => {
      cleanup(url)
      _isSpeaking = false
      config?.onEnd?.()
    }

    audio.onerror = () => {
      cleanup(url)
      _isSpeaking = false
      config?.onError?.(new Error('音频播放失败'))
    }

    await audio.play()
  } catch (err) {
    _isSpeaking = false
    console.warn('后端播报不可用，使用浏览器 TTS:', err)
    fallbackBrowserTTS(cleanText, config)
  }
}

function cleanup(url: string) {
  URL.revokeObjectURL(url)
  if (_currentAudio) {
    _currentAudio.pause()
    _currentAudio.src = ''
    _currentAudio = null
  }
}

export function stopSpeaking() {
  _isSpeaking = false

  if (_currentAudio) {
    _currentAudio.pause()
    _currentAudio.src = ''
    _currentAudio = null
  }

  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    window.speechSynthesis.cancel()
  }
}

function detectContentType(text: string): string {
  if (/AQI|空气质量|PM2\.5|PM10|监测数据|首要污染物/.test(text)) return 'monitoring_daily'
  if (/处罚|违法|执法|罚款|责令|整改/.test(text)) return 'enforcement_decision'
  if (/应急|泄漏|爆炸|事故|疏散/.test(text)) return 'emergency_plan'
  return 'general'
}

let _cachedZhVoice: SpeechSynthesisVoice | null = null
let _voicesLoaded = false

function getChineseVoice(): SpeechSynthesisVoice | null {
  if (_cachedZhVoice) return _cachedZhVoice

  const voices = window.speechSynthesis.getVoices()
  const zhVoice = voices.find(v =>
    v.lang.startsWith('zh') &&
    (v.localService || v.name.includes('Chinese') || v.name.includes('Tingting') || v.name.includes('Xiaoxiao'))
  ) || voices.find(v => v.lang.startsWith('zh'))

  if (zhVoice) _cachedZhVoice = zhVoice
  return zhVoice
}

function fallbackBrowserTTS(text: string, config?: BroadcasterConfig) {
  if (!('speechSynthesis' in window)) {
    config?.onError?.(new Error('浏览器不支持语音播报'))
    return
  }

  window.speechSynthesis.cancel()

  const zhVoice = getChineseVoice()

  const utterance = new SpeechSynthesisUtterance(text)
  utterance.lang = 'zh-CN'
  utterance.rate = 0.95
  utterance.pitch = 1.05
  utterance.volume = 1.0

  if (zhVoice) {
    utterance.voice = zhVoice
  }

  utterance.onstart = () => { _isSpeaking = true }
  utterance.onend = () => {
    _isSpeaking = false
    config?.onEnd?.()
  }
  utterance.onerror = () => {
    _isSpeaking = false
    config?.onError?.(new Error('TTS 播放出错'))
  }

  window.speechSynthesis.speak(utterance)
}

if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
  const loadVoices = () => {
    const voices = window.speechSynthesis.getVoices()
    if (voices.length > 0) {
      _voicesLoaded = true
      getChineseVoice()
    }
  }
  loadVoices()
  window.speechSynthesis.onvoiceschanged = loadVoices
}
