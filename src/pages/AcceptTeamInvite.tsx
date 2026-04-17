import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Layout, Container } from '../components/Layout';
import { Button, PasswordInput, Card, FloatingLanguageToggle } from '../components/UI';
import { useLanguage } from '../contexts/LanguageContext';
import { useTheme } from '../contexts/ThemeContext';
import { useForm } from '../hooks/useForm';
import { validators } from '../utils/validators';
import { publicTeamAPI } from '../services/api';

interface FormData {
  password: string;
  confirmPassword: string;
}

const AcceptTeamInvite: React.FC = () => {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const [inviteName, setInviteName] = useState<string | null>(null);
  const [ownerLabel, setOwnerLabel] = useState<string>('');
  const [isValidating, setIsValidating] = useState(true);
  const [validationError, setValidationError] = useState<string | null>(null);
  const { theme } = useTheme();
  const logoSrc = theme === 'dark' ? '/OnlyFlow-logo.png' : '/OnlyFlow-logo-claro.png';

  useEffect(() => {
    if (!token) {
      setValidationError('Token do convite é obrigatório');
      setIsValidating(false);
      return;
    }
    publicTeamAPI
      .validateInvite(token)
      .then((res) => {
        if (res.status === 'success' && res.invite) {
          setInviteName(res.invite.name);
          const org = res.invite.companyName?.trim();
          setOwnerLabel(
            org ? `${res.invite.ownerName} (${org})` : res.invite.ownerName || 'OnlyFlow'
          );
        } else {
          setValidationError('Convite inválido ou expirado');
        }
      })
      .catch(() => setValidationError('Convite inválido ou expirado'))
      .finally(() => setIsValidating(false));
  }, [token]);

  const { values, errors, isLoading, handleChange, handleSubmit } = useForm<FormData>({
    initialValues: { password: '', confirmPassword: '' },
    onSubmit: async (vals) => {
      if (!token) throw new Error('Token não encontrado');
      const response = await publicTeamAPI.acceptInvite(token, vals.password);
      if (response.status === 'success' && response.token && response.user) {
        localStorage.setItem('token', response.token);
        localStorage.setItem('user', JSON.stringify(response.user));
        window.location.assign('/inicio');
        return;
      }
      throw new Error('Não foi possível aceitar o convite');
    },
    validate: (vals) => {
      const e: Partial<Record<keyof FormData, string>> = {};
      const passwordResult = validators.password(vals.password);
      if (!passwordResult.isValid && passwordResult.error) {
        e.password = t(passwordResult.error);
      }
      const confirmPasswordResult = validators.confirmPassword(vals.confirmPassword, vals.password);
      if (!confirmPasswordResult.isValid && confirmPasswordResult.error) {
        e.confirmPassword = t(confirmPasswordResult.error);
      }
      return e;
    },
  });

  if (isValidating) {
    return (
      <Layout>
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-clerky-backendButton mx-auto mb-4" />
            <p className="text-clerky-backendText dark:text-gray-200">{t('common.loading')}</p>
          </div>
        </div>
      </Layout>
    );
  }

  if (validationError || !inviteName) {
    return (
      <Layout>
        <FloatingLanguageToggle />
        <div className="min-h-screen flex items-center justify-center px-4 py-12">
          <Container maxWidth="sm" className="w-full">
            <Card padding="lg" shadow="lg">
              <div className="text-center">
                <p className="text-red-600 dark:text-red-400 mb-4">{validationError || 'Convite inválido'}</p>
                <Button variant="primary" onClick={() => navigate('/login')}>
                  Voltar ao login
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
      <div className="min-h-screen flex flex-col items-center justify-center px-4 py-12">
        <img src={logoSrc} alt="OnlyFlow" className="h-10 mb-6" />
        <Container maxWidth="sm" className="w-full">
          <Card padding="lg" shadow="lg">
            <h1 className="text-xl font-bold text-clerky-backendText dark:text-gray-100 mb-2">
              Bem-vindo à equipe
            </h1>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
              <strong>{inviteName}</strong>, você foi convidado por <strong>{ownerLabel}</strong>. Defina sua senha
              para acessar o OnlyFlow.
            </p>
            <form onSubmit={handleSubmit} className="space-y-4">
              {errors.general && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                  {errors.general}
                </div>
              )}
              <PasswordInput
                id="password"
                name="password"
                label="Senha"
                value={values.password}
                onChange={handleChange}
                autoComplete="new-password"
                error={errors.password}
              />
              <PasswordInput
                id="confirmPassword"
                name="confirmPassword"
                label="Confirmar senha"
                value={values.confirmPassword}
                onChange={handleChange}
                autoComplete="new-password"
                error={errors.confirmPassword}
              />
              <Button type="submit" variant="primary" className="w-full" isLoading={isLoading}>
                Aceitar e entrar
              </Button>
            </form>
          </Card>
        </Container>
      </div>
    </Layout>
  );
};

export default AcceptTeamInvite;
