import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppLayout } from '../components/Layout';
import { Card, Button, PasswordInput } from '../components/UI';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { authAPI } from '../services/api';

const DeleteAccount: React.FC = () => {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const { logout } = useAuth();
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!password.trim()) {
      setError(t('validation.passwordRequired') || 'Senha é obrigatória');
      return;
    }
    setIsLoading(true);
    try {
      await authAPI.deleteAccount({ password });
      setSuccess(true);
      logout();
      setTimeout(() => navigate('/login'), 1500);
    } catch (err: any) {
      setError(err.message || t('error.generic') || 'Erro ao excluir conta');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AppLayout>
      <div className="animate-fadeIn max-w-xl mx-auto p-4 md:p-6">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-clerky-backendText dark:text-gray-200 mb-2">
            {t('deleteAccount.title')}
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            {t('deleteAccount.subtitle')}
          </p>
        </div>

        <Card padding="lg" shadow="lg" className="border-red-200 dark:border-red-900/50">
          {success ? (
            <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-green-700 dark:text-green-400 px-4 py-3 rounded-lg">
              {t('deleteAccount.success')}
            </div>
          ) : (
            <>
              <p className="text-sm text-gray-600 dark:text-gray-300 mb-6">
                {t('deleteAccount.warning')}
              </p>

              <form onSubmit={handleSubmit} className="space-y-6">
                {error && (
                  <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 px-4 py-3 rounded-lg text-sm">
                    {error}
                  </div>
                )}

                <PasswordInput
                  id="password"
                  name="password"
                  label={t('deleteAccount.password')}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={t('deleteAccount.passwordPlaceholder')}
                  autoComplete="current-password"
                />

                <div className="flex flex-col sm:flex-row gap-3">
                  <Button
                    type="submit"
                    variant="primary"
                    size="lg"
                    isLoading={isLoading}
                    className="sm:flex-1 bg-red-600 hover:bg-red-700 focus:ring-red-500 dark:bg-red-600 dark:hover:bg-red-700"
                  >
                    {isLoading ? t('deleteAccount.submitting') : t('deleteAccount.submit')}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="lg"
                    onClick={() => navigate('/configuracoes')}
                    disabled={isLoading}
                    className="sm:flex-1"
                  >
                    {t('deleteAccount.backToSettings')}
                  </Button>
                </div>
              </form>
            </>
          )}
        </Card>
      </div>
    </AppLayout>
  );
};

export default DeleteAccount;
