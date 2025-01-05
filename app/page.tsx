'use client'

import { useChat } from 'ai/react'
import { useEffect, useRef, useState } from 'react'

interface Message {
  id: string
  content: string
  role: 'user' | 'assistant'
}

interface AutomatorScript {
  id: string
  name: string
  description: string
  color: string
  actions: any[]
  createdAt: number
}

// Simple markdown-like formatting
function formatMessage(content: string): string {
  return content
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/```([^]*?)```/g, '<pre><code>$1</code></pre>')
    .replace(/`(.*?)`/g, '<code>$1</code>')
    .replace(/\n/g, '<br>')
}

export default function Home() {
  const [scriptToExecute, setScriptToExecute] = useState<AutomatorScript | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const { messages, input, handleInputChange, handleSubmit, isLoading } = useChat({
    api: '/api/chat',
    onFinish: (message) => {
      // Try to parse the message as an Automator script
      try {
        const possibleScript = JSON.parse(message.content);
        if (possibleScript.actions && Array.isArray(possibleScript.actions)) {
          setScriptToExecute(possibleScript);
        }
      } catch (e) {
        // Not a JSON message, ignore
      }
    }
  });

  // Scroll to bottom whenever messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Function to check if a string is valid JSON
  const isJsonString = (str: string) => {
    try {
      const json = JSON.parse(str)
      return json && typeof json === 'object'
    } catch (e) {
      return false
    }
  }

  // Function to execute Automator script
  const executeAutomatorScript = (script: AutomatorScript) => {
    // Post message to Figma plugin
    parent.postMessage(
      {
        pluginMessage: {
          type: 'EXECUTE_AUTOMATOR',
          script,
          id: script.id,
        },
      },
      '*'
    )
  }

  // Handle messages from Figma plugin
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data.pluginMessage) {
        const { type, error } = event.data.pluginMessage
        if (type === 'AUTOMATOR_ERROR') {
          console.error('Automator error:', error)
          // Handle error (could add to messages or show a notification)
        } else if (type === 'AUTOMATOR_COMPLETE') {
          console.log('Automator script completed successfully')
          // Handle success
        }
      }
    }

    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [])

  // Custom submit handler to check for Automator scripts
  const handleChatSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    handleSubmit(e)

    // Get the last assistant message after a short delay to allow for the response
    setTimeout(() => {
      const lastMessage = messages[messages.length - 1]
      if (lastMessage?.role === 'assistant' && lastMessage.content) {
        // Check if the message content is a valid JSON
        if (isJsonString(lastMessage.content)) {
          try {
            const script = JSON.parse(lastMessage.content) as AutomatorScript
            if (script.actions && Array.isArray(script.actions)) {
              executeAutomatorScript(script)
            }
          } catch (error) {
            console.error('Failed to parse or execute Automator script:', error)
          }
        }
      }
    }, 100) // Small delay to ensure the message has been added
  }

  const executeScript = () => {
    if (scriptToExecute) {
      parent.postMessage({ pluginMessage: { 
        type: 'EXECUTE_AUTOMATOR',
        script: scriptToExecute,
        id: Date.now().toString()
      } }, '*');
      setScriptToExecute(null);
    }
  };

  return (
    <div className="flex flex-col items-center min-h-screen bg-gray-900 text-white">
      <h1 className="text-4xl font-bold mb-5 mt-2">Design System Copilot</h1>
      <div className="text-sm mb-5 text-gray-300">
        Your AI assistant for design system implementation
      </div>

      <div className="w-full max-w-4xl px-4 mb-24">
        <div className="flex flex-col space-y-4 mb-4 max-h-[60vh] overflow-y-auto">
          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${
                message.role === 'assistant'
                  ? 'bg-gray-800'
                  : 'bg-gray-700'
              } rounded-lg p-4`}
            >
              <div className="flex-1">
                <div className="font-medium mb-2 flex items-center">
                  {message.role === 'assistant' ? (
                    <>
                      <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                      </svg>
                      Design Copilot
                    </>
                  ) : (
                    <>
                      <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                      You
                    </>
                  )}
                </div>
                <div 
                  className="prose prose-invert"
                  dangerouslySetInnerHTML={{ __html: formatMessage(message.content) }}
                />
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        {scriptToExecute && (
          <div className="fixed bottom-24 left-1/2 transform -translate-x-1/2 w-full max-w-4xl px-4">
            <div className="bg-blue-600 text-white p-4 rounded-lg shadow-lg">
              <div className="font-medium mb-2">Automator Script Ready</div>
              <p className="text-sm mb-4">A script has been generated to perform your requested actions.</p>
              <button
                onClick={executeScript}
                className="bg-white text-blue-600 px-4 py-2 rounded hover:bg-blue-50 transition-colors"
              >
                Execute Script
              </button>
            </div>
          </div>
        )}

        <div className="fixed bottom-0 left-0 w-full bg-gray-800 p-4">
          <div className="max-w-4xl mx-auto">
            <form onSubmit={handleChatSubmit} className="flex flex-col space-y-4">
              <input
                className="w-full rounded-md p-4 bg-gray-700 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={input}
                placeholder="Ask about design tokens, component architecture, or request Figma actions..."
                onChange={handleInputChange}
              />
              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={isLoading}
                  className={`px-6 py-3 rounded-md bg-blue-600 text-white font-medium ${
                    isLoading ? 'opacity-50 cursor-not-allowed' : 'hover:bg-blue-700'
                  }`}
                >
                  {isLoading ? (
                    <div className="flex items-center">
                      <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Processing...
                    </div>
                  ) : (
                    'Send Message'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
