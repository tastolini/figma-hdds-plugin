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
  data: any; // The data is already parsed JSON
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
                    {mode.colors.map((color) => (
                      <TableRow key={color.name}>
                        <TableCell className="font-medium">{color.name}</TableCell>
                        <TableCell className="font-mono">{color.value}</TableCell>
                        <TableCell>
                          <div
                            className="h-8 w-8 rounded-md border"
                            style={{ backgroundColor: color.value }}
                          />
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {color.description || '-'}
                        </TableCell>
                      </TableRow>
                    ))}
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
