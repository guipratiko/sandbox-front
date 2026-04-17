import React, { useCallback, useEffect, useState } from 'react';
import { Card, Button, Input } from '../UI';
import {
  teamAPI,
  instanceAPI,
  type TeamMemberRow,
  type TeamInvitationRow,
  type SubuserPermissions,
  type Instance,
} from '../../services/api';
import { validators } from '../../utils/validators';

const MODULE_ORDER: (keyof SubuserPermissions)[] = [
  'dashboard',
  'instances',
  'dispatches',
  'dispatchesOfficial',
  'crm',
  'manyflow',
  'integration',
  'aiAgent',
  'groupManager',
  'instagram',
  'scraping',
];

const MODULE_LABELS: Record<keyof SubuserPermissions, string> = {
  dashboard: 'Início / Dashboard',
  instances: 'Conexões (WhatsApp)',
  dispatches: 'Disparos',
  dispatchesOfficial: 'Disparo API Oficial',
  crm: 'CRM',
  manyflow: 'ManyFlow',
  integration: 'Integração',
  aiAgent: 'Agente de IA',
  groupManager: 'Gerenciador de grupos',
  instagram: 'Instagram',
  scraping: 'Scraping',
};

function emptyPerms(): SubuserPermissions {
  return {
    dashboard: false,
    instances: false,
    dispatches: false,
    dispatchesOfficial: false,
    crm: false,
    manyflow: false,
    integration: false,
    aiAgent: false,
    groupManager: false,
    instagram: false,
    scraping: false,
  };
}

