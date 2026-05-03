import type { UserAddress } from '@batalha/types';

export type ProfileValidationErrors = {
  cpf?: string;
  phone?: string;
  postalCode?: string;
  street?: string;
  number?: string;
  city?: string;
};

export function normalizeCpf(value: string) {
  return value.replace(/\D/g, '');
}

export function isValidCpf(value: string) {
  const digits = normalizeCpf(value);
  if (!digits) return true;
  if (digits.length !== 11 || /^(\d)\1+$/.test(digits)) return false;

  const calculateDigit = (length: number) => {
    let sum = 0;
    for (let i = 0; i < length; i += 1) {
      sum += Number(digits[i]) * (length + 1 - i);
    }
    const rest = (sum * 10) % 11;
    return rest === 10 ? 0 : rest;
  };

  return calculateDigit(9) === Number(digits[9]) && calculateDigit(10) === Number(digits[10]);
}

export function normalizePhone(value: string) {
  return value.replace(/\D/g, '');
}

export function isValidBrazilPhone(value: string) {
  const digits = normalizePhone(value);
  if (!digits) return true;
  const localDigits = digits.startsWith('55') ? digits.slice(2) : digits;
  return /^[1-9]{2}9?\d{8}$/.test(localDigits) && !/^(\d)\1+$/.test(localDigits);
}

export function normalizeCep(value: string) {
  return value.replace(/\D/g, '');
}

export function isValidCep(value: string) {
  const digits = normalizeCep(value);
  return !digits || /^\d{8}$/.test(digits);
}

export function validateOfficialProfileFields({
  cpf,
  phone,
  address,
}: {
  cpf?: string;
  phone?: string;
  address?: Partial<UserAddress>;
}) {
  const errors: ProfileValidationErrors = {};

  if (cpf !== undefined && !isValidCpf(cpf)) {
    errors.cpf = 'CPF invalido.';
  }
  if (phone !== undefined && !isValidBrazilPhone(phone)) {
    errors.phone = 'Use DDD + telefone, somente numeros.';
  }

  if (address) {
    if (address.postalCode !== undefined && !isValidCep(address.postalCode)) {
      errors.postalCode = 'Use um CEP valido com 8 digitos.';
    }
    if (
      address.street !== undefined &&
      address.street.trim().length > 0 &&
      address.street.trim().length < 3
    ) {
      errors.street = 'Rua precisa ter pelo menos 3 caracteres.';
    }
    if (
      address.number !== undefined &&
      address.number.trim().length > 0 &&
      address.number.trim().length > 20
    ) {
      errors.number = 'Numero muito longo.';
    }
    if (
      address.city !== undefined &&
      address.city.trim().length > 0 &&
      address.city.trim().length < 2
    ) {
      errors.city = 'Cidade precisa ter pelo menos 2 caracteres.';
    }
  }

  return errors;
}

export function hasProfileValidationErrors(errors: ProfileValidationErrors) {
  return Object.values(errors).some(Boolean);
}
