import { GoogleGenerativeAI } from '@google/generative-ai';
import { StreamingTextResponse, Message } from 'ai';
import { z } from 'zod';

// Check for API key
if (!process.env.GOOGLE_API_KEY) {
  throw new Error('Missing GOOGLE_API_KEY environment variable');
}

const model = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY).getGenerativeModel({ model: 'gemini-pro' });

// Define types
interface ColorInfo {
  name: string;
  value: string;
  description?: string;
}

type ColorMode = Record<string, ColorInfo[]>;
type ColorCollection = Record<string, ColorMode>;

interface DesignSystem {
  variables?: {
    colors?: {
      collections: Record<string, ColorCollection>;
    };
  };
}

interface SelectionItem {
  name: string;
  type: string;
}

interface Selection {
  count: number;
  items: SelectionItem[];
}

interface ChatMessage {
  role: string;
  content: string;
}

// Tool parameter schemas
const colorInfoSchema = z.object({
  collectionName: z.string().optional().describe('Specific color collection to query'),
  modeName: z.string().optional().describe('Specific color mode to query')
});

const selectionInfoSchema = z.object({});

const executeCommandSchema = z.object({
  command: z.enum(['cloneFrame', 'createVariant', 'convertToComponent', 'setInstanceProperty', 'setVariable'])
    .describe('The Figma command to execute'),
  title: z.string().describe('Title of the command'),
  description: z.string().describe('Description of what the command will do'),
  metadata: z.record(z.any()).optional().describe('Additional metadata for the command')
});

type ColorInfoParams = z.infer<typeof colorInfoSchema>;
type ExecuteCommandParams = z.infer<typeof executeCommandSchema>;

// Helper function to format color mode output as structured data
function formatColorMode(mode: string, colors: ColorInfo[]): { mode: string; colors: ColorInfo[] } {
  return {
    mode,
    colors: colors.map(color => ({
      name: color.name,
      value: color.value,
      description: color.description
    }))
  };
}

// Type for tool context
interface ToolContext {
  selection?: Selection;
  designSystem?: DesignSystem;
}

// Type for tool parameters
type ToolParams = ColorInfoParams | object | ExecuteCommandParams;

// Type for tool definition
interface Tool<T extends ToolParams> {
  description: string;
  parameters: z.ZodType<T>;
  function: (params: T, context: ToolContext) => Promise<string>;
}

// Define tools
const tools = {
  getColorInfo: {
    description: 'Get information about colors in the design system',
    parameters: colorInfoSchema,
    function: async (params: ColorInfoParams, { designSystem }: ToolContext) => {
      const collections = designSystem?.variables?.colors?.collections || {};
      const result: { collection: string; modes: { mode: string; colors: { name: string; value: string; description?: string }[] }[] }[] = [];
      
      if (params.collectionName) {
        const collection = collections[params.collectionName];
        if (collection) {
          const modes: { mode: string; colors: { name: string; value: string; description?: string }[] }[] = [];
          if (params.modeName && collection[params.modeName]) {
            const colors = Object.values(collection[params.modeName]).flat();
            modes.push({
              mode: params.modeName,
              colors: colors.map(color => ({
                name: color.name,
                value: color.value,
                description: color.description
              }))
            });
          } else {
            Object.entries(collection).forEach(([mode, modeColors]) => {
              const colors = Object.values(modeColors).flat();
              modes.push({
                mode,
                colors: colors.map(color => ({
                  name: color.name,
                  value: color.value,
                  description: color.description
                }))
              });
            });
          }
          result.push({ collection: params.collectionName, modes });
        }
      } else {
        Object.entries(collections).forEach(([name, collection]) => {
          const modes: { mode: string; colors: { name: string; value: string; description?: string }[] }[] = [];
          Object.entries(collection).forEach(([mode, modeColors]) => {
            const colors = Object.values(modeColors).flat();
            modes.push({
              mode,
              colors: colors.map(color => ({
                name: color.name,
                value: color.value,
                description: color.description
              }))
            });
          });
          result.push({ collection: name, modes });
        });
      }
      
      return JSON.stringify(result.length ? result : { error: 'No color information found in the design system.' });
    }
  } satisfies Tool<ColorInfoParams>,

  getSelectionInfo: {
    description: 'Get information about the current selection in Figma',
    parameters: selectionInfoSchema,
    function: async (_: object, { selection }: ToolContext) => {
      if (!selection || selection.count === 0) {
        return 'Nothing is currently selected in Figma.';
      }
      
      return `Currently selected:
- ${selection.count} item(s)
${selection.items.map(item => `- ${item.name} (${item.type})`).join('\n')}`;
    }
  } satisfies Tool<object>,

  executeCommand: {
    description: 'Execute a Figma command',
    parameters: executeCommandSchema,
    function: async (params: ExecuteCommandParams, _: ToolContext) => {
      const script = {
        id: `script-${Date.now()}`,
        name: params.title,
        description: params.description,
        color: 'green',
        actions: [
          {
            id: `action-${Date.now()}`,
            command: {
              name: params.command,
              metadata: params.metadata || {},
              title: params.title,
              description: params.description
            },
            actions: []
          }
        ],
        createdAt: Date.now()
      };
      
      return JSON.stringify(script, null, 2);
    }
  } satisfies Tool<ExecuteCommandParams>
} as const;

