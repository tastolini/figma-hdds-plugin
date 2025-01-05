declare const SITE_URL: string;

interface AutomatorCommand {
  name: string;
  metadata: Record<string, any>;
  title: string;
  description: string;
}

interface AutomatorAction {
  id: string;
  command: AutomatorCommand;
  actions: AutomatorAction[];
}

interface AutomatorScript {
  id: string;
  name: string;
  description: string;
  color: string;
  actions: AutomatorAction[];
  createdAt: number;
}

// Function to get detailed information about a node
function getNodeInfo(node: SceneNode): any {
  const baseInfo: Record<string, any> = {
    id: node.id,
    name: node.name,
    type: node.type,
    visible: node.visible,
  };

  // Add size information if available
  if ('width' in node && 'height' in node) {
    baseInfo.width = node.width;
    baseInfo.height = node.height;
  }

  // Add position information if available
  if ('x' in node && 'y' in node) {
    baseInfo.x = node.x;
    baseInfo.y = node.y;
  }

  // Add component specific information
  if (node.type === 'COMPONENT' || node.type === 'INSTANCE') {
    if ('componentProperties' in node) {
      baseInfo.componentProperties = node.componentProperties;
    }
  }

  // Add text content if it's a text node
  if (node.type === 'TEXT') {
    baseInfo.characters = (node as TextNode).characters;
    baseInfo.fontSize = (node as TextNode).fontSize;
    baseInfo.fontName = (node as TextNode).fontName;
  }

  // Add children count if it's a container
  if ('children' in node) {
    baseInfo.childCount = (node as FrameNode | GroupNode | ComponentNode | InstanceNode).children.length;
  }

  return baseInfo;
}

// Function to get selection information
function getSelectionInfo() {
  const selection = figma.currentPage.selection;
  const pageInfo = {
    id: figma.currentPage.id,
    name: figma.currentPage.name,
    type: figma.currentPage.type,
    childCount: figma.currentPage.children.length,
  };

  console.log('Current selection:', selection);
  console.log('Current page:', pageInfo);

  const selectionDetails = selection.map(node => {
    const info = getNodeInfo(node);
    console.log(`Node info for ${node.name}:`, info);
    return info;
  });

  return {
    count: selection.length,
    items: selectionDetails,
    page: pageInfo
  };
}

