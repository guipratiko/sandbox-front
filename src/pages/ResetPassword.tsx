import React, { useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Layout, Container } from '../components/Layout';
import { Button, PasswordInput, Card, FloatingLanguageToggle } from '../components/UI';
import { useLanguage } from '../contexts/LanguageContext';
import { useTheme } from '../contexts/ThemeContext';
import { useForm } from '../hooks/useForm';
import { validators } from '../utils/validators';
import { authAPI } from '../services/api';

interface ResetPasswordFormData {
  password: string;
  confirmPassword: string;
}

const ResetPassword: React.FC = () => {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const [success, setSuccess] = useState(false);
  const { theme } = useTheme();
  const logoSrc = theme === 'dark' ? '/OnlyFlow-logo.png' : '/OnlyFlow-logo-claro.png';

  const { values, errors, isLoading, handleChange, handleSubmit } = useForm<ResetPasswordFormData>({
    initialValues: {
      password: '',
      confirmPassword: '',
    },
    onSubmit: async (values) => {
      if (!token) {
        throw new Error(t('resetPassword.tokenInvalid') || 'Token inválido ou expirado');
      }

      try {
        await authAPI.resetPassword({
          token,
          password: values.password,
        });

        setSuccess(true);
        
        // Redirecionar para login após 2 segundos
        setTimeout(() => {
          navigate('/login');
        }, 2000);
      } catch (error: any) {
        // O erro já é tratado pelo useForm
        throw error;
      }
    },
    validate: (values) => {
      const errors: Partial<Record<keyof ResetPasswordFormData, string>> = {};

      const passwordResult = validators.password(values.password);
      if (!passwordResult.isValid && passwordResult.error) {
        errors.password = t(passwordResult.error);
      }

      const confirmPasswordResult = validators.confirmPassword(values.confirmPassword, values.password);
      if (!confirmPasswordResult.isValid && confirmPasswordResult.error) {
        errors.confirmPassword = t(confirmPasswordResult.error);
      }

      return errors;
    },
  });

  if (!token) {
    return (
      <Layout>
        <FloatingLanguageToggle />
        <div className="min-h-screen flex items-center justify-center px-4 py-12">
          <Container maxWidth="sm" className="w-full">
            <Card padding="lg" shadow="lg">
              <div className="text-center">
                <div className="text-red-500 dark:text-red-400 mb-4">
                  <svg
                    className="w-16 h-16 mx-auto"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                </div>
                <h1 className="text-2xl font-bold mb-4 text-clerky-backendText dark:text-gray-200">
                  {t('resetPassword.title')}
                </h1>
                <p className="text-gray-600 dark:text-gray-300 mb-6">
                  {t('resetPassword.tokenInvalid')}
                </p>
                <Button
                  variant="primary"
                  onClick={() => navigate('/login')}
                >
                  {t('resetPassword.backToLogin')}
                </Button>
              </div>
            </Card>
          </Container>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <FloatingLanguageToggle />
      <div className="min-h-screen flex items-center justify-center px-4 py-12">
        <Container maxWidth="sm" className="w-full">
          <div className="animate-fadeIn">
            {/* Logo */}
            <div className="flex justify-center mb-8">
              <img src={logoSrc} alt="OnlyFlow Logo" className="h-12 w-auto" />
            </div>

            {/* Card de Redefinição */}
            <Card padding="lg" shadow="lg" hover>
              <h1 className="text-3xl font-bold text-center mb-2 text-clerky-backendText dark:text-gray-200">
                {t('resetPassword.title')}
              </h1>
              <p className="text-gray-600 dark:text-gray-300 text-center mb-8">
                {t('resetPassword.subtitle')}
              </p>

              {success ? (
                <div className="space-y-6">
                  <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg text-sm animate-slideIn">
                    {t('resetPassword.success')}
                  </div>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-6">
                  {/* Erro geral */}
                  {errors.general && (
                    <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm animate-slideIn">
                      {errors.general}
                    </div>
                  )}

                  {/* Campo Senha */}
                  <PasswordInput
                    id="password"
                    name="password"
                    label={t('resetPassword.password')}
                    value={values.password}
                    onChange={handleChange}
                    placeholder={t('resetPassword.passwordPlaceholder')}
                    autoComplete="new-password"
                    error={errors.password}
                  />

                  {/* Campo Confirmar Senha */}
                  <PasswordInput
                    id="confirmPassword"
                    name="confirmPassword"
                    label={t('resetPassword.confirmPassword')}
                    value={values.confirmPassword}
                    onChange={handleChange}
                    placeholder={t('resetPassword.confirmPasswordPlaceholder')}
                    autoComplete="new-password"
                    error={errors.confirmPassword}
                  />

                  {/* Botão de Submit */}
                  <Button
                    type="submit"
                    variant="primary"
                    size="lg"
                    isLoading={isLoading}
                    className="w-full"
                  >
                    {isLoading ? t('resetPassword.submitting') : t('resetPassword.submit')}
                  </Button>
                </form>
              )}

              {/* Link para voltar ao login */}
              <div className="mt-6 text-center">
                <button
                  onClick={() => navigate('/login')}
                  className="text-sm text-clerky-backendButton hover:opacity-80 font-medium transition-smooth"
                >
                  {t('resetPassword.backToLogin')}
                </button>
              </div>
            </Card>
          </div>
        </Container>
      </div>
    </Layout>
  );
};

export default ResetPassword;