// Type for tool names
type ToolName = keyof typeof tools;

function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

export async function POST(req: Request) {
  try {
    const { messages, selection, designSystem } = await req.json() as {
      messages: ChatMessage[];
      selection?: Selection;
      designSystem?: DesignSystem;
    };
    
    // Map roles to valid Gemini roles
    const roleMap: Record<string, string> = {
      user: 'user',
      assistant: 'model',
      system: 'user',
      tool: 'model'
    };

    // Create chat history with proper role mapping
    const history = messages.map((msg: ChatMessage) => ({
      role: roleMap[msg.role] || 'user',
      parts: [{ text: msg.content }]
    }));

    // Create the chat instance
    const chat = model.startChat({
      history,
      generationConfig: {
        maxOutputTokens: 4096,
        temperature: 0.7,
        topP: 0.8,
        topK: 40
      }
    });

    const systemMessage = `You are a helpful AI assistant for the HDDS Design System plugin.
      When users ask about colors:
      1. Start with a friendly greeting like "I'll show you the colors in our design system."
      2. Use the getColorInfo function to fetch the color data
      3. After the data is returned, describe what you found, for example:
         "Here's a breakdown of our color system, organized by collections and modes. Each color includes its name, value, and a visual preview."
      
      Important: Always provide context and natural language responses around the color data.`;

    const result = await chat.sendMessage(systemMessage);
    const responseText = result.response.text();

    // Get the user's last message
    const userMessage = messages[messages.length - 1].content.toLowerCase();

    // Check if the user is asking about selection
    if (userMessage.includes('select') || userMessage.includes('figma')) {
      return new StreamingTextResponse(
        new ReadableStream({
          async start(controller) {
            // Send initial message
            controller.enqueue(
              new TextEncoder().encode(
                `{"type":"text","content":"Let me show you what's currently selected in Figma:\\n\\n"}\\n`
              )
            );

            // Send selection component
            controller.enqueue(
              new TextEncoder().encode(
                `{"type":"tool-call","name":"getSelectionInfo","data":{"selection":${JSON.stringify(selection)},"designSystem":${JSON.stringify(designSystem)}}}\\n`
              )
            );

            controller.close();
          }
        })
      );
    }

    // Check if the user is asking about colors or design system
    if (userMessage.includes('color') || userMessage.includes('design system')) {
      const toolResult = await tools.getColorInfo.function({}, { selection, designSystem });
      
      const colorData = JSON.parse(toolResult);
      return new StreamingTextResponse(
        new ReadableStream({
          async start(controller) {
            // Send initial message
            controller.enqueue(
              new TextEncoder().encode(
                `{"type":"text","content":"I'll show you the colors in our design system. Here's what I found:\\n\\n"}\\n`
              )
            );

            // Send color table component
            controller.enqueue(
              new TextEncoder().encode(
                `{"type":"tool-call","name":"getColorInfo","data":${toolResult}}\\n`
              )
            );

            // Send closing message
            controller.enqueue(
              new TextEncoder().encode(
                `{"type":"text","content":"\\nEach color is displayed with its name, hex value, and a visual preview for easy reference."}\\n`
              )
            );

            controller.close();
          }
        })
      );
    }

    // For all other responses, stream the text normally
    return new StreamingTextResponse(
      new ReadableStream({
        async start(controller) {
          controller.enqueue(
            new TextEncoder().encode(
              `{"type":"text","content":${JSON.stringify(responseText)}}\\n`
            )
          );
          controller.close();
        }
      })
    );
  } catch (error) {
    console.error('Chat API error:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to process chat message' }),
      { status: 500 }
    );
  }
}
