import React from 'react';
import { Handle, Position, NodeProps } from '@xyflow/react';
import { useLanguage } from '../../../contexts/LanguageContext';

export interface OpenAINodeData {
  apiKey?: string;
  model?: string;
  prompt?: string;
  responseDelay?: number; // Delay em milissegundos
}

export const OpenAINode: React.FC<NodeProps> = ({ data, selected }) => {
  const { t } = useLanguage();
  const nodeData = data as OpenAINodeData;
  const model = nodeData.model || 'gpt-3.5-turbo';
  const hasConfig = !!(nodeData.apiKey && nodeData.prompt);

  return (
    <div
      className={`bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-lg shadow-lg border-2 ${
        selected ? 'border-emerald-300 ring-2 ring-emerald-200' : 'border-emerald-400'
      } min-w-[200px]`}
    >
      <Handle
        type="target"
        position={Position.Left}
        className="!w-6 !h-6 bg-emerald-300 !border-3 border-emerald-500"
        style={{ width: '24px', height: '24px', borderRadius: '50%' }}
      />
      <div className="p-4">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center text-lg">
            🤖
          </div>
          <h3 className="font-semibold text-white text-sm">
            {t('mindFlow.nodes.openai')}
          </h3>
        </div>
        <div className="space-y-1">
          {hasConfig ? (
            <>
              <p className="text-xs text-white/80 font-medium">
                {model}
              </p>
              {nodeData.prompt && (
                <p className="text-xs text-white/70 truncate">
                  {nodeData.prompt.substring(0, 30)}
                  {nodeData.prompt.length > 30 ? '...' : ''}
                </p>
              )}
              {nodeData.responseDelay && nodeData.responseDelay > 0 && (
                <p className="text-xs text-white/70 font-medium mt-1">
                  ⏱️ Delay: {(nodeData.responseDelay / 1000).toFixed(1)}s
                </p>
              )}
            </>
          ) : (
            <p className="text-xs text-white/60 italic">
              {t('mindFlow.nodeSettings.configureOpenAI')}
            </p>
          )}
        </div>
      </div>
      <Handle
        type="source"
        position={Position.Right}
        className="!w-6 !h-6 bg-emerald-300 !border-3 border-emerald-500"
        style={{ width: '24px', height: '24px', borderRadius: '50%' }}
      />
    </div>
  );
};

