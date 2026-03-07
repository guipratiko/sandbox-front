# Utilitários e Hooks

## Validators (`validators.ts`)

Utilitários de validação reutilizáveis para formulários.

### Uso:

```typescript
import { validators } from '../utils/validators';
import { useLanguage } from '../contexts/LanguageContext';

const { t } = useLanguage();

// Validar email
const emailResult = validators.email(formData.email);
if (!emailResult.isValid) {
  errors.email = t(emailResult.error!);
}

// Validar senha
const passwordResult = validators.password(formData.password);
if (!passwordResult.isValid) {
  errors.password = t(passwordResult.error!);
}
```

### Validadores disponíveis:

- `email(value: string)` - Valida formato de email
- `password(value: string, minLength?: number)` - Valida senha
- `name(value: string, minLength?: number)` - Valida nome
- `confirmPassword(value: string, password: string)` - Valida confirmação de senha
- `required(value: any, errorKey?: string)` - Valida campo obrigatório

## useForm Hook (`useForm.ts`)

Hook customizado para gerenciar formulários de forma reutilizável.

### Uso:

```typescript
import { useForm } from '../hooks/useForm';

const { values, errors, isLoading, handleChange, handleSubmit } = useForm({
  initialValues: {
    email: '',
    password: '',
  },
  onSubmit: async (values) => {
    await login(values.email, values.password);
  },
  validate: (values) => {
    const errors = {};
    if (!values.email) errors.email = t('validation.emailRequired');
    return errors;
  },
});
```

