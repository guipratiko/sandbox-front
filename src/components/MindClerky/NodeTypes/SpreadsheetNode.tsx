import React from 'react';
import { Handle, Position, NodeProps } from '@xyflow/react';
import { useLanguage } from '../../../contexts/LanguageContext';

export interface SpreadsheetNodeData {
  spreadsheetId?: string;
  spreadsheetName?: string;
  isAuthenticated?: boolean;
  sheetName?: string;
}

export const SpreadsheetNode: React.FC<NodeProps> = ({ data, selected }) => {
  const { t } = useLanguage();
  const nodeData = data as SpreadsheetNodeData;

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
                d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2"
              />
            </svg>
          </div>
          <h3 className="font-semibold text-white text-sm">
            {t('mindFlow.nodes.spreadsheet')}
          </h3>
        </div>
        {nodeData.isAuthenticated ? (
          <div className="space-y-1">
            {nodeData.spreadsheetName && (
              <p className="text-xs text-white/80 font-medium truncate">
                {nodeData.spreadsheetName}
              </p>
            )}
            {nodeData.sheetName && (
              <p className="text-xs text-white/70 truncate">
                {t('mindFlow.nodeSettings.sheet')}: {nodeData.sheetName}
              </p>
            )}
          </div>
        ) : (
          <p className="text-xs text-white/60 italic">
            {t('mindFlow.nodeSettings.authenticateGoogle')}
          </p>
        )}
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

