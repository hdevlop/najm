import 'reflect-metadata';
import { describe, expect, test } from 'bun:test';
import { z } from 'zod';
import { resolveAuthConfig } from '../src/AuthPlugin';
import { changePasswordDto, confirmResetPasswordDto, createUserDto, defaultPasswordSchema, registerDto } from '../src/users/UserDto';
import { UserValidator } from '../src/users/UserValidator';

// A school whose staff type passwords on phones: a letter and a number, no shift key.
const letterAndDigit = z.string()
  .min(8, 'Password must be at least 8 characters')
  .regex(/[a-zA-Z]/, 'Password must contain at least one letter')
  .regex(/\d/, 'Password must contain at least one number');

const jwt = { accessSecret: 'a'.repeat(32), refreshSecret: 'b'.repeat(32) };

function validator(passwordSchema?: z.ZodType<string>) {
  const instance = new UserValidator({} as any, {} as any);
  if (passwordSchema) (instance as any).config = { passwordSchema };
  return instance;
}

describe('password policy', () => {
  test('keeps uppercase, lowercase and a number by default', () => {
    expect(defaultPasswordSchema.safeParse('Abcdefg1').success).toBe(true);
    expect(defaultPasswordSchema.safeParse('abcdefg1').success).toBe(false);
    expect(() => validator().validatePasswordStrength('abcdefg1')).toThrow('uppercase');
    expect(() => validator().validatePasswordStrength('Abcdef1')).toThrow('at least 8 characters');
    expect(resolveAuthConfig({ jwt }).passwordSchema).toBe(defaultPasswordSchema);
  });

  test('applies the application policy instead of the default', () => {
    expect(resolveAuthConfig({ jwt, passwordSchema: letterAndDigit }).passwordSchema).toBe(letterAndDigit);
    expect(() => validator(letterAndDigit).validatePasswordStrength('abcdefg1')).not.toThrow();
    expect(() => validator(letterAndDigit).validatePasswordStrength('abcdefgh')).toThrow('at least one number');
  });

  test('keeps bcrypt\'s 72-byte limit whatever the policy', () => {
    expect(() => validator(z.string()).validatePasswordStrength('a'.repeat(73))).toThrow('72 bytes');
  });

  test('request bodies check bounds only, so the configured policy decides', () => {
    expect(changePasswordDto.safeParse({ currentPassword: 'old', newPassword: 'abcdefg1' }).success).toBe(true);
    expect(confirmResetPasswordDto.safeParse({ token: 'reset-token-1234', newPassword: 'abcdefg1' }).success).toBe(true);
    expect(createUserDto.safeParse({ email: 'staff@example.test', password: 'abcdefg1' }).success).toBe(true);
    expect(registerDto.safeParse({ email: 'staff@example.test', password: 'abcdefg1' }).success).toBe(true);
    expect(createUserDto.safeParse({ email: 'staff@example.test', password: '' }).success).toBe(false);
    expect(createUserDto.safeParse({ email: 'staff@example.test', password: 'a'.repeat(73) }).success).toBe(false);
  });
});
