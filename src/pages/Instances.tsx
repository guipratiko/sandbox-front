import React, { useState, useEffect } from 'react';
import { AppLayout } from '../components/Layout';
import { HelpIcon } from '../components/UI';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import WhatsAppInstances from '../components/WhatsApp/WhatsAppInstances';
import WhatsAppOfficialInstances from '../components/WhatsApp/WhatsAppOfficialInstances';
import InstagramInstances from '../components/Instagram/InstagramInstances';

const INSTANCES_TAB_KEY = 'instances_active_tab';
type TabKey = 'whatsapp' | 'whatsapp-official' | 'instagram';

const Instances: React.FC = () => {
  const { t } = useLanguage();
  const { user } = useAuth();
  const canUseOfficial = user?.premiumPlan && user.premiumPlan !== 'start';

  const [activeTab, setActiveTab] = useState<TabKey>(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const urlTab = urlParams.get('tab');
    if (urlTab === 'instagram' || urlTab === 'whatsapp' || urlTab === 'whatsapp-official') {
      return urlTab as TabKey;
    }
    const savedTab = localStorage.getItem(INSTANCES_TAB_KEY);
    return (savedTab === 'instagram' || savedTab === 'whatsapp' || savedTab === 'whatsapp-official') ? savedTab as TabKey : 'whatsapp';
  });

  useEffect(() => {
    localStorage.setItem(INSTANCES_TAB_KEY, activeTab);
  }, [activeTab]);

  // Plano Start não tem acesso à aba WhatsApp Oficial; redirecionar se estiver nela
  useEffect(() => {
    if (!canUseOfficial && activeTab === 'whatsapp-official') {
      setActiveTab('whatsapp');
    }
  }, [canUseOfficial, activeTab]);

  return (
    <AppLayout>
      <div className="animate-fadeIn max-w-7xl mx-auto">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-clerky-backendText dark:text-gray-200 mb-2">
            {t('instances.title')}
          </h1>
          <p className="text-gray-600 dark:text-gray-400 inline-flex items-center gap-2">
            {t('instances.subtitle')}
            <HelpIcon helpKey="instances" className="ml-1" />
          </p>
        </div>

        <div className="border-b border-gray-200 dark:border-gray-700 mb-6">
          <nav className="flex space-x-8" aria-label="Tabs">
            <button
              onClick={() => setActiveTab('whatsapp')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'whatsapp'
                  ? 'border-clerky-backendButton text-clerky-backendButton'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
              }`}
            >
              WhatsApp
            </button>
            {canUseOfficial && (
              <button
                onClick={() => setActiveTab('whatsapp-official')}
                className={`py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'whatsapp-official'
                    ? 'border-clerky-backendButton text-clerky-backendButton'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
                }`}
              >
                WhatsApp Oficial
              </button>
            )}
            <button
              onClick={() => setActiveTab('instagram')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'instagram'
                  ? 'border-clerky-backendButton text-clerky-backendButton'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
              }`}
            >
              Instagram
            </button>
          </nav>
        </div>

        <div className="relative min-h-[400px]">
          <div
            className={`transition-all duration-300 ease-in-out ${
              activeTab === 'whatsapp'
                ? 'opacity-100 translate-x-0'
                : 'opacity-0 absolute inset-0 pointer-events-none translate-x-4'
            }`}
          >
            <WhatsAppInstances />
          </div>
          {canUseOfficial && (
            <div
              className={`transition-all duration-300 ease-in-out ${
                activeTab === 'whatsapp-official'
                  ? 'opacity-100 translate-x-0'
                  : 'opacity-0 absolute inset-0 pointer-events-none translate-x-4'
              }`}
            >
              <WhatsAppOfficialInstances />
            </div>
          )}
          <div
            className={`transition-all duration-300 ease-in-out ${
              activeTab === 'instagram'
                ? 'opacity-100 translate-x-0'
                : 'opacity-0 absolute inset-0 pointer-events-none -translate-x-4'
            }`}
          >
            <InstagramInstances />
          </div>
        </div>
      </div>
    </AppLayout>
  );
};

export default Instances;
