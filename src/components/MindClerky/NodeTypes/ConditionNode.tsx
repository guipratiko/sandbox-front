import React from 'react';
import { Handle, Position, NodeProps } from '@xyflow/react';
import { useLanguage } from '../../../contexts/LanguageContext';

export interface ConditionNodeData {
  conditions?: Array<{ id: string; text: string; outputId: string }>;
}

export const ConditionNode: React.FC<NodeProps> = ({ data, selected }) => {
  const { t } = useLanguage();
  const nodeData = data as ConditionNodeData;
  const conditions = nodeData.conditions || [];

  return (
    <div
      className={`bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg shadow-lg border-2 ${
        selected ? 'border-blue-300 ring-2 ring-blue-200' : 'border-blue-400'
      } min-w-[200px]`}
    >
      <Handle
        type="target"
        position={Position.Left}
        className="!w-6 !h-6 bg-blue-300 !border-3 border-blue-500"
        style={{ width: '24px', height: '24px', borderRadius: '50%' }}
      />
      <div className="p-4">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center">
            <svg
              className="w-5 h-5 text-white"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
              />
            </svg>
          </div>
          <h3 className="font-semibold text-white text-sm">
            {t('mindFlow.nodes.condition')}
          </h3>
        </div>
        {conditions.length > 0 ? (
          <div className="space-y-1">
            {conditions.slice(0, 3).map((condition: { id: string; text: string; outputId: string }) => (
              <p key={condition.id} className="text-xs text-white/90 truncate">
                • {condition.text}
              </p>
            ))}
            {conditions.length > 3 && (
              <p className="text-xs text-white/60">
                +{conditions.length - 3} {t('mindFlow.nodeSettings.conditions').toLowerCase()}
              </p>
            )}
          </div>
        ) : (
          <p className="text-xs text-white/60 italic">
            {t('mindFlow.nodeSettings.addCondition')}
          </p>
        )}
      </div>
      {/* Saídas dinâmicas para cada condição */}
      {conditions.map((condition: { id: string; text: string; outputId: string }, index: number) => (
        <Handle
          key={condition.outputId}
          type="source"
          position={Position.Right}
          id={condition.outputId}
          className="!w-6 !h-6 bg-blue-300 !border-3 border-blue-500"
          style={{ top: `${20 + (index + 1) * 25}%`, width: '24px', height: '24px', borderRadius: '50%' }}
        />
      ))}
    </div>
  );
};

