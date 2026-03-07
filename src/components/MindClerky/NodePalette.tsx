import React from 'react';
import { useLanguage } from '../../contexts/LanguageContext';

interface NodePaletteProps {
  onAddNode: (type: 'whatsappTrigger' | 'typebotTrigger' | 'webhookTrigger' | 'condition' | 'delay' | 'end' | 'response' | 'spreadsheet' | 'openai') => void;
}

// Mapa de classes de cores para evitar recriação a cada render
const COLOR_CLASSES_MAP: Record<string, { border: string; bg: string; text: string; hoverBg: string }> = {
  green: {
    border: 'hover:border-green-400 dark:hover:border-green-500',
    bg: 'bg-green-100 dark:bg-green-900/30',
    text: 'text-green-600 dark:text-green-400',
    hoverBg: 'group-hover:bg-green-200 dark:group-hover:bg-green-900/50',
  },
  blue: {
    border: 'hover:border-blue-400 dark:hover:border-blue-500',
    bg: 'bg-blue-100 dark:bg-blue-900/30',
    text: 'text-blue-600 dark:text-blue-400',
    hoverBg: 'group-hover:bg-blue-200 dark:group-hover:bg-blue-900/50',
  },
  yellow: {
    border: 'hover:border-yellow-400 dark:hover:border-yellow-500',
    bg: 'bg-yellow-100 dark:bg-yellow-900/30',
    text: 'text-yellow-600 dark:text-yellow-400',
    hoverBg: 'group-hover:bg-yellow-200 dark:group-hover:bg-yellow-900/50',
  },
  red: {
    border: 'hover:border-red-400 dark:hover:border-red-500',
    bg: 'bg-red-100 dark:bg-red-900/30',
    text: 'text-red-600 dark:text-red-400',
    hoverBg: 'group-hover:bg-red-200 dark:group-hover:bg-red-900/50',
  },
  purple: {
    border: 'hover:border-purple-400 dark:hover:border-purple-500',
    bg: 'bg-purple-100 dark:bg-purple-900/30',
    text: 'text-purple-600 dark:text-purple-400',
    hoverBg: 'group-hover:bg-purple-200 dark:group-hover:bg-purple-900/50',
  },
  indigo: {
    border: 'hover:border-indigo-400 dark:hover:border-indigo-500',
    bg: 'bg-indigo-100 dark:bg-indigo-900/30',
    text: 'text-indigo-600 dark:text-indigo-400',
    hoverBg: 'group-hover:bg-indigo-200 dark:group-hover:bg-indigo-900/50',
  },
  emerald: {
    border: 'hover:border-emerald-400 dark:hover:border-emerald-500',
    bg: 'bg-emerald-100 dark:bg-emerald-900/30',
    text: 'text-emerald-600 dark:text-emerald-400',
    hoverBg: 'group-hover:bg-emerald-200 dark:group-hover:bg-emerald-900/50',
  },
};

export const NodePalette: React.FC<NodePaletteProps> = ({ onAddNode }) => {
  const { t } = useLanguage();

  const nodeTypes = [
    {
      type: 'whatsappTrigger' as const,
      label: t('mindFlow.nodes.trigger'),
      description: t('mindFlow.nodes.trigger.description'),
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
          />
        </svg>
      ),
      color: 'green',
    },
    {
      type: 'typebotTrigger' as const,
      label: t('mindFlow.nodes.typebotTrigger'),
      description: t('mindFlow.nodes.typebotTrigger.description'),
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
          />
        </svg>
      ),
      color: 'indigo',
    },
    {
      type: 'webhookTrigger' as const,
      label: t('mindFlow.nodes.webhookTrigger'),
      description: t('mindFlow.nodes.webhookTrigger.description'),
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
          />
        </svg>
      ),
      color: 'purple',
    },
    {
      type: 'condition' as const,
      label: t('mindFlow.nodes.condition'),
      description: t('mindFlow.nodes.condition.description'),
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
          />
        </svg>
      ),
      color: 'blue',
    },
    {
      type: 'delay' as const,
      label: t('mindFlow.nodes.delay'),
      description: t('mindFlow.nodes.delay.description'),
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
      ),
      color: 'yellow',
    },
    {
      type: 'end' as const,
      label: t('mindFlow.nodes.end'),
      description: t('mindFlow.nodes.end.description'),
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M6 18L18 6M6 6l12 12"
          />
        </svg>
      ),
      color: 'red',
    },
    {
      type: 'response' as const,
      label: t('mindFlow.nodes.response'),
      description: t('mindFlow.nodes.response.description'),
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
          />
        </svg>
      ),
      color: 'purple',
    },
    {
      type: 'spreadsheet' as const,
      label: t('mindFlow.nodes.spreadsheet'),
      description: t('mindFlow.nodes.spreadsheet.description'),
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2"
          />
        </svg>
      ),
      color: 'emerald',
    },
    {
      type: 'openai' as const,
      label: t('mindFlow.nodes.openai'),
      description: t('mindFlow.nodes.openai.description'),
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
          />
        </svg>
      ),
      color: 'emerald',
    },
  ];

  return (
    <div className="w-64 bg-white dark:bg-[#091D41] border-r border-gray-200 dark:border-gray-700 h-full overflow-y-auto">
      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
        <h2 className="font-semibold text-clerky-backendText dark:text-gray-200 text-lg">
          {t('mindFlow.nodes')}
        </h2>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
          {t('mindFlow.subtitle')}
        </p>
      </div>
      <div className="p-4 space-y-3">
        {nodeTypes.map((node) => {
          const colorClasses = COLOR_CLASSES_MAP[node.color];
          const isDisabled = false;

          return (
            <button
              key={node.type}
              onClick={() => !isDisabled && onAddNode(node.type)}
              disabled={isDisabled}
              className={`w-full text-left p-3 rounded-lg border-2 border-gray-200 dark:border-gray-700 transition-all bg-white dark:bg-gray-700 group relative ${
                isDisabled
                  ? 'opacity-60 cursor-not-allowed'
                  : `${colorClasses.border} hover:shadow-md`
              }`}
            >
              <div className="flex items-start gap-3">
                <div
                  className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${colorClasses.bg} ${colorClasses.text} ${isDisabled ? '' : colorClasses.hoverBg} transition-colors`}
                >
                  {node.icon}
                </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="font-semibold text-sm text-clerky-backendText dark:text-gray-200">
                    {node.label}
                  </h3>
                  {isDisabled && (
                    <span className="px-2 py-0.5 text-xs bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded">
                      Em Breve
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2">
                  {node.description}
                </p>
              </div>
            </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};