const TeamEnterpriseSection: React.FC = () => {
  const [members, setMembers] = useState<TeamMemberRow[]>([]);
  const [invitations, setInvitations] = useState<TeamInvitationRow[]>([]);
  const [instances, setInstances] = useState<Instance[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteName, setInviteName] = useState('');
  const [inviteCpf, setInviteCpf] = useState('');
  const [invitePerms, setInvitePerms] = useState<SubuserPermissions>(emptyPerms());
  const [inviteInstances, setInviteInstances] = useState<string[]>([]);
  const [inviteCrmDelete, setInviteCrmDelete] = useState(false);
  const [sending, setSending] = useState(false);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [m, inv, inst] = await Promise.all([
        teamAPI.listMembers(),
        teamAPI.listInvitations(),
        instanceAPI.getAll().catch(() => ({ status: 'success', count: 0, instances: [] as Instance[] })),
      ]);
      setMembers(m.members || []);
      setInvitations(inv.invitations || []);
      setInstances(inst.instances || []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Erro ao carregar equipe');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const toggleInstance = (id: string) => {
    setInviteInstances((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const sendInvite = async () => {
    setSuccess(null);
    setError(null);
    const cpf = inviteCpf.replace(/\D/g, '');
    const cpfCheck = validators.cpf(inviteCpf);
    if (!inviteEmail.trim() || !inviteName.trim() || !cpfCheck.isValid) {
      setError('Preencha nome, email e CPF válidos.');
      return;
    }
    if (!Object.values(invitePerms).some(Boolean)) {
      setError('Marque ao menos um módulo.');
      return;
    }
    if (invitePerms.crm && inviteInstances.length === 0) {
      setError('Com CRM ativo, selecione ao menos uma instância WhatsApp.');
      return;
    }
    try {
      setSending(true);
      await teamAPI.createInvitation({
        email: inviteEmail.trim().toLowerCase(),
        name: inviteName.trim(),
        cpf,
        permissions: invitePerms,
        allowedCrmInstanceIds: inviteInstances,
        crmAllowDeleteConversationCard: inviteCrmDelete,
      });
      setSuccess('Convite enviado por email.');
      setInviteEmail('');
      setInviteName('');
      setInviteCpf('');
      setInvitePerms(emptyPerms());
      setInviteInstances([]);
      setInviteCrmDelete(false);
      await load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Erro ao enviar convite');
    } finally {
      setSending(false);
    }
  };

  const deactivateMember = async (id: string) => {
    if (!window.confirm('Desativar este membro? Ele não poderá mais entrar.')) return;
    try {
      await teamAPI.updateMember(id, { isSubuserActive: false });
      await load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Erro ao atualizar');
    }
  };

  const cancelInvitation = async (id: string) => {
    try {
      await teamAPI.deleteInvitation(id);
      await load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Erro ao cancelar');
    }
  };

  if (loading) {
    return <p className="text-gray-600 dark:text-gray-400">Carregando equipe…</p>;
  }

  return (
    <div className="space-y-6">
      <Card padding="md" shadow="lg" className="p-4 md:p-6">
        <h2 className="text-lg font-semibold text-clerky-backendText dark:text-gray-100 mb-2">Convidar membro</h2>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
          Recurso exclusivo do plano Enterprise. O convidado receberá um email com link para definir a senha (CPF
          obrigatório, único no sistema).
        </p>
        {error && (
          <div className="mb-4 bg-red-50 dark:bg-red-900/20 border border-red-200 text-red-700 dark:text-red-300 px-3 py-2 rounded text-sm">
            {error}
          </div>
        )}
        {success && (
          <div className="mb-4 bg-green-50 dark:bg-green-900/20 border border-green-200 text-green-800 dark:text-green-300 px-3 py-2 rounded text-sm">
            {success}
          </div>
        )}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input label="Nome" value={inviteName} onChange={(e) => setInviteName(e.target.value)} />
          <Input label="Email" type="email" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} />
        </div>
        <div className="mt-4 max-w-md">
          <Input label="CPF (somente números)" value={inviteCpf} onChange={(e) => setInviteCpf(e.target.value)} />
        </div>
        <div className="mt-4">
          <p className="text-sm font-medium text-clerky-backendText dark:text-gray-200 mb-2">Módulos permitidos</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {MODULE_ORDER.map((key) => (
              <label key={key} className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                <input
                  type="checkbox"
                  checked={invitePerms[key]}
                  onChange={(e) => setInvitePerms((p) => ({ ...p, [key]: e.target.checked }))}
                />
                {MODULE_LABELS[key]}
              </label>
            ))}
          </div>
        </div>
        {invitePerms.crm && (
          <div className="mt-4">
            <p className="text-sm font-medium mb-2">Instâncias WhatsApp no CRM</p>
            <div className="max-h-40 overflow-y-auto border border-gray-200 dark:border-gray-600 rounded p-2 space-y-1">
              {instances.length === 0 ? (
                <p className="text-sm text-gray-500">Nenhuma instância encontrada.</p>
              ) : (
                instances.map((inst) => (
                  <label key={inst.id} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={inviteInstances.includes(inst.id)}
                      onChange={() => toggleInstance(inst.id)}
                    />
                    {inst.name || inst.instanceName || inst.id}
                  </label>
                ))
              )}
            </div>
            <label className="flex items-center gap-2 mt-3 text-sm">
              <input
                type="checkbox"
                checked={inviteCrmDelete}
                onChange={(e) => setInviteCrmDelete(e.target.checked)}
              />
              Permitir excluir conversas no CRM
            </label>
          </div>
        )}
        <Button className="mt-4" variant="primary" onClick={sendInvite} isLoading={sending}>
          Enviar convite
        </Button>
      </Card>

      <Card padding="md" shadow="lg" className="p-4 md:p-6">
        <h2 className="text-lg font-semibold mb-3">Convites pendentes</h2>
        {invitations.length === 0 ? (
          <p className="text-sm text-gray-500">Nenhum convite pendente.</p>
        ) : (
          <ul className="space-y-2">
            {invitations.map((inv) => (
              <li
                key={inv.id}
                className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 dark:border-gray-700 pb-2"
              >
                <span className="text-sm">
                  {inv.name} — {inv.email}
                </span>
                <Button size="sm" variant="secondary" onClick={() => cancelInvitation(inv.id)}>
                  Cancelar
                </Button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card padding="md" shadow="lg" className="p-4 md:p-6">
        <h2 className="text-lg font-semibold mb-3">Membros</h2>
        {members.length === 0 ? (
          <p className="text-sm text-gray-500">Nenhum membro ainda.</p>
        ) : (
          <ul className="space-y-3">
            {members.map((m) => (
              <li
                key={m.id}
                className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 dark:border-gray-700 pb-2 text-sm"
              >
                <div>
                  <div className="font-medium">{m.name}</div>
                  <div className="text-gray-500">{m.email}</div>
                  <div className="text-xs text-gray-400">{m.isSubuserActive ? 'Ativo' : 'Desativado'}</div>
                </div>
                {m.isSubuserActive && (
                  <Button size="sm" variant="secondary" onClick={() => deactivateMember(m.id)}>
                    Desativar
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
};

export default TeamEnterpriseSection;
