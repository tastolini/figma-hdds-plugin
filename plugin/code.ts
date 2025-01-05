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

async function executeAutomatorAction(action: AutomatorAction, selection: readonly SceneNode[]) {
  const { command, actions } = action;

  switch (command.name) {
    case 'cloneFrame':
      if (selection.length > 0) {
        const node = selection[0];
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
        }
      }
      break;

    case 'createVariant':
      if (selection.length > 0) {
        const node = selection[0];
        const { variantName } = command.metadata;
        
        // If selected node is already a component
        if (node.type === 'COMPONENT') {
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
          }
        } else {
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
          }
        }
      }
      break;

    case 'convertToComponent':
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
        }
      }
      break;

    case 'setInstanceProperty':
      if (selection.length > 0) {
        const node = selection[0];
        if ('setProperties' in node) {
          const { property, value } = command.metadata;
          node.setProperties({ [property]: value });
        }
      }
      break;

    case 'setVariable':
      if (selection.length > 0) {
        const { key, value } = command.metadata;
        selection.forEach(node => {
          if ('boundVariables' in node) {
            // Find the variable by key
            const collection = figma.variables.getLocalVariableCollections()[0];
            if (collection) {
              const variable = collection.variableIds
                .map(id => figma.variables.getVariableById(id))
                .find(v => v?.name === key);
              
              if (variable) {
                // Get the default mode ID
                const modeId = collection.defaultModeId;
                
                // Set the variable value using the proper API
                variable.setValueForMode(modeId, value);
                
                // Bind the variable to the node
                if (node.type === 'INSTANCE') {
                  // Pass the variable directly to setBoundVariable
                  node.setBoundVariable(key as VariableBindableNodeField, variable);
                }
              }
            }
          }
        });
      }
      break;
  }

  // Execute nested actions
  for (const subAction of actions) {
    await executeAutomatorAction(subAction, selection);
  }
}

figma.showUI(`<script>window.location.href = '${SITE_URL}'</script>`, {
  width: 700,
  height: 700,
});

figma.ui.onmessage = async (message, props) => {
  if (props.origin !== SITE_URL) {
    return;
  }

  switch (message.type) {
    case "EXECUTE_AUTOMATOR": {
      try {
        const script: AutomatorScript = message.script;
        const selection = figma.currentPage.selection;

        for (const action of script.actions) {
          await executeAutomatorAction(action, selection);
        }

        figma.ui.postMessage({
          type: "AUTOMATOR_COMPLETE",
          id: message.id,
        });
      } catch (e) {
        figma.ui.postMessage({
          type: "AUTOMATOR_ERROR",
          error: e instanceof Error ? e.message : String(e),
          id: message.id,
        });
      }
      break;
    }
  }
};
