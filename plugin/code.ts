// Collection names
const COLLECTIONS = {
  BRAND_COLORS: 'Brand Colors',
  COLOR_MODES: 'Color Mode',
  SCREENS: 'Screens'
} as const;

// Color utility functions
function padHex(hex: string): string {
  return hex.length === 1 ? '0' + hex : hex;
}

function rgbToHex(color: RGB): string {
  const r = Math.round(color.r * 255).toString(16);
  const g = Math.round(color.g * 255).toString(16);
  const b = Math.round(color.b * 255).toString(16);
  return `#${padHex(r)}${padHex(g)}${padHex(b)}`.toUpperCase();
}

// Function to convert any color value to hex
function toHexColor(value: VariableValue): string {
  if (typeof value === 'object' && value !== null && 'r' in value) {
    return rgbToHex(value as RGB);
  } else if (typeof value === 'string' && value.startsWith('#')) {
    return value.toUpperCase();
  }
  return 'N/A';
}

// Types for color system
type ModeId = string;
type ModeName = string;
type CollectionModes = Record<ModeId, ModeName>;

interface ColorMode {
  modeId: string;
  name: string;
  value: string;
}

interface ColorVariable {
  name: string;
  value: string;
  description: string;
  resolvedValue: string | null;
}

interface ColorCollection {
  [modeName: string]: ColorVariable[];
}

interface ColorInfo {
  modes: {
    [collectionName: string]: {
      [modeId: string]: string;
    };
  };
  collections: {
    [collectionName: string]: ColorCollection;
  };
}

interface ThemeGroup {
  name: string;
  colors: ColorVariable[];
  subgroups: {
    name: string;
    colors: ColorVariable[];
  }[];
}

interface CollectionMode {
  name: string;
  modes: string[];
  modeIds: string[];
}

type ColorsByCategory = { [key: string]: ColorVariable[] };

// Function to get design system information
function getDesignSystemInfo() {
  console.log('Getting design system info...');
  
  const variables = figma.variables.getLocalVariables();
  const collections = figma.variables.getLocalVariableCollections();
  
  console.log('Found variables:', variables.length);
  console.log('Found collections:', collections.length);
  
  // Get specific collections
  const brandColors = collections.find(c => c.name === COLLECTIONS.BRAND_COLORS);
  const colorModes = collections.find(c => c.name === COLLECTIONS.COLOR_MODES);
  const screens = collections.find(c => c.name === COLLECTIONS.SCREENS);
  
  console.log('Collections found:', {
    brandColors: brandColors?.name,
    colorModes: colorModes?.name,
    screens: screens?.name
  });

  // Process color variables (from Brand Colors and Color Mode collections)
  const colorVariables = variables.filter(v => 
    (v.variableCollectionId === brandColors?.id || v.variableCollectionId === colorModes?.id) &&
    v.resolvedType === 'COLOR'
  );

  // Process screen variables (from Screens collection)
  const screenVariables = variables.filter(v => 
    v.variableCollectionId === screens?.id
  );

  // Process color information
  const processedColors = processColorVariables(colorVariables, collections);
  
  // Process screen information
  const processedScreens = processScreenVariables(screenVariables, collections);

  return {
    variables: {
      colors: processedColors,
      screens: processedScreens
    }
  };
}

function processColorVariables(colorVariables: Variable[], collections: VariableCollection[]): ColorInfo {
  console.log('Processing color variables with:', {
    numVariables: colorVariables.length,
    collections: collections.map(c => c.name)
  });

  const colorInfo: ColorInfo = {
    modes: {},
    collections: {}
  };

  // First, create a map of all brand colors for reference
  const brandColorMap = new Map<string, { value: string, name: string }>();
  const brandCollection = collections.find(c => c.name === COLLECTIONS.BRAND_COLORS);
  if (brandCollection) {
    const brandVars = colorVariables.filter(v => v.variableCollectionId === brandCollection.id);
    brandVars.forEach(variable => {
      const modeId = Object.keys(variable.valuesByMode)[0]; // Brand colors only have one mode
      const value = variable.valuesByMode[modeId];
      if (typeof value === 'object' && 'r' in value) {
        brandColorMap.set(variable.id, {
          value: toHexColor(value),
          name: variable.name
        });
      }
    });
  }

  // Convert map to object for logging in a compatible way
  const brandColorObj = Array.from(brandColorMap).reduce((obj, [key, value]) => {
    obj[key] = value;
    return obj;
  }, {} as Record<string, { value: string, name: string }>);
  
  console.log('Brand color map:', brandColorObj);

  // Process collections and their modes
  collections.forEach(collection => {
    if (collection.name === COLLECTIONS.BRAND_COLORS || collection.name === COLLECTIONS.COLOR_MODES) {
      // Initialize the collection in modes and collections
      colorInfo.modes[collection.name] = {};
      colorInfo.collections[collection.name] = {};

      // Store modes
      for (const mode of collection.modes) {
        colorInfo.modes[collection.name][mode.modeId] = mode.name;
      }
      
      // Get variables for this collection
      const collectionVars = colorVariables.filter(v => v.variableCollectionId === collection.id);
      
      // Process variables by mode
      for (const mode of collection.modes) {
        const modeName = mode.name;
        const modeId = mode.modeId;
        
        // Initialize the mode in the collection if not exists
        if (!colorInfo.collections[collection.name][modeName]) {
          colorInfo.collections[collection.name][modeName] = [];
        }
        
        // Process each variable
        collectionVars.forEach(variable => {
          console.log('Processing variable:', {
            collection: collection.name,
            mode: modeName,
            name: variable.name,
            type: variable.resolvedType,
            value: variable.valuesByMode[modeId]
          });

          const value = variable.valuesByMode[modeId];
          let aliasValue: string | null = null;
          let resolvedValue: string | null = null;

          if (value && typeof value === 'object') {
            if ('r' in value) {
              // Direct color value
              resolvedValue = toHexColor(value);
              aliasValue = resolvedValue;
            } else if ('id' in value) {
              // Alias to another color
              const referencedColor = brandColorMap.get(value.id);
              if (referencedColor) {
                aliasValue = `→ ${referencedColor.name}`;
                resolvedValue = referencedColor.value;
              }
            }
          }

          colorInfo.collections[collection.name][modeName].push({
            name: variable.name,
            value: aliasValue || 'N/A',
            resolvedValue,
            description: variable.description || ''
          });
        });
      }
    }
  });

  console.log('Final color info:', JSON.stringify(colorInfo, null, 2));
  return colorInfo;
}

