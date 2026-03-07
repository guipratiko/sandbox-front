import React from 'react';
import { Button } from '../UI';
import { useLanguage } from '../../contexts/LanguageContext';
import { WorkflowContact } from '../../services/api';
import { formatDateTime } from '../../utils/dateFormatters';

interface ContactListProps {
  contacts: WorkflowContact[];
  onClear: () => void;
  isClearing?: boolean;
}

export const ContactList: React.FC<ContactListProps> = ({ contacts, onClear, isClearing = false }) => {
  const { t, language } = useLanguage();

  return (
    <div className="flex flex-col max-h-[70vh]">
      <div className="p-4 border-b border-gray-200 dark:border-gray-700 mb-4">
        <Button
          variant="outline"
          size="sm"
          onClick={onClear}
          disabled={contacts.length === 0 || isClearing}
          isLoading={isClearing}
          className="w-full"
        >
          {t('mindFlow.contacts.clear')}
        </Button>
      </div>
      <div className="flex-1 overflow-y-auto px-4 pb-4">
        {contacts.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {t('mindFlow.contacts.empty')}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {contacts.map((contact) => (
              <div
                key={contact.id}
                className="p-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              >
                <div className="flex items-center justify-between mb-1">
                  <p className="font-medium text-sm text-clerky-backendText dark:text-gray-200">
                    {contact.contactPhone}
                  </p>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {t('mindFlow.contacts.enteredAt')}: {formatDateTime(contact.enteredAt, language as 'pt' | 'en')}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

