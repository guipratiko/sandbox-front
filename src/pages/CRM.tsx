import React, { useState, useEffect, useLayoutEffect, useCallback, useRef } from 'react';
import { AppLayout } from '../components/Layout';
import { Card, Button, Modal, HelpIcon } from '../components/UI';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { crmAPI, Contact, CRMColumn, Message, instanceAPI, Instance, Label } from '../services/api';
import { useSocket, NewMessageData } from '../hooks/useSocket';
import { sortMessagesByTimestamp, formatLastMessageContent } from '../utils/messageUtils';
import { getInitials } from '../utils/formatters';
import { formatTime } from '../utils/dateFormatters';

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
  useDroppable,
  DragOverEvent,
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
}

const ContactCard: React.FC<ContactCardProps> = ({ contact, onClick }) => {
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


  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={onClick}
      className="bg-white dark:bg-[#091D41] rounded-lg p-4 mb-3 cursor-grab active:cursor-grabbing hover:shadow-md transition-shadow duration-150 border border-gray-200 dark:border-gray-700 relative overflow-hidden"
    >
      {/* Labels no canto superior esquerdo */}
      {contact.labels && contact.labels.length > 0 && (
        <div className="absolute top-2 left-2 flex flex-wrap gap-1 z-10 max-w-[calc(100%-3rem)]">
          {contact.labels.map((label) => (
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
      <div className="flex items-start justify-between gap-2 min-w-0">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          {/* Foto de perfil - movida para baixo quando há labels */}
          <div className={`flex-shrink-0 ${contact.labels && contact.labels.length > 0 ? 'mt-6' : ''}`}>
            {contact.profilePicture ? (
              <img
                src={contact.profilePicture}
                alt={contact.name}
                className="w-12 h-12 rounded-full object-cover border-2 border-gray-200 dark:border-gray-700"
                onError={(e) => {
                  // Se a imagem falhar ao carregar, mostrar iniciais
                  const target = e.target as HTMLImageElement;
                  target.style.display = 'none';
                  const parent = target.parentElement;
                  if (parent) {
                    parent.innerHTML = `<div class="w-12 h-12 rounded-full bg-blue-500 flex items-center justify-center text-white font-semibold text-sm">${getInitials(contact.name)}</div>`;
                  }
                }}
              />
            ) : (
              <div className="w-12 h-12 rounded-full bg-blue-500 flex items-center justify-center text-white font-semibold text-sm">
                {getInitials(contact.name)}
              </div>
            )}
          </div>
          <div className={`flex-1 min-w-0 overflow-hidden ${contact.labels && contact.labels.length > 0 ? 'mt-6 ml-2' : ''}`}>
            <h4 className="font-semibold text-clerky-backendText dark:text-gray-200 mb-1 truncate max-w-full">
              {contact.name}
            </h4>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-2 truncate max-w-full">
              {contact.phone}
            </p>
            {contact.lastMessage && (
              <p className="text-xs text-gray-500 dark:text-gray-500 truncate max-w-full overflow-hidden text-ellipsis whitespace-nowrap">
                {contact.lastMessage}
              </p>
            )}
          </div>
        </div>
        {contact.unreadCount > 0 && (
          <span className="ml-2 bg-blue-500 text-white text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center flex-shrink-0">
            {contact.unreadCount}
          </span>
        )}
      </div>
    </div>
  );
};

// Componente de Coluna do Kanban
interface ColumnProps {
  column: CRMColumn;
  contacts: Contact[];
  onContactClick: (contact: Contact) => void;
}

const Column: React.FC<ColumnProps> = ({ column, contacts, onContactClick }) => {
  const { t } = useLanguage();
  const { setNodeRef, isOver } = useDroppable({
    id: column.id,
  });

  const contactIds = contacts.map((c) => c.id);

  return (
    <div
      ref={setNodeRef}
      className={`flex flex-col h-full bg-gray-100 dark:bg-gray-900 rounded-lg p-4 min-w-[239px] transition-all duration-200 border-2 ${
        isOver 
          ? 'border-blue-400 dark:border-blue-600 bg-blue-50 dark:bg-blue-950 shadow-lg scale-[1.01]' 
          : 'border-transparent'
      }`}
    >
      <div className="mb-4 pb-4 border-b border-gray-300 dark:border-gray-700">
        <h3 className="font-semibold text-lg text-clerky-backendText dark:text-gray-200 mb-1">
          {column.name}
        </h3>
        <span className="text-sm text-gray-500 dark:text-gray-400">
          {contacts.length} {contacts.length === 1 ? t('crm.contact') : t('crm.contacts')}
        </span>
      </div>
      <div className="flex-1 overflow-y-auto min-h-[200px]">
        {contactIds.length > 0 ? (
          <SortableContext items={contactIds} strategy={verticalListSortingStrategy}>
            {contacts.map((contact) => (
              <ContactCard
                key={contact.id}
                contact={contact}
                onClick={() => onContactClick(contact)}
              />
            ))}
          </SortableContext>
        ) : (
          <div className="flex items-center justify-center h-full text-gray-400 dark:text-gray-500 text-sm border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-lg">
            {t('crm.dragContactsHere')}
          </div>
        )}
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
  const { token } = useAuth();
  const { language } = useLanguage();
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [showCaptionInput, setShowCaptionInput] = useState(false);
  const [caption, setCaption] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const [newMessageIds, setNewMessageIds] = useState<Set<string>>(new Set());
  const isInitialLoadRef = useRef<boolean>(true);
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

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const loadMessages = useCallback(async () => {
    if (!contact) return;

    try {
      setIsLoading(true);
      isInitialLoadRef.current = true;
      const response = await crmAPI.getMessages(contact.id);
      setMessages(sortMessagesByTimestamp(response.messages));
    } catch (error: any) {
      console.error('Erro ao carregar mensagens:', error);
    } finally {
      setIsLoading(false);
    }
  }, [contact]);

  // Callback para novas mensagens via WebSocket
  const handleNewMessage = useCallback((data: NewMessageData) => {
    if (!contact || !isOpen) return;

    // Verificar se a mensagem é para o contato atual
    if (data.contactId !== contact.id) {
      // É para outro contato, apenas atualizar lista de contatos
      return;
    }

    // Adicionar mensagens diretamente ao estado (sem recarregar tudo)
    setMessages((prev) => {
      const existingIds = new Set(prev.map((m) => m.id));
      const newMessages = data.messages.filter((m) => !existingIds.has(m.id));

      if (newMessages.length === 0) {
        return prev; // Nenhuma mensagem nova
      }

      // Adicionar novas mensagens
      const allMessages = [...prev, ...newMessages.map((m) => ({
        id: m.id,
        messageId: m.messageId,
        fromMe: m.fromMe,
        messageType: m.messageType,
        content: m.content,
        mediaUrl: m.mediaUrl,
        timestamp: m.timestamp,
        read: m.read,
      }))];

      // Ordenar por timestamp
      const sorted = sortMessagesByTimestamp(allMessages);

      // Marcar mensagens como novas para animação
      const newIds = new Set(newMessages.map((m) => m.id));
      setNewMessageIds((prevIds) => {
        const combined = new Set(Array.from(prevIds));
        newIds.forEach((id) => combined.add(id));
        // Remover IDs após 1 segundo (tempo da animação)
        setTimeout(() => {
          setNewMessageIds((current) => {
            const updated = new Set(Array.from(current));
            newIds.forEach((id) => updated.delete(id));
            return updated;
          });
        }, 1000);
        return combined;
      });

      return sorted;
    });

    // Scroll suave para a última mensagem após um pequeno delay
    setTimeout(() => {
      scrollToBottom();
    }, 100);
  }, [contact, isOpen]);

  // Callback para atualizar lista de contatos (quando contato é atualizado)
  const handleContactUpdate = useCallback(() => {
    // Apenas atualizar lista de contatos, não recarregar mensagens
    // Isso será tratado pelo componente pai se necessário
  }, []);

  // Conectar ao WebSocket para receber novas mensagens em tempo real
  useSocket(token, undefined, handleNewMessage, handleContactUpdate);

  useEffect(() => {
    if (contact && isOpen) {
      isInitialLoadRef.current = true;
      loadMessages();
    } else {
      setMessages([]);
      isInitialLoadRef.current = true;
    }
  }, [contact, isOpen, loadMessages]);

  // Scroll para o final quando mensagens são carregadas (apenas se não for carregamento inicial)
  useEffect(() => {
    if (isInitialLoadRef.current || isLoading) return;
    scrollToBottom();
  }, [messages, isLoading]);

  // Definir scroll no final ANTES da renderização (para carregamento inicial)
  useLayoutEffect(() => {
    if (isInitialLoadRef.current && !isLoading && messages.length > 0 && messagesContainerRef.current) {
      // Definir scroll no final sem animação (antes da renderização ser visível)
      const container = messagesContainerRef.current;
      container.scrollTop = container.scrollHeight;
      isInitialLoadRef.current = false;
    }
  }, [messages, isLoading]);


  const handleSendMessage = async () => {
    if (!contact || !newMessage.trim()) return;

    const messageText = newMessage.trim();
    setNewMessage('');

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

    // Inserir na posição correta mantendo ordenação
    setMessages((prev) => sortMessagesByTimestamp([...prev, optimisticMessage]));

    try {
      setIsSending(true);
      const response = await crmAPI.sendMessage(contact.id, { text: messageText });
      
      // Substituir mensagem otimista pela real
      setMessages((prev) => {
        const filtered = prev.filter((msg) => msg.id !== optimisticMessage.id);
        return sortMessagesByTimestamp([...filtered, response.data]);
      });
    } catch (error: any) {
      console.error('Erro ao enviar mensagem:', error);
      // Remover mensagem otimista em caso de erro
      setMessages((prev) => prev.filter((msg) => msg.id !== optimisticMessage.id));
      setNewMessage(messageText); // Restaurar texto
      alert(error.message || 'Erro ao enviar mensagem');
    } finally {
      setIsSending(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
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

      setMessages((prev) => sortMessagesByTimestamp([...prev, optimisticMessage]));

      // Enviar mídia
      const response = isAudio
        ? await crmAPI.sendAudio(contact.id, fileToSend)
        : await crmAPI.sendMedia(contact.id, fileToSend, caption || undefined);

      // Substituir mensagem otimista pela real
      setMessages((prev) => {
        const filtered = prev.filter((msg) => msg.id !== optimisticMessage.id);
        return sortMessagesByTimestamp([...filtered, response.data]);
      });

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
            const response = await crmAPI.sendAudio(contact.id, audioFile);
            
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

            setTimeout(() => {
              scrollToBottom();
            }, 100);
          } catch (error: any) {
            console.error('Erro ao enviar áudio:', error);
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

  return (
    <>
      <Modal 
        isOpen={isOpen} 
        onClose={onClose} 
        title={
          <div className="flex flex-col gap-2">
            {/* Etiquetas acima do nome */}
            {contact.labels && contact.labels.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {contact.labels.map((label) => (
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
      >
        <div className="flex flex-col h-[582px]">
          {/* Área de mensagens */}
          <div 
            ref={messagesContainerRef}
            className="flex-1 overflow-y-auto p-4 bg-gray-50 dark:bg-[#091D41] rounded-lg mb-4 min-h-0"
          >
          {isLoading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-clerky-backendButton mx-auto mb-2"></div>
              <p className="text-gray-600 dark:text-gray-300">Carregando mensagens...</p>
            </div>
          ) : messages.length === 0 ? (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
              Nenhuma mensagem ainda. Inicie a conversa!
            </div>
          ) : (
            <div className="space-y-4">
              {messages.map((msg) => {
                const isMedia = msg.mediaUrl && msg.content === '[Mídia]';
                const isImage = isMedia && (msg.messageType === 'imageMessage' || msg.messageType === 'stickerMessage');
                const isAudio = isMedia && msg.messageType === 'audioMessage';
                const isVideo = isMedia && msg.messageType === 'videoMessage';
                const isDocument = isMedia && msg.messageType === 'documentMessage';

                const isNewMessage = newMessageIds.has(msg.id);

                return (
                  <div
                    key={msg.id}
                    className={`flex ${msg.fromMe ? 'justify-end' : 'justify-start'} ${
                      isNewMessage ? 'animate-message-appear' : ''
                    }`}
                  >
                    <div
                      className={`${isImage || isVideo ? 'w-fit' : 'max-w-[70%]'} rounded-lg ${isImage || isVideo ? 'p-1' : 'px-4 py-2'} ${
                        msg.fromMe
                          ? 'bg-blue-500 text-white'
                          : 'bg-white dark:bg-gray-700 text-clerky-backendText dark:text-gray-200'
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
                              <video
                                src={msg.mediaUrl!}
                                controls
                                className="max-w-[250px] h-auto rounded-lg block"
                              >
                                Seu navegador não suporta vídeo.
                              </video>
                            )}
                          {isAudio && (
                            <div className="flex items-center gap-2">
                              <audio
                                src={msg.mediaUrl!}
                                controls
                                className="flex-1"
                              >
                                Seu navegador não suporta áudio.
                              </audio>
                            </div>
                          )}
                          {isDocument && (
                            <div className="flex items-center gap-2">
                              <svg
                                className="w-6 h-6"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
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
                        </div>
                      ) : (
                        <p className="text-sm whitespace-pre-wrap break-words">{msg.content}</p>
                      )}
                      <p className={`text-xs mt-1 ${msg.fromMe ? 'text-blue-100' : 'text-gray-500'}`}>
                        {formatTime(msg.timestamp, language as 'pt' | 'en')}
                      </p>
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Input de mensagem */}
        <div className="space-y-2">
          {showCaptionInput && selectedFile && (
            <div className="flex items-center gap-2 p-2 bg-gray-100 dark:bg-gray-700 rounded-lg">
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
            <div className="flex gap-2 items-center">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,video/*,audio/*"
                onChange={handleFileSelect}
                className="hidden"
              />
              <button
                onClick={handleAttachClick}
                disabled={isSending || isRecording}
                className="p-2 rounded-lg border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
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
                type="text"
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder={isRecording ? `Gravando... ${Math.floor(recordingTime / 60)}:${String(recordingTime % 60).padStart(2, '0')}` : "Digite sua mensagem..."}
                className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-clerky-backendButton focus:border-transparent bg-white dark:bg-gray-700 text-clerky-backendText dark:text-gray-200 disabled:opacity-50"
                disabled={isSending || isRecording}
              />
              <button
                onClick={isRecording ? stopRecording : startRecording}
                disabled={isSending}
                className={`p-2 rounded-lg border transition-all ${
                  isRecording
                    ? 'bg-red-500 border-red-500 text-white hover:bg-red-600 animate-pulse'
                    : 'border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
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
    <Modal
      isOpen={showLabelsModal}
      onClose={() => setShowLabelsModal(false)}
      title="Gerenciar Etiquetas"
      size="md"
    >
      <div className="space-y-4">
        {isLoadingLabels ? (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-clerky-backendButton mx-auto mb-2"></div>
            <p className="text-gray-600 dark:text-gray-300">Carregando etiquetas...</p>
          </div>
        ) : (
          <>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Selecione as etiquetas para este contato:
            </p>
            <div className="space-y-2 max-h-[400px] overflow-y-auto">
              {availableLabels.map((label) => {
                const isSelected = contactLabels.has(label.id);
                return (
                  <button
                    key={label.id}
                    onClick={() => handleToggleLabel(label.id)}
                    className={`w-full flex items-center gap-3 p-3 rounded-lg border-2 transition-all ${
                      isSelected
                        ? 'border-clerky-backendButton bg-blue-50 dark:bg-blue-900/20'
                        : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                    }`}
                  >
                    <div
                      className="w-5 h-5 rounded border-2 flex items-center justify-center"
                      style={{
                        backgroundColor: isSelected ? label.color : 'transparent',
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
                      className="px-2 py-1 text-xs font-semibold rounded-md text-white"
                      style={{ backgroundColor: label.color }}
                    >
                      {label.name}
                    </span>
                  </button>
                );
              })}
            </div>
            <div className="flex justify-end gap-2 pt-4 border-t border-gray-200 dark:border-gray-700">
              <Button
                variant="secondary"
                onClick={() => setShowLabelsModal(false)}
              >
                Fechar
              </Button>
            </div>
          </>
        )}
      </div>
    </Modal>
    </>
  );
};

const CRM: React.FC = () => {
  const { token } = useAuth();
  const { t } = useLanguage();
  const [columns, setColumns] = useState<CRMColumn[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [instances, setInstances] = useState<Instance[]>([]);
  const [selectedInstanceId, setSelectedInstanceId] = useState<string | null>(null);
  // Map de contatos abertos: contactId -> Contact
  const [openChats, setOpenChats] = useState<Map<string, Contact>>(new Map());
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingInstances, setIsLoadingInstances] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeId, setActiveId] = useState<string | null>(null);
  const [draggedOverColumnId, setDraggedOverColumnId] = useState<string | null>(null);

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

  const loadInstances = async () => {
    try {
      setIsLoadingInstances(true);
      const response = await instanceAPI.getAll();
      setInstances(response.instances);
      
      // Selecionar a primeira instância conectada automaticamente
      const connectedInstance = response.instances.find(
        (inst) => inst.status === 'connected'
      );
      if (connectedInstance) {
        setSelectedInstanceId(connectedInstance.id);
      } else if (response.instances.length > 0) {
        // Se não houver conectada, selecionar a primeira
        setSelectedInstanceId(response.instances[0].id);
      }
    } catch (error: any) {
      console.error('Erro ao carregar instâncias:', error);
    } finally {
      setIsLoadingInstances(false);
    }
  };

  const loadColumns = async () => {
    try {
      const response = await crmAPI.getColumns();
      setColumns(response.columns.sort((a, b) => a.order - b.order));
    } catch (error: any) {
      console.error('Erro ao carregar colunas:', error);
    }
  };

  const loadContacts = useCallback(async () => {
    if (!selectedInstanceId) {
      setContacts([]);
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      let response;
      if (searchQuery.trim()) {
        response = await crmAPI.searchContacts(searchQuery);
      } else {
        response = await crmAPI.getContacts();
      }
      // Filtrar contatos pela instância selecionada
      const filteredContacts = response.contacts.filter(
        (contact) => contact.instanceId === selectedInstanceId
      );
      setContacts(filteredContacts);
    } catch (error: any) {
      console.error('Erro ao carregar contatos:', error);
    } finally {
      setIsLoading(false);
    }
  }, [selectedInstanceId, searchQuery]);

  // Handler para novas mensagens - atualiza o card do contato específico
  // Funciona igual ao chat: verifica apenas se o contato existe na lista atual
  const handleNewMessage = useCallback((data: NewMessageData) => {
    // Verificar se temos contactId e mensagens
    if (!data.contactId || !data.messages || data.messages.length === 0) {
      return;
    }

    // Se não há instância selecionada, não fazer nada
    if (!selectedInstanceId) {
      return;
    }

    // Verificar se a instância corresponde
    const dataInstanceId = String(data.instanceId || '').trim();
    const currentInstanceId = String(selectedInstanceId || '').trim();
    
    // Se a instância não corresponde, ignorar
    if (currentInstanceId && dataInstanceId && dataInstanceId !== currentInstanceId) {
      return;
    }
    
    // Atualizar o contato específico que recebeu a mensagem
      setContacts((prevContacts) => {
      // Verificar se o contato existe na lista atual
        const contactExists = prevContacts.some((c) => c.id === data.contactId);
        
      // Se o contato não existe na lista atual, recarregar lista completa
        if (!contactExists) {
        if (dataInstanceId === currentInstanceId || !dataInstanceId) {
          loadContacts();
        }
          return prevContacts;
        }

        // Atualizar o contato específico
        const updatedContacts = prevContacts.map((contact) => {
          if (contact.id === data.contactId) {
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
  }, [selectedInstanceId, loadContacts]);

  // Ref para evitar recarregamentos desnecessários
  const lastContactUpdateRef = useRef<number>(0);
  const contactUpdateTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleContactUpdate = useCallback(() => {
    // Usar debounce para evitar recarregamentos excessivos
    // O handleNewMessage já atualiza os cards em tempo real
    // Este callback só é necessário para atualizações de estrutura (labels, colunas, etc)
    if (!selectedInstanceId) return;

    const now = Date.now();
    const timeSinceLastUpdate = now - lastContactUpdateRef.current;

    // Se passou menos de 500ms desde a última atualização, aguardar
    if (timeSinceLastUpdate < 500) {
      if (contactUpdateTimeoutRef.current) {
        clearTimeout(contactUpdateTimeoutRef.current);
      }
      contactUpdateTimeoutRef.current = setTimeout(() => {
        lastContactUpdateRef.current = Date.now();
      loadContacts();
      }, 500);
      return;
    }

    // Atualizar imediatamente se passou tempo suficiente
    lastContactUpdateRef.current = now;
    loadContacts();
  }, [loadContacts, selectedInstanceId]);

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
    loadColumns();
  }, []);

  useEffect(() => {
    if (selectedInstanceId) {
      loadContacts();
    } else {
      setContacts([]);
    }
  }, [selectedInstanceId, loadContacts]);

  useEffect(() => {
    // Debounce para busca
    if (!selectedInstanceId) return;
    
    const timer = setTimeout(() => {
      loadContacts();
    }, 500);

    return () => clearTimeout(timer);
  }, [searchQuery, selectedInstanceId, loadContacts]);

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { over } = event;
    if (over) {
      // Verificar se está sobre uma coluna ou um contato dentro de uma coluna
      const targetColumn = columns.find((col) => col.id === over.id);
      if (targetColumn) {
        setDraggedOverColumnId(targetColumn.id);
      } else {
        // Se não for coluna diretamente, verificar se é um contato e pegar sua coluna
        const targetContact = contacts.find((c) => c.id === over.id);
        if (targetContact?.columnId) {
          setDraggedOverColumnId(targetContact.columnId);
        }
      }
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);
    setDraggedOverColumnId(null);

    if (!over) return;

    const contactId = active.id as string;
    let targetColumnId: string | null = null;

    // Verificar se o destino é uma coluna diretamente
    const targetColumn = columns.find((col) => col.id === over.id);
    if (targetColumn) {
      targetColumnId = targetColumn.id;
    } else {
      // Se não for coluna, pode ser um contato - pegar a coluna do contato
      const targetContact = contacts.find((c) => c.id === over.id);
      if (targetContact?.columnId) {
        targetColumnId = targetContact.columnId;
      } else if (draggedOverColumnId) {
        // Usar a coluna que estava sendo arrastada sobre
        targetColumnId = draggedOverColumnId;
      }
    }

    if (!targetColumnId) return;

    // Se arrastou para o mesmo lugar, não fazer nada
    const currentContact = contacts.find((c) => c.id === contactId);
    if (currentContact?.columnId === targetColumnId) {
      return;
    }

    const finalColumn = columns.find((col) => col.id === targetColumnId);
    if (!finalColumn) return;

    // Salvar estado anterior para possível reversão
    const previousContacts = contacts;

    // Atualização otimista - atualizar imediatamente na UI
    setContacts((prev) =>
      prev.map((contact) =>
        contact.id === contactId 
          ? { ...contact, columnId: targetColumnId, columnName: finalColumn.name } 
          : contact
      )
    );

    // Sincronizar com backend em background
    try {
      await crmAPI.moveContact(contactId, { columnId: targetColumnId });
    } catch (error: any) {
      console.error('Erro ao mover contato:', error);
      // Reverter mudança em caso de erro
      setContacts(previousContacts);
      alert(error.message || 'Erro ao mover contato. Tente novamente.');
    }
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
    loadContacts(); // Recarregar para atualizar contador de não lidas
  };

  const draggedContact = activeId ? contacts.find((c) => c.id === activeId) : null;

  return (
    <AppLayout>
      <div className="animate-fadeIn">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-clerky-backendText dark:text-gray-200 mb-2">
            {t('crm.title')}
          </h1>
          <p className="text-gray-600 dark:text-gray-400 inline-flex items-center gap-2">
            {t('crm.subtitle')}
            <HelpIcon helpKey="crm" className="ml-1" />
          </p>
        </div>
        <div className="flex items-center justify-between mb-6">
          <div className="flex gap-4 items-center">
            {isLoadingInstances ? (
              <div className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-100 dark:bg-gray-700">
                <span className="text-sm text-gray-500 dark:text-gray-400">Carregando instâncias...</span>
              </div>
            ) : instances.length > 0 ? (
              <select
                value={selectedInstanceId || ''}
                onChange={(e) => setSelectedInstanceId(e.target.value)}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-clerky-backendButton focus:border-transparent bg-white dark:bg-gray-700 text-clerky-backendText dark:text-gray-200 min-w-[200px]"
              >
                <option value="">Selecione uma instância</option>
                {instances.map((instance) => (
                  <option key={instance.id} value={instance.id}>
                    {instance.name}
                  </option>
                ))}
              </select>
            ) : (
              <div className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-100 dark:bg-gray-700">
                <span className="text-sm text-gray-500 dark:text-gray-400">Nenhuma instância disponível</span>
              </div>
            )}
          </div>
          <div className="flex gap-4 items-center">
            <input
              type="text"
              placeholder={t('crm.searchContacts')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              disabled={!selectedInstanceId}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-clerky-backendButton focus:border-transparent bg-white dark:bg-gray-700 text-clerky-backendText dark:text-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
            />
          </div>
        </div>

        {!selectedInstanceId ? (
          <Card padding="lg" shadow="lg">
            <div className="text-center py-12">
              <p className="text-xl font-semibold text-clerky-backendText dark:text-gray-200 mb-2">
                Selecione uma instância
              </p>
              <p className="text-gray-600 dark:text-gray-400">
                Escolha uma instância acima para visualizar os contatos do CRM
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
            collisionDetection={closestCorners}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDragEnd={handleDragEnd}
          >
            <div className="flex gap-4 overflow-x-auto pb-4" style={{ minHeight: 'calc(100vh - 250px)' }}>
              {columns.map((column, index) => (
                <React.Fragment key={column.id}>
                  <Column
                    column={column}
                    contacts={getContactsByColumn(column.id)}
                    onContactClick={handleContactClick}
                  />
                  {index < columns.length - 1 && (
                    <div className="w-px bg-gray-300 dark:bg-gray-700 flex-shrink-0" />
                  )}
                </React.Fragment>
              ))}
            </div>
            <DragOverlay>
              {draggedContact ? (
                <div className="bg-white dark:bg-[#091D41] rounded-lg p-4 border border-gray-200 dark:border-gray-700 shadow-lg opacity-90 w-[222px]">
                  <div className="flex items-center gap-3">
                    {draggedContact.profilePicture ? (
                      <img
                        src={draggedContact.profilePicture}
                        alt={draggedContact.name}
                        className="w-10 h-10 rounded-full object-cover"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-blue-500 flex items-center justify-center text-white font-semibold text-xs">
                        {getInitials(draggedContact.name)}
                      </div>
                    )}
                    <div>
                      <h4 className="font-semibold text-clerky-backendText dark:text-gray-200 mb-1">
                        {draggedContact.name}
                      </h4>
                      <p className="text-sm text-gray-600 dark:text-gray-400">{draggedContact.phone}</p>
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
              onContactUpdate={loadContacts}
              draggable={true}
              initialPosition={{ x: initialX, y: initialY }}
              modalId={`chat_${contactId}`}
              zIndex={zIndex}
            />
          );
        })}
      </div>
    </AppLayout>
  );
};

export default CRM;
