import React, {
  useState,
  useEffect,
  useLayoutEffect,
  useCallback,
  useMemo,
  useRef,
  startTransition,
} from 'react';
import { createPortal, flushSync } from 'react-dom';
import { Link } from 'react-router-dom';
import { AppLayout } from '../components/Layout';
import { Card, Button, Modal, HelpIcon } from '../components/UI';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import {
  crmAPI,
  Contact,
  CRMColumn,
  Message,
  instanceAPI,
  instagramAPI,
  Instance,
  InstagramInstance,
  Label,
  type GetContactsResponse,
} from '../services/api';
import {
  CrmInstancePicker,
  CRMInstanceOption,
  CrmSelectedInstance,
} from '../components/crm/CrmInstancePicker';
import { useSocket, NewMessageData, ContactUpdatedPayload } from '../hooks/useSocket';
import { sortMessagesByTimestamp, formatLastMessageContent } from '../utils/messageUtils';
import { userHasPremiumPlan } from '../utils/planAccess';
import {
  formatTime,
  resolveUserDisplayTimeZone,
  formatChatDaySeparatorLabel,
  groupCrmChatMessagesByUserCalendarDay,
} from '../utils/dateFormatters';

// @dnd-kit imports
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  TouchSensor,
  MouseSensor,
  useSensor,
  useSensors,
  closestCorners,
  pointerWithin,
  useDroppable,
  DragOverEvent,
  DragCancelEvent,
  CollisionDetection,
} from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

// Componente de Card de Contato (arrastável)
interface ContactCardProps {
  contact: Contact;
  onClick: () => void;
  showDeleteButton?: boolean;
  onDelete?: (contact: Contact) => void;
  /** Botão direito: abrir escolha de coluna para mover o card. */
  onRequestMoveToColumn?: (contact: Contact, clientX: number, clientY: number) => void;
}

const CRM_STORAGE_INSTANCES = 'crm.selectedInstancesV1';
const CRM_STORAGE_LEGACY = 'crm.selectedInstanceV1';

/** Avatar quando não há foto de perfil (`public/avatar.png`). */
const CRM_DEFAULT_CONTACT_AVATAR_URL = `${(process.env.PUBLIC_URL || '').replace(/\/$/, '')}/avatar.png`;

/** Tamanho da página por coluna no Kanban (alinhado ao backend, máx. 100). */
const CRM_KANBAN_PAGE_SIZE = 20;

function dedupeContactsById(contacts: Contact[]): Contact[] {
  const map = new Map<string, Contact>();
  for (const c of contacts) {
    map.set(c.id, c);
  }
  return Array.from(map.values());
}

type CrmStoredRead =
  | { kind: 'absent' }
  | { kind: 'explicit'; instances: CrmSelectedInstance[] };

function readCrmStoredInstances(): CrmStoredRead {
  try {
    const rawNew = localStorage.getItem(CRM_STORAGE_INSTANCES);
    if (rawNew) {
      const parsed = JSON.parse(rawNew) as { instances?: unknown };
      if (parsed && Array.isArray(parsed.instances)) {
        const instances = (parsed.instances as CrmSelectedInstance[]).filter(
          (x) =>
            x &&
            typeof x.id === 'string' &&
            (x.channel === 'whatsapp' || x.channel === 'instagram')
        );
        return { kind: 'explicit', instances };
      }
    }
    const rawLegacy = localStorage.getItem(CRM_STORAGE_LEGACY);
    if (rawLegacy) {
      const parsed = JSON.parse(rawLegacy) as { instanceId?: string; channel?: string };
      if (
        parsed?.instanceId &&
        (parsed.channel === 'whatsapp' || parsed.channel === 'instagram')
      ) {
        return {
          kind: 'explicit',
          instances: [{ id: parsed.instanceId, channel: parsed.channel }],
        };
      }
    }
  } catch {
    /* ignore */
  }
  return { kind: 'absent' };
}

function crmDefaultInstancesFirstVisit(merged: CRMInstanceOption[]): CrmSelectedInstance[] {
  const connected = merged.find((i) => i.status === 'connected');
  if (connected) return [{ id: connected.id, channel: connected.channel }];
  if (merged.length > 0) return [{ id: merged[0].id, channel: merged[0].channel }];
  return [];
}

function resolveCrmInitialSelection(
  merged: CRMInstanceOption[],
  read: CrmStoredRead
): CrmSelectedInstance[] {
  if (read.kind === 'explicit') {
    return read.instances.filter((s) =>
      merged.some((m) => m.id === s.id && m.channel === s.channel)
    );
  }
  return crmDefaultInstancesFirstVisit(merged);
}

/**
 * Nome vindo do CRM IG costuma ser "Nome exibido · @usuario" (microserviço Instagram / formatIgContactDisplayName).
 * Separa o título do card do @ para a linha abaixo da etiqueta Instagram (sem mostrar o ID numérico em `phone`).
 */
function parseInstagramContactDisplay(name: string): { title: string; handle: string | null } {
  const trimmed = name.trim();
  const dotSep = trimmed.match(/^(.+?)\s*·\s*(@[A-Za-z0-9._]+)\s*$/u);
  if (dotSep) {
    const titlePart = dotSep[1].trim();
    return { title: titlePart || trimmed, handle: dotSep[2] };
  }
  const loneHandle = trimmed.match(/^(@[A-Za-z0-9._]+)$/u);
  if (loneHandle) {
    return { title: trimmed, handle: loneHandle[1] };
  }
  const embedded = trimmed.match(/@([A-Za-z0-9._]+)/u);
  if (embedded) {
    const handle = `@${embedded[1]}`;
    let title = trimmed.replace(/\s*·\s*@[A-Za-z0-9._]+/u, '').trim();
    title = title.replace(new RegExp(`\\s*${handle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*`, 'g'), ' ').trim();
    if (!title) title = trimmed;
    return { title, handle };
  }
  return { title: trimmed, handle: null };
}