async function executeAutomatorAction(action: AutomatorAction, selection: readonly SceneNode[]) {
  console.log('Executing action:', action);
  const { command, actions } = action;

  switch (command.name) {
    case 'cloneFrame':
      console.log('Cloning frame...');
      if (selection.length > 0) {
        const node = selection[0];
        console.log('Selected node:', node);
        if ('clone' in node) {
          const clone = node.clone();
          // Position the clone next to the original
          if ('x' in clone && 'width' in node) {
            clone.x = node.x + node.width + 100;
          }
          // Add to the same parent as the original
          if (node.parent) {
            node.parent.appendChild(clone);
          }
          console.log('Frame cloned successfully');
        } else {
          console.log('Selected node cannot be cloned');
        }
      } else {
        console.log('No selection found');
      }
      break;

    case 'createVariant':
      console.log('Creating variant...');
      if (selection.length > 0) {
        const node = selection[0];
        const { variantName } = command.metadata;
        console.log('Creating variant with name:', variantName);
        
        // If selected node is already a component
        if (node.type === 'COMPONENT') {
          console.log('Selected node is a component');
          // Create a new component with the same properties
          const variant = figma.createComponent();
          
          // Copy properties and content from original component
          if ('width' in node && 'height' in node && 'x' in node && 'y' in node) {
            variant.resize(node.width, node.height);
            variant.x = node.x;
            variant.y = node.y + node.height + 100; // Position below original
            
            // Clone the content into the new component
            if ('clone' in node) {
              const clone = node.clone();
              variant.appendChild(clone);
            }
            
            // Set the variant name
            variant.name = variantName;
            
            // Add to the same parent as the original
            if (node.parent?.type === 'COMPONENT_SET') {
              node.parent.appendChild(variant);
            } else if (node.parent) {
              // Create a new component set
              const componentSet = figma.combineAsVariants([node, variant], node.parent);
              componentSet.name = node.name.split('=')[0]; // Use base name for component set
            }
            console.log('Variant created successfully');
          }
        } else {
          console.log('Selected node is not a component, creating new component');
          // Create a new component from non-component node
          const component = figma.createComponent();
          
          // Copy properties from selected node
          if ('width' in node && 'height' in node && 'x' in node && 'y' in node) {
            component.resize(node.width, node.height);
            component.x = node.x;
            component.y = node.y;
            
            // Clone the content into the component
            if ('clone' in node) {
              const clone = node.clone();
              component.appendChild(clone);
            }
            
            // Set the variant name
            component.name = variantName;
            console.log('New component created successfully');
          }
        }
      } else {
        console.log('No selection found');
      }
      break;

    case 'convertToComponent':
      console.log('Converting to component...');
      if (selection.length > 0) {
        const node = selection[0];
        if ('width' in node && 'height' in node && 'x' in node && 'y' in node) {
          const component = figma.createComponent();
          component.x = node.x;
          component.y = node.y;
          component.resize(node.width, node.height);
          
          // Move all selected items into the component
          selection.forEach(selectedNode => {
            if (selectedNode.parent) {
              selectedNode.parent.appendChild(component);
              component.appendChild(selectedNode);
            }
          });
          console.log('Converted to component successfully');
        }
      } else {
        console.log('No selection found');
      }
      break;

    case 'setInstanceProperty':
      console.log('Setting instance property...');
      if (selection.length > 0) {
        const node = selection[0];
        if ('setProperties' in node) {
          const { property, value } = command.metadata;
          node.setProperties({ [property]: value });
          console.log('Property set successfully:', property, value);
        } else {
          console.log('Selected node does not support properties');
        }
      } else {
        console.log('No selection found');
      }
      break;

    case 'setVariable':
      console.log('Setting variable...');
      if (selection.length > 0) {
        const { key, value } = command.metadata;
        console.log('Setting variable:', key, value);
        selection.forEach(node => {
          if ('boundVariables' in node) {
            // Find the variable by key
            const collection = figma.variables.getLocalVariableCollections()[0];
            if (collection) {
              const variable = collection.variableIds
                .map(id => figma.variables.getVariableById(id))
                .find(v => v?.name === key);
              
              if (variable) {
                console.log('Found variable:', variable.name);
                // Get the default mode ID
                const modeId = collection.defaultModeId;
                
                // Set the variable value using the proper API
                variable.setValueForMode(modeId, value);
                
                // Bind the variable to the node
                if (node.type === 'INSTANCE') {
                  // Pass the variable directly to setBoundVariable
                  node.setBoundVariable(key as VariableBindableNodeField, variable);
                  console.log('Variable bound successfully');
                } else {
                  console.log('Node is not an instance, cannot bind variable');
                }
              } else {
                console.log('Variable not found:', key);
              }
            } else {
              console.log('No variable collection found');
            }
          } else {
            console.log('Node does not support variables');
          }
        });
      } else {
        console.log('No selection found');
      }
      break;
  }

  // Execute nested actions
  for (const subAction of actions) {
    await executeAutomatorAction(subAction, selection);
  }
}

console.log('Plugin code loaded');

figma.showUI(`<script>window.location.href = '${SITE_URL}'</script>`, {
  width: 700,
  height: 700,
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
    selection: selectionInfo,
  });
});

figma.ui.onmessage = async (message) => {
  console.log('Received message:', message);

  switch (message.type) {
    case "GET_SELECTION": {
      console.log('Getting selection info');
      const selectionInfo = getSelectionInfo();
      console.log('Selection info:', selectionInfo);
      sendToUI({
        type: 'SELECTION_INFO',
        selection: selectionInfo,
      });
      break;
    }

    case "EXECUTE_AUTOMATOR": {
      console.log('Executing automator script:', message.script);
      try {
        const script: AutomatorScript = message.script;
        const selection = figma.currentPage.selection;
        console.log('Current selection:', selection);

        for (const action of script.actions) {
          await executeAutomatorAction(action, selection);
        }

        console.log('Script execution completed');
        sendToUI({
          type: "AUTOMATOR_COMPLETE",
          id: message.id,
        });
      } catch (e) {
        console.error('Script execution failed:', e);
        sendToUI({
          type: "AUTOMATOR_ERROR",
          error: e instanceof Error ? e.message : String(e),
          id: message.id,
        });
      }
      break;
    }
  }
};
