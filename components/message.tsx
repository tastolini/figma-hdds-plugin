'use client';

import { memo } from 'react';
import { Message as AIMessage } from 'ai';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { ColorTable } from './color-table';
import { SelectionInfo } from './selection-info';

interface MessageProps {
  message: AIMessage;
}

interface MessageChunk {
  type: 'text' | 'tool-call';
  content?: string;
  name?: string;
  data?: any;
}

function Message({ message }: MessageProps) {
  const renderContent = () => {
    const elements: JSX.Element[] = [];
    let currentIndex = 0;

    try {
      // Try parsing the entire message as a single JSON object first
      const chunk = JSON.parse(message.content) as MessageChunk;
      const element = renderChunk(chunk, currentIndex++);
      return element ? [element] : [];
    } catch (e) {
      // If that fails, try parsing line by line
      const lines = message.content.split('\n');
      
      lines.forEach((line, index) => {
        if (!line.trim()) return;

        try {
          const chunk = JSON.parse(line) as MessageChunk;
          const element = renderChunk(chunk, currentIndex++);
          if (element) {
            elements.push(element);
          }
        } catch (e) {
          // If not JSON, render as plain text
          elements.push(
            <p key={`text-${currentIndex++}`} className="text-gray-800">
              {line}
            </p>
          );
        }
      });
    }

    return elements;
  };

  const renderChunk = (chunk: MessageChunk, index: number): JSX.Element | null => {
    switch (chunk.type) {
      case 'text':
        return chunk.content ? (
          <p key={`text-${index}`} className="text-gray-800">
            {chunk.content}
          </p>
        ) : null;

      case 'tool-call':
        switch (chunk.name) {
          case 'getColorInfo':
            if (chunk.data) {
              return (
                <div key={`tool-${index}`} className="my-4">
                  <ColorTable data={chunk.data} />
                </div>
              );
            }
            break;

          case 'getSelectionInfo':
            if (chunk.data) {
              return (
                <div key={`tool-${index}`} className="my-4">
                  <SelectionInfo data={chunk.data} />
                </div>
              );
            }
            break;
        }
        return null;

      default:
        return null;
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        className={cn('group relative mb-4 flex items-start md:mb-6', {
          'justify-end': message.role === 'user'
        })}
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 20 }}
      >
        <div className="flex-1 px-1 ml-4 space-y-2 overflow-hidden">
          {renderContent()}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

export default memo(Message);
