'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { Mic, MicOff, Bot, X, Loader2, Send } from 'lucide-react'
import Image from 'next/image'

const SiriStyleAICFO = ({
  userId = 'current-user-id',
  context = {}
}) => {
  const [isListening, setIsListening] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [transcript, setTranscript] = useState('')
  const [response, setResponse] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [isRecognitionSupported, setIsRecognitionSupported] = useState(false)
  const [manualQuery, setManualQuery] = useState('')
  const [errorMessage, setErrorMessage] = useState('')
  const [isHolding, setIsHolding] = useState(false)

  const buttonRef = useRef(null)
  const holdStartTime = useRef(null)
  const holdTimerRef = useRef(null)
  const recognitionRef = useRef(null)
  const transcriptRef = useRef('')
  const isProcessingRef = useRef(false)
  const shouldProcessRef = useRef(false)
  const processVoiceQueryRef = useRef(() => {})

  useEffect(() => {
    transcriptRef.current = transcript
  }, [transcript])

  useEffect(() => {
    isProcessingRef.current = isProcessing
  }, [isProcessing])

  const processVoiceQuery = useCallback(async (query) => {
    if (!query.trim()) return

    setIsProcessing(true)
    setErrorMessage('')

    try {
      const response = await fetch('/api/ai-chat-mobile', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: query,
          userId,
          context: {
            platform: 'web-floating-siri',
            requestType: 'voice_query',
            ...context
          }
        })
      })

      if (!response.ok) {
        throw new Error('AI request failed')
      }

      const data = await response.json()
      setResponse(data.response)
      shouldProcessRef.current = false

      // Optional: Text-to-speech response
      if ('speechSynthesis' in window) {
        const utterance = new SpeechSynthesisUtterance(data.response)
        utterance.rate = 0.9
        utterance.pitch = 1
        speechSynthesis.speak(utterance)
      }

    } catch (error) {
      console.error('AI query error:', error)
      setResponse("I'm having trouble processing that request. Please try again.")
      setErrorMessage('There was an issue connecting to the AI assistant. Please try again in a moment.')
    } finally {
      setIsProcessing(false)
    }
  }, [context, userId])

  useEffect(() => {
    processVoiceQueryRef.current = processVoiceQuery
  }, [processVoiceQuery])

  // Initialize speech recognition
  useEffect(() => {
    if (typeof window === 'undefined') return

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition

    if (!SpeechRecognition) {
      setIsRecognitionSupported(false)
      return
    }

    setIsRecognitionSupported(true)

    const recognitionInstance = new SpeechRecognition()
    recognitionInstance.continuous = true
    recognitionInstance.interimResults = true
    recognitionInstance.lang = 'en-US'

    recognitionInstance.onresult = (event) => {
      let finalTranscript = ''
      let interimTranscript = ''

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const resultTranscript = event.results[i][0].transcript
        if (event.results[i].isFinal) {
          finalTranscript += resultTranscript
        } else {
          interimTranscript += resultTranscript
        }
      }

      const trimmedFinal = finalTranscript.trim()
      const trimmedInterim = interimTranscript.trim()

      if (trimmedFinal) {
        shouldProcessRef.current = true
        transcriptRef.current = trimmedFinal
        setTranscript(trimmedFinal)
      } else if (trimmedInterim) {
        transcriptRef.current = trimmedInterim
        setTranscript(trimmedInterim)
      }
    }

    recognitionInstance.onerror = (event) => {
      console.error('Speech recognition error:', event.error)
      setErrorMessage(
        event.error === 'not-allowed'
          ? 'Microphone access was denied. Please enable permissions in your browser settings.'
          : 'We ran into a speech recognition error. Please try again.'
      )
      shouldProcessRef.current = false
      recognitionInstance.stop()
      setIsListening(false)
    }

    recognitionInstance.onend = () => {
      setIsListening(false)
      if (
        shouldProcessRef.current &&
        transcriptRef.current &&
        !isProcessingRef.current
      ) {
        shouldProcessRef.current = false
        processVoiceQueryRef.current(transcriptRef.current)
      }
    }

    recognitionRef.current = recognitionInstance

    return () => {
      recognitionInstance.onresult = null
      recognitionInstance.onerror = null
      recognitionInstance.onend = null
      recognitionInstance.stop()
      recognitionRef.current = null
    }
  }, [])

  // Start voice recognition
  const startListening = useCallback(async () => {
    const recognition = recognitionRef.current
    if (!recognition) {
      setShowModal(true)
      setErrorMessage('Voice recognition is not available in this browser, but you can still ask the AI CFO by typing below.')
      return
    }
    if (isListening) return

    try {
      if (typeof navigator !== 'undefined' && navigator.mediaDevices?.getUserMedia) {
        await navigator.mediaDevices.getUserMedia({ audio: true })
      }
      setShowModal(true)
      setIsListening(true)
      setTranscript('')
      setResponse('')
      setManualQuery('')
      setErrorMessage('')
      transcriptRef.current = ''
      shouldProcessRef.current = false
      recognition.start()
    } catch (err) {
      console.error('Microphone access denied:', err)
      setErrorMessage('Microphone access was denied. Please enable it to use voice commands.')
      setIsListening(false)
    }
  }, [isListening])

  // Stop voice recognition
  const stopListening = useCallback(() => {
    const recognition = recognitionRef.current
    if (recognition && isListening) {
      recognition.stop()
    }
  }, [isListening])

  // Handle quick tap (toggle modal)
  const handleQuickTap = useCallback(() => {
    if (!showModal) {
      setShowModal(true)
    } else {
      setShowModal(false)
      setTranscript('')
      setResponse('')
      setManualQuery('')
      setErrorMessage('')
      shouldProcessRef.current = false
      stopListening()
    }
  }, [showModal, stopListening])

  // Handle hold start (like Siri side button)
  const handleHoldStart = useCallback((e) => {
    e.preventDefault()
    holdStartTime.current = Date.now()
    setIsHolding(true)
    shouldProcessRef.current = false

    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      navigator.vibrate(50)
    }

    if (holdTimerRef.current) {
      clearTimeout(holdTimerRef.current)
    }

    holdTimerRef.current = setTimeout(() => {
      setErrorMessage('')
      startListening()
    }, 250)
  }, [startListening])

  // Handle hold end
  const handleHoldEnd = useCallback((e) => {
    e.preventDefault()
    setIsHolding(false)

    if (holdTimerRef.current) {
      clearTimeout(holdTimerRef.current)
      holdTimerRef.current = null
    }

    const holdDuration = Date.now() - (holdStartTime.current || 0)

    // If held for less than 250ms, treat as regular tap
    if (holdDuration < 250) {
      handleQuickTap()
    } else {
      // Stop listening and process
      stopListening()
    }
  }, [handleQuickTap, stopListening])

  const handleManualSubmit = useCallback(async (e) => {
    e.preventDefault()
    const query = manualQuery.trim()
    if (!query || isProcessing) return

    setTranscript(query)
    transcriptRef.current = query
    shouldProcessRef.current = false
    setManualQuery('')
    await processVoiceQuery(query)
  }, [isProcessing, manualQuery, processVoiceQuery])

  // Close modal
  const closeModal = useCallback(() => {
    setShowModal(false)
    setTranscript('')
    setResponse('')
    setManualQuery('')
    setErrorMessage('')
    shouldProcessRef.current = false
    stopListening()
  }, [stopListening])

  useEffect(() => {
    return () => {
      if (holdTimerRef.current) {
        clearTimeout(holdTimerRef.current)
      }
    }
  }, [])

  return (
    <>
      {/* Floating AI Button (Siri-style) */}
      <button
        ref={buttonRef}
        className={`fixed bottom-6 right-6 w-16 h-16 rounded-full shadow-2xl flex items-center justify-center z-50 transition-all duration-200 ${
          isHolding 
            ? 'bg-red-500 scale-110 shadow-red-500/50' 
            : isListening 
              ? 'bg-blue-600 animate-pulse' 
              : 'bg-gradient-to-r from-blue-500 to-blue-600 hover:scale-105'
        }`}
        onMouseDown={handleHoldStart}
        onMouseUp={handleHoldEnd}
        onTouchStart={handleHoldStart}
        onTouchEnd={handleHoldEnd}
        onTouchCancel={handleHoldEnd}
        onMouseLeave={handleHoldEnd} // Handle mouse leave
        style={{
          background: isHolding
            ? 'linear-gradient(45deg, #ef4444, #dc2626)'
            : isListening
              ? 'linear-gradient(45deg, #3b82f6, #1d4ed8)'
              : 'linear-gradient(45deg, #56B6E9, #3A9BD1)'
        }}
      >
        {isListening ? (
          <div className="flex items-center space-x-1">
            <div className="w-1 h-4 bg-white rounded-full animate-bounce"></div>
            <div className="w-1 h-6 bg-white rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
            <div className="w-1 h-4 bg-white rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
          </div>
        ) : (
          <Bot className="w-8 h-8 text-white" />
        )}
      </button>

      {/* Siri-style Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl w-full max-w-sm mx-auto shadow-2xl">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-blue-600 rounded-full flex items-center justify-center">
                  <Bot className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">AI CFO</h3>
                  <p className="text-sm text-gray-500">
                    {isListening ? 'Listening...' : isProcessing ? 'Thinking...' : 'Tap and hold to speak'}
                  </p>
                </div>
              </div>
              <button
                onClick={closeModal}
                className="p-2 rounded-full hover:bg-gray-100"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

              {/* Content */}
              <div className="p-6">
                {!isRecognitionSupported && (
                  <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700">
                    Voice recognition is not supported in this browser. You can still type a question below to talk to the AI CFO.
                  </div>
                )}

                {errorMessage && (
                  <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-600">
                    {errorMessage}
                  </div>
                )}

                {/* Voice Waveform Visual */}
                {isListening && (
                  <div className="flex items-center justify-center mb-6">
                    <div className="flex items-center space-x-1">
                      {[...Array(5)].map((_, i) => (
                      <div
                        key={i}
                        className="w-1 bg-blue-500 rounded-full animate-pulse"
                        style={{
                          height: `${20 + Math.random() * 30}px`,
                          animationDelay: `${i * 0.1}s`,
                          animationDuration: '0.5s'
                        }}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Transcript */}
              {transcript && (
                <div className="mb-4">
                  <p className="text-sm font-medium text-gray-700 mb-2">You said:</p>
                  <div className="bg-gray-50 rounded-lg p-3">
                    <p className="text-gray-800">{transcript}</p>
                  </div>
                </div>
              )}

              {/* AI Response */}
              {response && (
                <div className="mb-4">
                  <p className="text-sm font-medium text-gray-700 mb-2">AI CFO says:</p>
                  <div className="bg-blue-50 rounded-lg p-3 border-l-4 border-blue-500">
                    <p className="text-gray-800">{response}</p>
                  </div>
                </div>
              )}

              {/* Processing */}
              {isProcessing && (
                <div className="flex items-center justify-center mb-4">
                  <div className="flex space-x-1">
                    <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce"></div>
                    <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                    <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                  </div>
                </div>
              )}

              {/* Instructions */}
              {!transcript && !response && !isListening && !isProcessing && (
                <div className="text-center">
                  <div className="mb-4">
                    <Image
                      src="/iamcfo-logo.jpg"
                      alt="I AM CFO"
                      width={120}
                      height={48}
                      className="mx-auto object-contain"
                    />
                  </div>
                  <p className="text-gray-600 text-sm mb-4">
                    Hold the button and ask about your financial data
                  </p>
                  <div className="space-y-2 text-xs text-gray-500">
                    <p>"What's my revenue this month?"</p>
                    <p>"Which property makes the most money?"</p>
                    <p>"Show me my A/R aging"</p>
                  </div>
                </div>
              )}

              {/* Manual input fallback */}
              {!isListening && (
                <form onSubmit={handleManualSubmit} className="mt-6 space-y-2">
                  <label className="text-xs font-medium uppercase tracking-wide text-gray-500">
                    Type a question for the AI CFO
                  </label>
                  <div className="flex items-center space-x-2">
                    <input
                      type="text"
                      value={manualQuery}
                      onChange={(e) => setManualQuery(e.target.value)}
                      placeholder="e.g. What's our COGS this month?"
                      className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                      disabled={isProcessing}
                    />
                    <button
                      type="submit"
                      className="inline-flex items-center justify-center rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300"
                      disabled={isProcessing || !manualQuery.trim()}
                    >
                      {isProcessing ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <>
                          <Send className="mr-1.5 h-4 w-4" />
                          Ask
                        </>
                      )}
                    </button>
                  </div>
                </form>
              )}
            </div>

            {/* Action Button */}
            <div className="p-6 border-t border-gray-100">
              <button
                onMouseDown={handleHoldStart}
                onMouseUp={handleHoldEnd}
                onTouchStart={handleHoldStart}
                onTouchEnd={handleHoldEnd}
                onTouchCancel={handleHoldEnd}
                className={`w-full h-12 rounded-xl flex items-center justify-center transition-all duration-200 ${
                  isHolding
                    ? 'bg-red-500 scale-95'
                    : isListening
                      ? 'bg-blue-600'
                      : 'bg-gradient-to-r from-blue-500 to-blue-600 hover:scale-105'
                }`}
                disabled={isProcessing}
              >
                {isListening ? (
                  <MicOff className="w-6 h-6 text-white" />
                ) : (
                  <Mic className="w-6 h-6 text-white" />
                )}
              </button>
              <p className="text-center text-xs text-gray-500 mt-2">
                {isListening ? 'Release to send' : 'Hold to speak'}
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

export default SiriStyleAICFO
