'use client'

import { useChat } from 'ai/react'
import { useEffect, useRef, useState } from 'react'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
}

interface SelectionInfo {
  count: number
  items: any[]
  page: {
    id: string
    name: string
    type: string
    childCount: number
  }
}

interface AutomatorScript {
  id: string
  name: string
  description: string
  color: string
  actions: any[]
  createdAt: number
}

export default function Home() {
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const [lastExecutedId, setLastExecutedId] = useState<string | null>(null)
  const [selection, setSelection] = useState<SelectionInfo | null>(null)
  const { messages, input, setInput, isLoading, handleSubmit } = useChat({
    api: '/api/chat',
    body: {
      selection // Include selection info in the chat request
    }
  });

  // Function to send message to plugin
  const sendToPlugin = (message: any) => {
    parent.postMessage({ 
      pluginMessage: message,
      pluginId: '*'  // Allow any plugin to receive the message
    }, '*');
  };

  // Function to execute Automator script
  const executeAutomatorScript = (script: any) => {
    console.log('Executing script in UI:', script);
    sendToPlugin({
      type: 'EXECUTE_AUTOMATOR',
      script,
      id: script.id,
    });
  }

  // Check for selection-related queries before submitting
  const handleFormSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!input.trim()) return;

    if (input.toLowerCase().includes('selected') || input.toLowerCase().includes('selection')) {
      console.log('Requesting selection info...');
      sendToPlugin({ type: 'GET_SELECTION' });
    }

    // Use the built-in handleSubmit from useChat
    handleSubmit(e);
  };

  // Handle messages from the plugin
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const message = event.data.pluginMessage;
      if (!message) return;

      console.log('Received plugin message:', message);

      if (message.type === 'SELECTION_INFO' || message.type === 'SELECTION_CHANGED') {
        console.log('Setting selection data:', message.selection);
        setSelection(message.selection);
      } else if (message.type === 'AUTOMATOR_ERROR') {
        console.error('Automator error:', message.error)
        // Handle error (could add to messages or show a notification)
      } else if (message.type === 'AUTOMATOR_COMPLETE') {
        console.log('Automator script completed successfully')
        // Handle success
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  // Watch for new messages and execute scripts
  useEffect(() => {
    if (messages.length > 0) {
      const lastMessage = messages[messages.length - 1]
      if (lastMessage?.role === 'assistant' && lastMessage.content) {
        console.log('Raw message content:', lastMessage.content);
        
        try {
          // First try direct JSON parse
          const contentObj = JSON.parse(lastMessage.content.trim());
          console.log('Successfully parsed JSON:', contentObj);
          
          if (contentObj.actions?.[0]?.command?.name) {
            console.log('Executing Automator script...');
            executeAutomatorScript(contentObj);
            return;
          }
        } catch (e) {
          console.log('Direct JSON parse failed, trying to extract JSON...');
          
          // Try to extract JSON from the message
          const jsonMatch = lastMessage.content.match(/```json\n?(.*?)\n?```/s) || 
                           lastMessage.content.match(/\{[\s\S]*\}/);
          
          if (jsonMatch) {
            try {
              const jsonContent = jsonMatch[1] || jsonMatch[0];
              console.log('Extracted JSON string:', jsonContent);
              
              const contentObj = JSON.parse(jsonContent.trim());
              console.log('Parsed extracted JSON:', contentObj);
              
              if (contentObj.actions?.[0]?.command?.name) {
                console.log('Executing extracted Automator script...');
                executeAutomatorScript(contentObj);
              } else {
                console.log('Extracted JSON is not a valid Automator script:', contentObj);
              }
            } catch (e) {
              console.error('Failed to parse extracted JSON:', e);
            }
          } else {
            console.log('No JSON found in message');
          }
        }
      }
    }
  }, [messages]);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

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
                  dangerouslySetInnerHTML={{ __html: message.content }}
                />
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        <div className="fixed bottom-0 left-0 w-full bg-gray-800 p-4">
          <div className="max-w-4xl mx-auto">
            <form onSubmit={handleFormSubmit} className="flex flex-col space-y-4">
              <input
                className="w-full rounded-md p-4 bg-gray-700 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={input}
                placeholder="Ask about design tokens, component architecture, or request Figma actions..."
                onChange={(e) => setInput(e.target.value)}
                disabled={isLoading}
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
  )
}
