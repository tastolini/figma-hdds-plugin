'use client';

import { memo } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

interface ColorInfo {
  name: string;
  value: string;
  description?: string;
}

interface ColorMode {
  mode: string;
  colors: ColorInfo[];
}

interface ColorCollection {
  collection: string;
  modes: ColorMode[];
}

interface ColorTableProps {
  data: any;
}

function cleanColorValue(value: string): string {
  // Remove arrow and whitespace, then the brand/ prefix if it exists
  return value.replace('→', '').trim().replace('brand/', '');
}

function PureColorTable({ data }: ColorTableProps) {
  let parsedData: ColorCollection[];
  try {
    parsedData = Array.isArray(data) ? data : [data];
  } catch (e) {
    console.error('Failed to process color data:', e);
    return <div className="text-red-500">Error: Invalid color data</div>;
  }

  if (!parsedData.length) {
    return <div className="text-muted-foreground">No color information available</div>;
  }

  // Collect all brand colors for reference
  const brandColors = new Map<string, string>(
    parsedData
      .find(c => c.collection === 'Brand Colors')
      ?.modes.flatMap(mode => 
        mode.colors.flatMap(color => [
          [cleanColorValue(color.name), color.value],
          [color.name, color.value]
        ] as [string, string][])
      ) || []
  );

  console.log('Brand Colors Map:', Object.fromEntries(brandColors));

  return (
    <div className="flex flex-col gap-6">
      {parsedData.map((collection) => (
        <div key={collection.collection} className="flex flex-col gap-4">
          <h3 className="text-lg font-semibold text-foreground">{collection.collection}</h3>
          {collection.modes.map((mode) => (
            <div key={mode.mode} className="flex flex-col gap-2">
              <h4 className="text-md font-medium text-muted-foreground">{mode.mode}</h4>
              <div className="rounded-lg border bg-card">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Value</TableHead>
                      <TableHead>Preview</TableHead>
                      <TableHead>Description</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {mode.colors.map((color) => {
                      const lookupKey = cleanColorValue(color.value);
                      const previewColor = collection.collection === 'Brand Colors'
                        ? color.value
                        : brandColors.get(lookupKey);
                      
                      console.log(
                        `Color ${color.name}:`,
                        `\n  Value: ${color.value}`,
                        `\n  Lookup Key: ${lookupKey}`,
                        `\n  Preview Color: ${previewColor}`
                      );
                      
                      return (
                        <TableRow key={color.name}>
                          <TableCell className="font-medium">{color.name}</TableCell>
                          <TableCell className="font-mono">{color.value}</TableCell>
                          <TableCell>
                            <div
                              className="h-8 w-8 rounded-md border"
                              style={{
                                backgroundColor: previewColor || 'transparent'
                              } as React.CSSProperties}
                            />
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {color.description || '-'}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

export const ColorTable = memo(PureColorTable);
