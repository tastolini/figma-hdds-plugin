# AI SDK UI: Generative User Interfaces
[AI SDK UI](https://sdk.vercel.ai/docs/ai-sdk-ui)Generative User Interfaces

Generative user interfaces (generative UI) is the process of allowing a large language model (LLM) to go beyond text and "generate UI". This creates a more engaging and AI-native experience for users.

What is the weather in SF?

getWeather("San Francisco")

At the core of generative UI are [tools](https://sdk.vercel.ai/docs/ai-sdk-core/tools-and-tool-calling) , which are functions you provide to the model to perform specialized tasks like getting the weather in a location. The model can decide when and how to use these tools based on the context of the conversation.

Generative UI is the process of connecting the results of a tool call to a React component. Here's how it works:

1.  You provide the model with a prompt or conversation history, along with a set of tools.
2.  Based on the context, the model may decide to call a tool.
3.  If a tool is called, it will execute and return data.
4.  This data can then be passed to a React component for rendering.

By passing the tool results to React components, you can create a generative UI experience that's more engaging and adaptive to your needs.

[Build a Generative UI Chat Interface](#build-a-generative-ui-chat-interface)
-----------------------------------------------------------------------------

Let's create a chat interface that handles text-based conversations and incorporates dynamic UI elements based on model responses.

### [Basic Chat Implementation](#basic-chat-implementation)

Start with a basic chat implementation using the `useChat` hook:

```

'use client';
import { useChat } from 'ai/react';
export default function Page() {
  const { messages, input, handleInputChange, handleSubmit } = useChat();
  return (
    <div>
      {messages.map(message => (
        <div key={message.id}>
          <div>{message.role === 'user' ? 'User: ' : 'AI: '}</div>
          <div>{message.content}</div>
        </div>
      ))}
      <form onSubmit={handleSubmit}>
        <input
          value={input}
          onChange={handleInputChange}
          placeholder="Type a message..."
        />
        <button type="submit">Send</button>
      </form>
    </div>
  );
}
```


To handle the chat requests and model responses, set up an API route:

```

import { openai } from '@ai-sdk/openai';
import { streamText } from 'ai';
export async function POST(request: Request) {
  const { messages } = await request.json();
  const result = streamText({
    model: openai('gpt-4o'),
    system: 'You are a friendly assistant!',
    messages,
    maxSteps: 5,
  });
  return result.toDataStreamResponse();
}
```


This API route uses the `streamText` function to process chat messages and stream the model's responses back to the client.

### [Create a Tool](#create-a-tool)

Before enhancing your chat interface with dynamic UI elements, you need to create a tool and corresponding React component. A tool will allow the model to perform a specific action, such as fetching weather information.

Create a new file called `ai/tools.ts` with the following content:

```

import { tool as createTool } from 'ai';
import { z } from 'zod';
export const weatherTool = createTool({
  description: 'Display the weather for a location',
  parameters: z.object({
    location: z.string().describe('The location to get the weather for'),
  }),
  execute: async function ({ location }) {
    await new Promise(resolve => setTimeout(resolve, 2000));
    return { weather: 'Sunny', temperature: 75, location };
  },
});
export const tools = {
  displayWeather: weatherTool,
};
```


In this file, you've created a tool called `weatherTool`. This tool simulates fetching weather information for a given location. This tool will return simulated data after a 2-second delay. In a real-world application, you would replace this simulation with an actual API call to a weather service.

### [Update the API Route](#update-the-api-route)

Update the API route to include the tool you've defined:

```

import { openai } from '@ai-sdk/openai';
import { streamText } from 'ai';
import { tools } from '@/ai/tools';
export async function POST(request: Request) {
  const { messages } = await request.json();
  const result = streamText({
    model: openai('gpt-4o'),
    system: 'You are a friendly assistant!',
    messages,
    maxSteps: 5,
    tools,
  });
  return result.toDataStreamResponse();
}
```


Now that you've defined the tool and added it to your `streamText` call, let's build a React component to display the weather information it returns.

### [Create UI Components](#create-ui-components)

Create a new file called `components/weather.tsx`:

```

type WeatherProps = {
  temperature: number;
  weather: string;
  location: string;
};
export const Weather = ({ temperature, weather, location }: WeatherProps) => {
  return (
    <div>
      <h2>Current Weather for {location}</h2>
      <p>Condition: {weather}</p>
      <p>Temperature: {temperature}°C</p>
    </div>
  );
};
```


This component will display the weather information for a given location. It takes three props: `temperature`, `weather`, and `location` (exactly what the `weatherTool` returns).

### [Render the Weather Component](#render-the-weather-component)

Now that you have your tool and corresponding React component, let's integrate them into your chat interface. You'll render the Weather component when the model calls the weather tool.

To check if the model has called a tool, you can use the `toolInvocations` property of the message object. This property contains information about any tools that were invoked in that generation including `toolCallId`, `toolName`, `args`, `toolState`, and `result`.

Update your `page.tsx` file:

```

'use client';
import { useChat } from 'ai/react';
import { Weather } from '@/components/weather';
export default function Page() {
  const { messages, input, handleInputChange, handleSubmit } = useChat();
  return (
    <div>
      {messages.map(message => (
        <div key={message.id}>
          <div>{message.role === 'user' ? 'User: ' : 'AI: '}</div>
          <div>{message.content}</div>
          <div>
            {message.toolInvocations?.map(toolInvocation => {
              const { toolName, toolCallId, state } = toolInvocation;
              if (state === 'result') {
                if (toolName === 'displayWeather') {
                  const { result } = toolInvocation;
                  return (
                    <div key={toolCallId}>
                      <Weather {...result} />
                    </div>
                  );
                }
              } else {
                return (
                  <div key={toolCallId}>
                    {toolName === 'displayWeather' ? (
                      <div>Loading weather...</div>
                    ) : null}
                  </div>
                );
              }
            })}
          </div>
        </div>
      ))}
      <form onSubmit={handleSubmit}>
        <input
          value={input}
          onChange={handleInputChange}
          placeholder="Type a message..."
        />
        <button type="submit">Send</button>
      </form>
    </div>
  );
}
```


In this updated code snippet, you:

1.  Check if the message has `toolInvocations`.
2.  Check if the tool invocation state is 'result'.
3.  If it's a result and the tool name is 'displayWeather', render the Weather component.
4.  If the tool invocation state is not 'result', show a loading message.

This approach allows you to dynamically render UI components based on the model's responses, creating a more interactive and context-aware chat experience.

[Expanding Your Generative UI Application](#expanding-your-generative-ui-application)
-------------------------------------------------------------------------------------

You can enhance your chat application by adding more tools and components, creating a richer and more versatile user experience. Here's how you can expand your application:

### [Adding More Tools](#adding-more-tools)

To add more tools, simply define them in your `ai/tools.ts` file:

```

// Add a new stock tool
export const stockTool = createTool({
  description: 'Get price for a stock',
  parameters: z.object({
    symbol: z.string().describe('The stock symbol to get the price for'),
  }),
  execute: async function ({ symbol }) {
    // Simulated API call
    await new Promise(resolve => setTimeout(resolve, 2000));
    return { symbol, price: 100 };
  },
});
// Update the tools object
export const tools = {
  displayWeather: weatherTool,
  getStockPrice: stockTool,
};
```


Now, create a new file called `components/stock.tsx`:

```

type StockProps = {
  price: number;
  symbol: string;
};
export const Stock = ({ price, symbol }: StockProps) => {
  return (
    <div>
      <h2>Stock Information</h2>
      <p>Symbol: {symbol}</p>
      <p>Price: ${price}</p>
    </div>
  );
};
```


Finally, update your `page.tsx` file to include the new Stock component:

```

'use client';
import { useChat } from 'ai/react';
import { Weather } from '@/components/weather';
import { Stock } from '@/components/stock';
export default function Page() {
  const { messages, input, setInput, handleSubmit } = useChat();
  return (
    <div>
      {messages.map(message => (
        <div key={message.id}>
          <div>{message.role}</div>
          <div>{message.content}</div>
          <div>
            {message.toolInvocations?.map(toolInvocation => {
              const { toolName, toolCallId, state } = toolInvocation;
              if (state === 'result') {
                if (toolName === 'displayWeather') {
                  const { result } = toolInvocation;
                  return (
                    <div key={toolCallId}>
                      <Weather {...result} />
                    </div>
                  );
                } else if (toolName === 'getStockPrice') {
                  const { result } = toolInvocation;
                  return <Stock key={toolCallId} {...result} />;
                }
              } else {
                return (
                  <div key={toolCallId}>
                    {toolName === 'displayWeather' ? (
                      <div>Loading weather...</div>
                    ) : toolName === 'getStockPrice' ? (
                      <div>Loading stock price...</div>
                    ) : (
                      <div>Loading...</div>
                    )}
                  </div>
                );
              }
            })}
          </div>
        </div>
      ))}
      <form onSubmit={handleSubmit}>
        <input
          type="text"
          value={input}
          onChange={event => {
            setInput(event.target.value);
          }}
        />
        <button type="submit">Send</button>
      </form>
    </div>
  );
}
```


By following this pattern, you can continue to add more tools and components, expanding the capabilities of your Generative UI application.

# AI SDK Generative UI Implementation

This document describes how we implemented generative UI components using the Vercel AI SDK in our chat interface.

## Overview

Instead of returning plain text or HTML, our AI responses can now include dynamic UI components that are rendered in real-time as part of the chat stream. This is achieved by embedding JSON objects in the stream that represent UI components.

## Implementation Details

### 1. Route Handler (route.ts)

The route handler streams both text and UI components:

```typescript
return new StreamingTextResponse(
  new ReadableStream({
    async start(controller) {
      // Send text
      controller.enqueue(
        new TextEncoder().encode("Here's what I found:\n\n")
      );

      // Send UI component
      controller.enqueue(
        new TextEncoder().encode(
          JSON.stringify({
            type: 'color-table',
            data: colorData
          }) + '\n'
        )
      );

      // Send more text
      controller.enqueue(
        new TextEncoder().encode("\nMore information...")
      );

      controller.close();
    }
  })
);
```

### 2. Message Component (message.tsx)

The Message component parses the stream and renders UI components:

```typescript
interface UIComponent {
  type: string;
  data: any;
}

function Message({ message }: MessageProps) {
  const [parts, setParts] = useState<JSX.Element[]>([]);

  useEffect(() => {
    const lines = content.split('\n');
    let currentText = '';
    
    lines.forEach((line, index) => {
      try {
        // Try to parse as UI component
        const component = JSON.parse(line) as UIComponent;
        
        // Render accumulated text
        if (currentText.trim()) {
          elements.push(<p>{currentText.trim()}</p>);
          currentText = '';
        }
        
        // Render UI component
        if (component.type === 'color-table') {
          elements.push(<ColorTable data={component.data} />);
        }
      } catch (e) {
        // Not JSON, accumulate as text
        currentText += line + '\n';
      }
    });
  }, [message.content]);
}
```

## Available UI Components

### ColorTable Component

Displays color information in a structured table format:

```typescript
interface ColorData {
  collection: string;
  modes: {
    mode: string;
    colors: {
      name: string;
      value: string;
      description: string;
    }[];
  }[];
}
```

## Usage

When the AI needs to display structured data:

1. Format the data as a JSON object with `type` and `data` fields
2. Stream it as a single line between text content
3. The Message component will automatically detect and render it

## Benefits

- Real-time streaming of both text and UI
- Clean separation of content and presentation
- Type-safe component rendering
- Better user experience with rich UI elements

## Future Improvements

- Add more UI component types
- Support nested components
- Add animations for component transitions
- Implement component interactivity