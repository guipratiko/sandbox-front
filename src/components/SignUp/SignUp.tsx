import React from 'react';
import { Link } from 'react-router-dom';
import { Layout, Container } from '../Layout';
import { Button, Input, PasswordInput, Card, FloatingLanguageToggle } from '../UI';
import { useLanguage } from '../../contexts/LanguageContext';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { useForm } from '../../hooks/useForm';
import { validators } from '../../utils/validators';
import { normalizeCPFInput, cleanCPF } from '../../utils/cpfUtils';

interface SignUpFormData {
  name: string;
  email: string;
  password: string;
  confirmPassword: string;
  cpf: string;
  acceptTerms: boolean;
}

const SignUp: React.FC = () => {
  const { t } = useLanguage();
  const { register } = useAuth();
  const { theme } = useTheme();
  const logoSrc = theme === 'dark' ? '/OnlyFlow-logo.png' : '/OnlyFlow-logo-claro.png';

  const { values, errors, isLoading, handleChange, handleSubmit } = useForm<SignUpFormData>({
    initialValues: {
      name: '',
      email: '',
      password: '',
      confirmPassword: '',
      cpf: '',
      acceptTerms: false,
    },
    onSubmit: async (values) => {
      // Enviar CPF apenas com números
      const cleanCpf = cleanCPF(values.cpf);
      await register(values.name, values.email, values.password, cleanCpf);
    },
    validate: (values) => {
      const errors: Partial<Record<keyof SignUpFormData, string>> = {};

      const nameResult = validators.name(values.name);
      if (!nameResult.isValid && nameResult.error) {
        errors.name = t(nameResult.error);
      }

      const emailResult = validators.email(values.email);
      if (!emailResult.isValid && emailResult.error) {
        errors.email = t(emailResult.error);
      }

      const cpfResult = validators.cpf(values.cpf);
      if (!cpfResult.isValid && cpfResult.error) {
        errors.cpf = t(cpfResult.error);
      }

      const passwordResult = validators.password(values.password);
      if (!passwordResult.isValid && passwordResult.error) {
        errors.password = t(passwordResult.error);
      }

      const confirmPasswordResult = validators.confirmPassword(values.confirmPassword, values.password);
      if (!confirmPasswordResult.isValid && confirmPasswordResult.error) {
        errors.confirmPassword = t(confirmPasswordResult.error);
      }

      if (!values.acceptTerms) {
        errors.acceptTerms = t('validation.termsRequired');
      }

      return errors;
    },
  });

  // Handler customizado para CPF com formatação
  const handleCPFChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = normalizeCPFInput(e.target.value);
    handleChange({
      target: {
        name: 'cpf',
        value: formatted,
      },
    } as React.ChangeEvent<HTMLInputElement>);
  };

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

            {/* Card de Registro */}
            <Card padding="lg" shadow="lg" hover>
              <h1 className="text-3xl font-bold text-center mb-2 text-clerky-backendText dark:text-gray-200">
                {t('signup.title')}
              </h1>
              <p className="text-gray-600 dark:text-gray-300 text-center mb-8">
                {t('signup.subtitle')}
              </p>

              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Erro geral */}
                {errors.general && (
                  <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm animate-slideIn">
                    {errors.general}
                  </div>
                )}

                {/* Campo Nome */}
                <Input
                  id="name"
                  name="name"
                  type="text"
                  label={t('signup.name')}
                  value={values.name}
                  onChange={handleChange}
                  placeholder={t('signup.namePlaceholder')}
                  autoComplete="name"
                  error={errors.name}
                />

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

                {/* Campo CPF */}
                <Input
                  id="cpf"
                  name="cpf"
                  type="text"
                  label={t('signup.cpf')}
                  value={values.cpf}
                  onChange={handleCPFChange}
                  placeholder="000.000.000-00"
                  autoComplete="off"
                  maxLength={14}
                  error={errors.cpf}
                />

                {/* Campo Senha */}
                <PasswordInput
                  id="password"
                  name="password"
                  label={t('login.password')}
                  value={values.password}
                  onChange={handleChange}
                  placeholder={t('login.passwordPlaceholder')}
                  autoComplete="new-password"
                  error={errors.password}
                />

                {/* Campo Confirmar Senha */}
                <PasswordInput
                  id="confirmPassword"
                  name="confirmPassword"
                  label={t('signup.confirmPassword')}
                  value={values.confirmPassword}
                  onChange={handleChange}
                  placeholder={t('signup.confirmPasswordPlaceholder')}
                  autoComplete="new-password"
                  error={errors.confirmPassword}
                />

                {/* Checkbox Termos */}
                <div>
                  <label className="flex items-start gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      name="acceptTerms"
                      checked={values.acceptTerms}
                      onChange={handleChange}
                      className="mt-1 w-4 h-4 text-clerky-backendButton border-gray-300 rounded focus:ring-clerky-backendButton/50"
                    />
                    <span className="text-sm text-gray-600 dark:text-gray-300">
                      {t('signup.terms')}{' '}
                      <a
                        href="https://clerky.com.br/legal/termos"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-clerky-backendButton hover:opacity-80 underline transition-smooth"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {t('signup.termsOfUse')}
                      </a>
                      {' '}{t('signup.and')}{' '}
                      <a
                        href="https://clerky.com.br/legal/politica-privacidade"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-clerky-backendButton hover:opacity-80 underline transition-smooth"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {t('signup.privacyPolicy')}
                      </a>
                    </span>
                  </label>
                  {errors.acceptTerms && (
                    <p className="mt-1 text-sm text-red-500 dark:text-red-400 animate-slideIn">
                      {errors.acceptTerms}
                    </p>
                  )}
                </div>

                {/* Botão de Submit */}
                <Button
                  type="submit"
                  variant="primary"
                  size="lg"
                  isLoading={isLoading}
                  className="w-full"
                >
                  {isLoading ? t('signup.submitting') : t('signup.submit')}
                </Button>
              </form>

              {/* Link para login */}
              <div className="mt-6 text-center">
                <p className="text-sm text-gray-600 dark:text-gray-300">
                  {t('signup.hasAccount')}{' '}
                  <Link 
                    to="/login"
                    className="text-clerky-backendButton hover:opacity-80 font-medium transition-smooth"
                  >
                    {t('signup.signIn')}
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

export default SignUp;

