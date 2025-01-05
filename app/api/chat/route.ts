import { GoogleGenerativeAI } from '@google/generative-ai'
import { StreamingTextResponse, Message } from 'ai'

// Check for API key
if (!process.env.GOOGLE_API_KEY) {
  throw new Error('GOOGLE_API_KEY is not set in environment variables')
}

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY)
const model = genAI.getGenerativeModel({ model: 'gemini-pro' })

interface SelectionItem {
  id: string;
  name: string;
  type: string;
  width?: number;
  height?: number;
  x?: number;
  y?: number;
  characters?: string;
  fontSize?: number | symbol;
  fontName?: string | { family: string; style: string };
  componentProperties?: Record<string, any>;
  childCount?: number;
}

interface SelectionInfo {
  count: number;
  items: SelectionItem[];
  page: {
    id: string;
    name: string;
    type: string;
    childCount: number;
  };
}

const systemPrompt = `You are a Design System Copilot, an AI assistant specialized in helping designers and developers implement and maintain design systems in Figma. You have expertise in:

1. Design Tokens and their implementation
2. Component architecture and best practices
3. Design system documentation
4. Accessibility guidelines
5. Figma best practices and organization
6. Version control and change management for design systems

When the user requests an action like cloning, creating, or modifying elements in Figma, respond with a valid Automator script in this exact JSON format:

{
  "id": "script-[timestamp]",
  "name": "Action Name",
  "description": "What this script does",
  "color": "green",
  "actions": [
    {
      "id": "action-[timestamp]",
      "command": {
        "name": "commandName",
        "metadata": {},
        "title": "Command Title",
        "description": "Command Description"
      },
      "actions": []
    }
  ],
  "createdAt": [timestamp]
}

Available commands:
- cloneFrame: Clones the selected frame
- createVariant: Creates a new component variant
- convertToComponent: Converts selection to component
- setInstanceProperty: Sets component instance property
- setVariable: Sets variable value

For example, when asked to clone a frame, respond with exactly:
{
  "id": "script-1234567890",
  "name": "Clone Frame",
  "description": "Clones the selected frame",
  "color": "green",
  "actions": [
    {
      "id": "action-1234567890",
      "command": {
        "name": "cloneFrame",
        "metadata": {},
        "title": "Clone Frame",
        "description": "Creates a copy of the selected frame"
      },
      "actions": []
    }
  ],
  "createdAt": 1704464968000
}

When asked about the current selection in Figma, analyze the selection data provided and give a clear description of what is selected.

For other queries, provide clear explanations and best practices in markdown format.`

