import React from 'react';
import { AppLayout } from '../components/Layout';
import { Card } from '../components/UI';
import { useLanguage } from '../contexts/LanguageContext';

const GroupFlow: React.FC = () => {
  const { t } = useLanguage();

  return (
    <AppLayout>
      <Card padding="lg" shadow="md" className="max-w-2xl mx-auto">
        <h1 className="text-xl font-semibold text-clerky-backendText dark:text-gray-100 mb-2">
          {t('groupFlow.title')}
        </h1>
        <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
          {t('groupFlow.placeholder')}
        </p>
        <p className="text-xs text-gray-500 dark:text-gray-500 mt-4">{t('groupFlow.devNote')}</p>
      </Card>
    </AppLayout>
  );
};

export default GroupFlow;
