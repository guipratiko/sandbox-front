import React, { useCallback, useRef, useEffect } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  addEdge,
  Connection,
  Edge,
  Node,
  NodeTypes,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { TriggerNode, ConditionNode, DelayNode, EndNode, ResponseNode, TypebotTriggerNode, WebhookTriggerNode, SpreadsheetNode, OpenAINode } from './NodeTypes';
import { WorkflowNode, WorkflowEdge } from '../../services/api';

interface FlowEditorProps {
  initialNodes?: WorkflowNode[];
  initialEdges?: WorkflowEdge[];
  onNodesChange?: (nodes: WorkflowNode[]) => void;
  onEdgesChange?: (edges: WorkflowEdge[]) => void;
  onNodeClick?: (node: Node) => void;
  selectedNodeId?: string | null;
}

const nodeTypes: NodeTypes = {
  whatsappTrigger: TriggerNode as any,
  typebotTrigger: TypebotTriggerNode as any,
  webhookTrigger: WebhookTriggerNode as any,
  condition: ConditionNode as any,
  delay: DelayNode as any,
  end: EndNode as any,
  response: ResponseNode as any,
  spreadsheet: SpreadsheetNode as any,
  openai: OpenAINode as any,
};

// Função auxiliar para comparar arrays de nós
const nodesAreEqual = (nodes1: WorkflowNode[], nodes2: WorkflowNode[]): boolean => {
  if (nodes1.length !== nodes2.length) return false;
  return nodes1.every((node1, index) => {
    const node2 = nodes2[index];
    return (
      node1.id === node2.id &&
      node1.type === node2.type &&
      JSON.stringify(node1.position) === JSON.stringify(node2.position) &&
      JSON.stringify(node1.data) === JSON.stringify(node2.data)
    );
  });
};

// Função auxiliar para comparar arrays de edges
const edgesAreEqual = (edges1: WorkflowEdge[], edges2: WorkflowEdge[]): boolean => {
  if (edges1.length !== edges2.length) return false;
  return edges1.every((edge1, index) => {
    const edge2 = edges2[index];
    return (
      edge1.id === edge2.id &&
      edge1.source === edge2.source &&
      edge1.target === edge2.target &&
      edge1.sourceHandle === edge2.sourceHandle
    );
  });
};

