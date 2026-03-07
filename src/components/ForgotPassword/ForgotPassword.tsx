import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Layout, Container } from '../Layout';
import { Button, Input, Card, FloatingLanguageToggle } from '../UI';
import { useLanguage } from '../../contexts/LanguageContext';
import { useTheme } from '../../contexts/ThemeContext';
import { useForm } from '../../hooks/useForm';
import { validators } from '../../utils/validators';
import { authAPI } from '../../services/api';

interface ForgotPasswordFormData {
  email: string;
}

const ForgotPassword: React.FC = () => {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [success, setSuccess] = useState(false);
  const { theme } = useTheme();
  const logoSrc = theme === 'dark' ? '/OnlyFlow-logo.png' : '/OnlyFlow-logo-claro.png';

  const { values, errors, isLoading, handleChange, handleSubmit } = useForm<ForgotPasswordFormData>({
    initialValues: {
      email: '',
    },
    onSubmit: async (values) => {
      try {
        await authAPI.forgotPassword({ email: values.email });
        setSuccess(true);
      } catch (error: any) {
        // O erro já é tratado pelo useForm
        throw error;
      }
    },
    validate: (values) => {
      const errors: Partial<Record<keyof ForgotPasswordFormData, string>> = {};

      const emailResult = validators.email(values.email);
      if (!emailResult.isValid && emailResult.error) {
        errors.email = t(emailResult.error);
      }

      return errors;
    },
  });

  return (
    <Layout>
      {/* Botão de Idioma - Fixo no canto superior direito */}
      <FloatingLanguageToggle />

      <div className="min-h-screen flex items-center justify-center px-4 py-12">
        <Container maxWidth="sm" className="w-full">
          <div className="animate-fadeIn">
            {/* Logo */}
            <div className="flex justify-center mb-8">
              <img 
                src={logoSrc} 
                alt="OnlyFlow Logo" 
                className="h-12 w-auto"
              />
            </div>

            {/* Card de Recuperação */}
            <Card padding="lg" shadow="lg" hover>
              <h1 className="text-3xl font-bold text-center mb-2 text-clerky-backendText dark:text-gray-200">
                {t('forgotPassword.title')}
              </h1>
              <p className="text-gray-600 dark:text-gray-300 text-center mb-8">
                {t('forgotPassword.subtitle')}
              </p>

              {success ? (
                <div className="space-y-6">
                  <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg text-sm animate-slideIn">
                    {t('forgotPassword.success')}
                  </div>
                  <Button
                    type="button"
                    variant="primary"
                    size="lg"
                    className="w-full"
                    onClick={() => navigate('/login')}
                  >
                    {t('forgotPassword.backToLogin')}
                  </Button>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-6">
                  {/* Erro geral */}
                  {errors.general && (
                    <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm animate-slideIn">
                      {errors.general}
                    </div>
                  )}

                  {/* Campo Email */}
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    label={t('forgotPassword.email')}
                    value={values.email}
                    onChange={handleChange}
                    placeholder={t('forgotPassword.emailPlaceholder')}
                    autoComplete="email"
                    error={errors.email}
                  />

                  {/* Botão de Submit */}
                  <Button
                    type="submit"
                    variant="primary"
                    size="lg"
                    isLoading={isLoading}
                    className="w-full"
                  >
                    {isLoading ? t('forgotPassword.submitting') : t('forgotPassword.submit')}
                  </Button>
                </form>
              )}
            </Card>
          </div>
        </Container>
      </div>
    </Layout>
  );
};

export default ForgotPassword;