/** Prévia da última mensagem: remove cercas markdown, aspas iniciais e espaços extras. */
function formatCrmCardPreview(text: string): string {
  let s = String(text).trim();
  const compact = s.replace(/\s+/g, ' ');
  if (/^\[m[ií]dia\]$/i.test(compact)) return '📎 Mídia';
  if (/^\[(áudio|audio)\]$/i.test(compact)) return '🎤 Áudio';
  if (/^\[(imagem|figurinha)\]$/i.test(compact)) return '📷 Imagem';
  if (/^\[(v[ií]deo|video)\]$/i.test(compact)) return '🎥 Vídeo';
  if (/^\[documento\]$/i.test(compact)) return '📄 Documento';
  s = s.replace(/^```[\w]*\s*/i, '').replace(/\s*```\s*$/, '');
  s = s.replace(/^[`'"«»\s]+/, '').replace(/[`'"«»\s]+$/, '');
  return s.trim();
}

const ContactCard: React.FC<ContactCardProps> = ({
  contact,
  onClick,
  showDeleteButton,
  onDelete,
  onRequestMoveToColumn,
}) => {
  const { t } = useLanguage();
  const isInstagram = contact.channel === 'instagram';
  const igParsed = isInstagram ? parseInstagramContactDisplay(contact.name) : null;
  const cardTitle = igParsed?.title ?? contact.name;
  const instagramHandle = igParsed?.handle ?? null;

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: contact.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition: isDragging ? 'none' : transition, // Sem transição durante o drag
    opacity: isDragging ? 0.6 : 1,
    cursor: isDragging ? 'grabbing' : 'grab',
  };


  const hasLabels = Boolean(contact.labels && contact.labels.length > 0);
  /** Reserva espaço à direita (corpo do card) para alinhar com cards que têm exclusão / não lidas */
  const reserveBodyActions = Boolean(showDeleteButton && onDelete) || contact.unreadCount > 0;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={onClick}
      onContextMenu={
        onRequestMoveToColumn
          ? (e) => {
              e.preventDefault();
              e.stopPropagation();
              onRequestMoveToColumn(contact, e.clientX, e.clientY);
            }
          : undefined
      }
      className="group mb-1 w-full max-w-full cursor-grab box-border overflow-hidden rounded-lg border border-slate-200/70 bg-[radial-gradient(ellipse_125%_110%_at_50%_-15%,#F0F8FF_0%,#FAFCFF_42%,#ffffff_100%)] p-[13.7px] shadow-[0_9px_34px_-9px_rgba(30,64,120,0.14),0_3px_11px_-5px_rgba(30,58,95,0.08)] backdrop-blur-[5px] transition-[box-shadow,transform] duration-200 active:cursor-grabbing dark:border-slate-600/35 dark:bg-[radial-gradient(ellipse_125%_110%_at_50%_-15%,#152a4a_0%,#0f1f35_48%,#091525_100%)] dark:shadow-[0_11px_38px_-11px_rgba(0,0,0,0.55),0_5px_17px_-7px_rgba(0,0,0,0.35)] hover:shadow-[0_13px_41px_-11px_rgba(30,64,120,0.18),0_5px_15px_-7px_rgba(30,58,95,0.1)] dark:hover:shadow-[0_15px_43px_-11px_rgba(0,0,0,0.6)]"
    >
      {/* Labels no canto superior esquerdo */}
      {hasLabels && (
        <div
          className={`absolute top-2 left-2 flex flex-wrap gap-1 z-10 ${
            reserveBodyActions ? 'max-w-[calc(100%-4.25rem)]' : 'max-w-[calc(100%-3rem)]'
          }`}
        >
          {contact.labels!.map((label) => (
            <span
              key={label.id}
              className="px-2 py-0.5 text-xs font-semibold rounded-md text-white shadow-sm truncate max-w-full"
              style={{ backgroundColor: label.color }}
              title={label.name}
            >
              {label.name}
            </span>
          ))}
        </div>
      )}

      <div className={`min-w-0 ${hasLabels ? 'pt-5' : ''}`}>
        {/* Cabeçalho: uma linha, sem quebra (ellipsis se não couber) */}
        <div className="mb-2 min-w-0 border-b border-slate-200/90 pb-1.5 dark:border-slate-500/35">
          <h4
            className="truncate text-[11.6px] font-medium leading-snug tracking-tight text-slate-800 dark:text-slate-100 whitespace-nowrap"
            title={cardTitle}
          >
            {cardTitle}
          </h4>
        </div>

        {/* Corpo: avatar | telefone + prévia (flex-1) | badge + exclusão (faixa estreita) */}
        <div className="flex min-w-0 items-start gap-1">
          <div className="relative h-[2.39rem] w-[2.39rem] shrink-0">
            {/* Bokeh suave por trás da foto */}
            <div
              className="pointer-events-none absolute -inset-1 rounded-full bg-[radial-gradient(circle_at_28%_22%,rgba(255,255,255,0.95)_0%,transparent_42%),radial-gradient(circle_at_72%_28%,rgba(186,210,255,0.45)_0%,transparent_32%),radial-gradient(circle_at_55%_78%,rgba(255,245,220,0.5)_0%,transparent_38%)] opacity-90 dark:bg-[radial-gradient(circle_at_30%_25%,rgba(120,160,220,0.35)_0%,transparent_45%),radial-gradient(circle_at_70%_70%,rgba(80,120,180,0.2)_0%,transparent_40%)] dark:opacity-70"
              aria-hidden
            />
            <div className="relative rounded-full bg-gradient-to-br from-white/95 to-slate-100/90 p-[2px] shadow-[inset_0_2px_5px_rgba(15,23,42,0.14),inset_0_-2px_4px_rgba(255,255,255,0.75)] dark:from-slate-600/50 dark:to-slate-800/85 dark:shadow-[inset_0_2px_9px_rgba(0,0,0,0.5),inset_0_-1px_3px_rgba(255,255,255,0.06)]">
              <div className="relative overflow-hidden rounded-full ring-1 ring-slate-200/60 dark:ring-slate-500/25">
                <img
                  src={contact.profilePicture || CRM_DEFAULT_CONTACT_AVATAR_URL}
                  alt=""
                  className="h-[2.39rem] w-[2.39rem] rounded-full object-cover bg-slate-100 dark:bg-slate-700"
                  style={{ imageRendering: 'auto' }}
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    if (target.src.endsWith('/avatar.png')) return;
                    target.onerror = null;
                    target.src = CRM_DEFAULT_CONTACT_AVATAR_URL;
                  }}
                />
              </div>
            </div>
          </div>
          <div className="flex min-h-[2.39rem] min-w-0 flex-1 flex-col justify-between gap-px overflow-hidden pr-0.5">
            <div className="min-w-0 space-y-px">
              {isInstagram && (
                <span className="inline-flex w-fit items-center rounded px-1.5 py-px text-[8.6px] font-semibold bg-pink-100 text-pink-700 dark:bg-pink-900/40 dark:text-pink-300">
                  Instagram
                </span>
              )}
              {isInstagram ? (
                instagramHandle ? (
                  <p
                    className="max-w-full truncate text-[9.6px] font-medium leading-snug text-slate-800 dark:text-slate-100 whitespace-nowrap"
                    title={instagramHandle}
                  >
                    {instagramHandle}
                  </p>
                ) : null
              ) : (
                <p
                  className="max-w-full truncate text-[9.6px] font-semibold leading-snug tracking-tight text-slate-800 tabular-nums dark:text-slate-100 whitespace-nowrap"
                  title={contact.phone}
                >
                  {contact.phone}
                </p>
              )}
            </div>
            {contact.lastMessage && (
              <p className="line-clamp-3 min-w-0 max-w-full text-left text-[9.6px] font-normal leading-snug text-slate-500 break-words dark:text-slate-400">
                {formatCrmCardPreview(contact.lastMessage)}
              </p>
            )}
          </div>

          {/* Badge + exclusão: coluna estreita para maximizar texto central */}
          {reserveBodyActions && (
            <div
              className={`flex shrink-0 flex-col items-end justify-start gap-px self-start ${
                showDeleteButton && onDelete ? 'w-[2.21rem]' : 'w-[1.48rem]'
              }`}
            >
              <div className="h-[1.09rem] w-full flex items-center justify-end shrink-0">
                {contact.unreadCount > 0 ? (
                  <span
                    className="inline-flex h-[1.09rem] min-w-[1.18rem] items-center justify-center rounded-full bg-[#2196F3] px-0.5 text-[8.6px] font-bold tabular-nums leading-none text-white shadow-sm shadow-sky-900/15"
                    aria-label={String(contact.unreadCount)}
                  >
                    {contact.unreadCount > 99 ? '99+' : contact.unreadCount}
                  </span>
                ) : null}
              </div>
              {showDeleteButton && onDelete && (
                <button
                  type="button"
                  title={t('crm.deleteCard')}
                  aria-label={t('crm.deleteCard')}
                  className="rounded-md p-0.5 text-rose-400 transition-colors hover:bg-rose-500/10 hover:text-rose-500 dark:text-rose-400/90 dark:hover:bg-rose-500/15 dark:hover:text-rose-300"
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(contact);
                  }}
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-3.5 w-3.5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={1.5}
                    aria-hidden
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0"
                    />
                  </svg>
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// Componente de Coluna do Kanban
interface ColumnProps {
  column: CRMColumn;
  contacts: Contact[];
  /** Total de contatos na coluna (servidor); se omitido, usa contacts.length. */
  totalInColumn?: number;
  loadingMore?: boolean;
  onLoadMore?: () => void;
  onContactClick: (contact: Contact) => void;
  allowDeleteCard?: boolean;
  onDeleteContact?: (contact: Contact) => void;
  onRequestMoveToColumn?: (contact: Contact, clientX: number, clientY: number) => void;
}

const Column: React.FC<ColumnProps> = ({
  column,
  contacts,
  totalInColumn,
  loadingMore,
  onLoadMore,
  onContactClick,
  allowDeleteCard,
  onDeleteContact,
  onRequestMoveToColumn,
}) => {
  const { t } = useLanguage();
  const { setNodeRef, isOver } = useDroppable({
    id: column.id,
  });
  const scrollRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const loadMoreLockRef = useRef(false);

  const contactIds = contacts.map((c) => c.id);
  const displayedTotal = totalInColumn ?? contacts.length;
  /** Sem total do servidor: página cheia (20) implica possível próxima página. */
  const hasMore =
    typeof totalInColumn === 'number'
      ? contacts.length < totalInColumn
      : contacts.length >= CRM_KANBAN_PAGE_SIZE;

  const handleScroll = () => {
    if (!onLoadMore || loadingMore || !hasMore) return;
    const el = scrollRef.current;
    if (!el || loadMoreLockRef.current) return;
    const { scrollTop, clientHeight, scrollHeight } = el;
    if (scrollHeight - scrollTop - clientHeight < 72) {
      loadMoreLockRef.current = true;
      onLoadMore();
      window.setTimeout(() => {
        loadMoreLockRef.current = false;
      }, 400);
    }
  };

  useEffect(() => {
    const root = scrollRef.current;
    const sentinel = sentinelRef.current;
    if (!root || !sentinel || !onLoadMore || loadingMore || !hasMore) {
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        const hit = entries.some((e) => e.isIntersecting);
        if (!hit || loadMoreLockRef.current) return;
        loadMoreLockRef.current = true;
        onLoadMore();
        window.setTimeout(() => {
          loadMoreLockRef.current = false;
        }, 450);
      },
      { root, rootMargin: '100px', threshold: 0 }
    );
    io.observe(sentinel);
    return () => io.disconnect();
  }, [onLoadMore, loadingMore, hasMore, contacts.length, totalInColumn]);

  return (
    <div
      ref={setNodeRef}
      className={`flex h-full max-h-full min-h-0 min-w-0 flex-col rounded-lg border-2 p-2 sm:p-3 transition-[border-color,box-shadow,background-color] duration-200 bg-gray-100 dark:bg-gray-900 shrink-0 w-[min(249px,85vw)] max-w-[249px] self-stretch md:h-full md:w-full md:max-w-none ${
        isOver
          ? 'border-blue-500 dark:border-blue-400 bg-blue-50/90 dark:bg-blue-950/80 shadow-md ring-2 ring-blue-400/40 dark:ring-blue-500/35 z-[1]'
          : 'border-transparent'
      }`}
    >
      <div className="relative z-[2] mb-3 sm:mb-4 shrink-0 pb-3 sm:pb-4 border-b border-gray-300 dark:border-gray-700">
        <h3
          className="font-semibold text-base md:text-lg text-clerky-backendText dark:text-gray-200 mb-1 truncate"
          title={column.name}
        >
          {column.name}
        </h3>
        <span className="text-sm text-gray-500 dark:text-gray-400">
          {displayedTotal}{' '}
          {displayedTotal === 1 ? t('crm.contact') : t('crm.contacts')}
        </span>
      </div>
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain scrollbar-hide"
      >
        {contactIds.length > 0 ? (
          <SortableContext items={contactIds} strategy={verticalListSortingStrategy}>
            {contacts.map((contact) => (
              <ContactCard
                key={contact.id}
                contact={contact}
                onClick={() => onContactClick(contact)}
                showDeleteButton={allowDeleteCard}
                onDelete={onDeleteContact}
                onRequestMoveToColumn={onRequestMoveToColumn}
              />
            ))}
          </SortableContext>
        ) : (
          <div className="flex items-center justify-center h-full text-gray-400 dark:text-gray-500 text-sm border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-lg">
            {t('crm.dragContactsHere')}
          </div>
        )}
        <div ref={sentinelRef} className="h-px w-full shrink-0" aria-hidden />
        {loadingMore ? (
          <div className="py-2 text-center text-xs text-gray-500 dark:text-gray-400">
            …
          </div>
        ) : null}
      </div>
    </div>
  );
};

/** Quando o backend ainda envia placeholder + URL mas tipo genérico, inferir para renderizar mídia. */
function effectiveCrmMessageTypeForMedia(msg: Message): string {
  const mt = msg.messageType || 'conversation';
  if (
    ['imageMessage', 'stickerMessage', 'audioMessage', 'videoMessage', 'documentMessage'].includes(mt)
  ) {
    return mt;
  }
  const url = msg.mediaUrl;
  if (!url || !String(url).trim()) return mt;
  const c = (msg.content || '').trim().toLowerCase();
  const byContent: Record<string, string> = {
    '[imagem]': 'imageMessage',
    '[áudio]': 'audioMessage',
    '[audio]': 'audioMessage',
    '[vídeo]': 'videoMessage',
    '[video]': 'videoMessage',
  };
  return byContent[c] || mt;
}

/** Texto só-placeholder de mídia no CRM — não exibir como legenda abaixo da mídia. */
function isCrmMediaPlaceholderContent(content: string | undefined): boolean {
  if (content == null || !String(content).trim()) return false;
  const key = String(content).trim().toLowerCase();
  const placeholders = new Set([
    '[mídia]',
    '[imagem]',
    '[áudio]',
    '[audio]',
    '[vídeo]',
    '[video]',
    '[file]',
    '[share]',
    '[anexo]',
  ]);
  return placeholders.has(key);
}

interface CrmChatMessageBubbleProps {
  msg: Message;
  language: 'pt' | 'en';
  newMessageIds: Set<string>;
}

const CrmChatMessageBubble: React.FC<CrmChatMessageBubbleProps> = ({ msg, language, newMessageIds }) => {
  const effType = effectiveCrmMessageTypeForMedia(msg);
  const isMedia =
    !!msg.mediaUrl &&
    ['imageMessage', 'stickerMessage', 'audioMessage', 'videoMessage', 'documentMessage'].includes(effType);
  const isImage = isMedia && (effType === 'imageMessage' || effType === 'stickerMessage');
  const isAudio = isMedia && effType === 'audioMessage';
  const isVideo = isMedia && effType === 'videoMessage';
  const isDocument = isMedia && effType === 'documentMessage';

  const isNewMessage = newMessageIds.has(msg.id);
  const isAutomationOutbound = msg.fromMe && msg.automatedOutbound === true;

  return (
    <div
      className={`flex ${msg.fromMe ? 'justify-end' : 'justify-start'} ${
        isNewMessage ? 'animate-message-appear' : ''
      }`}
    >
      <div
        className={`${isImage || isVideo ? 'w-fit' : 'max-w-[85%] sm:max-w-[75%]'} rounded-2xl ${isImage || isVideo ? 'p-1 overflow-hidden' : 'px-3 sm:px-4 py-2 sm:py-2.5'} shadow-sm ${
          msg.fromMe
            ? isAutomationOutbound
              ? 'bg-[#5B9DFE] text-white rounded-br-md'
              : 'bg-[#D9FCD2] text-[#0f1f1c] dark:bg-[#064640] dark:text-gray-100 rounded-br-md'
            : 'bg-white dark:bg-gray-700 text-clerky-backendText dark:text-gray-200 rounded-bl-md'
        }`}
      >
        {isMedia ? (
          <div>
            {isImage && (
              <img
                src={msg.mediaUrl!}
                alt="Imagem"
                className="max-w-[250px] h-auto rounded-lg block"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                }}
              />
            )}
            {isVideo && (
              <video src={msg.mediaUrl!} controls className="max-w-[250px] h-auto rounded-lg block">
                Seu navegador não suporta vídeo.
              </video>
            )}
            {isAudio && (
              <div className="flex items-center gap-2">
                <audio src={msg.mediaUrl!} controls className="flex-1">
                  Seu navegador não suporta áudio.
                </audio>
              </div>
            )}
            {isDocument && (
              <div className="flex items-center gap-2">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"
                  />
                </svg>
                <a
                  href={msg.mediaUrl!}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm underline hover:opacity-80"
                >
                  Baixar documento
                </a>
              </div>
            )}
            {!isImage && !isVideo && !isAudio && !isDocument && (
              <p className="text-sm">[Mídia não suportada]</p>
            )}
            {msg.content && !isCrmMediaPlaceholderContent(msg.content) && (
              <p
                className={`text-sm mt-2 whitespace-pre-wrap break-words ${
                  msg.fromMe
                    ? isAutomationOutbound
                      ? 'text-white/95'
                      : 'text-[#0f1f1c]/95 dark:text-gray-100'
                    : 'text-clerky-backendText dark:text-gray-200'
                }`}
              >
                {msg.content}
              </p>
            )}
          </div>
        ) : (
          <p className="text-sm whitespace-pre-wrap break-words">{msg.content}</p>
        )}
        <p
          className={`text-xs mt-1 ${
            msg.fromMe
              ? isAutomationOutbound
                ? 'text-white/85'
                : 'text-[#14532d]/65 dark:text-white/70'
              : 'text-gray-500'
          }`}
        >
          {formatTime(msg.timestamp, language)}
        </p>
      </div>
    </div>
  );
};