export const FlowEditor: React.FC<FlowEditorProps> = ({
  initialNodes = [],
  initialEdges = [],
  onNodesChange,
  onEdgesChange,
  onNodeClick,
  selectedNodeId,
}) => {
  const prevInitialNodesRef = useRef<WorkflowNode[]>(initialNodes);
  const prevInitialEdgesRef = useRef<WorkflowEdge[]>(initialEdges);
  const isUpdatingFromParentRef = useRef(false);

  // Converter WorkflowNode/WorkflowEdge para Node/Edge do React Flow
  const convertToReactFlowNodes = useCallback((nodes: WorkflowNode[]): Node[] => {
    return nodes.map((node) => ({
      id: node.id,
      type: node.type,
      position: node.position,
      data: node.data,
      selected: node.id === selectedNodeId,
    }));
  }, [selectedNodeId]);

  const convertToReactFlowEdges = useCallback((edges: WorkflowEdge[]): Edge[] => {
    return edges.map((edge) => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      sourceHandle: edge.sourceHandle,
      style: { strokeWidth: 2 },
    }));
  }, []);

  // Converter Node/Edge do React Flow para WorkflowNode/WorkflowEdge
  const convertToWorkflowNodes = useCallback((nodes: Node[]): WorkflowNode[] => {
    return nodes.map((node) => ({
      id: node.id,
      type: node.type as WorkflowNode['type'],
      position: node.position,
      data: node.data,
    }));
  }, []);

  const convertToWorkflowEdges = useCallback((edges: Edge[]): WorkflowEdge[] => {
    return edges.map((edge) => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      sourceHandle: edge.sourceHandle || undefined,
    }));
  }, []);

  const [nodes, setNodes, onNodesChangeInternal] = useNodesState(
    convertToReactFlowNodes(initialNodes)
  );
  const [edges, setEdges, onEdgesChangeInternal] = useEdgesState(
    convertToReactFlowEdges(initialEdges)
  );

  // Atualizar apenas quando initialNodes/initialEdges mudarem externamente
  useEffect(() => {
    // Verificar se realmente mudou
    const nodesChanged = !nodesAreEqual(initialNodes, prevInitialNodesRef.current);
    const edgesChanged = !edgesAreEqual(initialEdges, prevInitialEdgesRef.current);

    if (nodesChanged) {
      prevInitialNodesRef.current = initialNodes;
      isUpdatingFromParentRef.current = true;
      setNodes(convertToReactFlowNodes(initialNodes));
      // Resetar flag após um pequeno delay
      setTimeout(() => {
        isUpdatingFromParentRef.current = false;
      }, 50);
    }

    if (edgesChanged) {
      prevInitialEdgesRef.current = initialEdges;
      isUpdatingFromParentRef.current = true;
      setEdges(convertToReactFlowEdges(initialEdges));
      setTimeout(() => {
        isUpdatingFromParentRef.current = false;
      }, 50);
    }
  }, [initialNodes, initialEdges, setNodes, setEdges, convertToReactFlowNodes, convertToReactFlowEdges]);

  // Notificar mudanças para o componente pai (apenas quando não for atualização do pai)
  useEffect(() => {
    if (isUpdatingFromParentRef.current) return;

    const timeoutId = setTimeout(() => {
      if (onNodesChange) {
        const workflowNodes = convertToWorkflowNodes(nodes);
        // Só notificar se realmente mudou
        if (!nodesAreEqual(workflowNodes, prevInitialNodesRef.current)) {
          onNodesChange(workflowNodes);
        }
      }
    }, 200);

    return () => clearTimeout(timeoutId);
  }, [nodes, onNodesChange, convertToWorkflowNodes]);

  useEffect(() => {
    if (isUpdatingFromParentRef.current) return;

    const timeoutId = setTimeout(() => {
      if (onEdgesChange) {
        const workflowEdges = convertToWorkflowEdges(edges);
        // Só notificar se realmente mudou
        if (!edgesAreEqual(workflowEdges, prevInitialEdgesRef.current)) {
          onEdgesChange(workflowEdges);
        }
      }
    }, 200);

    return () => clearTimeout(timeoutId);
  }, [edges, onEdgesChange, convertToWorkflowEdges]);

  const onConnect = useCallback(
    (params: Connection) => {
      const newEdge = addEdge(params, edges);
      setEdges(newEdge);
    },
    [edges, setEdges]
  );

  const onNodeClickInternal = useCallback(
    (event: React.MouseEvent, node: Node) => {
      if (onNodeClick) {
        onNodeClick(node);
      }
    },
    [onNodeClick]
  );

  return (
    <div className="w-full h-full bg-gray-50 dark:bg-[#020617]">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChangeInternal}
        onEdgesChange={onEdgesChangeInternal}
        onConnect={onConnect}
        onNodeClick={onNodeClickInternal}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ maxZoom: 0.5 }}
        className="bg-gray-50 dark:bg-[#020617]"
      >
        <Background />
        <Controls />
        <MiniMap
          nodeColor={(node) => {
            const colorMap: Record<string, string> = {
              whatsappTrigger: '#10b981',
              typebotTrigger: '#6366f1',
              webhookTrigger: '#9333ea',
              condition: '#3b82f6',
              delay: '#f59e0b',
              end: '#ef4444',
              response: '#a855f7',
              spreadsheet: '#10b981',
            };
            return colorMap[node.type || ''] || '#6b7280';
          }}
          className="bg-white dark:bg-[#091D41]"
        />
      </ReactFlow>
    </div>
  );
};
