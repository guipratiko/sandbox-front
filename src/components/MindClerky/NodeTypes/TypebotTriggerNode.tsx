import React from 'react';
import { Handle, Position, NodeProps } from '@xyflow/react';
import { useLanguage } from '../../../contexts/LanguageContext';

export interface TypebotTriggerNodeData {
  webhookUrl?: string;
  workflowId?: string;
}

export const TypebotTriggerNode: React.FC<NodeProps> = ({ data, selected }) => {
  const { t } = useLanguage();
  const nodeData = data as TypebotTriggerNodeData;

  return (
    <div
      className={`bg-gradient-to-br from-indigo-500 to-indigo-600 rounded-lg shadow-lg border-2 ${
        selected ? 'border-indigo-300 ring-2 ring-indigo-200' : 'border-indigo-400'
      } min-w-[200px]`}
    >
      <div className="p-4">
        <div className="flex items-center gap-2">
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
                d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
              />
            </svg>
          </div>
          <h3 className="font-semibold text-white text-sm">
            {t('mindFlow.nodes.typebotTrigger')}
          </h3>
        </div>
      </div>
      <Handle
        type="source"
        position={Position.Right}
        className="!w-6 !h-6 bg-indigo-300 !border-3 border-indigo-500"
        style={{ width: '24px', height: '24px', borderRadius: '50%' }}
      />
    </div>
  );
};

