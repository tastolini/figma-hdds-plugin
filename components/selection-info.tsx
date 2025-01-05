'use client';

import { cn } from '@/lib/utils';

interface SelectionInfoProps {
  data: {
    selection: any[];
    designSystem?: any;
  };
}

export function SelectionInfo({ data }: SelectionInfoProps) {
  const { selection } = data;

  if (!selection || selection.length === 0) {
    return (
      <div className="p-4 bg-gray-100 rounded-lg">
        <p className="text-gray-600">No elements are currently selected in Figma.</p>
      </div>
    );
  }

  return (
    <div className="p-4 bg-gray-100 rounded-lg space-y-4">
      <h3 className="font-medium text-lg">Selected Elements:</h3>
      <div className="space-y-2">
        {selection.map((item: any, index: number) => (
          <div key={index} className="p-3 bg-white rounded border">
            <div className="flex justify-between items-start">
              <div>
                <p className="font-medium">{item.name || 'Unnamed Element'}</p>
                <p className="text-sm text-gray-500">Type: {item.type}</p>
              </div>
              {item.id && (
                <span className="text-xs bg-gray-100 px-2 py-1 rounded">
                  ID: {item.id}
                </span>
              )}
            </div>
            {item.children && (
              <p className="text-sm text-gray-500 mt-1">
                Contains {item.children.length} child elements
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
