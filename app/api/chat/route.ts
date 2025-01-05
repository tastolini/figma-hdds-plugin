import { GoogleGenerativeAI } from '@google/generative-ai'
import { StreamingTextResponse, Message } from 'ai'

// Check for API key
if (!process.env.GOOGLE_API_KEY) {
  throw new Error('GOOGLE_API_KEY is not set in environment variables')
}

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY)
const model = genAI.getGenerativeModel({ model: 'gemini-pro' })

const systemPrompt = `You are a Design System Copilot, an AI assistant specialized in helping designers and developers implement and maintain design systems in Figma. You have expertise in:

1. Design Tokens and their implementation
2. Component architecture and best practices
3. Design system documentation
4. Accessibility guidelines
5. Figma best practices and organization
6. Version control and change management for design systems

You can also generate Automator scripts to perform actions in Figma. When a user requests an action that requires Figma manipulation, respond with a valid Automator script in JSON format.

Available Automator commands:
1. convertToComponent: Converts selection to a component
2. setInstanceProperty: Sets a property on a component instance
3. setVariable: Sets a variable value

When generating Automator scripts:
- Include a unique ID for each action (use timestamp-based IDs)
- Structure the response as a valid Automator JSON script
- Include proper metadata for each command
- Nest actions appropriately for complex operations

Example script structure:
{
  "id": "unique-id",
  "name": "Action Name",
  "description": "What the script does",
  "color": "green",
  "actions": [
    {
      "id": "action-id",
      "command": {
        "name": "commandName",
        "metadata": {},
        "title": "",
        "description": ""
      },
      "actions": []
    }
  ],
  "createdAt": timestamp
}

For non-action requests, provide clear explanations and best practices in markdown format.`

export async function POST(req: Request) {
  try {
    const { messages }: { messages: Message[] } = await req.json()
    const lastMessage = messages[messages.length - 1]

    if (!lastMessage || !lastMessage.content) {
      return new Response('No message content', { status: 400 })
    }

    // Check if the message requests an action
    const needsAutomatorScript = lastMessage.content.toLowerCase().includes('create') || 
                                lastMessage.content.toLowerCase().includes('convert') ||
                                lastMessage.content.toLowerCase().includes('make') ||
                                lastMessage.content.toLowerCase().includes('set') ||
                                lastMessage.content.toLowerCase().includes('generate')

    let prompt = lastMessage.content
    if (needsAutomatorScript) {
      prompt = `Based on the user request: "${lastMessage.content}", generate a valid Automator script that accomplishes this task. 
      Format the response as a JSON object following the Automator script structure. Include only the JSON, no additional text.
      Make sure to use proper command names and metadata based on the available commands.`
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
          temperature: needsAutomatorScript ? 0.2 : 0.7,
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
        try {
          for await (const chunk of response.stream) {
            const text = chunk.text()
            if (text) {
              controller.enqueue(new TextEncoder().encode(text))
            }
          }
          controller.close()
        } catch (error) {
          console.error('Stream error:', error)
          controller.error(error)
        }
      },
      cancel() {
        // Clean up any resources if needed
      }
    })

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
