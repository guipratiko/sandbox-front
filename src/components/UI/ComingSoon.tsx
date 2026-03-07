import React from 'react';
import { AppLayout } from '../Layout';
import Card from './Card';
import { useLanguage } from '../../contexts/LanguageContext';

interface ComingSoonProps {
  className?: string;
}

const ComingSoon: React.FC<ComingSoonProps> = ({ className = '' }) => {
  const { t } = useLanguage();

  return (
    <AppLayout>
      <div className={`animate-fadeIn ${className}`}>
        <Card padding="lg" shadow="lg">
          <p className="text-gray-600 dark:text-gray-300">
            {t('common.comingSoon')}
          </p>
        </Card>
      </div>
    </AppLayout>
  );
};

export default ComingSoon;

