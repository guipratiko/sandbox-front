import React from 'react';
import { Handle, Position, NodeProps } from '@xyflow/react';
import { useLanguage } from '../../../contexts/LanguageContext';

export interface EndNodeData {
  // Nó de fim não precisa de dados
}

export const EndNode: React.FC<NodeProps> = ({ selected }) => {
  const { t } = useLanguage();

  return (
    <div
      className={`bg-gradient-to-br from-red-500 to-red-600 rounded-lg shadow-lg border-2 ${
        selected ? 'border-red-300 ring-2 ring-red-200' : 'border-red-400'
      } min-w-[200px]`}
    >
      <Handle
        type="target"
        position={Position.Left}
        className="!w-6 !h-6 bg-red-300 !border-3 border-red-500"
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
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </div>
          <h3 className="font-semibold text-white text-sm">
            {t('mindFlow.nodes.end')}
          </h3>
        </div>
        <p className="text-xs text-white/80">
          {t('mindFlow.nodes.end.description')}
        </p>
      </div>
    </div>
  );
};

