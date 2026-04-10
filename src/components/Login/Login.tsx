import React from 'react';
import { Link } from 'react-router-dom';
import { Layout, Container } from '../Layout';
import { Button, Input, PasswordInput, Card, FloatingLanguageToggle } from '../UI';
import { useLanguage } from '../../contexts/LanguageContext';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { useForm } from '../../hooks/useForm';
import { validators } from '../../utils/validators';

interface LoginFormData {
  email: string;
  password: string;
}

const Login: React.FC = () => {
  const { t } = useLanguage();
  const { login } = useAuth();
   const { theme } = useTheme();
   const logoSrc = theme === 'dark' ? '/OnlyFlow-logo.png' : '/OnlyFlow-logo-claro.png';

  const { values, errors, isLoading, handleChange, handleSubmit } = useForm<LoginFormData>({
    initialValues: {
      email: '',
      password: '',
    },
    onSubmit: async (values) => {
      await login(values.email, values.password);
    },
    validate: (values) => {
      const errors: Partial<Record<keyof LoginFormData, string>> = {};

      const emailResult = validators.email(values.email);
      if (!emailResult.isValid && emailResult.error) {
        errors.email = t(emailResult.error);
      }

      const passwordResult = validators.password(values.password);
      if (!passwordResult.isValid && passwordResult.error) {
        errors.password = t(passwordResult.error);
      }

      return errors;
    },
  });

  return (
    <Layout>
      {/* Botão de Idioma - Fixo no canto superior direito */}
      <FloatingLanguageToggle />

      <div
        className="flex flex-1 flex-col justify-start sm:justify-center min-h-0 w-full
          px-3 sm:px-4
          pt-[calc(env(safe-area-inset-top,0px)+5.75rem)] sm:pt-10
          pb-[max(1rem,env(safe-area-inset-bottom,0px)+0.5rem)] sm:pb-10"
      >
        <Container maxWidth="sm" className="w-full !px-0 sm:!px-4 lg:!px-4">
          <div className="animate-fadeIn mx-auto max-w-md">
            {/* Logo */}
            <div className="flex justify-center mb-5 sm:mb-8">
              <img
                src={logoSrc}
                alt="OnlyFlow Logo"
                className="h-16 w-auto max-h-[22vw] sm:h-24 md:h-[100px]"
                width={280}
                height={100}
                decoding="async"
              />
            </div>

            {/* Card de Login */}
            <Card padding="none" shadow="lg" hover className="p-5 sm:p-8">
              <h1 className="text-2xl sm:text-3xl font-bold text-center mb-1.5 sm:mb-2 text-clerky-backendText dark:text-gray-200">
                {t('login.welcome')}
              </h1>
              <p className="text-sm sm:text-base text-gray-600 dark:text-gray-300 text-center mb-6 sm:mb-8 leading-relaxed">
                {t('login.subtitle')}
              </p>

              <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-6">
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
                  label={t('login.email')}
                  value={values.email}
                  onChange={handleChange}
                  placeholder={t('login.emailPlaceholder')}
                  autoComplete="email"
                  error={errors.email}
                />

                {/* Campo Senha */}
                <PasswordInput
                  id="password"
                  name="password"
                  label={t('login.password')}
                  value={values.password}
                  onChange={handleChange}
                  placeholder={t('login.passwordPlaceholder')}
                  autoComplete="current-password"
                  error={errors.password}
                />

                {/* Esqueci minha senha */}
                <div className="flex justify-end">
                  <Link 
                    to="/forgot-password"
                    className="text-sm text-clerky-backendButton hover:opacity-80 transition-smooth"
                  >
                    {t('login.forgotPassword')}
                  </Link>
                </div>

                {/* Botão de Submit */}
                <Button
                  type="submit"
                  variant="primary"
                  size="lg"
                  isLoading={isLoading}
                  className="w-full min-h-[48px] touch-manipulation"
                >
                  {isLoading ? t('login.submitting') : t('login.submit')}
                </Button>
              </form>

              {/* Link para cadastro */}
              <div className="mt-6 text-center">
                <p className="text-sm text-gray-600 dark:text-gray-300">
                  {t('login.noAccount')}{' '}
                  <Link 
                    to="/signup"
                    className="text-clerky-backendButton hover:opacity-80 font-medium transition-smooth"
                  >
                    {t('login.signUp')}
                  </Link>
                </p>
              </div>
            </Card>
          </div>
        </Container>
      </div>
    </Layout>
  );
};

export default Login;

