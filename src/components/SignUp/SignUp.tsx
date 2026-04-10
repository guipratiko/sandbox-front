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

            {/* Card de Registro */}
            <Card padding="none" shadow="lg" hover className="p-5 sm:p-8">
              <h1 className="text-2xl sm:text-3xl font-bold text-center mb-1.5 sm:mb-2 text-clerky-backendText dark:text-gray-200">
                {t('signup.title')}
              </h1>
              <p className="text-sm sm:text-base text-gray-600 dark:text-gray-300 text-center mb-6 sm:mb-8 leading-relaxed">
                {t('signup.subtitle')}
              </p>

              <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-6">
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
                  <label className="flex items-start gap-3 cursor-pointer rounded-lg py-2 -my-1 -mx-1 px-1 sm:py-0 sm:-my-0 sm:-mx-0 sm:px-0">
                    <input
                      type="checkbox"
                      name="acceptTerms"
                      checked={values.acceptTerms}
                      onChange={handleChange}
                      className="mt-0.5 sm:mt-1 h-5 w-5 min-h-[1.25rem] min-w-[1.25rem] shrink-0 text-clerky-backendButton border-gray-300 rounded focus:ring-clerky-backendButton/50"
                    />
                    <span className="text-sm leading-relaxed text-gray-600 dark:text-gray-300 break-words [overflow-wrap:anywhere]">
                      {t('signup.terms')}{' '}
                      <a
                        href="https://onlyflow.com.br/termos"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-clerky-backendButton hover:opacity-80 underline transition-smooth"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {t('signup.termsOfUse')}
                      </a>
                      {', '}
                      <a
                        href="https://onlyflow.com.br/politica-privacidade"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-clerky-backendButton hover:opacity-80 underline transition-smooth"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {t('signup.privacyPolicy')}
                      </a>
                      {', '}
                      <a
                        href="https://onlyflow.com.br/politica-anti-spam"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-clerky-backendButton hover:opacity-80 underline transition-smooth"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {t('signup.antiSpamPolicy')}
                      </a>
                      {' '}{t('signup.and')}{' '}
                      <a
                        href="https://onlyflow.com.br/politica-de-uso-aceitavel"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-clerky-backendButton hover:opacity-80 underline transition-smooth"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {t('signup.acceptableUsePolicy')}
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
                  className="w-full min-h-[48px] touch-manipulation"
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