function processScreenVariables(variables: Variable[], collections: VariableCollection[]) {
  const screenTokens: { [key: string]: any[] } = {
    typography: [],
    spacing: [],
    sizing: [],
    effects: []
  };

  variables.forEach(v => {
    const nameParts = v.name.split('/');
    const category = nameParts[0].toLowerCase();
    
    if (category in screenTokens) {
      screenTokens[category].push({
        name: v.name,
        value: v.valuesByMode[Object.keys(v.valuesByMode)[0]],
        description: v.description || '',
        resolvedType: v.resolvedType
      });
    }
  });

  return screenTokens;
}

// Function to get selection information
function getSelectionInfo() {
  const selection = figma.currentPage.selection;
  return {
    count: selection.length,
    items: selection.map(node => ({
      id: node.id,
      name: node.name,
      type: node.type
    })),
    page: {
      id: figma.currentPage.id,
      name: figma.currentPage.name
    }
  };
}

// Initialize plugin
console.log('Initializing plugin...');

// Show UI with the URL from environment
figma.showUI(`<script>
  window.location.href = 'http://localhost:3000/';
</script>`, {
  width: 700,
  height: 700,
  themeColors: true
});

// Function to send message to UI
function sendToUI(message: any) {
  figma.ui.postMessage(message);
}

// Listen for selection changes
figma.on('selectionchange', () => {
  console.log('Selection changed');
  const selectionInfo = getSelectionInfo();
  sendToUI({
    type: 'SELECTION_CHANGED',
    selection: selectionInfo
  });
});

// Handle messages from UI
figma.ui.onmessage = async (msg) => {
  console.log('Received message:', msg);

  if (msg.type === 'UPDATE_DESIGN_SYSTEM') {
    // Update the design system info and send it back to UI
    const designSystem = getDesignSystemInfo();
    console.log('Updated design system info:', JSON.stringify(designSystem, null, 2));
    figma.ui.postMessage({
      type: 'DESIGN_SYSTEM_UPDATED',
      designSystem
    });
    return;
  }

  if (msg.type === 'query') {
    const query = msg.query.toLowerCase();
    console.log('Processing query:', query);

    const designSystem = getDesignSystemInfo();
    console.log('Design system info:', JSON.stringify(designSystem, null, 2));

    const selection = getSelectionInfo();
    console.log('Selection info:', selection);
    
    try {
      // Determine if this is a color-related query
      const isColorQuery = query.includes('color') || 
                          query.includes('brand') || 
                          query.includes('theme') ||
                          query.includes('dark') ||
                          query.includes('light');

      console.log('Query type:', isColorQuery ? 'color query' : 'non-color query');

      const systemContext = isColorQuery 
        ? `You are a Design System Assistant that ONLY provides information about colors from the Brand Colors and Color Mode collections.
           When asked about colors:
           - Use Brand Colors collection for brand-specific colors (primary brand colors)
           - Use Color Mode collection for theme-specific colors (fg, surface, stroke)
           - Always show the color value in both light and dark modes when applicable
           - Display colors visually with their hex values
           - Group colors by their categories (brand/, fg/, surface/, etc.)
           NEVER give general color advice - only show colors that exist in these collections.`
        : `You are a Design System Assistant that ONLY provides information from the Screens collection.
           This includes typography, spacing, sizing, and effects.
           NEVER give general design advice - only show tokens that exist in the Screens collection.`;

      const requestBody = {
        messages: [
          { 
            role: 'system', 
            content: systemContext
          },
          { role: 'user', content: query }
        ],
        designSystem: {
          variables: {
            colors: {
              collections: designSystem.variables.colors.collections,
              modes: designSystem.variables.colors.modes
            }
          }
        },
        selection
      };

      console.log('Sending request to AI:', JSON.stringify(requestBody, null, 2));

      const response = await fetch('http://localhost:3000/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody)
      });

      const result = await response.json();
      console.log('Received response from AI:', result);

      figma.ui.postMessage({
        type: 'QUERY_RESPONSE',
        ...result
      });
    } catch (error) {
      console.error('Error:', error);
      figma.ui.postMessage({
        type: 'QUERY_RESPONSE',
        role: 'assistant',
        content: 'Sorry, there was an error processing your request. Please try again.'
      });
    }
  }
};
