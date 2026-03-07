import React from 'react';
import { Handle, Position, NodeProps } from '@xyflow/react';
import { useLanguage } from '../../../contexts/LanguageContext';

export interface ResponseNodeData {
  responseType?: 'text' | 'image' | 'image_caption' | 'video' | 'video_caption' | 'audio' | 'file';
  content?: string;
  mediaUrl?: string;
  caption?: string;
  fileName?: string;
  responseDelay?: number; // Delay em milissegundos
}

export const ResponseNode: React.FC<NodeProps> = ({ data, selected }) => {
  const { t } = useLanguage();
  const nodeData = data as ResponseNodeData;
  const responseType = nodeData.responseType || 'text';

  const getTypeLabel = () => {
    const typeMap: Record<string, string> = {
      text: t('templateBuilder.types.text'),
      image: t('templateBuilder.types.image'),
      image_caption: t('templateBuilder.types.imageCaption'),
      video: t('templateBuilder.types.video'),
      video_caption: t('templateBuilder.types.videoCaption'),
      audio: t('templateBuilder.types.audio'),
      file: t('templateBuilder.types.file'),
    };
    return typeMap[responseType] || responseType;
  };

  const getTypeIcon = () => {
    switch (responseType) {
      case 'image':
      case 'image_caption':
        return '📷';
      case 'video':
      case 'video_caption':
        return '🎥';
      case 'audio':
        return '🎤';
      case 'file':
        return '📄';
      default:
        return '💬';
    }
  };

  return (
    <div
      className={`bg-gradient-to-br from-purple-500 to-purple-600 rounded-lg shadow-lg border-2 ${
        selected ? 'border-purple-300 ring-2 ring-purple-200' : 'border-purple-400'
      } min-w-[200px]`}
    >
      <Handle
        type="target"
        position={Position.Left}
        className="!w-6 !h-6 bg-purple-300 !border-3 border-purple-500"
        style={{ width: '24px', height: '24px', borderRadius: '50%' }}
      />
      <div className="p-4">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center text-lg">
            {getTypeIcon()}
          </div>
          <h3 className="font-semibold text-white text-sm">
            {t('mindFlow.nodes.response')}
          </h3>
        </div>
        <div className="space-y-1">
          <p className="text-xs text-white/80 font-medium">
            {getTypeLabel()}
          </p>
          {responseType === 'text' && nodeData.content && (
            <p className="text-xs text-white/70 truncate">
              {nodeData.content.substring(0, 30)}
              {nodeData.content.length > 30 ? '...' : ''}
            </p>
          )}
          {(responseType === 'image_caption' || responseType === 'video_caption') && nodeData.caption && (
            <p className="text-xs text-white/70 truncate">
              {nodeData.caption.substring(0, 30)}
              {nodeData.caption.length > 30 ? '...' : ''}
            </p>
          )}
          {responseType === 'file' && nodeData.fileName && (
            <p className="text-xs text-white/70 truncate">
              {nodeData.fileName}
            </p>
          )}
          {!nodeData.content && !nodeData.caption && !nodeData.fileName && responseType === 'text' && (
            <p className="text-xs text-white/60 italic">
              {t('mindFlow.nodeSettings.configureResponse')}
            </p>
          )}
          {nodeData.responseDelay && nodeData.responseDelay > 0 && (
            <p className="text-xs text-white/70 font-medium mt-1">
              ⏱️ Delay: {(nodeData.responseDelay / 1000).toFixed(1)}s
            </p>
          )}
        </div>
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

