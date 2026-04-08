import React, { useState, useEffect } from 'react';
import { Modal, Button } from '../UI';
import { useLanguage } from '../../contexts/LanguageContext';

export type MentionEveryoneModalMode = 'one' | 'all';

interface MentionEveryoneModalProps {
  isOpen: boolean;
  onClose: () => void;
  mode: MentionEveryoneModalMode;
  /** Usado no modo "all" para o texto de ajuda com {count} */
  groupCount?: number;
  onSubmit: (text: string) => Promise<void>;
}

const MentionEveryoneModal: React.FC<MentionEveryoneModalProps> = ({
  isOpen,
  onClose,
  mode,
  groupCount = 0,
  onSubmit,
}) => {
  const { t } = useLanguage();
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setText('');
      setErr(null);
      setSending(false);
    }
  }, [isOpen]);

  const title = mode === 'all' ? t('groupManager.mentionAllGroups.title') : t('groupManager.mention.title');
  const placeholder =
    mode === 'all' ? t('groupManager.mentionAllGroups.placeholder') : t('groupManager.mention.placeholder');
  const messageLabel = mode === 'all' ? t('groupManager.mentionAllGroups.message') : t('groupManager.mention.message');
  const sendLabel = mode === 'all' ? t('groupManager.mentionAllGroups.send') : t('groupManager.mention.send');
  const sendingLabel = mode === 'all' ? t('groupManager.mentionAllGroups.sending') : t('groupManager.mention.sending');
  const helper =
    mode === 'all' && groupCount > 0
      ? t('groupManager.mentionAllGroups.helper').replace('{count}', String(groupCount))
      : null;

  const handleSend = async () => {
    const v = text.trim();
    if (!v) {
      setErr(t('groupManager.mention.textRequired'));
      return;
    }
    setSending(true);
    setErr(null);
    try {
      await onSubmit(v);
      onClose();
    } catch (e: unknown) {
      const msg = e && typeof e === 'object' && 'message' in e && typeof (e as { message: unknown }).message === 'string'
        ? (e as { message: string }).message
        : String(e);
      setErr(msg);
    } finally {
      setSending(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} size="md">
      <div className="space-y-4">
        {helper && <p className="text-sm text-gray-500 dark:text-gray-400">{helper}</p>}
        <div>
          <label className="block text-sm font-medium text-clerky-backendText dark:text-gray-200 mb-1.5">
            {messageLabel}
          </label>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={placeholder}
            rows={4}
            disabled={sending}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-clerky-backendText dark:text-gray-200 text-sm disabled:opacity-60"
          />
        </div>
        {err && <p className="text-sm text-red-600 dark:text-red-400">{err}</p>}
        <div className="flex flex-wrap justify-end gap-2 pt-1">
          <Button variant="outline" size="sm" type="button" onClick={onClose} disabled={sending}>
            {t('common.cancel')}
          </Button>
          <Button variant="primary" size="sm" type="button" onClick={handleSend} disabled={sending}>
            {sending ? sendingLabel : sendLabel}
          </Button>
        </div>
      </div>
    </Modal>
  );
};

export default MentionEveryoneModal;
