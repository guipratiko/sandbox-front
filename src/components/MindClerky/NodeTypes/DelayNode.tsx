import React from 'react';
import { Handle, Position, NodeProps } from '@xyflow/react';
import { useLanguage } from '../../../contexts/LanguageContext';

export interface DelayNodeData {
  delay?: number;
  delayUnit?: 'seconds' | 'minutes' | 'hours';
}

export const DelayNode: React.FC<NodeProps> = ({ data, selected }) => {
  const { t } = useLanguage();
  const nodeData = data as DelayNodeData;
  const delay = nodeData.delay || 0;
  const delayUnit = (nodeData.delayUnit || 'seconds') as 'seconds' | 'minutes' | 'hours';

  const formatDelay = () => {
    if (delay === 0) return t('mindFlow.nodeSettings.delayValue');
    const unitMap = {
      seconds: t('mindFlow.nodeSettings.delaySeconds'),
      minutes: t('mindFlow.nodeSettings.delayMinutes'),
      hours: t('mindFlow.nodeSettings.delayHours'),
    };
    return `${delay} ${unitMap[delayUnit]}`;
  };

  return (
    <div
      className={`bg-gradient-to-br from-yellow-500 to-orange-500 rounded-lg shadow-lg border-2 ${
        selected ? 'border-yellow-300 ring-2 ring-yellow-200' : 'border-yellow-400'
      } min-w-[200px]`}
    >
      <Handle
        type="target"
        position={Position.Left}
        className="!w-6 !h-6 bg-yellow-300 !border-3 border-yellow-500"
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
                d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>
          <h3 className="font-semibold text-white text-sm">
            {t('mindFlow.nodes.delay')}
          </h3>
        </div>
        <p className="text-xs text-white/90 font-medium">
          {formatDelay()}
        </p>
      </div>
      <Handle
        type="source"
        position={Position.Right}
        className="!w-6 !h-6 bg-yellow-300 !border-3 border-yellow-500"
        style={{ width: '24px', height: '24px', borderRadius: '50%' }}
      />
    </div>
  );
};

