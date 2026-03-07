import React from 'react';
import { Handle, Position, NodeProps } from '@xyflow/react';
import { useLanguage } from '../../../contexts/LanguageContext';

export interface TriggerNodeData {
  instanceId?: string;
  instanceName?: string; // Nome da instância para exibição no card
}

export const TriggerNode: React.FC<NodeProps> = ({ data, selected }) => {
  const { t } = useLanguage();
  const nodeData = data as TriggerNodeData;

  return (
    <div
      className={`bg-gradient-to-br from-green-500 to-green-600 rounded-lg shadow-lg border-2 ${
        selected ? 'border-green-300 ring-2 ring-green-200' : 'border-green-400'
      } min-w-[200px]`}
    >
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
                d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
              />
            </svg>
          </div>
          <h3 className="font-semibold text-white text-sm">
            {t('mindFlow.nodes.trigger')}
          </h3>
        </div>
        {nodeData.instanceId ? (
          <p className="text-xs text-white/80 truncate">
            {nodeData.instanceName || nodeData.instanceId}
          </p>
        ) : (
          <p className="text-xs text-white/60 italic">
            {t('mindFlow.nodeSettings.selectInstance')}
          </p>
        )}
      </div>
      <Handle
        type="source"
        position={Position.Right}
        className="!w-6 !h-6 bg-green-300 !border-3 border-green-500"
        style={{ width: '24px', height: '24px', borderRadius: '50%' }}
      />
    </div>
  );
};

