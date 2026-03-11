import React, { useState } from 'react';
import { AppLayout } from '../components/Layout';
import { Card, HelpIcon } from '../components/UI';
import { useLanguage } from '../contexts/LanguageContext';

const DispatchesOfficial: React.FC = () => {
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState<'templates' | 'dispatches'>('templates');

  return (
    <AppLayout>
      <div className="animate-fadeIn">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-clerky-backendText dark:text-gray-200 mb-2">
            {t('dispatchesOfficial.title')}
          </h1>
          <p className="text-gray-600 dark:text-gray-400 inline-flex items-center gap-2">
            {t('dispatchesOfficial.subtitle')}
            <HelpIcon helpKey="dispatchesOfficial" className="ml-1" />
          </p>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6 border-b border-gray-200 dark:border-gray-700">
          <button
            onClick={() => setActiveTab('templates')}
            className={`px-4 py-2 font-medium transition-colors ${
              activeTab === 'templates'
                ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
            }`}
          >
            {t('dispatchesOfficial.templatesTab')}
          </button>
          <button
            onClick={() => setActiveTab('dispatches')}
            className={`px-4 py-2 font-medium transition-colors ${
              activeTab === 'dispatches'
                ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
            }`}
          >
            {t('dispatchesOfficial.dispatchesTab')}
          </button>
        </div>

        {/* Conteúdo das Tabs — placeholder por enquanto */}
        {activeTab === 'templates' ? (
          <Card className="p-8 text-center">
            <p className="text-gray-500 dark:text-gray-400">
              {t('dispatchesOfficial.comingSoon')}
            </p>
          </Card>
        ) : (
          <Card className="p-8 text-center">
            <p className="text-gray-500 dark:text-gray-400">
              {t('dispatchesOfficial.comingSoon')}
            </p>
          </Card>
        )}
      </div>
    </AppLayout>
  );
};

export default DispatchesOfficial;
