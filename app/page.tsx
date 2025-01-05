'use client'

import { useChat } from 'ai/react'
import { useEffect, useRef, useState } from 'react'
import styles from './page.module.css'
import { ColorTable } from '@/components/color-table'
import { SelectionInfo } from '@/components/selection-info'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
}

interface DesignSystem {
  variables?: {
    colors?: any;
    screens?: any;
  };
}

interface Selection {
  count: number
  items: Array<{
    id: string;
    name: string;
    type: string;
  }>;
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
  actions: Array<{
    command: {
      name: string;
      [key: string]: any;
    };
  }>;
}

interface ChatMessage {
  type: 'text' | 'tool-call';
  content?: string;
  name?: string;
  data?: any;
}

interface ChatResponse {
  messages: ChatMessage[];
}

type ResponseContent = ChatResponse | AutomatorScript;

interface ContentObj {
  type: 'color' | 'selection';
  data: any;
}

export default function Home() {
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const [lastExecutedId, setLastExecutedId] = useState<string | null>(null)
  const [selection, setSelection] = useState<SelectionInfo | null>(null)
  const [designSystem, setDesignSystem] = useState<DesignSystem>({});
  const [contentObj, setContentObj] = useState<ContentObj | null>(null)
  const { messages, input, setInput, isLoading, handleSubmit } = useChat({
    api: '/api/chat',
    body: {
      selection,
      designSystem
    }
  });

  // Function to send message to plugin
  const sendToPlugin = (message: any) => {
    parent.postMessage({ 
      pluginMessage: message,
      pluginId: '*'  // Allow any plugin to receive the message
    }, '*');
  };

  // Request design system update
  const updateDesignSystem = () => {
    console.log('Requesting design system update...');
    sendToPlugin({ type: 'UPDATE_DESIGN_SYSTEM' });
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

    if (input.toLowerCase().includes('update design system')) {
      updateDesignSystem();
    } else if (input.toLowerCase().includes('selected') || input.toLowerCase().includes('selection')) {
      console.log('Requesting selection info...');
      sendToPlugin({ type: 'GET_SELECTION' });
    }

    // Use the built-in handleSubmit from useChat
    handleSubmit(e);
  };

  useEffect(() => {
    // Listen for messages from the plugin
    window.onmessage = (event) => {
      const msg = event.data.pluginMessage;
      console.log('Received plugin message:', msg);

      if (msg.type === 'DESIGN_SYSTEM_UPDATED') {
        console.log('Design system updated:', msg.designSystem);
        setDesignSystem(msg.designSystem);
      } else if (msg.type === 'QUERY_RESPONSE') {
        console.log('Query response:', msg);
        // Removed append here
      } else if (msg.type === 'SELECTION_INFO') {
        console.log('Setting selection data:', msg.selection);
        setSelection(msg.selection);
      } else if (msg.type === 'AUTOMATOR_ERROR') {
        console.error('Automator error:', msg.error)
        // Handle error (could add to messages or show a notification)
      } else if (msg.type === 'AUTOMATOR_COMPLETE') {
        console.log('Automator script completed successfully')
        // Handle success
      }
    };

    // Request initial design system info
    parent.postMessage({ pluginMessage: { type: 'UPDATE_DESIGN_SYSTEM' } }, '*');
  }, []);

  // Request design system info on first load
  useEffect(() => {
    updateDesignSystem();
  }, []);

  // Watch for new messages and execute scripts
  useEffect(() => {
    if (messages.length > 0) {
      const lastMessage = messages[messages.length - 1];
      if (lastMessage?.role === 'assistant' && lastMessage.content) {
        console.log('Raw message content:', lastMessage.content);
        
        try {
          // Parse the message content
          const contentObj = JSON.parse(lastMessage.content.trim()) as ResponseContent;
          console.log('Successfully parsed JSON:', contentObj);
          
          // Type guard for ChatResponse
          const isChatResponse = (obj: ResponseContent): obj is ChatResponse => {
            return 'messages' in obj;
          };
          
          // Type guard for AutomatorScript
          const isAutomatorScript = (obj: ResponseContent): obj is AutomatorScript => {
            return 'actions' in obj && Array.isArray(obj.actions);
          };
          
          if (isChatResponse(contentObj)) {
            // Handle messages array
            contentObj.messages.forEach((msg: ChatMessage) => {
              if (msg.type === 'tool-call') {
                if (msg.name === 'getColorInfo' && msg.data) {
                  console.log('Rendering color table with data:', msg.data);
                  setContentObj({ type: 'color', data: msg.data });
                } else if (msg.name === 'getSelectionInfo' && msg.data) {
                  console.log('Rendering selection info with data:', msg.data);
                  setContentObj({ type: 'selection', data: msg.data });
                }
              }
            });
          } else if (isAutomatorScript(contentObj)) {
            console.log('Executing Automator script...');
            executeAutomatorScript(contentObj);
          }
        } catch (e) {
          console.error('Failed to parse message content:', e);
        }
      }
    }
  }, [messages]);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  return (
    <div className="flex flex-col h-screen">
      <div className="flex-none">
        <h1 className="text-4xl font-bold p-4">
          Design Copilot
        </h1>
      </div>
      
      <div className="flex-1 overflow-y-auto px-4">
        <div className="flex flex-col space-y-4">
          {messages.map((message, index) => (
            <div
              key={index}
              className={`${
                message.role === 'assistant'
                  ? 'bg-gray-100'
                  : 'bg-blue-100'
              } p-4 rounded-lg max-w-3xl ${
                message.role === 'assistant' ? 'mr-auto' : 'ml-auto'
              }`}
            >
              {message.role === 'user' ? (
                <div className="text-gray-800">{message.content}</div>
              ) : (
                <>
                  {contentObj && message === messages[messages.length - 1] && (
                    <div className="mb-4">
                      {contentObj.type === 'color' && (
                        <ColorTable data={contentObj.data} />
                      )}
                      {contentObj.type === 'selection' && (
                        <SelectionInfo data={{
                          selection: contentObj.data.selection,
                          designSystem: contentObj.data.designSystem
                        }} />
                      )}
                    </div>
                  )}
                  {/* Only show text content for non-tool-call messages */}
                  {(!contentObj || message !== messages[messages.length - 1]) && (
                    <div className="text-gray-800">{message.content}</div>
                  )}
                </>
              )}
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>
      </div>

      <div className="flex-none p-4">
        <form onSubmit={handleFormSubmit} className="flex space-x-4">
          <input
            className="flex-1 p-2 border rounded-lg"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about your design system..."
          />
          <button
            type="submit"
            className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
            disabled={isLoading}
          >
            Send
          </button>
        </form>
      </div>
    </div>
  )
}