export async function POST(req: Request) {
  try {
    const { messages, selection }: { messages: Message[], selection: any } = await req.json()
    const lastMessage = messages[messages.length - 1]

    if (!lastMessage || !lastMessage.content) {
      return new Response('No message content', { status: 400 })
    }

    let prompt = lastMessage.content
    const isActionRequest = prompt.toLowerCase().includes('clone') ||
                          prompt.toLowerCase().includes('create') ||
                          prompt.toLowerCase().includes('convert') ||
                          prompt.toLowerCase().includes('set') ||
                          prompt.toLowerCase().includes('make')

    if (isActionRequest) {
      prompt = `You are a script generator. Generate ONLY a JSON Automator script for this request: "${prompt}"

Your response must be ONLY the JSON object, no markdown, no explanation. The JSON must follow this format:
{
  "id": "script-${Date.now()}",
  "name": "Action Name",
  "description": "What this script does",
  "color": "green",
  "actions": [
    {
      "id": "action-${Date.now()}",
      "command": {
        "name": "commandName",
        "metadata": {},
        "title": "Command Title",
        "description": "Command Description"
      },
      "actions": []
    }
  ],
  "createdAt": ${Date.now()}
}

Available commands are: cloneFrame, createVariant, convertToComponent, setInstanceProperty, setVariable.
Replace commandName with one of these exact commands.
Do not add any text before or after the JSON.`
    } else if (
      (prompt.toLowerCase().includes('selected') || 
       prompt.toLowerCase().includes('selection')) && 
      selection
    ) {
      const { count, items, page } = selection as SelectionInfo;
      
      // Create a natural description of the selection
      let selectionDescription = '';
      
      if (count === 0) {
        selectionDescription = 'Nothing is currently selected in Figma.';
      } else {
        selectionDescription = `Currently selected on the "${page.name}" page:\n\n`;
        
        items.forEach((item: SelectionItem, index: number) => {
          selectionDescription += `${index + 1}. ${item.name} (${item.type}):\n`;
          
          // Add size and position if available
          if ('width' in item && 'height' in item && item.width != null && item.height != null) {
            selectionDescription += `   - Size: ${Math.round(Number(item.width))}px × ${Math.round(Number(item.height))}px\n`;
          }
          if ('x' in item && 'y' in item && item.x != null && item.y != null) {
            selectionDescription += `   - Position: (${Math.round(Number(item.x))}, ${Math.round(Number(item.y))})\n`;
          }
          
          // Add text content for text nodes
          if (item.type === 'TEXT') {
            selectionDescription += `   - Text: "${item.characters}"\n`;
            selectionDescription += `   - Font: ${String(item.fontSize)}px ${
              typeof item.fontName === 'object' 
                ? item.fontName.family 
                : String(item.fontName || '')
            }\n`;
          }
          
          // Add component properties if available
          if (item.componentProperties) {
            selectionDescription += '   - Component Properties:\n';
            Object.entries(item.componentProperties).forEach(([key, value]) => {
              selectionDescription += `     • ${key}: ${JSON.stringify(value)}\n`;
            });
          }
          
          // Add child count for containers
          if ('childCount' in item) {
            selectionDescription += `   - Contains ${item.childCount} child elements\n`;
          }
          
          selectionDescription += '\n';
        });
      }

      prompt = `Here's what is currently selected in Figma:

${selectionDescription}

Please provide a clear, natural language description of the selection, focusing on the most relevant details for the user's context.`
    }

    // Create chat history with proper role mapping
    const chatHistory = messages.slice(0, -1).map(msg => ({
      role: msg.role === 'user' ? 'user' : 'model',
      parts: [{ text: msg.content }]
    }))

    // Add system prompt at the beginning
    chatHistory.unshift({
      role: 'model',
      parts: [{ text: systemPrompt }]
    })

    // Add current message
    chatHistory.push({
      role: 'user',
      parts: [{ text: prompt }]
    })

    // Generate response with error handling
    let response
    try {
      response = await model.generateContentStream({
        contents: chatHistory,
        generationConfig: {
          maxOutputTokens: 1000,
          temperature: isActionRequest ? 0.1 : 0.7, // Lower temperature for actions
          topP: 0.8,
          topK: 40,
        },
      })
    } catch (error) {
      console.error('Gemini API error:', error)
      return new Response(
        JSON.stringify({ error: 'Failed to generate response from Gemini API' }), 
        { status: 500, headers: { 'Content-Type': 'application/json' }}
      )
    }

    // Create a ReadableStream from the response with error handling
    const stream = new ReadableStream({
      async start(controller) {
        const timestamp = Date.now();
        
        // If it's an action request, ensure we output clean JSON
        if (isActionRequest) {
          try {
            let fullResponse = '';
            
            for await (const chunk of response.stream) {
              fullResponse += chunk.text();
            }
            
            // Try to extract just the JSON object
            const jsonMatch = fullResponse.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
              const jsonStr = jsonMatch[0];
              
              // Parse and rebuild to ensure valid JSON
              const parsed = JSON.parse(jsonStr);
              const cleanJson = {
                id: `script-${timestamp}`,
                name: parsed.name || "Automator Action",
                description: parsed.description || "Executes the requested action",
                color: "green",
                actions: [{
                  id: `action-${timestamp}`,
                  command: {
                    name: parsed.actions?.[0]?.command?.name || "cloneFrame",
                    metadata: {},
                    title: parsed.actions?.[0]?.command?.title || "Execute Action",
                    description: parsed.actions?.[0]?.command?.description || "Executes the requested action"
                  },
                  actions: []
                }],
                createdAt: timestamp
              };
              
              // Output the clean JSON
              controller.enqueue(new TextEncoder().encode(JSON.stringify(cleanJson, null, 2)));
            } else {
              // Fallback for clone action
              const fallbackJson = {
                id: `script-${timestamp}`,
                name: "Clone Frame",
                description: "Clones the selected frame",
                color: "green",
                actions: [{
                  id: `action-${timestamp}`,
                  command: {
                    name: "cloneFrame",
                    metadata: {},
                    title: "Clone Frame",
                    description: "Creates a copy of the selected frame"
                  },
                  actions: []
                }],
                createdAt: timestamp
              };
              controller.enqueue(new TextEncoder().encode(JSON.stringify(fallbackJson, null, 2)));
            }
          } catch (error) {
            console.error('Error processing action response:', error);
            controller.error(error);
          }
        } else {
          // For non-action requests, stream normally
          try {
            for await (const chunk of response.stream) {
              const text = chunk.text();
              if (text) {
                controller.enqueue(new TextEncoder().encode(text));
              }
            }
          } catch (error) {
            console.error('Stream error:', error);
            controller.error(error);
          }
        }
        controller.close();
      },
      cancel() {
        // Clean up if needed
      }
    });

    // Return the streaming response
    return new StreamingTextResponse(stream)
  } catch (error) {
    console.error('Chat API error:', error)
    return new Response(
      JSON.stringify({ error: 'Failed to process chat request' }), 
      { status: 500, headers: { 'Content-Type': 'application/json' }}
    )
  }
}
