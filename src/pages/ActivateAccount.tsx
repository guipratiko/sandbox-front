import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Layout, Container } from '../components/Layout';
import { Button, Input, PasswordInput, Card, FloatingLanguageToggle } from '../components/UI';
import { useLanguage } from '../contexts/LanguageContext';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import { useForm } from '../hooks/useForm';
import { validators } from '../utils/validators';
import { request } from '../services/api';

interface ActivateFormData {
  password: string;
  confirmPassword: string;
}

interface ActivationUser {
  name: string;
  email: string;
}

const ActivateAccount: React.FC = () => {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const [user, setUser] = useState<ActivationUser | null>(null);
  const [isValidating, setIsValidating] = useState(true);
  const [validationError, setValidationError] = useState<string | null>(null);
  const { theme } = useTheme();
  const logoSrc = theme === 'dark' ? '/OnlyFlow-logo.png' : '/OnlyFlow-logo-claro.png';

  // Validar token ao carregar
  useEffect(() => {
    if (!token) {
      setValidationError(t('activate.tokenRequired') || 'Token de ativação é obrigatório');
      setIsValidating(false);
      return;
    }

    const validateToken = async () => {
      try {
        const response = await request<{ status: string; user: ActivationUser }>(
          `/auth/activate?token=${token}`
        );
        if (response.status === 'success' && response.user) {
          setUser(response.user);
        } else {
          setValidationError(t('activate.tokenInvalid') || 'Token de ativação inválido ou expirado');
        }
      } catch (error: any) {
        setValidationError(
          error?.message || t('activate.tokenInvalid') || 'Token de ativação inválido ou expirado'
        );
      } finally {
        setIsValidating(false);
      }
    };

    validateToken();
  }, [token, t]);

  const { values, errors, isLoading, handleChange, handleSubmit } = useForm<ActivateFormData>({
    initialValues: {
      password: '',
      confirmPassword: '',
    },
    onSubmit: async (values) => {
      if (!token) {
        throw new Error('Token não encontrado');
      }

      const response = await request<{ status: string; token: string; user: any }>('/auth/activate', {
        method: 'POST',
        body: JSON.stringify({
          token,
          password: values.password,
        }),
      });

      if (response.status === 'success' && response.token) {
        // Login automático após ativação
        localStorage.setItem('token', response.token);
        localStorage.setItem('user', JSON.stringify(response.user));
        
        // Redirecionar para página inicial
        navigate('/inicio');
      }
    },
    validate: (values) => {
      const errors: Partial<Record<keyof ActivateFormData, string>> = {};

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

  if (isValidating) {
    return (
      <Layout>
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-clerky-backendButton mx-auto mb-4"></div>
            <p className="text-clerky-backendText dark:text-gray-200">
              {t('common.loading') || 'Carregando...'}
            </p>
          </div>
        </div>
      </Layout>
    );
  }

  if (validationError || !user) {
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
                  {t('activate.error') || 'Erro na Ativação'}
                </h1>
                <p className="text-gray-600 dark:text-gray-300 mb-6">
                  {validationError || t('activate.tokenInvalid') || 'Token de ativação inválido ou expirado'}
                </p>
                <Button
                  variant="primary"
                  onClick={() => navigate('/login')}
                >
                  {t('activate.backToLogin') || 'Voltar para Login'}
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

            {/* Card de Ativação */}
            <Card padding="lg" shadow="lg" hover>
              <h1 className="text-3xl font-bold text-center mb-2 text-clerky-backendText dark:text-gray-200">
                {t('activate.title') || 'Ativar Conta'}
              </h1>
              <p className="text-gray-600 dark:text-gray-300 text-center mb-2">
                {t('activate.welcome') || 'Bem-vindo,'} <strong>{user.name}</strong>!
              </p>
              <p className="text-gray-600 dark:text-gray-300 text-center mb-8 text-sm">
                {user.email}
              </p>
              <p className="text-gray-600 dark:text-gray-300 text-center mb-8">
                {t('activate.subtitle') || 'Defina sua senha para ativar sua conta Premium'}
              </p>

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
                  label={t('activate.password') || 'Nova Senha'}
                  value={values.password}
                  onChange={handleChange}
                  placeholder={t('activate.passwordPlaceholder') || 'Digite sua nova senha'}
                  autoComplete="new-password"
                  error={errors.password}
                />

                {/* Campo Confirmar Senha */}
                <PasswordInput
                  id="confirmPassword"
                  name="confirmPassword"
                  label={t('activate.confirmPassword') || 'Confirmar Senha'}
                  value={values.confirmPassword}
                  onChange={handleChange}
                  placeholder={t('activate.confirmPasswordPlaceholder') || 'Confirme sua nova senha'}
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
                  {isLoading
                    ? t('activate.activating') || 'Ativando...'
                    : t('activate.submit') || 'Ativar Conta'}
                </Button>
              </form>
            </Card>
          </div>
        </Container>
      </div>
    </Layout>
  );
};

export default ActivateAccount;

