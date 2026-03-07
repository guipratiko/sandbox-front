import { useState, ChangeEvent, FormEvent } from 'react';
import { useLanguage } from '../contexts/LanguageContext';

interface UseFormOptions<T> {
  initialValues: T;
  onSubmit: (values: T) => Promise<void> | void;
  validate?: (values: T) => Partial<Record<keyof T, string>>;
}

type FormErrors<T> = Partial<Record<keyof T, string>> & { general?: string };

export const useForm = <T extends Record<string, any>>({
  initialValues,
  onSubmit,
  validate,
}: UseFormOptions<T>) => {
  const { t } = useLanguage();
  const [values, setValues] = useState<T>(initialValues);
  const [errors, setErrors] = useState<FormErrors<T>>({} as FormErrors<T>);
  const [isLoading, setIsLoading] = useState(false);

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    setValues((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));

    // Limpar erro do campo quando o usuário começar a digitar
    if (errors[name as keyof typeof errors]) {
      setErrors((prev) => ({
        ...prev,
        [name]: undefined,
      }));
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    // Validação
    if (validate) {
      const validationErrors = validate(values);
      if (Object.keys(validationErrors).length > 0) {
        setErrors(validationErrors);
        return;
      }
    }

    setIsLoading(true);
    setErrors({});

    try {
      await onSubmit(values);
    } catch (error: any) {
      setErrors({
        general: error.message || t('error.formProcessing'),
      } as FormErrors<T>);
    } finally {
      setIsLoading(false);
    }
  };

  const reset = () => {
    setValues(initialValues);
    setErrors({});
    setIsLoading(false);
  };

  return {
    values,
    errors,
    isLoading,
    handleChange,
    handleSubmit,
    setValues,
    setErrors,
    reset,
  };
};