// Componente de Modal de Chat
interface ChatModalProps {
  isOpen: boolean;
  onClose: () => void;
  contact: Contact | null;
  onContactUpdate?: () => void;
  draggable?: boolean;
  initialPosition?: { x: number; y: number };
  modalId?: string;
  zIndex?: number;
}

const ChatModal: React.FC<ChatModalProps> = ({ 
  isOpen, 
  onClose, 
  contact, 
  onContactUpdate,
  draggable = false,
  initialPosition,
  modalId,
  zIndex = 50,
}) => {
  const { token, user } = useAuth();
  const { language } = useLanguage();
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [showCaptionInput, setShowCaptionInput] = useState(false);
  const [caption, setCaption] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messageInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const [newMessageIds, setNewMessageIds] = useState<Set<string>>(new Set());
  /** Após `getMessages` (abrir trocar contato): rolar até a última mensagem, com reforços pós-layout do modal. */
  const pendingScrollAfterMessagesLoadRef = useRef(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<number | null>(null);
  const timeCounterRef = useRef<number>(0);
  const [showLabelsModal, setShowLabelsModal] = useState(false);
  const [availableLabels, setAvailableLabels] = useState<Label[]>([]);
  const [contactLabels, setContactLabels] = useState<Set<string>>(new Set());
  const [isLoadingLabels, setIsLoadingLabels] = useState(false);

  const chatTimeZone = useMemo(
    () => resolveUserDisplayTimeZone(user?.timezone),
    [user?.timezone]
  );
  const messageGroups = useMemo(
    () => groupCrmChatMessagesByUserCalendarDay(messages, chatTimeZone),
    [messages, chatTimeZone]
  );

  /** Garante scroll após o DOM atualizar (mensagens via socket / append). Usa 'auto' para evitar “piscar” por scroll animado. */
  const scrollToBottomAfterPaint = useCallback(() => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'auto' });
      });
    });
  }, []);

  const flushScrollToBottomOfThread = useCallback(() => {
    const container = messagesContainerRef.current;
    const end = messagesEndRef.current;
    if (container) {
      container.scrollTop = Math.max(0, container.scrollHeight - container.clientHeight);
    }
    end?.scrollIntoView({ behavior: 'auto', block: 'end' });
  }, []);

  const loadMessages = useCallback(async (opts?: { silent?: boolean }) => {
    if (!contact) return;
    const silent = !!opts?.silent;

    try {
      if (!silent) {
        pendingScrollAfterMessagesLoadRef.current = false;
        setIsLoading(true);
      }
      const response = await crmAPI.getMessages(contact.id);
      const sorted = sortMessagesByTimestamp(response.messages);
      setMessages(sorted);
      if (!silent) {
        pendingScrollAfterMessagesLoadRef.current = sorted.length > 0;
      }
    } catch (error: any) {
      console.error('Erro ao carregar mensagens:', error);
      if (!silent) {
        pendingScrollAfterMessagesLoadRef.current = false;
      }
    } finally {
      if (!silent) {
        setIsLoading(false);
      }
    }
  }, [contact]);

  // Callback para novas mensagens via WebSocket
  const handleNewMessage = useCallback((data: NewMessageData) => {
    if (!contact || !isOpen) return;

    if (data.instanceId && String(data.instanceId) !== String(contact.instanceId)) {
      return;
    }

    // Verificar se a mensagem é para o contato atual
    if (String(data.contactId) !== String(contact.id)) {
      return;
    }

    setMessages((prev) => {
      const existingIds = new Set(prev.map((m) => m.id));
      const newMessages = data.messages.filter((m) => !existingIds.has(m.id));
      if (newMessages.length === 0) {
        return prev;
      }

      const mapped = newMessages.map((m) => ({
        id: m.id,
        messageId: m.messageId,
        channel: m.channel,
        fromMe: m.fromMe,
        messageType: m.messageType,
        content: m.content,
        mediaUrl: m.mediaUrl,
        timestamp: m.timestamp,
        read: m.read,
        automatedOutbound: m.automatedOutbound === true,
      }));

      const highlightIds = new Set(mapped.map((m) => m.id));
      queueMicrotask(() => {
        setNewMessageIds((prevIds) => {
          const combined = new Set(Array.from(prevIds));
          highlightIds.forEach((id) => combined.add(id));
          return combined;
        });
        window.setTimeout(() => {
          setNewMessageIds((current) => {
            const updated = new Set(Array.from(current));
            highlightIds.forEach((id) => updated.delete(id));
            return updated;
          });
        }, 600);
      });

      return sortMessagesByTimestamp([...prev, ...mapped]);
    });

    scrollToBottomAfterPaint();
  }, [contact, isOpen, scrollToBottomAfterPaint]);

  // Recarrega a thread quando o backend avisa (WhatsApp e Instagram).
  // Instagram: fallback quando new-message não chega (ex.: socket do Insta-Clerky em produção).
  const handleContactUpdate = useCallback(
    (payload?: ContactUpdatedPayload) => {
      if (!contact || !isOpen) return;
      if (
        payload?.instanceId != null &&
        String(payload.instanceId).trim() !== '' &&
        String(payload.instanceId) !== String(contact.instanceId)
      ) {
        return;
      }
      const ch = payload?.channel;
      if (ch != null && ch !== contact.channel) {
        return;
      }
      loadMessages({ silent: true });
    },
    [contact, isOpen, loadMessages]
  );

  // Conectar ao WebSocket para receber novas mensagens em tempo real
  useSocket(token, undefined, handleNewMessage, handleContactUpdate);

  useEffect(() => {
    if (contact && isOpen) {
      loadMessages();
    } else {
      setMessages([]);
      pendingScrollAfterMessagesLoadRef.current = false;
    }
  }, [contact, isOpen, loadMessages]);

  const focusMessageInput = useCallback(() => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const el = messageInputRef.current;
        if (!el || el.disabled) return;
        el.focus({ preventScroll: true });
      });
    });
  }, []);

  /** Ao abrir o chat ou fechar o fluxo de legenda, foco no campo de texto. */
  useEffect(() => {
    if (!isOpen || !contact || showCaptionInput || isRecording) return;
    const id = window.setTimeout(focusMessageInput, 80);
    return () => window.clearTimeout(id);
  }, [isOpen, contact?.id, showCaptionInput, isRecording, focusMessageInput]);

  // Ao abrir o chat / trocar de contato: após carregar a thread, ir até a última mensagem (reforços pós-layout do modal).
  useLayoutEffect(() => {
    if (!pendingScrollAfterMessagesLoadRef.current || isLoading || messages.length === 0) {
      return;
    }
    flushScrollToBottomOfThread();
  }, [isLoading, messages, flushScrollToBottomOfThread]);

  useEffect(() => {
    if (!pendingScrollAfterMessagesLoadRef.current || isLoading || messages.length === 0) {
      return;
    }
    const run = () => flushScrollToBottomOfThread();
    run();
    const raf = requestAnimationFrame(() => {
      run();
      requestAnimationFrame(run);
    });
    const t1 = window.setTimeout(run, 80);
    const t2 = window.setTimeout(run, 220);
    const t3 = window.setTimeout(() => {
      run();
      pendingScrollAfterMessagesLoadRef.current = false;
    }, 400);
    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      window.clearTimeout(t3);
    };
  }, [isLoading, messages, flushScrollToBottomOfThread]);


  const handleSendMessage = async () => {
    if (!contact || !newMessage.trim()) return;
    if (isSending) return;

    const messageText = newMessage.trim();
    setNewMessage('');
    setIsSending(true);

    // Adicionar mensagem otimisticamente (antes de enviar)
    const optimisticMessage: Message = {
      id: `temp_${Date.now()}`,
      messageId: `temp_${Date.now()}`,
      fromMe: true,
      messageType: 'conversation',
      content: messageText,
      timestamp: new Date().toISOString(),
      read: true,
    };

    // Commit síncrono + scroll no próximo paint: sensação imediata (não esperar a API)
    flushSync(() => {
      setMessages((prev) => sortMessagesByTimestamp([...prev, optimisticMessage]));
    });
    scrollToBottomAfterPaint();

    try {
      const response = await crmAPI.sendMessage(contact.id, { text: messageText });
      
      // Substituir mensagem otimista pela real
      setMessages((prev) => {
        const filtered = prev.filter((msg) => msg.id !== optimisticMessage.id);
        return sortMessagesByTimestamp([...filtered, response.data]);
      });
      scrollToBottomAfterPaint();
    } catch (error: any) {
      console.error('Erro ao enviar mensagem:', error);
      // Remover mensagem otimista em caso de erro
      setMessages((prev) => prev.filter((msg) => msg.id !== optimisticMessage.id));
      setNewMessage(messageText); // Restaurar texto
      alert(error.message || 'Erro ao enviar mensagem');
    } finally {
      setIsSending(false);
      // Após o React voltar a habilitar o input (fim do envio), restaurar o foco para a próxima mensagem
      window.setTimeout(() => focusMessageInput(), 0);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validar tamanho (50MB)
    if (file.size > 50 * 1024 * 1024) {
      alert('Arquivo muito grande. Tamanho máximo: 50MB');
      return;
    }

    // Validar tipo
    const allowedTypes = [
      'image/jpeg',
      'image/jpg',
      'image/png',
      'image/gif',
      'image/webp',
      'video/mp4',
      'video/quicktime',
      'audio/mpeg',
      'audio/mp3',
      'audio/ogg',
      'audio/wav',
    ];

    if (!allowedTypes.includes(file.type)) {
      alert('Tipo de arquivo não permitido. Use imagens, vídeos ou áudios.');
      return;
    }

    setSelectedFile(file);

    // Se for imagem ou vídeo, mostrar campo de caption
    if (file.type.startsWith('image/') || file.type.startsWith('video/')) {
      setShowCaptionInput(true);
    } else {
      // Se for áudio, enviar diretamente
      handleSendMedia(file);
    }
  };

  const handleSendMedia = async (file?: File) => {
    if (!contact) return;
    if (isSending) return;

    const fileToSend = file || selectedFile;
    if (!fileToSend) return;

    const isAudio = fileToSend.type.startsWith('audio/');

    try {
      setIsSending(true);

      // Adicionar mensagem otimisticamente
      const optimisticMessage: Message = {
        id: `temp_${Date.now()}`,
        messageId: `temp_${Date.now()}`,
        fromMe: true,
        messageType: isAudio ? 'audioMessage' : fileToSend.type.startsWith('image/') ? 'imageMessage' : 'videoMessage',
        content: '[Mídia]',
        mediaUrl: URL.createObjectURL(fileToSend),
        timestamp: new Date().toISOString(),
        read: true,
      };

      flushSync(() => {
        setMessages((prev) => sortMessagesByTimestamp([...prev, optimisticMessage]));
      });
      scrollToBottomAfterPaint();

      // Enviar mídia
      const response = isAudio
        ? await crmAPI.sendAudio(contact.id, fileToSend)
        : await crmAPI.sendMedia(contact.id, fileToSend, caption || undefined);

      // Substituir mensagem otimista pela real
      setMessages((prev) => {
        const filtered = prev.filter((msg) => msg.id !== optimisticMessage.id);
        return sortMessagesByTimestamp([...filtered, response.data]);
      });
      scrollToBottomAfterPaint();

      // Limpar estado
      setSelectedFile(null);
      setShowCaptionInput(false);
      setCaption('');
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (error: any) {
      console.error('Erro ao enviar mídia:', error);
      // Remover mensagem otimista em caso de erro
      setMessages((prev) => prev.filter((msg) => msg.id.startsWith('temp_')));
      alert(error.message || 'Erro ao enviar mídia');
    } finally {
      setIsSending(false);
    }
  };

  const handleAttachClick = () => {
    fileInputRef.current?.click();
  };

  // Função para iniciar gravação de áudio
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      // Preferir audio/ogg (suportado pela API WhatsApp/Meta); webm não é aceito no upload.
      const options: MediaRecorderOptions = {};
      if (MediaRecorder.isTypeSupported('audio/ogg;codecs=opus')) {
        options.mimeType = 'audio/ogg;codecs=opus';
      } else if (MediaRecorder.isTypeSupported('audio/ogg')) {
        options.mimeType = 'audio/ogg';
      } else if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
        options.mimeType = 'audio/webm;codecs=opus';
      } else if (MediaRecorder.isTypeSupported('audio/webm')) {
        options.mimeType = 'audio/webm';
      }

      const mediaRecorder = new MediaRecorder(stream, options);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        if (audioChunksRef.current.length === 0) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        // Obter o tipo MIME real usado pelo MediaRecorder
        const actualMimeType = mediaRecorder.mimeType || 'audio/ogg';
        
        // Normalizar o tipo MIME (remover codecs se necessário para compatibilidade)
        let normalizedMimeType = actualMimeType;
        let extension = 'ogg';
        
        if (actualMimeType.includes('ogg')) {
          normalizedMimeType = 'audio/ogg';
          extension = 'ogg';
        } else if (actualMimeType.includes('webm')) {
          normalizedMimeType = 'audio/webm';
          extension = 'webm';
        } else if (actualMimeType.includes('mp4') || actualMimeType.includes('m4a')) {
          normalizedMimeType = 'audio/mp4';
          extension = 'm4a';
        } else if (actualMimeType.includes('wav')) {
          normalizedMimeType = 'audio/wav';
          extension = 'wav';
        }

        const audioBlob = new Blob(audioChunksRef.current, { type: normalizedMimeType });
        const audioFile = new File([audioBlob], `audio-${Date.now()}.${extension}`, { type: normalizedMimeType });
        
        // Parar todas as tracks do stream
        stream.getTracks().forEach((track) => track.stop());

        // Enviar áudio apenas se tiver conteúdo
        if (contact && audioFile.size > 0) {
          try {
            setIsSending(true);
            console.log('[CRM] Gravação finalizada, enviando áudio', {
              contactId: contact.id,
              size: audioFile.size,
              type: normalizedMimeType,
              extension,
            });
            const response = await crmAPI.sendAudio(contact.id, audioFile);
            console.log('[CRM] Áudio enviado com sucesso', { messageId: response.data?.messageId });
            // Adicionar mensagem otimisticamente
            const optimisticMessage: Message = {
              id: response.data.id,
              messageId: response.data.messageId,
              fromMe: true,
              messageType: 'audioMessage',
              content: '[Mídia]',
              mediaUrl: response.data.mediaUrl,
              timestamp: response.data.timestamp,
              read: true,
            };

            setMessages((prev) => sortMessagesByTimestamp([...prev, optimisticMessage]));

            scrollToBottomAfterPaint();
          } catch (error: any) {
            console.error('[CRM] Erro ao enviar áudio:', error?.message || error, error);
            alert('Erro ao enviar áudio. Tente novamente.');
          } finally {
            setIsSending(false);
          }
        }
      };

      // Limpar timer anterior se existir
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
        recordingTimerRef.current = null;
      }

      // Iniciar gravação
      mediaRecorder.start(100); // Coletar dados a cada 100ms
      
      // Resetar contador
      timeCounterRef.current = 0;
      setRecordingTime(0);
      setIsRecording(true);

      // Timer para mostrar tempo de gravação
      recordingTimerRef.current = window.setInterval(() => {
        timeCounterRef.current += 1;
        setRecordingTime(timeCounterRef.current);
      }, 1000);
    } catch (error: any) {
      console.error('Erro ao iniciar gravação:', error);
      alert('Erro ao acessar o microfone. Verifique as permissões.');
    }
  };

  // Função para parar gravação
  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      // Parar timer primeiro
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
        recordingTimerRef.current = null;
      }
      
      // Parar gravação
      if (mediaRecorderRef.current.state === 'recording') {
        mediaRecorderRef.current.stop();
      }
      
      setIsRecording(false);
    }
  };

  // Limpar ao desmontar componente (apenas uma vez)
  useEffect(() => {
    return () => {
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
        recordingTimerRef.current = null;
      }
      if (mediaRecorderRef.current) {
        if (mediaRecorderRef.current.state === 'recording') {
          mediaRecorderRef.current.stop();
        }
      }
    };
  }, []); // Array vazio = apenas na desmontagem

  const loadLabels = useCallback(async () => {
    if (!contact) return;
    try {
      setIsLoadingLabels(true);
      const [labelsResponse, contactsResponse] = await Promise.all([
        crmAPI.getLabels(),
        crmAPI.getContacts(),
      ]);
      setAvailableLabels(labelsResponse.labels.sort((a, b) => a.order - b.order));
      const currentContact = contactsResponse.contacts.find((c) => c.id === contact.id);
      if (currentContact?.labels) {
        setContactLabels(new Set(currentContact.labels.map((l) => l.id)));
      }
    } catch (error: any) {
      console.error('Erro ao carregar labels:', error);
    } finally {
      setIsLoadingLabels(false);
    }
  }, [contact]);

  const handleToggleLabel = async (labelId: string) => {
    if (!contact) return;
    const hasLabel = contactLabels.has(labelId);
    try {
      if (hasLabel) {
        await crmAPI.removeLabelFromContact(contact.id, labelId);
        setContactLabels((prev) => {
          const newSet = new Set(prev);
          newSet.delete(labelId);
          return newSet;
        });
      } else {
        await crmAPI.addLabelToContact(contact.id, labelId);
        setContactLabels((prev) => {
          const newSet = new Set(prev);
          newSet.add(labelId);
          return newSet;
        });
      }
      // Recarregar labels para atualizar o contato
      await loadLabels();
      // Notificar componente pai para atualizar lista de contatos
      if (onContactUpdate) {
        onContactUpdate();
      }
    } catch (error: any) {
      console.error('Erro ao atualizar label:', error);
      alert(error.message || 'Erro ao atualizar etiqueta');
    }
  };

  useEffect(() => {
    if (isOpen && contact) {
      loadLabels();
    }
  }, [isOpen, contact, loadLabels]);

  if (!contact) return null;

  // Labels no header: usar dados carregados por loadLabels() quando disponível, senão contact.labels
  const headerLabels =
    availableLabels.length > 0 && contactLabels.size > 0
      ? availableLabels.filter((l) => contactLabels.has(l.id))
      : contact.labels ?? [];

  return (
    <>
      <Modal 
        isOpen={isOpen} 
        onClose={onClose} 
        title={
          <div className="flex flex-col gap-2">
            {/* Etiquetas acima do nome */}
            {headerLabels.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {headerLabels.map((label) => (
                  <span
                    key={label.id}
                    className="px-2 py-0.5 text-xs font-semibold rounded-md text-white"
                    style={{ backgroundColor: label.color }}
                  >
                    {label.name}
                  </span>
                ))}
              </div>
            )}
            {/* Nome do contato */}
            <h2 className="text-xl font-semibold text-clerky-backendText dark:text-gray-200">
              {contact.name}
            </h2>
          </div>
        }
        headerActions={
          <Button
            onClick={() => setShowLabelsModal(true)}
            variant="secondary"
            size="sm"
          >
            Gerenciar Etiquetas
          </Button>
        }
        size="lg"
        draggable={draggable}
        initialPosition={initialPosition}
        modalId={modalId}
        zIndex={zIndex}
        contentScroll={false}
      >
        <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
          {/* Área de mensagens — único scroll (barra invisível) */}
          <div
            ref={messagesContainerRef}
            className="relative flex-1 min-h-0 overflow-y-auto scrollbar-hide p-3 sm:p-4 bg-gray-50/80 dark:bg-[#0d1f3c] rounded-2xl mb-3 sm:mb-4 overscroll-contain"
          >
          {isLoading ? (
            <div className="text-center py-8 sm:py-10">
              <div className="animate-spin rounded-full h-8 w-8 border-2 border-clerky-backendButton/30 border-t-clerky-backendButton mx-auto mb-3"></div>
              <p className="text-sm sm:text-base text-gray-600 dark:text-gray-300">Carregando mensagens...</p>
            </div>
          ) : messages.length === 0 ? (
            <div className="text-center py-8 sm:py-10 text-gray-500 dark:text-gray-400 text-sm sm:text-base">
              Nenhuma mensagem ainda. Inicie a conversa!
            </div>
          ) : (
            <>
              <div className="space-y-4 sm:space-y-5">
                {messageGroups.map((group) => (
                  <div key={group.dayKey} data-chat-day={group.dayKey}>
                    <div className="sticky top-0 z-20 flex justify-center py-2 mb-1 pointer-events-none">
                      <span className="pointer-events-auto rounded-full px-3 py-1 text-xs font-medium text-gray-600 dark:text-gray-300 bg-gray-200 dark:bg-gray-700 shadow-md ring-1 ring-black/5 dark:ring-white/10">
                        {formatChatDaySeparatorLabel(
                          new Date(group.messages[0].timestamp),
                          chatTimeZone,
                          language as 'pt' | 'en'
                        )}
                      </span>
                    </div>
                    <div className="space-y-3 sm:space-y-4">
                      {group.messages.map((msg) => (
                        <CrmChatMessageBubble
                          key={msg.id}
                          msg={msg}
                          language={language as 'pt' | 'en'}
                          newMessageIds={newMessageIds}
                        />
                      ))}
                    </div>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>
            </>
          )}
        </div>

        {/* Input de mensagem */}
        <div className="space-y-2">
          {showCaptionInput && selectedFile && (
            <div className="flex items-center gap-2 p-2 sm:p-3 bg-gray-100 dark:bg-gray-700/80 rounded-xl">
              <span className="text-sm text-gray-600 dark:text-gray-400 truncate flex-1">
                {selectedFile.name}
              </span>
              <input
                type="text"
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                placeholder="Legenda (opcional)..."
                className="flex-1 px-3 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded focus:ring-2 focus:ring-clerky-backendButton focus:border-transparent bg-white dark:bg-[#091D41] text-clerky-backendText dark:text-gray-200"
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleSendMedia();
                  }
                }}
              />
              <button
                onClick={() => {
                  setSelectedFile(null);
                  setShowCaptionInput(false);
                  setCaption('');
                  if (fileInputRef.current) {
                    fileInputRef.current.value = '';
                  }
                }}
                className="text-red-500 hover:text-red-700"
                type="button"
              >
                ✕
              </button>
            </div>
          )}
          {!showCaptionInput && (
            <div className="flex gap-2 sm:gap-3 items-center">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,video/*,audio/*"
                onChange={handleFileSelect}
                className="hidden"
              />
              <button
                onClick={handleAttachClick}
                disabled={isRecording}
                className="p-2.5 rounded-xl border border-gray-200 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 hover:border-gray-300 dark:hover:border-gray-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
                type="button"
                title="Anexar arquivo"
              >
                <svg
                  className="w-6 h-6 text-gray-600 dark:text-gray-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"
                  />
                </svg>
              </button>
              <input
                ref={messageInputRef}
                type="text"
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                onKeyDown={handleKeyPress}
                placeholder={isRecording ? `Gravando... ${Math.floor(recordingTime / 60)}:${String(recordingTime % 60).padStart(2, '0')}` : "Digite sua mensagem..."}
                className="flex-1 px-3 sm:px-4 py-2.5 border border-gray-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-clerky-backendButton/50 focus:border-clerky-backendButton bg-white dark:bg-gray-700/90 text-clerky-backendText dark:text-gray-200 placeholder-gray-400 dark:placeholder-gray-500 disabled:opacity-50 transition-colors duration-200"
                disabled={isRecording}
                autoComplete="off"
              />
              <button
                onClick={isRecording ? stopRecording : startRecording}
                disabled={isSending}
                className={`p-2.5 rounded-xl border transition-all duration-200 ${
                  isRecording
                    ? 'bg-red-500 border-red-500 text-white hover:bg-red-600 animate-pulse shadow-sm'
                    : 'border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 hover:border-gray-300 dark:hover:border-gray-500'
                } disabled:opacity-50 disabled:cursor-not-allowed`}
                type="button"
                title={isRecording ? 'Parar gravação' : 'Gravar áudio'}
              >
                {isRecording ? (
                  <svg
                    className="w-6 h-6"
                    fill="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path d="M6 6h12v12H6z" />
                  </svg>
                ) : (
                  <svg
                    className="w-6 h-6"
                    fill="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path d="M12 14c1.66 0 2.99-1.34 2.99-3L15 5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.3-3c0 3-2.54 5.1-5.3 5.1S6.7 14 6.7 11H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c3.28-.48 6-3.3 6-6.72h-1.7z" />
                  </svg>
                )}
              </button>
              <Button
                type="button"
                variant="primary"
                onClick={handleSendMessage}
                disabled={!newMessage.trim() || isSending || isRecording}
                isLoading={isSending}
              >
                Enviar
              </Button>
            </div>
          )}
          {showCaptionInput && selectedFile && (
            <div className="space-y-2">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,video/*,audio/*"
                onChange={handleFileSelect}
                className="hidden"
              />
              <Button
                variant="primary"
                onClick={() => handleSendMedia()}
                disabled={isSending}
                isLoading={isSending}
                className="w-full"
              >
                Enviar Mídia
              </Button>
            </div>
          )}
        </div>
      </div>
    </Modal>
    {showLabelsModal &&
      createPortal(
        <Modal
          isOpen={true}
          onClose={() => setShowLabelsModal(false)}
          title="Gerenciar Etiquetas"
          size="md"
          draggable={true}
          modalId="crm_labels_modal"
          initialPosition={{ x: 200, y: 150 }}
          zIndex={999}
        >
          <div className="space-y-4 sm:space-y-5">
            {isLoadingLabels ? (
              <div className="text-center py-8 sm:py-10">
                <div className="animate-spin rounded-full h-8 w-8 border-2 border-clerky-backendButton/30 border-t-clerky-backendButton mx-auto mb-3"></div>
                <p className="text-sm sm:text-base text-gray-600 dark:text-gray-300">Carregando etiquetas...</p>
              </div>
            ) : (
              <>
                <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400 mb-3 sm:mb-4">
                  Selecione as etiquetas para este contato:
                </p>
                <div className="space-y-2 max-h-[min(400px,60vh)] overflow-y-auto overscroll-contain pr-1 -mr-1 scrollbar-hide">
                  {availableLabels.map((label) => {
                    const isSelected = contactLabels.has(label.id);
                    return (
                      <button
                        key={label.id}
                        onClick={() => handleToggleLabel(label.id)}
                        className={`w-full flex items-center gap-3 p-3 sm:p-3.5 rounded-xl border-2 transition-all duration-200 active:scale-[0.99] ${
                          isSelected
                            ? 'border-clerky-backendButton/60 bg-blue-50 dark:bg-blue-900/25 shadow-sm'
                            : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 hover:bg-gray-50/50 dark:hover:bg-gray-800/30'
                        }`}
                      >
                        <div
                          className="w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0 transition-colors duration-200"
                          style={{
                            backgroundColor: isSelected ? label.color : 'transparent',
                            borderWidth: 2,
                            borderStyle: 'solid',
                            borderColor: label.color,
                          }}
                        >
                          {isSelected && (
                            <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                              <path
                                fillRule="evenodd"
                                d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                                clipRule="evenodd"
                              />
                            </svg>
                          )}
                        </div>
                        <span
                          className="px-2.5 py-1 text-xs font-semibold rounded-lg text-white shadow-sm"
                          style={{ backgroundColor: label.color }}
                        >
                          {label.name}
                        </span>
                      </button>
                    );
                  })}
                </div>
                <div className="flex justify-end gap-2 pt-4 border-t border-gray-200/80 dark:border-gray-700/80">
                  <Button
                    variant="secondary"
                    onClick={() => setShowLabelsModal(false)}
                    className="rounded-xl"
                  >
                    Fechar
                  </Button>
                </div>
              </>
            )}
          </div>
        </Modal>,
        document.body
      )}
    </>
  );
};

const CRM: React.FC = () => {
  const { token, user } = useAuth();
  const { t } = useLanguage();
  const [columns, setColumns] = useState<CRMColumn[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [instances, setInstances] = useState<CRMInstanceOption[]>([]);
  const [selectedInstances, setSelectedInstances] = useState<CrmSelectedInstance[]>([]);
  const [crmSelectionReady, setCrmSelectionReady] = useState(false);
  const [allowDeleteCard, setAllowDeleteCard] = useState(false);
  // Map de contatos abertos: contactId -> Contact
  const [openChats, setOpenChats] = useState<Map<string, Contact>>(new Map());
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingInstances, setIsLoadingInstances] = useState(true);
  /** Totais por coluna (servidor) e offsets carregados para paginação por scroll. */
  const [columnTotals, setColumnTotals] = useState<Record<string, number>>({});
  const [columnOffsets, setColumnOffsets] = useState<Record<string, number>>({});
  const [loadingMoreColumnId, setLoadingMoreColumnId] = useState<string | null>(null);
  const loadMoreLockRef = useRef(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeId, setActiveId] = useState<string | null>(null);
  const [draggedOverColumnId, setDraggedOverColumnId] = useState<string | null>(null);
  /** Última coluna válida sob o ponteiro — evita `over` null no dragEnd (comum com overlay + grid). */
  const lastOverColumnIdRef = useRef<string | null>(null);
  /** Primeira carga após escolher instâncias: sem debounce para o Kanban aparecer já. */
  const skipContactsDebounceOnceRef = useRef(true);

  /** Scroll horizontal ao aproximar o rato das bordas do quadro Kanban. */
  const kanbanHScrollRef = useRef<HTMLDivElement>(null);
  const kanbanEdgeScrollRafRef = useRef<number | null>(null);
  const kanbanEdgeScrollDirRef = useRef<0 | -1 | 1>(0);

  const KANBAN_EDGE_SCROLL_ZONE_PX = 80;
  const KANBAN_EDGE_SCROLL_SPEED = 14;

  const stopKanbanEdgeScroll = useCallback(() => {
    kanbanEdgeScrollDirRef.current = 0;
    if (kanbanEdgeScrollRafRef.current != null) {
      cancelAnimationFrame(kanbanEdgeScrollRafRef.current);
      kanbanEdgeScrollRafRef.current = null;
    }
  }, []);

  const tickKanbanEdgeScroll = useCallback(() => {
    const el = kanbanHScrollRef.current;
    const dir = kanbanEdgeScrollDirRef.current;
    if (!el || dir === 0) {
      kanbanEdgeScrollRafRef.current = null;
      return;
    }
    const maxScroll = Math.max(0, el.scrollWidth - el.clientWidth);
    if (dir < 0 && el.scrollLeft <= 0) {
      stopKanbanEdgeScroll();
      return;
    }
    if (dir > 0 && el.scrollLeft >= maxScroll - 0.5) {
      stopKanbanEdgeScroll();
      return;
    }
    el.scrollLeft += dir * KANBAN_EDGE_SCROLL_SPEED;
    kanbanEdgeScrollRafRef.current = requestAnimationFrame(tickKanbanEdgeScroll);
  }, [stopKanbanEdgeScroll]);

  const updateKanbanEdgeScrollFromPointerClientX = useCallback(
    (clientX: number) => {
      const el = kanbanHScrollRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const x = clientX - rect.left;
      const w = rect.width;
      const maxScroll = Math.max(0, el.scrollWidth - el.clientWidth);
      let dir: 0 | -1 | 1 = 0;
      if (x >= 0 && x < KANBAN_EDGE_SCROLL_ZONE_PX && el.scrollLeft > 0) {
        dir = -1;
      } else if (x > w - KANBAN_EDGE_SCROLL_ZONE_PX && x <= w && el.scrollLeft < maxScroll - 0.5) {
        dir = 1;
      }
      kanbanEdgeScrollDirRef.current = dir;
      if (dir !== 0 && kanbanEdgeScrollRafRef.current == null) {
        kanbanEdgeScrollRafRef.current = requestAnimationFrame(tickKanbanEdgeScroll);
      } else if (dir === 0) {
        stopKanbanEdgeScroll();
      }
    },
    [tickKanbanEdgeScroll, stopKanbanEdgeScroll]
  );

  const handleKanbanHorizontalPointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      updateKanbanEdgeScrollFromPointerClientX(e.clientX);
    },
    [updateKanbanEdgeScrollFromPointerClientX]
  );

  /** Durante o arraste, o ponteiro pode ficar fora do div; usar posição global. */
  useEffect(() => {
    if (!activeId) return;
    const onDocPointerMove = (e: PointerEvent) => {
      updateKanbanEdgeScrollFromPointerClientX(e.clientX);
    };
    document.addEventListener('pointermove', onDocPointerMove);
    return () => {
      document.removeEventListener('pointermove', onDocPointerMove);
      stopKanbanEdgeScroll();
    };
  }, [activeId, updateKanbanEdgeScrollFromPointerClientX, stopKanbanEdgeScroll]);

  useEffect(() => {
    return () => stopKanbanEdgeScroll();
  }, [stopKanbanEdgeScroll]);

  /** Prioriza o retângulo sob o ponteiro (melhor entre colunas lado a lado); fallback para cantos. */
  const crmCollisionDetection: CollisionDetection = useCallback((args) => {
    const pointerHits = pointerWithin(args);
    if (pointerHits.length > 0) {
      return pointerHits;
    }
    return closestCorners(args);
  }, []);

  // Configuração otimizada de sensors para melhor fluidez em tablet
  // TouchSensor para tablets com delay reduzido
  // MouseSensor para desktop com delay mínimo
  // PointerSensor como fallback
  const sensors = useSensors(
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 100, // Delay reduzido para tablets (padrão é 250ms)
        tolerance: 5, // Tolerância menor para melhor responsividade
      },
    }),
    useSensor(MouseSensor, {
      activationConstraint: {
        distance: 5, // Distância menor para melhor responsividade em desktop
      },
    }),
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // Fallback para outros dispositivos
      },
    })
  );

  const loadInstances = useCallback(async () => {
    try {
      setIsLoadingInstances(true);
      const premium = userHasPremiumPlan(user);
      const waResponse = await instanceAPI.getAll();

      let igData: InstagramInstance[] = [];
      const mayFetchInstagram =
        premium && (!user?.isSubuser || !!user?.permissions?.instagram);
      if (mayFetchInstagram) {
        try {
          const igResponse = await instagramAPI.getInstances();
          igData = igResponse.data || [];
        } catch (e) {
          console.warn('CRM: não foi possível listar instâncias Instagram (permissão ou serviço).', e);
        }
      }

      const whatsappInstances: CRMInstanceOption[] = (waResponse.instances || []).map((inst: Instance) => ({
        id: inst.id,
        name: inst.name,
        status: inst.status,
        channel: 'whatsapp',
      }));
      const instagramInstances: CRMInstanceOption[] = igData.map((inst: InstagramInstance) => ({
        id: inst.id,
        name: inst.name || inst.username || inst.instanceName,
        status: inst.status,
        channel: 'instagram',
      }));
      const merged = [...whatsappInstances, ...instagramInstances];
      setInstances(merged);

      const stored = readCrmStoredInstances();
      setSelectedInstances(resolveCrmInitialSelection(merged, stored));
      setCrmSelectionReady(true);
    } catch (error: any) {
      console.error('Erro ao carregar instâncias:', error);
    } finally {
      setIsLoadingInstances(false);
    }
  }, [user]);

  /** Só colunas (ex.: nenhuma instância selecionada no filtro do CRM). */
  const loadColumnsOnly = useCallback(async () => {
    try {
      const response = await crmAPI.getColumns();
      setColumns(response.columns.sort((a, b) => a.order - b.order));
    } catch (error: any) {
      console.error('Erro ao carregar colunas:', error);
    }
  }, []);

  /**
   * Uma requisição: colunas + primeira página de cada coluna (lista ou busca).
   * Elimina N× HTTP que serializavam no browser e repetiam init/IGC no servidor.
   */
  const loadKanbanBootstrap = useCallback(async () => {
    if (selectedInstances.length === 0) {
      setContacts([]);
      setColumnTotals({});
      setColumnOffsets({});
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      const scope = selectedInstances;
      const r = await crmAPI.kanbanBootstrap({
        limit: CRM_KANBAN_PAGE_SIZE,
        crmScope: scope,
        q: searchQuery.trim() || undefined,
      });

      const sortedCols = [...r.columns].sort((a, b) => a.order - b.order);
      setColumns(sortedCols);

      const merged: Contact[] = [];
      const totals: Record<string, number> = {};
      const offsets: Record<string, number> = {};

      for (const col of sortedCols) {
        const slot = r.byColumn[col.id];
        const list = slot?.contacts ?? [];
        merged.push(...list);
        if (list.length === 0) {
          totals[col.id] = typeof slot?.totalInColumn === 'number' ? slot.totalInColumn : 0;
        } else if (typeof slot?.totalInColumn === 'number') {
          totals[col.id] = slot.totalInColumn;
        } else if (list.length < CRM_KANBAN_PAGE_SIZE) {
          totals[col.id] = list.length;
        }
        offsets[col.id] = list.length;
      }

      setContacts(dedupeContactsById(merged));
      setColumnTotals(totals);
      setColumnOffsets(offsets);
    } catch (error: any) {
      console.error('Erro ao carregar quadro do CRM:', error);
    } finally {
      setIsLoading(false);
    }
  }, [selectedInstances, searchQuery]);

  /** Lista completa (para sincronizar após WebSocket / fechar chat). */
  const loadContactsFull = useCallback(async () => {
    if (selectedInstances.length === 0) {
      return;
    }

    try {
      setIsLoading(true);
      let response;
      if (searchQuery.trim()) {
        response = await crmAPI.searchContacts(searchQuery.trim());
      } else {
        response = await crmAPI.getContacts();
      }
      const filteredContacts = response.contacts.filter((contact) =>
        selectedInstances.some(
          (s) => s.id === contact.instanceId && s.channel === contact.channel
        )
      );
      setContacts(filteredContacts);
      const totals: Record<string, number> = {};
      const offs: Record<string, number> = {};
      for (const col of columns) {
        const list = filteredContacts.filter((c) => c.columnId === col.id);
        totals[col.id] = list.length;
        offs[col.id] = list.length;
      }
      setColumnTotals(totals);
      setColumnOffsets(offs);
    } catch (error: any) {
      console.error('Erro ao recarregar contatos:', error);
    } finally {
      setIsLoading(false);
    }
  }, [selectedInstances, searchQuery, columns]);

  const loadMoreForColumn = useCallback(
    async (columnId: string) => {
      if (selectedInstances.length === 0 || loadMoreLockRef.current) {
        return;
      }
      const offset = columnOffsets[columnId] ?? 0;
      const total = columnTotals[columnId];
      if (total !== undefined && offset >= total) {
        return;
      }

      loadMoreLockRef.current = true;
      setLoadingMoreColumnId(columnId);
      try {
        const scope = selectedInstances;
        let r: GetContactsResponse;
        if (searchQuery.trim()) {
          r = await crmAPI.searchContacts(searchQuery.trim(), {
            columnId,
            limit: CRM_KANBAN_PAGE_SIZE,
            offset,
            crmScope: scope,
          });
        } else {
          r = await crmAPI.getContacts({
            columnId,
            limit: CRM_KANBAN_PAGE_SIZE,
            offset,
            crmScope: scope,
          });
        }
        const newContacts = r.contacts;
        if (newContacts.length === 0) {
          setColumnTotals((t) => ({
            ...t,
            [columnId]: offset,
          }));
          return;
        }
        setContacts((prev) => {
          const ids = new Set(prev.map((c) => c.id));
          const next = [...prev];
          for (const c of newContacts) {
            if (!ids.has(c.id)) {
              ids.add(c.id);
              next.push(c);
            }
          }
          return next;
        });
        if (typeof r.totalInColumn === 'number') {
          const tInCol = r.totalInColumn;
          setColumnTotals((t) => ({ ...t, [columnId]: tInCol }));
        }
        setColumnOffsets((o) => ({
          ...o,
          [columnId]: offset + newContacts.length,
        }));
      } catch (error: any) {
        console.error('Erro ao carregar mais contatos:', error);
      } finally {
        loadMoreLockRef.current = false;
        setLoadingMoreColumnId(null);
      }
    },
    [selectedInstances, searchQuery, columnOffsets, columnTotals]
  );

  // Handler para novas mensagens - atualiza o card do contato específico
  // Funciona igual ao chat: verifica apenas se o contato existe na lista atual
  const handleNewMessage = useCallback((data: NewMessageData) => {
    // Verificar se temos contactId e mensagens
    if (!data.contactId || !data.messages || data.messages.length === 0) {
      return;
    }

    const contactIdNorm = String(data.contactId);

    if (selectedInstances.length === 0) {
      return;
    }

    const dataInstanceId = String(data.instanceId || '').trim();
    const dataChannel = data.channel;
    const matchesInstance = selectedInstances.some((s) => {
      if (String(s.id) !== dataInstanceId) return false;
      if (dataChannel === 'whatsapp' || dataChannel === 'instagram') {
        return s.channel === dataChannel;
      }
      return true;
    });
    if (!matchesInstance) {
      return;
    }

    setContacts((prevContacts) => {
        const contactExists = prevContacts.some((c) => String(c.id) === contactIdNorm);

        if (!contactExists) {
          void crmAPI
            .getContacts()
            .then((response) => {
              const filtered = response.contacts.filter((contact) =>
                selectedInstances.some(
                  (s) => s.id === contact.instanceId && s.channel === contact.channel
                )
              );
              setContacts((prev) => {
                const ids = new Set(prev.map((c) => c.id));
                const additions = filtered.filter((c) => !ids.has(c.id));
                if (additions.length === 0) return prev;
                setColumnTotals((t) => {
                  const n = { ...t };
                  for (const c of additions) {
                    if (c.columnId) {
                      n[c.columnId] = (n[c.columnId] ?? 0) + 1;
                    }
                  }
                  return n;
                });
                return [...prev, ...additions];
              });
            })
            .catch((e) => console.error(e));
          return prevContacts;
        }

        // Atualizar o contato específico
        const updatedContacts = prevContacts.map((contact) => {
          if (String(contact.id) === contactIdNorm) {
            // Pegar a última mensagem (a mais recente)
            const lastMessage = data.messages && data.messages.length > 0 
              ? data.messages[data.messages.length - 1] 
              : null;
            
          // Formatar conteúdo da última mensagem usando função utilitária
          const lastMessageContent = lastMessage 
            ? formatLastMessageContent(lastMessage) || contact.lastMessage
            : contact.lastMessage;
          
            // Calcular nova contagem de não lidas
          let newUnreadCount = contact.unreadCount || 0;
          if (lastMessage && !lastMessage.fromMe && !lastMessage.read) {
            newUnreadCount = (contact.unreadCount || 0) + 1;
            }
            
            return {
              ...contact,
            lastMessage: lastMessageContent,
              lastMessageAt: lastMessage?.timestamp || contact.lastMessageAt || null,
              unreadCount: newUnreadCount,
            };
          }
          return contact;
        });
        return updatedContacts;
      });
  }, [selectedInstances]);

  // Ref para evitar recarregamentos desnecessários
  const lastContactUpdateRef = useRef<number>(0);
  const contactUpdateTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleContactUpdate = useCallback((payload?: ContactUpdatedPayload) => {
    if (selectedInstances.length === 0) return;

    const pid = payload?.instanceId;
    if (pid != null && String(pid).trim() !== '') {
      const pch = payload?.channel;
      const matches = selectedInstances.some(
        (s) => String(s.id) === String(pid) && (pch ? s.channel === pch : true)
      );
      if (!matches) return;
    }

    const now = Date.now();
    const timeSinceLastUpdate = now - lastContactUpdateRef.current;

    // Se passou menos de 500ms desde a última atualização, aguardar
    if (timeSinceLastUpdate < 500) {
      if (contactUpdateTimeoutRef.current) {
        clearTimeout(contactUpdateTimeoutRef.current);
      }
      contactUpdateTimeoutRef.current = setTimeout(() => {
        lastContactUpdateRef.current = Date.now();
        loadContactsFull();
      }, 500);
      return;
    }

    // Atualizar imediatamente se passou tempo suficiente
    lastContactUpdateRef.current = now;
    loadContactsFull();
  }, [loadContactsFull, selectedInstances]);

  // Conectar ao WebSocket - escutar tanto new-message quanto contact-updated
  useSocket(token, undefined, handleNewMessage, handleContactUpdate);

  // Cleanup do timeout quando componente desmontar
  useEffect(() => {
    return () => {
      if (contactUpdateTimeoutRef.current) {
        clearTimeout(contactUpdateTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    loadInstances();
  }, [loadInstances]);

  /** Colunas do quadro antes de `crmSelectionReady` (evita Kanban vazio só de cabeçalhos). */
  useEffect(() => {
    if (crmSelectionReady) return;
    void (async () => {
      try {
        const response = await crmAPI.getColumns();
        setColumns(response.columns.sort((a, b) => a.order - b.order));
      } catch (error: any) {
        console.error('Erro ao carregar colunas:', error);
      }
    })();
  }, [crmSelectionReady]);

  useEffect(() => {
    if (!crmSelectionReady) return;
    try {
      localStorage.setItem(CRM_STORAGE_INSTANCES, JSON.stringify({ instances: selectedInstances }));
      localStorage.removeItem(CRM_STORAGE_LEGACY);
    } catch {
      /* ignore */
    }
  }, [crmSelectionReady, selectedInstances]);

  useEffect(() => {
    if (!token) return;
    crmAPI
      .getPreferences()
      .then((r) => setAllowDeleteCard(!!r.preferences?.allowDeleteConversationCard))
      .catch(() => setAllowDeleteCard(false));
  }, [token]);

  /**
   * Com instâncias selecionadas: POST /kanban/bootstrap (debounce na busca).
   * Sem instâncias: só colunas vazias no quadro.
   */
  useEffect(() => {
    if (!crmSelectionReady) return;

    if (selectedInstances.length === 0) {
      skipContactsDebounceOnceRef.current = true;
      setContacts([]);
      setColumnTotals({});
      setColumnOffsets({});
      setIsLoading(false);
      void loadColumnsOnly();
      return;
    }

    const hasSearch = searchQuery.trim().length > 0;
    const delay = hasSearch
      ? 450
      : skipContactsDebounceOnceRef.current
        ? 0
        : 160;
    const timer = window.setTimeout(() => {
      skipContactsDebounceOnceRef.current = false;
      void loadKanbanBootstrap();
    }, delay);
    return () => clearTimeout(timer);
  }, [crmSelectionReady, selectedInstances, searchQuery, loadKanbanBootstrap, loadColumnsOnly]);

  const [columnPickerMenu, setColumnPickerMenu] = useState<{
    contact: Contact;
    x: number;
    y: number;
  } | null>(null);

  const performMoveContactToColumn = useCallback(
    async (contactId: string, targetColumnId: string) => {
      const currentContact = contacts.find((c) => String(c.id) === contactId);
      if (!currentContact || String(currentContact.columnId) === String(targetColumnId)) {
        return;
      }
      const finalColumn = columns.find((col) => col.id === targetColumnId);
      if (!finalColumn) return;

      const previousContacts = contacts;
      setContacts((prev) =>
        prev.map((contact) =>
          contact.id === contactId
            ? { ...contact, columnId: targetColumnId, columnName: finalColumn.name }
            : contact
        )
      );

      const fromCol = currentContact.columnId ? String(currentContact.columnId) : null;
      const toCol = String(targetColumnId);
      if (fromCol && fromCol !== toCol) {
        setColumnTotals((t) => ({
          ...t,
          [fromCol]: Math.max(0, (t[fromCol] ?? 1) - 1),
          [toCol]: (t[toCol] ?? 0) + 1,
        }));
        setColumnOffsets((o) => ({
          ...o,
          [fromCol]: Math.max(0, (o[fromCol] ?? 1) - 1),
          [toCol]: (o[toCol] ?? 0) + 1,
        }));
      }

      try {
        await crmAPI.moveContact(contactId, { columnId: targetColumnId });
      } catch (error: any) {
        console.error('Erro ao mover contato:', error);
        setContacts(previousContacts);
        void loadKanbanBootstrap();
        alert(error.message || 'Erro ao mover contato. Tente novamente.');
      }
    },
    [contacts, columns, loadKanbanBootstrap]
  );

  const handleRequestMoveToColumn = useCallback(
    (contact: Contact, clientX: number, clientY: number) => {
      setColumnPickerMenu({ contact, x: clientX, y: clientY });
    },
    []
  );

  useEffect(() => {
    if (!columnPickerMenu) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setColumnPickerMenu(null);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [columnPickerMenu]);

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
    lastOverColumnIdRef.current = null;
    setDraggedOverColumnId(null);
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { over } = event;
    if (!over) {
      return;
    }
    const overId = String(over.id);
    const targetColumn = columns.find((col) => String(col.id) === overId);
    if (targetColumn) {
      lastOverColumnIdRef.current = targetColumn.id;
      setDraggedOverColumnId(targetColumn.id);
      return;
    }
    const targetContact = contacts.find((c) => String(c.id) === overId);
    if (targetContact?.columnId) {
      lastOverColumnIdRef.current = targetContact.columnId;
      setDraggedOverColumnId(targetContact.columnId);
    }
  };

  const handleDragCancel = (_event: DragCancelEvent) => {
    setActiveId(null);
    setDraggedOverColumnId(null);
    lastOverColumnIdRef.current = null;
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    const fallbackColumnId = lastOverColumnIdRef.current;

    setActiveId(null);
    setDraggedOverColumnId(null);
    lastOverColumnIdRef.current = null;

    const contactId = String(active.id);
    let targetColumnId: string | null = null;

    if (over) {
      const overId = String(over.id);
      const targetColumn = columns.find((col) => String(col.id) === overId);
      if (targetColumn) {
        targetColumnId = targetColumn.id;
      } else {
        const targetContact = contacts.find((c) => String(c.id) === overId);
        if (targetContact?.columnId) {
          targetColumnId = targetContact.columnId;
        }
      }
    }

    if (!targetColumnId && fallbackColumnId) {
      targetColumnId = fallbackColumnId;
    }

    if (!targetColumnId) {
      return;
    }

    void performMoveContactToColumn(contactId, targetColumnId);
  };

  const getContactsByColumn = (columnId: string) => {
    return contacts.filter((contact) => contact.columnId === columnId);
  };

  const handleContactClick = (contact: Contact) => {
    // Se o chat já está aberto, não fazer nada (ou focar nele)
    if (openChats.has(contact.id)) {
      return;
    }
    
    // Adicionar novo chat ao Map
    setOpenChats((prev) => {
      const newMap = new Map(prev);
      newMap.set(contact.id, contact);
      return newMap;
    });
  };

  const handleCloseChat = (contactId: string) => {
    setOpenChats((prev) => {
      const newMap = new Map(prev);
      newMap.delete(contactId);
      return newMap;
    });
    loadContactsFull(); // Recarregar para atualizar contador de não lidas
  };

  const handleDeleteContact = async (contact: Contact) => {
    if (!window.confirm(t('crm.deleteCardConfirm'))) return;
    try {
      await crmAPI.deleteContact(contact.id);
      setContacts((prev) => prev.filter((c) => c.id !== contact.id));
      if (contact.columnId) {
        const cid = contact.columnId;
        setColumnTotals((t) => ({
          ...t,
          [cid]: Math.max(0, (t[cid] ?? 1) - 1),
        }));
        setColumnOffsets((o) => ({
          ...o,
          [cid]: Math.max(0, (o[cid] ?? 1) - 1),
        }));
      }
      setOpenChats((prev) => {
        const next = new Map(prev);
        next.delete(contact.id);
        return next;
      });
    } catch (error: any) {
      alert(error.message || t('crm.deleteCardError'));
    }
  };

  const toggleInstanceSelection = useCallback((inst: CRMInstanceOption) => {
    startTransition(() => {
      setSelectedInstances((prev) => {
        const key = `${inst.channel}:${inst.id}`;
        const exists = prev.some((p) => `${p.channel}:${p.id}` === key);
        if (exists) {
          return prev.filter((p) => `${p.channel}:${p.id}` !== key);
        }
        return [...prev, { id: inst.id, channel: inst.channel }];
      });
    });
  }, []);

  const selectAllInstances = useCallback(() => {
    startTransition(() => {
      setSelectedInstances(instances.map((i) => ({ id: i.id, channel: i.channel })));
    });
  }, [instances]);

  const clearInstanceSelection = useCallback(() => {
    startTransition(() => {
      setSelectedInstances([]);
    });
  }, []);

  const draggedContact = activeId ? contacts.find((c) => c.id === activeId) : null;

  return (
    <AppLayout>
      <div className="animate-fadeIn">
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-clerky-backendText dark:text-gray-200 mb-2">
              {t('crm.title')}
            </h1>
            <p className="text-gray-600 dark:text-gray-400 inline-flex items-center gap-2">
              {t('crm.subtitle')}
              <HelpIcon helpKey="crm" className="ml-1" />
            </p>
          </div>
          <Link to="/crm/contatos" className="shrink-0">
            <Button variant="secondary" size="md" className="w-full sm:w-auto">
              {t('crm.contactsButton')}
            </Button>
          </Link>
        </div>
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex min-w-0 flex-wrap items-center gap-3">
            {isLoadingInstances ? (
              <div className="rounded-2xl border border-slate-200/90 bg-slate-50 px-4 py-3 dark:border-slate-600 dark:bg-slate-800/80">
                <span className="text-sm text-slate-500 dark:text-slate-400">{t('crm.instancesLoading')}</span>
              </div>
            ) : instances.length > 0 ? (
              <CrmInstancePicker
                instances={instances}
                selected={selectedInstances}
                isLoading={isLoadingInstances}
                onToggle={toggleInstanceSelection}
                onSelectAll={selectAllInstances}
                onClear={clearInstanceSelection}
                t={t}
              />
            ) : (
              <div className="rounded-2xl border border-slate-200/90 bg-slate-50 px-4 py-3 dark:border-slate-600 dark:bg-slate-800/80">
                <span className="text-sm text-slate-500 dark:text-slate-400">{t('crm.instancesNone')}</span>
              </div>
            )}
          </div>
          <div className="flex min-w-0 flex-1 gap-4 items-center sm:justify-end">
            <input
              type="text"
              placeholder={t('crm.searchContacts')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              disabled={selectedInstances.length === 0}
              className="min-w-0 w-full max-w-md px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-clerky-backendButton focus:border-transparent bg-white dark:bg-gray-700 text-clerky-backendText dark:text-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
            />
          </div>
        </div>

        {selectedInstances.length === 0 ? (
          <Card padding="lg" shadow="lg">
            <div className="text-center py-12 px-4">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-slate-100 to-slate-50 ring-1 ring-slate-200/80 dark:from-slate-800 dark:to-slate-900 dark:ring-slate-600/60">
                <svg className="h-8 w-8 text-slate-400 dark:text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 3v1.5M4.5 8.25H3m18 0h-1.5M4.5 12H3m18 0h-1.5m-15 3.75H3m18 0h-1.5M8.25 19.5V21M12 3v1.5m0 15V21m3.75-18v1.5m0 15V19.5m-9-1.035a3.001 3.001 0 003.75.615m4.5-8.25a3.001 3.001 0 00-3.75-.615m0 0a3 3 0 01-6 0m6 0a3 3 0 00-6 0m6 0h.008v.008H12V12z" />
                </svg>
              </div>
              <p className="text-xl font-semibold text-clerky-backendText dark:text-gray-200 mb-2">
                {instances.length === 0 ? t('crm.instancesNone') : t('crm.noInstancesSelectedTitle')}
              </p>
              <p className="text-gray-600 dark:text-gray-400 max-w-md mx-auto">
                {instances.length === 0 ? t('crm.instancesNoneHint') : t('crm.noInstancesSelectedHint')}
              </p>
            </div>
          </Card>
        ) : isLoading && contacts.length === 0 ? (
          <Card padding="lg" shadow="lg">
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-clerky-backendButton mx-auto mb-4"></div>
              <p className="text-gray-600 dark:text-gray-300">Carregando contatos...</p>
            </div>
          </Card>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={crmCollisionDetection}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDragCancel={handleDragCancel}
            onDragEnd={handleDragEnd}
          >
            <div
              ref={kanbanHScrollRef}
              onPointerMove={handleKanbanHorizontalPointerMove}
              onPointerLeave={stopKanbanEdgeScroll}
              onPointerCancel={stopKanbanEdgeScroll}
              className="w-full min-w-0 max-w-full overflow-x-auto pb-4 scrollbar-hide"
            >
              <div
                className="flex h-[min(720px,calc(100vh-250px))] min-h-[280px] w-full min-w-0 items-stretch gap-3 md:grid md:gap-4 md:min-h-0"
                style={{
                  ...(columns.length > 0
                    ? {
                        gridTemplateColumns: `repeat(${columns.length}, minmax(0, 1fr))`,
                        /* Até 5 colunas preenchem a largura; da 6ª em diante o bloco fica mais largo e o scroll horizontal aparece */
                        width: `max(100%, calc(${columns.length} / 5 * 100%))`,
                      }
                    : {}),
                }}
              >
              {columns.map((column) => (
                <Column
                  key={column.id}
                  column={column}
                  contacts={getContactsByColumn(column.id)}
                  totalInColumn={columnTotals[column.id]}
                  loadingMore={loadingMoreColumnId === column.id}
                  onLoadMore={() => loadMoreForColumn(column.id)}
                  onContactClick={handleContactClick}
                  allowDeleteCard={allowDeleteCard}
                  onDeleteContact={handleDeleteContact}
                  onRequestMoveToColumn={handleRequestMoveToColumn}
                />
              ))}
              </div>
            </div>
            <DragOverlay>
              {draggedContact ? (
                <div className="box-border w-[225px] max-w-[225px] rounded-lg border border-slate-200/70 bg-[radial-gradient(ellipse_125%_110%_at_50%_-15%,#F0F8FF_0%,#FAFCFF_42%,#ffffff_100%)] p-[13.7px] opacity-95 shadow-[0_9px_34px_-9px_rgba(30,64,120,0.16)] backdrop-blur-sm dark:border-slate-600/35 dark:bg-[radial-gradient(ellipse_125%_110%_at_50%_-15%,#152a4a_0%,#0f1f35_48%,#091525_100%)] dark:shadow-[0_11px_38px_-11px_rgba(0,0,0,0.5)]">
                  <div className="flex items-center gap-2">
                    <img
                      src={draggedContact.profilePicture || CRM_DEFAULT_CONTACT_AVATAR_URL}
                      alt=""
                      className="h-[2.39rem] w-[2.39rem] rounded-full object-cover bg-slate-100 ring-1 ring-slate-200/60 dark:bg-slate-700 dark:ring-slate-500/25"
                      onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        if (target.src.endsWith('/avatar.png')) return;
                        target.onerror = null;
                        target.src = CRM_DEFAULT_CONTACT_AVATAR_URL;
                      }}
                    />
                    <div className="min-w-0 flex-1">
                      <h4
                        className="mb-0.5 truncate text-[11.6px] font-medium leading-snug text-slate-800 dark:text-slate-100 whitespace-nowrap"
                        title={draggedContact.name}
                      >
                        {draggedContact.name}
                      </h4>
                      <p
                        className="truncate text-[9.6px] font-semibold tabular-nums text-slate-800 dark:text-slate-200 whitespace-nowrap"
                        title={draggedContact.phone}
                      >
                        {draggedContact.phone}
                      </p>
                    </div>
                  </div>
                </div>
              ) : null}
            </DragOverlay>
          </DndContext>
        )}

        {/* Renderizar múltiplos modais de chat */}
        {Array.from(openChats.entries()).map(([contactId, contact], index) => {
          // Calcular posição inicial para cada modal (cascata)
          const offsetX = index * 30;
          const offsetY = index * 30;
          const initialX = 100 + offsetX;
          const initialY = 100 + offsetY;
          // Z-index aumenta com o índice para que modais mais recentes fiquem por cima
          // Modais mais recentes têm z-index maior
          const zIndex = 50 + (openChats.size - index);
          
          return (
            <ChatModal
              key={contactId}
              isOpen={true}
              onClose={() => handleCloseChat(contactId)}
              contact={contact}
              onContactUpdate={loadContactsFull}
              draggable={true}
              initialPosition={{ x: initialX, y: initialY }}
              modalId={`chat_${contactId}`}
              zIndex={zIndex}
            />
          );
        })}

        {columnPickerMenu &&
          createPortal(
            <>
              <div
                className="fixed inset-0 z-[10040] bg-transparent"
                aria-hidden
                onMouseDown={() => setColumnPickerMenu(null)}
              />
              <div
                role="menu"
                aria-label={t('crm.moveToColumnTitle')}
                className="fixed z-[10050] w-[min(260px,calc(100vw-1rem))] max-h-[min(320px,70vh)] overflow-y-auto rounded-xl border border-slate-200 bg-white py-1 shadow-xl scrollbar-hide dark:border-slate-600 dark:bg-slate-900"
                style={{
                  left: Math.min(
                    Math.max(8, columnPickerMenu.x),
                    window.innerWidth - Math.min(260, window.innerWidth - 16) - 8
                  ),
                  top: Math.min(
                    Math.max(8, columnPickerMenu.y),
                    window.innerHeight - Math.min(320, window.innerHeight * 0.7) - 8
                  ),
                }}
                onMouseDown={(e) => e.stopPropagation()}
              >
                <div className="border-b border-slate-200 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:border-slate-600 dark:text-slate-400">
                  {t('crm.moveToColumnTitle')}
                </div>
                <div className="py-1">
                  {[...columns]
                    .sort((a, b) => a.order - b.order)
                    .map((col) => {
                      const isCurrent =
                        columnPickerMenu.contact.columnId != null &&
                        String(columnPickerMenu.contact.columnId) === String(col.id);
                      return (
                        <button
                          key={col.id}
                          type="button"
                          role="menuitem"
                          disabled={isCurrent}
                          className="flex w-full items-center px-3 py-2 text-left text-sm text-slate-800 hover:bg-slate-100 disabled:cursor-default disabled:opacity-45 disabled:hover:bg-transparent dark:text-slate-100 dark:hover:bg-slate-800 dark:disabled:hover:bg-transparent"
                          onClick={() => {
                            if (isCurrent) return;
                            void performMoveContactToColumn(columnPickerMenu.contact.id, col.id);
                            setColumnPickerMenu(null);
                          }}
                        >
                          <span className="min-w-0 flex-1 truncate">{col.name}</span>
                          {isCurrent ? (
                            <span className="ml-2 shrink-0 text-[10px] text-slate-400 dark:text-slate-300">
                              {t('crm.moveToColumnCurrent')}
                            </span>
                          ) : null}
                        </button>
                      );
                    })}
                </div>
              </div>
            </>,
            document.body
          )}
      </div>
    </AppLayout>
  );
};

export default CRM;
