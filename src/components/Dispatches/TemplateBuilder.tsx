import React, { useState, useRef } from 'react';
import { Modal, Button, Input } from '../UI';
import { TemplateType, CreateTemplateData, dispatchAPI } from '../../services/api';
import { useLanguage } from '../../contexts/LanguageContext';

// Variáveis disponíveis para personalização
const AVAILABLE_VARIABLES = [
  { variable: '$firstName', label: 'Primeiro Nome', description: 'Primeiro nome do contato' },
  { variable: '$lastName', label: 'Último Nome', description: 'Último nome do contato' },
  { variable: '$fullName', label: 'Nome Completo', description: 'Nome completo do contato' },
  { variable: '$formattedPhone', label: 'Número Formatado', description: 'Número formatado (ex: (62) 99844-8536)' },
  { variable: '$originalPhone', label: 'Número Original', description: 'Número original/normalizado' },
];

// Componente para construir sequência de mensagens
interface SequenceBuilderProps {
  content: any;
  setContent: (content: any) => void;
}

const SequenceBuilder: React.FC<SequenceBuilderProps> = ({ content, setContent }) => {
  const { t } = useLanguage();
  const steps = content.steps || [];
  const [uploading, setUploading] = useState<number | null>(null);
  const [recordingStepIndex, setRecordingStepIndex] = useState<number | null>(null);
  const fileInputRefs = useRef<Map<number, HTMLInputElement>>(new Map());
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);

  const addStep = () => {
    setContent({
      ...content,
      steps: [...steps, { type: 'text', content: { text: '' }, delay: 0, delayUnit: 'seconds' }],
    });
  };

  const removeStep = (index: number) => {
    const newSteps = steps.filter((_: any, i: number) => i !== index);
    setContent({ ...content, steps: newSteps });
  };

  const updateStep = (index: number, field: string, value: any) => {
    const newSteps = [...steps];
    newSteps[index] = { ...newSteps[index], [field]: value };
    setContent({ ...content, steps: newSteps });
  };

  const updateStepContent = (index: number, field: string, value: any) => {
    const newSteps = [...steps];
    newSteps[index] = {
      ...newSteps[index],
      content: { ...newSteps[index].content, [field]: value },
    };
    setContent({ ...content, steps: newSteps });
  };

  const handleInsertVariable = (variable: string, stepIndex: number, field: string) => {
    const currentValue = steps[stepIndex]?.content?.[field] || '';
    updateStepContent(stepIndex, field, currentValue + variable);
  };

  const handleFileUpload = async (file: File, stepIndex: number, field: 'imageUrl' | 'videoUrl' | 'audioUrl' | 'fileUrl') => {
    try {
      setUploading(stepIndex);
      const result = await dispatchAPI.uploadTemplateFile(file);
      const newSteps = [...steps];
      newSteps[stepIndex] = {
        ...newSteps[stepIndex],
        content: { ...newSteps[stepIndex].content, [field]: result.fullUrl },
      };
      setContent({ ...content, steps: newSteps });
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Erro ao fazer upload';
      alert(errorMessage);
    } finally {
      setUploading(null);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>, stepIndex: number, field: 'imageUrl' | 'videoUrl' | 'audioUrl' | 'fileUrl') => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileUpload(file, stepIndex, field);
    }
    const input = fileInputRefs.current.get(stepIndex);
    if (input) {
      input.value = '';
    }
  };

  const startRecordingAudio = async (stepIndex: number) => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
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
      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };
      mediaRecorder.onstop = async () => {
        const streamToStop = streamRef.current;
        if (streamToStop) {
          streamToStop.getTracks().forEach((track) => track.stop());
          streamRef.current = null;
        }
        if (audioChunksRef.current.length === 0) return;
        const actualMimeType = mediaRecorderRef.current?.mimeType || 'audio/ogg';
        const normalizedMimeType = actualMimeType.includes('ogg') ? 'audio/ogg' : actualMimeType.includes('webm') ? 'audio/webm' : 'audio/ogg';
        const extension = normalizedMimeType.includes('ogg') ? 'ogg' : 'webm';
        const blob = new Blob(audioChunksRef.current, { type: normalizedMimeType });
        const file = new File([blob], `recording-${Date.now()}.${extension}`, { type: normalizedMimeType });
        await handleFileUpload(file, stepIndex, 'audioUrl');
        setRecordingStepIndex(null);
      };
      mediaRecorder.start();
      setRecordingStepIndex(stepIndex);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro ao acessar microfone';
      alert(msg);
    }
  };

  const stopRecordingAudio = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current = null;
    }
  };

  // Validar sequência
  const getValidationError = () => {
    if (steps.length < 2) {
      return t('templateBuilder.sequenceMinSteps');
    }
    return null;
  };

  const validationError = getValidationError();

  return (
    <div>
      <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
        {t('templateBuilder.sequenceDescription')}
      </p>

      {validationError && (
        <div className="mb-4 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg text-yellow-800 dark:text-yellow-200 text-sm">
          ⚠️ {validationError}
        </div>
      )}

      <div className="space-y-4 max-h-[500px] overflow-y-auto">
        {steps.map((step: any, index: number) => (
          <div key={index} className="p-4 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-[#091D41]/50">
            <div className="flex justify-between items-start mb-3">
              <h4 className="font-semibold text-clerky-backendText dark:text-gray-200">
                {t('templateBuilder.step')} {index + 1}
              </h4>
              {steps.length > 1 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => removeStep(index)}
                  className="text-red-600 hover:text-red-700"
                >
                  {t('templateBuilder.remove')}
                </Button>
              )}
            </div>

            <div className="space-y-3">
              {/* Tipo da etapa */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {t('templateBuilder.stepType')}
                </label>
                <select
                  value={step.type}
                  onChange={(e) => {
                    const newType = e.target.value;
                    let newContent: any = {};
                    if (newType === 'text') {
                      newContent = { text: '' };
                    } else if (newType === 'image') {
                      newContent = { imageUrl: '' };
                    } else if (newType === 'image_caption') {
                      newContent = { imageUrl: '', caption: '' };
                    } else if (newType === 'video') {
                      newContent = { videoUrl: '' };
                    } else if (newType === 'video_caption') {
                      newContent = { videoUrl: '', caption: '' };
                    } else if (newType === 'audio') {
                      newContent = { audioUrl: '' };
                    } else if (newType === 'file') {
                      newContent = { fileUrl: '', fileName: '' };
                    }
                    // Atualizar tipo e conteúdo em uma única operação
                    const newSteps = [...steps];
                    newSteps[index] = {
                      ...newSteps[index],
                      type: newType,
                      content: newContent,
                    };
                    setContent({ ...content, steps: newSteps });
                  }}
                  className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-[#091D41] dark:text-gray-200"
                >
                  <option value="text">{t('templateBuilder.types.text')}</option>
                  <option value="image">{t('templateBuilder.types.image')}</option>
                  <option value="image_caption">{t('templateBuilder.types.imageCaption')}</option>
                  <option value="video">{t('templateBuilder.types.video')}</option>
                  <option value="video_caption">{t('templateBuilder.types.videoCaption')}</option>
                  <option value="audio">{t('templateBuilder.types.audio')}</option>
                  <option value="file">{t('templateBuilder.types.file')}</option>
                </select>
              </div>

              {/* Conteúdo baseado no tipo */}
              {step.type === 'text' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    {t('templateBuilder.message')}
                  </label>
                  <div className="mb-2">
                    <div className="flex flex-wrap gap-2 mb-2">
                      {AVAILABLE_VARIABLES.map((v) => (
                        <button
                          key={v.variable}
                          onClick={() => handleInsertVariable(v.variable, index, 'text')}
                          className="px-2 py-1 text-xs bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 rounded hover:bg-blue-200 dark:hover:bg-blue-800"
                          title={v.description}
                        >
                          {v.label}
                        </button>
                      ))}
                    </div>
                    <textarea
                      value={step.content?.text || ''}
                      onChange={(e) => updateStepContent(index, 'text', e.target.value)}
                      className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-[#091D41] dark:text-gray-200"
                      rows={3}
                      placeholder={t('templateBuilder.digiteMensagem')}
                    />
                  </div>
                </div>
              )}

              {step.type === 'image' && (
                <div>
                  <div className="mb-2">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      {t('templateBuilder.uploadFile')}
                    </label>
                    <input
                      ref={(el) => {
                        if (el) fileInputRefs.current.set(index, el);
                      }}
                      type="file"
                      accept="image/*"
                      onChange={(e) => handleFileSelect(e, index, 'imageUrl')}
                      className="hidden"
                      id={`image-upload-${index}`}
                    />
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => fileInputRefs.current.get(index)?.click()}
                        disabled={uploading === index}
                      >
                        {uploading === index ? t('templateBuilder.uploading') : t('templateBuilder.selectFile')}
                      </Button>
                      {step.content?.imageUrl && (
                        <span className="text-xs text-gray-500 dark:text-gray-400 self-center">
                          {t('templateBuilder.fileSelected')}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="mb-2">
                    <span className="text-xs text-gray-500 dark:text-gray-400">{t('templateBuilder.or')}</span>
                  </div>
                  <Input
                    label={t('templateBuilder.imageUrl')}
                    value={step.content?.imageUrl || ''}
                    onChange={(e) => updateStepContent(index, 'imageUrl', e.target.value)}
                    placeholder={t('templateBuilder.imageUrlPlaceholder')}
                  />
                </div>
              )}

              {step.type === 'image_caption' && (
                <>
                  <div className="mb-2">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      {t('templateBuilder.uploadFile')}
                    </label>
                    <input
                      ref={(el) => {
                        if (el) fileInputRefs.current.set(index, el);
                      }}
                      type="file"
                      accept="image/*"
                      onChange={(e) => handleFileSelect(e, index, 'imageUrl')}
                      className="hidden"
                      id={`image-caption-upload-${index}`}
                    />
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => fileInputRefs.current.get(index)?.click()}
                        disabled={uploading === index}
                      >
                        {uploading === index ? t('templateBuilder.uploading') : t('templateBuilder.selectFile')}
                      </Button>
                      {step.content?.imageUrl && (
                        <span className="text-xs text-gray-500 dark:text-gray-400 self-center">
                          {t('templateBuilder.fileSelected')}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="mb-2">
                    <span className="text-xs text-gray-500 dark:text-gray-400">{t('templateBuilder.or')}</span>
                  </div>
                  <Input
                    label={t('templateBuilder.imageUrl')}
                    value={step.content?.imageUrl || ''}
                    onChange={(e) => updateStepContent(index, 'imageUrl', e.target.value)}
                    placeholder={t('templateBuilder.imageUrlPlaceholder')}
                    className="mb-2"
                  />
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      {t('templateBuilder.caption')}
                    </label>
                    <div className="mb-2">
                      <div className="flex flex-wrap gap-2 mb-2">
                        {AVAILABLE_VARIABLES.map((v) => (
                          <button
                            key={v.variable}
                            onClick={() => handleInsertVariable(v.variable, index, 'caption')}
                            className="px-2 py-1 text-xs bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 rounded hover:bg-blue-200 dark:hover:bg-blue-800"
                            title={v.description}
                          >
                            {v.label}
                          </button>
                        ))}
                      </div>
                      <textarea
                        value={step.content?.caption || ''}
                        onChange={(e) => updateStepContent(index, 'caption', e.target.value)}
                        className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-[#091D41] dark:text-gray-200"
                        rows={2}
                        placeholder={t('templateBuilder.digiteLegenda')}
                      />
                    </div>
                  </div>
                </>
              )}

              {step.type === 'video' && (
                <div>
                  <div className="mb-2">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      {t('templateBuilder.uploadFile')}
                    </label>
                    <input
                      ref={(el) => {
                        if (el) fileInputRefs.current.set(index, el);
                      }}
                      type="file"
                      accept="video/*"
                      onChange={(e) => handleFileSelect(e, index, 'videoUrl')}
                      className="hidden"
                      id={`video-upload-${index}`}
                    />
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => fileInputRefs.current.get(index)?.click()}
                        disabled={uploading === index}
                      >
                        {uploading === index ? t('templateBuilder.uploading') : t('templateBuilder.selectFile')}
                      </Button>
                      {step.content?.videoUrl && (
                        <span className="text-xs text-gray-500 dark:text-gray-400 self-center">
                          {t('templateBuilder.fileSelected')}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="mb-2">
                    <span className="text-xs text-gray-500 dark:text-gray-400">{t('templateBuilder.or')}</span>
                  </div>
                  <Input
                    label={t('templateBuilder.videoUrl')}
                    value={step.content?.videoUrl || ''}
                    onChange={(e) => updateStepContent(index, 'videoUrl', e.target.value)}
                    placeholder={t('templateBuilder.videoUrlPlaceholder')}
                  />
                </div>
              )}

              {step.type === 'video_caption' && (
                <>
                  <div className="mb-2">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      {t('templateBuilder.uploadFile')}
                    </label>
                    <input
                      ref={(el) => {
                        if (el) fileInputRefs.current.set(index, el);
                      }}
                      type="file"
                      accept="video/*"
                      onChange={(e) => handleFileSelect(e, index, 'videoUrl')}
                      className="hidden"
                      id={`video-caption-upload-${index}`}
                    />
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => fileInputRefs.current.get(index)?.click()}
                        disabled={uploading === index}
                      >
                        {uploading === index ? t('templateBuilder.uploading') : t('templateBuilder.selectFile')}
                      </Button>
                      {step.content?.videoUrl && (
                        <span className="text-xs text-gray-500 dark:text-gray-400 self-center">
                          {t('templateBuilder.fileSelected')}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="mb-2">
                    <span className="text-xs text-gray-500 dark:text-gray-400">{t('templateBuilder.or')}</span>
                  </div>
                  <Input
                    label={t('templateBuilder.videoUrl')}
                    value={step.content?.videoUrl || ''}
                    onChange={(e) => updateStepContent(index, 'videoUrl', e.target.value)}
                    placeholder={t('templateBuilder.videoUrlPlaceholder')}
                    className="mb-2"
                  />
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      {t('templateBuilder.caption')}
                    </label>
                    <div className="mb-2">
                      <div className="flex flex-wrap gap-2 mb-2">
                        {AVAILABLE_VARIABLES.map((v) => (
                          <button
                            key={v.variable}
                            onClick={() => handleInsertVariable(v.variable, index, 'caption')}
                            className="px-2 py-1 text-xs bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 rounded hover:bg-blue-200 dark:hover:bg-blue-800"
                            title={v.description}
                          >
                            {v.label}
                          </button>
                        ))}
                      </div>
                      <textarea
                        value={step.content?.caption || ''}
                        onChange={(e) => updateStepContent(index, 'caption', e.target.value)}
                        className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-[#091D41] dark:text-gray-200"
                        rows={2}
                        placeholder={t('templateBuilder.digiteLegenda')}
                      />
                    </div>
                  </div>
                </>
              )}

              {step.type === 'audio' && (
                <div>
                  <div className="mb-2">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      {t('templateBuilder.uploadFile')}
                    </label>
                    <input
                      ref={(el) => {
                        if (el) fileInputRefs.current.set(index, el);
                      }}
                      type="file"
                      accept="audio/*"
                      onChange={(e) => handleFileSelect(e, index, 'audioUrl')}
                      className="hidden"
                      id={`audio-upload-${index}`}
                    />
                    <div className="flex flex-wrap gap-2 items-center">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => fileInputRefs.current.get(index)?.click()}
                        disabled={uploading === index || recordingStepIndex !== null}
                      >
                        {uploading === index ? t('templateBuilder.uploading') : t('templateBuilder.selectFile')}
                      </Button>
                      {recordingStepIndex === index ? (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={stopRecordingAudio}
                          className="text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                        >
                          {t('templateBuilder.stopRecording')}
                        </Button>
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => startRecordingAudio(index)}
                          disabled={uploading === index || recordingStepIndex !== null}
                        >
                          {t('templateBuilder.recordAudio')}
                        </Button>
                      )}
                      {step.content?.audioUrl && (
                        <span className="text-xs text-gray-500 dark:text-gray-400 self-center">
                          {t('templateBuilder.fileSelected')}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="mb-2">
                    <span className="text-xs text-gray-500 dark:text-gray-400">{t('templateBuilder.or')}</span>
                  </div>
                  <Input
                    label={t('templateBuilder.audioUrl')}
                    value={step.content?.audioUrl || ''}
                    onChange={(e) => updateStepContent(index, 'audioUrl', e.target.value)}
                    placeholder={t('templateBuilder.audioUrlPlaceholder')}
                  />
                </div>
              )}

              {step.type === 'file' && (
                <>
                  <div className="mb-2">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      {t('templateBuilder.uploadFile')}
                    </label>
                    <input
                      ref={(el) => {
                        if (el) fileInputRefs.current.set(index, el);
                      }}
                      type="file"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          handleFileUpload(file, index, 'fileUrl');
                          const newSteps = [...steps];
                          newSteps[index] = {
                            ...newSteps[index],
                            content: { ...newSteps[index].content, fileName: file.name },
                          };
                          setContent({ ...content, steps: newSteps });
                        }
                        const input = fileInputRefs.current.get(index);
                        if (input) {
                          input.value = '';
                        }
                      }}
                      className="hidden"
                      id={`file-upload-${index}`}
                    />
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => fileInputRefs.current.get(index)?.click()}
                        disabled={uploading === index}
                      >
                        {uploading === index ? t('templateBuilder.uploading') : t('templateBuilder.selectFile')}
                      </Button>
                      {step.content?.fileUrl && (
                        <span className="text-xs text-gray-500 dark:text-gray-400 self-center">
                          {t('templateBuilder.fileSelected')}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="mb-2">
                    <span className="text-xs text-gray-500 dark:text-gray-400">{t('templateBuilder.or')}</span>
                  </div>
                  <Input
                    label={t('templateBuilder.fileUrl')}
                    value={step.content?.fileUrl || ''}
                    onChange={(e) => updateStepContent(index, 'fileUrl', e.target.value)}
                    placeholder={t('templateBuilder.fileUrlPlaceholder')}
                    className="mb-2"
                  />
                  <Input
                    label={t('templateBuilder.fileName')}
                    value={step.content?.fileName || ''}
                    onChange={(e) => updateStepContent(index, 'fileName', e.target.value)}
                    placeholder={t('templateBuilder.fileNamePlaceholder')}
                  />
                </>
              )}

              {/* Delay */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    {t('templateBuilder.delay')}
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={step.delay || 0}
                    onChange={(e) => updateStep(index, 'delay', parseInt(e.target.value) || 0)}
                    className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-[#091D41] dark:text-gray-200"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    {t('templateBuilder.delayUnit')}
                  </label>
                  <select
                    value={step.delayUnit || 'seconds'}
                    onChange={(e) => updateStep(index, 'delayUnit', e.target.value)}
                    className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-[#091D41] dark:text-gray-200"
                  >
                    <option value="seconds">{t('dispatchCreator.seconds')}</option>
                    <option value="minutes">{t('dispatchCreator.minutes')}</option>
                    <option value="hours">{t('dispatchCreator.hours')}</option>
                  </select>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <Button variant="outline" onClick={addStep} className="mt-4">
        {t('templateBuilder.addStep')}
      </Button>
    </div>
  );
};

interface TemplateBuilderProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: CreateTemplateData) => Promise<void>;
  initialData?: { name?: string; type?: TemplateType; content?: any };
}

const TemplateBuilder: React.FC<TemplateBuilderProps> = ({
  isOpen,
  onClose,
  onSave,
  initialData,
}) => {
  const { t } = useLanguage();
  const [step, setStep] = useState<'type' | 'content'>(
    initialData?.type ? 'content' : 'type'
  );
  const [templateType, setTemplateType] = useState<TemplateType | null>(
    initialData?.type || null
  );
  const [name, setName] = useState(initialData?.name || '');
  const [content, setContent] = useState<any>(initialData?.content || {});
  const [uploading, setUploading] = useState(false);
  const [isRecordingAudio, setIsRecordingAudio] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRefMain = useRef<MediaRecorder | null>(null);
  const audioChunksRefMain = useRef<Blob[]>([]);
  const streamRefMain = useRef<MediaStream | null>(null);

  const handleSave = async () => {
    if (!name || !templateType) {
      console.error('❌ TemplateBuilder - Validação falhou:', { name, templateType });
      return;
    }

    // Validar sequência se for o tipo
    if (templateType === 'sequence') {
      const steps = content.steps || [];
      if (steps.length < 2) {
        alert(t('templateBuilder.sequenceMinSteps'));
        return;
      }
    }

    // Garantir que o tipo está correto antes de enviar
    const validTypes: TemplateType[] = ['text', 'image', 'image_caption', 'video', 'video_caption', 'audio', 'file', 'sequence'];
    if (!validTypes.includes(templateType)) {
      console.error('❌ TemplateBuilder - Tipo inválido:', templateType);
      alert('Tipo de template inválido. Por favor, selecione um tipo válido.');
      return;
    }

    console.log('✅ TemplateBuilder - Salvando template:', { name, type: templateType, contentKeys: Object.keys(content) });

    await onSave({
      name,
      type: templateType,
      content,
    });

    // Reset
    setStep('type');
    setTemplateType(null);
    setName('');
    setContent({});
    onClose();
  };

  const handleInsertVariable = (variable: string, field: string) => {
    const currentValue = content[field] || '';
    setContent({
      ...content,
      [field]: currentValue + variable,
    });
  };

  const handleFileUpload = async (file: File, field: 'imageUrl' | 'videoUrl' | 'audioUrl' | 'fileUrl') => {
    try {
      setUploading(true);
      const result = await dispatchAPI.uploadTemplateFile(file);
      setContent({
        ...content,
        [field]: result.fullUrl,
      });
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Erro ao fazer upload';
      alert(errorMessage);
    } finally {
      setUploading(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>, field: 'imageUrl' | 'videoUrl' | 'audioUrl' | 'fileUrl') => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileUpload(file, field);
    }
    // Limpar input para permitir selecionar o mesmo arquivo novamente
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const startRecordingAudioMain = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRefMain.current = stream;
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
      mediaRecorderRefMain.current = mediaRecorder;
      audioChunksRefMain.current = [];
      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRefMain.current.push(e.data);
      };
      mediaRecorder.onstop = async () => {
        const streamToStop = streamRefMain.current;
        if (streamToStop) {
          streamToStop.getTracks().forEach((track) => track.stop());
          streamRefMain.current = null;
        }
        if (audioChunksRefMain.current.length === 0) {
          setIsRecordingAudio(false);
          return;
        }
        const actualMimeType = mediaRecorderRefMain.current?.mimeType || 'audio/ogg';
        const normalizedMimeType = actualMimeType.includes('ogg') ? 'audio/ogg' : actualMimeType.includes('webm') ? 'audio/webm' : 'audio/ogg';
        const extension = normalizedMimeType.includes('ogg') ? 'ogg' : 'webm';
        const blob = new Blob(audioChunksRefMain.current, { type: normalizedMimeType });
        const file = new File([blob], `recording-${Date.now()}.${extension}`, { type: normalizedMimeType });
        await handleFileUpload(file, 'audioUrl');
        setIsRecordingAudio(false);
      };
      mediaRecorder.start();
      setIsRecordingAudio(true);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro ao acessar microfone';
      alert(msg);
    }
  };

  const stopRecordingAudioMain = () => {
    if (mediaRecorderRefMain.current && mediaRecorderRefMain.current.state !== 'inactive') {
      mediaRecorderRefMain.current.stop();
      mediaRecorderRefMain.current = null;
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={initialData ? t('templateBuilder.editTitle') : t('templateBuilder.title')} size="lg">
      {step === 'type' ? (
        <div>
          <div className="mb-4">
            <Input
              label={t('templateBuilder.templateName')}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('templateBuilder.templateNamePlaceholder')}
            />
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {t('templateBuilder.templateType')}
            </label>
            <div className="grid grid-cols-2 gap-2">
              {[
                { value: 'text', label: t('templateBuilder.types.text') },
                { value: 'image', label: t('templateBuilder.types.image') },
                { value: 'image_caption', label: t('templateBuilder.types.imageCaption') },
                { value: 'video', label: t('templateBuilder.types.video') },
                { value: 'video_caption', label: t('templateBuilder.types.videoCaption') },
                { value: 'audio', label: t('templateBuilder.types.audio') },
                { value: 'file', label: t('templateBuilder.types.file') },
                { value: 'sequence', label: t('templateBuilder.types.sequence') },
              ].map((type) => {
                const isSelected = templateType === type.value;
                return (
                  <button
                    key={type.value}
                    onClick={() => {
                      const newType = type.value as TemplateType;
                      const isTypeChanging = templateType !== newType;
                      
                      setTemplateType(newType);
                      setStep('content');
                      
                      // Só inicializar conteúdo se estiver mudando de tipo ou se o conteúdo estiver vazio
                      if (isTypeChanging || !content || Object.keys(content).length === 0) {
                        // Inicializar conteúdo baseado no tipo
                        if (newType === 'text') {
                          setContent({ text: '' });
                        } else if (newType === 'image') {
                          setContent({ imageUrl: '' });
                        } else if (newType === 'image_caption') {
                          setContent({ imageUrl: '', caption: '' });
                        } else if (newType === 'video') {
                          setContent({ videoUrl: '' });
                        } else if (newType === 'video_caption') {
                          setContent({ videoUrl: '', caption: '' });
                        } else if (newType === 'audio') {
                          setContent({ audioUrl: '' });
                        } else if (newType === 'file') {
                          setContent({ fileUrl: '', fileName: '' });
                        } else if (newType === 'sequence') {
                          setContent({ steps: [] });
                        }
                      }
                      // Se não estiver mudando de tipo, manter o conteúdo existente
                    }}
                    className={`p-3 border rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 text-left text-gray-700 dark:text-gray-200 ${
                      isSelected
                        ? 'border-blue-500 dark:border-blue-400 bg-blue-50 dark:bg-blue-900/20'
                        : 'border-gray-300 dark:border-gray-600'
                    }`}
                  >
                    {type.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      ) : (
        <div>
          <div className="mb-4 flex justify-between items-center">
            <h3 className="font-semibold text-clerky-backendText dark:text-gray-200">
              {t('templateBuilder.configure')} {templateType}
            </h3>
            <Button variant="outline" size="sm" onClick={() => setStep('type')}>
              {t('templateBuilder.back')}
            </Button>
          </div>

          {/* Conteúdo baseado no tipo */}
          {templateType === 'text' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {t('templateBuilder.textMessage')}
              </label>
              <div className="mb-2">
                <div className="flex flex-wrap gap-2 mb-2">
                  {AVAILABLE_VARIABLES.map((v) => (
                    <button
                      key={v.variable}
                      onClick={() => handleInsertVariable(v.variable, 'text')}
                      className="px-2 py-1 text-xs bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 rounded hover:bg-blue-200 dark:hover:bg-blue-800"
                      title={v.description}
                    >
                      {v.label}
                    </button>
                  ))}
                </div>
                <textarea
                  value={content.text || ''}
                  onChange={(e) => setContent({ ...content, text: e.target.value })}
                  className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-[#091D41] dark:text-gray-200"
                  rows={6}
                  placeholder={t('templateBuilder.messagePlaceholder')}
                />
              </div>
            </div>
          )}

          {templateType === 'image' && (
            <div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  {t('templateBuilder.uploadFile')}
                </label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={(e) => handleFileSelect(e, 'imageUrl')}
                  className="hidden"
                  id="image-upload"
                />
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                  >
                    {uploading ? t('templateBuilder.uploading') : t('templateBuilder.selectFile')}
                  </Button>
                  {content.imageUrl && (
                    <span className="text-sm text-gray-500 dark:text-gray-400 self-center">
                      {t('templateBuilder.fileSelected')}
                    </span>
                  )}
                </div>
              </div>
              <div className="mb-2">
                <span className="text-sm text-gray-500 dark:text-gray-400">{t('templateBuilder.or')}</span>
              </div>
              <Input
                label={t('templateBuilder.imageUrl')}
                value={content.imageUrl || ''}
                onChange={(e) => setContent({ ...content, imageUrl: e.target.value })}
                placeholder={t('templateBuilder.imageUrlPlaceholder')}
              />
            </div>
          )}

          {templateType === 'image_caption' && (
            <div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  {t('templateBuilder.uploadFile')}
                </label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={(e) => handleFileSelect(e, 'imageUrl')}
                  className="hidden"
                  id="image-caption-upload"
                />
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                  >
                    {uploading ? t('templateBuilder.uploading') : t('templateBuilder.selectFile')}
                  </Button>
                  {content.imageUrl && (
                    <span className="text-sm text-gray-500 dark:text-gray-400 self-center">
                      {t('templateBuilder.fileSelected')}
                    </span>
                  )}
                </div>
              </div>
              <div className="mb-2">
                <span className="text-sm text-gray-500 dark:text-gray-400">{t('templateBuilder.or')}</span>
              </div>
              <Input
                label={t('templateBuilder.imageUrl')}
                value={content.imageUrl || ''}
                onChange={(e) => setContent({ ...content, imageUrl: e.target.value })}
                placeholder={t('templateBuilder.imageUrlPlaceholder')}
                className="mb-4"
              />
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {t('templateBuilder.caption')}
              </label>
              <div className="mb-2">
                <div className="flex flex-wrap gap-2 mb-2">
                  {AVAILABLE_VARIABLES.map((v) => (
                    <button
                      key={v.variable}
                      onClick={() => handleInsertVariable(v.variable, 'caption')}
                      className="px-2 py-1 text-xs bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 rounded hover:bg-blue-200 dark:hover:bg-blue-800"
                      title={v.description}
                    >
                      {v.label}
                    </button>
                  ))}
                </div>
                <textarea
                  value={content.caption || ''}
                  onChange={(e) => setContent({ ...content, caption: e.target.value })}
                  className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-[#091D41] dark:text-gray-200"
                  rows={4}
                  placeholder={t('templateBuilder.captionPlaceholder')}
                />
              </div>
            </div>
          )}

          {templateType === 'video' && (
            <div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  {t('templateBuilder.uploadFile')}
                </label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="video/*"
                  onChange={(e) => handleFileSelect(e, 'videoUrl')}
                  className="hidden"
                  id="video-upload"
                />
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                  >
                    {uploading ? t('templateBuilder.uploading') : t('templateBuilder.selectFile')}
                  </Button>
                  {content.videoUrl && (
                    <span className="text-sm text-gray-500 dark:text-gray-400 self-center">
                      {t('templateBuilder.fileSelected')}
                    </span>
                  )}
                </div>
              </div>
              <div className="mb-2">
                <span className="text-sm text-gray-500 dark:text-gray-400">{t('templateBuilder.or')}</span>
              </div>
              <Input
                label={t('templateBuilder.videoUrl')}
                value={content.videoUrl || ''}
                onChange={(e) => setContent({ ...content, videoUrl: e.target.value })}
                placeholder={t('templateBuilder.videoUrlPlaceholder')}
              />
            </div>
          )}

          {templateType === 'video_caption' && (
            <div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  {t('templateBuilder.uploadFile')}
                </label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="video/*"
                  onChange={(e) => handleFileSelect(e, 'videoUrl')}
                  className="hidden"
                  id="video-caption-upload"
                />
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                  >
                    {uploading ? t('templateBuilder.uploading') : t('templateBuilder.selectFile')}
                  </Button>
                  {content.videoUrl && (
                    <span className="text-sm text-gray-500 dark:text-gray-400 self-center">
                      {t('templateBuilder.fileSelected')}
                    </span>
                  )}
                </div>
              </div>
              <div className="mb-2">
                <span className="text-sm text-gray-500 dark:text-gray-400">{t('templateBuilder.or')}</span>
              </div>
              <Input
                label={t('templateBuilder.videoUrl')}
                value={content.videoUrl || ''}
                onChange={(e) => setContent({ ...content, videoUrl: e.target.value })}
                placeholder={t('templateBuilder.videoUrlPlaceholder')}
                className="mb-4"
              />
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {t('templateBuilder.caption')}
              </label>
              <div className="mb-2">
                <div className="flex flex-wrap gap-2 mb-2">
                  {AVAILABLE_VARIABLES.map((v) => (
                    <button
                      key={v.variable}
                      onClick={() => handleInsertVariable(v.variable, 'caption')}
                      className="px-2 py-1 text-xs bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 rounded hover:bg-blue-200 dark:hover:bg-blue-800"
                      title={v.description}
                    >
                      {v.label}
                    </button>
                  ))}
                </div>
                <textarea
                  value={content.caption || ''}
                  onChange={(e) => setContent({ ...content, caption: e.target.value })}
                  className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-[#091D41] dark:text-gray-200"
                  rows={4}
                  placeholder={t('templateBuilder.captionPlaceholder')}
                />
              </div>
            </div>
          )}

          {templateType === 'audio' && (
            <div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  {t('templateBuilder.uploadFile')}
                </label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="audio/*"
                  onChange={(e) => handleFileSelect(e, 'audioUrl')}
                  className="hidden"
                  id="audio-upload"
                />
                <div className="flex flex-wrap gap-2 items-center">
                  <Button
                    variant="outline"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading || isRecordingAudio}
                  >
                    {uploading ? t('templateBuilder.uploading') : t('templateBuilder.selectFile')}
                  </Button>
                  {isRecordingAudio ? (
                    <Button
                      variant="outline"
                      onClick={stopRecordingAudioMain}
                      className="text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                    >
                      {t('templateBuilder.stopRecording')}
                    </Button>
                  ) : (
                    <Button
                      variant="outline"
                      onClick={startRecordingAudioMain}
                      disabled={uploading}
                    >
                      {t('templateBuilder.recordAudio')}
                    </Button>
                  )}
                  {content.audioUrl && (
                    <span className="text-sm text-gray-500 dark:text-gray-400 self-center">
                      {t('templateBuilder.fileSelected')}
                    </span>
                  )}
                </div>
              </div>
              <div className="mb-2">
                <span className="text-sm text-gray-500 dark:text-gray-400">{t('templateBuilder.or')}</span>
              </div>
              <Input
                label={t('templateBuilder.audioUrl')}
                value={content.audioUrl || ''}
                onChange={(e) => setContent({ ...content, audioUrl: e.target.value })}
                placeholder={t('templateBuilder.audioUrlPlaceholder')}
              />
            </div>
          )}

          {templateType === 'file' && (
            <div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  {t('templateBuilder.uploadFile')}
                </label>
                <input
                  ref={fileInputRef}
                  type="file"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      handleFileUpload(file, 'fileUrl');
                      setContent({
                        ...content,
                        fileName: file.name,
                      });
                    }
                    if (fileInputRef.current) {
                      fileInputRef.current.value = '';
                    }
                  }}
                  className="hidden"
                  id="file-upload"
                />
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                  >
                    {uploading ? t('templateBuilder.uploading') : t('templateBuilder.selectFile')}
                  </Button>
                  {content.fileUrl && (
                    <span className="text-sm text-gray-500 dark:text-gray-400 self-center">
                      {t('templateBuilder.fileSelected')}
                    </span>
                  )}
                </div>
              </div>
              <div className="mb-2">
                <span className="text-sm text-gray-500 dark:text-gray-400">{t('templateBuilder.or')}</span>
              </div>
              <Input
                label={t('templateBuilder.fileUrl')}
                value={content.fileUrl || ''}
                onChange={(e) => setContent({ ...content, fileUrl: e.target.value })}
                placeholder={t('templateBuilder.fileUrlPlaceholder')}
                className="mb-4"
              />
              <Input
                label={t('templateBuilder.fileName')}
                value={content.fileName || ''}
                onChange={(e) => setContent({ ...content, fileName: e.target.value })}
                placeholder={t('templateBuilder.fileNamePlaceholder')}
              />
            </div>
          )}

          {templateType === 'sequence' && (
            <SequenceBuilder
              content={content}
              setContent={setContent}
            />
          )}

          <div className="mt-6 flex justify-end gap-2">
            <Button variant="outline" onClick={onClose}>
              {t('templateBuilder.cancel')}
            </Button>
            <Button variant="primary" onClick={handleSave} disabled={!name || !templateType}>
              {t('templateBuilder.save')}
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
};

export default TemplateBuilder;

