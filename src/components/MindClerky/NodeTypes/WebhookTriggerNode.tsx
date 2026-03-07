import React from 'react';
import { Handle, Position, NodeProps } from '@xyflow/react';
import { useLanguage } from '../../../contexts/LanguageContext';

export interface WebhookTriggerNodeData {
  webhookUrl?: string;
  workflowId?: string;
  listening?: boolean;
}

export const WebhookTriggerNode: React.FC<NodeProps> = ({ data, selected }) => {
  const { t } = useLanguage();
  const nodeData = data as WebhookTriggerNodeData;

  return (
    <div
      className={`bg-gradient-to-br from-purple-500 to-purple-600 rounded-lg shadow-lg border-2 ${
        selected ? 'border-purple-300 ring-2 ring-purple-200' : 'border-purple-400'
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
                d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
          </div>
          <h3 className="font-semibold text-white text-sm">
            {t('mindFlow.nodes.webhookTrigger')}
          </h3>
        </div>
        {nodeData.listening && (
          <div className="mt-2 flex items-center gap-2">
            <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
            <p className="text-xs text-white/80">
              {t('mindFlow.nodeSettings.listening')}
            </p>
          </div>
        )}
      </div>
      <Handle
        type="source"
        position={Position.Right}
        className="!w-6 !h-6 bg-purple-300 !border-3 border-purple-500"
        style={{ width: '24px', height: '24px', borderRadius: '50%' }}
      />
    </div>
  );
};
