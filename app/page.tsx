'use client'

import { useChat } from 'ai/react'
import { useEffect, useRef, useState } from 'react'
import styles from './page.module.css'

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
  actions: any[]
  createdAt: number
}

export default function Home() {
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const [lastExecutedId, setLastExecutedId] = useState<string | null>(null)
  const [selection, setSelection] = useState<SelectionInfo | null>(null)
  const [designSystem, setDesignSystem] = useState<DesignSystem>({});
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
            let extractedJson = jsonMatch[1] || jsonMatch[0];
            extractedJson = extractedJson.trim();
            
            try {
              // Try to parse as a regular JSON first
              const parsedJson = JSON.parse(extractedJson);
              
              // Check if this is color data by looking for collection and modes
              if (parsedJson.collection && parsedJson.modes) {
                console.log('Found color data:', parsedJson);
                // setContentObj({ type: 'color', data: parsedJson });
              } else if (parsedJson.actions?.[0]?.command?.name) {
                console.log('Executing extracted Automator script...');
                executeAutomatorScript(parsedJson);
              } else {
                console.log('Extracted JSON is not a valid Automator script:', parsedJson);
              }
            } catch (error) {
              console.error('Failed to parse extracted JSON:', error);
              // setContentObj(null);
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
              <div 
                className="prose prose-invert"
                dangerouslySetInnerHTML={{ __html: message.content }}
              />
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
