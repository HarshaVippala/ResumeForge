'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { MessageSquare, Send, Minimize2, Maximize2, Sparkles, X } from 'lucide-react'

interface AIAssistantProps {
  selectedText: string
  context: any
  onSuggestionApply: (suggestion: string) => void
}

export function AIAssistant({ selectedText, context, onSuggestionApply }: AIAssistantProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [isMinimized, setIsMinimized] = useState(false)
  const [prompt, setPrompt] = useState('')
  const [messages, setMessages] = useState<Array<{ role: 'user' | 'assistant', content: string }>>([])
  const [isLoading, setIsLoading] = useState(false)

  const quickPrompts = [
    "Make this sound more professional",
    "Add quantifiable achievements",
    "Optimize for ATS scanning",
    "Make it more concise",
    "Add action verbs",
    "Include relevant keywords"
  ]

  const handleSendMessage = async () => {
    if (!prompt.trim()) return

    const userMessage = { role: 'user' as const, content: prompt }
    setMessages(prev => [...prev, userMessage])
    setPrompt('')
    setIsLoading(true)

    try {
      // Simulate AI response - replace with actual API call
      await new Promise(resolve => setTimeout(resolve, 1500))
      
      const assistantMessage = {
        role: 'assistant' as const,
        content: `Here's an improved version: "${prompt}". This version includes better action verbs and quantifiable results that align with the job requirements.`
      }
      
      setMessages(prev => [...prev, assistantMessage])
    } catch (error) {
      console.error('Error getting AI response:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleQuickPrompt = (quickPrompt: string) => {
    setPrompt(quickPrompt)
  }

  const handleApplySuggestion = (suggestion: string) => {
    onSuggestionApply(suggestion)
    setMessages(prev => [...prev, { role: 'user', content: 'Applied suggestion to resume' }])
  }

  if (!isOpen) {
    return (
      <div className="fixed bottom-6 right-6 z-50">
        <Button
          onClick={() => setIsOpen(true)}
          className="rounded-full h-12 w-12 bg-blue-600 hover:bg-blue-700 shadow-lg"
        >
          <Sparkles className="h-5 w-5 text-white" />
        </Button>
      </div>
    )
  }

  return (
    <div className={`fixed bottom-6 right-6 z-50 transition-all duration-300 ${
      isMinimized ? 'w-80 h-12' : 'w-96 h-96'
    }`}>
      <Card className="h-full shadow-xl border-2 border-blue-200">
        {/* Header */}
        <div className="flex items-center justify-between p-3 bg-blue-50 border-b">
          <div className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-blue-600" />
            <span className="font-medium text-blue-900">AI Writing Assistant</span>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsMinimized(!isMinimized)}
              className="h-6 w-6 p-0"
            >
              {isMinimized ? <Maximize2 className="h-3 w-3" /> : <Minimize2 className="h-3 w-3" />}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsOpen(false)}
              className="h-6 w-6 p-0"
            >
              <X className="h-3 w-3" />
            </Button>
          </div>
        </div>

        {!isMinimized && (
          <>
            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-3 space-y-3 bg-gray-50 max-h-48">
              {messages.length === 0 ? (
                <div className="text-center text-gray-500 text-sm py-4">
                  <Sparkles className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>Ask me to help improve your resume content!</p>
                  <p className="text-xs mt-1">Try selecting text and asking for suggestions</p>
                </div>
              ) : (
                messages.map((message, index) => (
                  <div
                    key={index}
                    className={`p-2 rounded-lg text-sm ${
                      message.role === 'user'
                        ? 'bg-blue-100 text-blue-900 ml-4'
                        : 'bg-white text-gray-900 mr-4 shadow-sm'
                    }`}
                  >
                    {message.content}
                    {message.role === 'assistant' && (
                      <div className="mt-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleApplySuggestion(message.content)}
                          className="h-6 text-xs"
                        >
                          Apply to Resume
                        </Button>
                      </div>
                    )}
                  </div>
                ))
              )}
              {isLoading && (
                <div className="bg-white p-2 rounded-lg mr-4 shadow-sm">
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-blue-600"></div>
                    Thinking...
                  </div>
                </div>
              )}
            </div>

            {/* Quick Prompts */}
            <div className="p-3 border-t bg-white">
              <div className="mb-2">
                <p className="text-xs font-medium text-gray-700 mb-2">Quick suggestions:</p>
                <div className="flex flex-wrap gap-1">
                  {quickPrompts.slice(0, 3).map((quickPrompt) => (
                    <button
                      key={quickPrompt}
                      onClick={() => handleQuickPrompt(quickPrompt)}
                      className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs hover:bg-gray-200 transition-colors"
                    >
                      {quickPrompt}
                    </button>
                  ))}
                </div>
              </div>

              {/* Input */}
              <div className="flex gap-2">
                <input
                  type="text"
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                  placeholder="Ask for help with your content..."
                  className="flex-1 px-3 py-1 border border-gray-200 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                  disabled={isLoading}
                />
                <Button
                  onClick={handleSendMessage}
                  disabled={!prompt.trim() || isLoading}
                  size="sm"
                  className="px-3"
                >
                  <Send className="h-3 w-3" />
                </Button>
              </div>
            </div>
          </>
        )}
      </Card>
    </div>
  )
}