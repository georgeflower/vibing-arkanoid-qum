// Common passwords list (top 100 most common)
const COMMON_PASSWORDS = new Set([
  "password123", "123456789a", "qwerty12345", "letmein1234", "welcome1234",
  "monkey12345", "dragon12345", "master12345", "1234567890", "trustno1xx",
  "baseball123", "iloveyou123", "shadow12345", "sunshine123", "princess123",
  "football123", "charlie1234", "access12345", "michael1234", "superman123",
  "batman12345", "passw0rd123", "password1234", "qwertyuiop", "1q2w3e4r5t",
  "abcdefghij", "0987654321", "1234qwerty", "aabbccddee", "password12",
  "iloveyou12", "changeme123", "admin12345", "welcome123", "login12345",
  "starwars123", "whatever123", "trustno1234", "letmein12345", "hello12345",
]);

export interface PasswordValidation {
  isValid: boolean;
  errors: string[];
  strength: 'weak' | 'fair' | 'strong' | 'very-strong';
}

export function validatePassword(password: string): PasswordValidation {
  const errors: string[] = [];

  if (password.length < 8) {
    errors.push("Must be at least 8 characters");
  }

  if (!/[A-Z]/.test(password)) {
    errors.push("Must contain an uppercase letter");
  }

  if (!/[a-z]/.test(password)) {
    errors.push("Must contain a lowercase letter");
  }

  if (!/[0-9]/.test(password)) {
    errors.push("Must contain a number");
  }

  if (COMMON_PASSWORDS.has(password.toLowerCase())) {
    errors.push("This password is too common");
  }

  let strength: PasswordValidation['strength'] = 'weak';
  if (errors.length === 0) {
    const hasSpecial = /[^A-Za-z0-9]/.test(password);
    if (password.length >= 16 && hasSpecial) strength = 'very-strong';
    else if (password.length >= 12 || hasSpecial) strength = 'strong';
    else strength = 'fair';
  }

  return { isValid: errors.length === 0, errors, strength };
}

export function validateUsername(username: string): { isValid: boolean; error?: string } {
  if (username.length < 3) return { isValid: false, error: "Must be at least 3 characters" };
  if (username.length > 20) return { isValid: false, error: "Must be 20 characters or less" };
  if (!/^[a-zA-Z0-9_]+$/.test(username)) return { isValid: false, error: "Only letters, numbers, and underscores" };
  return { isValid: true };
}

export function validateInitials(initials: string): { isValid: boolean; error?: string } {
  if (!/^[A-Z]{3}$/.test(initials)) return { isValid: false, error: "Must be exactly 3 uppercase letters" };
  return { isValid: true };
}
