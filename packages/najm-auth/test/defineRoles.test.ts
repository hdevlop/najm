import { describe, expect, test } from 'bun:test';
import { getGuardMetadata } from '../../najm-guard/src/decorator';
import { defineRoles } from '../src/roles/defineRoles';

describe('defineRoles', () => {
  test('preserves existing exact-match behavior by default', () => {
    const { hasRole } = defineRoles({
      ADMIN: 'admin',
      TEACHER: 'teacher',
      ACCOUNTING: 'accounting',
    });

    expect(hasRole('admin', 'TEACHER')).toBe(false);
    expect(hasRole('teacher', 'TEACHER')).toBe(true);
  });

  test('applies superRoles to generated single-role guards', () => {
    const { isTeacher } = defineRoles({
      ADMIN: 'admin',
      TEACHER: 'teacher',
      ACCOUNTING: 'accounting',
    }, {
      superRoles: ['ADMIN'],
    });

    class TeacherController {
      @isTeacher()
      list() { }
    }

    const guards = getGuardMetadata(TeacherController, 'list');

    expect(guards).toHaveLength(2);
    expect(guards[1]?.params).toEqual(['teacher', 'admin']);
  });

  test('applies superRoles to group guards and service-layer checks', () => {
    const roles = defineRoles({
      ADMIN: 'admin',
      TEACHER: 'teacher',
      ACCOUNTING: 'accounting',
      PRINCIPAL: 'principal',
    }, {
      superRoles: ['ADMIN'],
    });

    const isFinancial = roles.createGroupGuard(['ACCOUNTING', 'PRINCIPAL']);

    class FinancialController {
      @isFinancial()
      list() { }
    }

    const guards = getGuardMetadata(FinancialController, 'list');

    expect(guards).toHaveLength(2);
    expect(guards[1]?.params).toEqual(['accounting', 'principal', 'admin']);
    expect(roles.hasRole('admin', 'ACCOUNTING')).toBe(true);
    expect(roles.isInGroup('admin', ['PRINCIPAL'])).toBe(true);
    expect(roles.hasRole('teacher', 'ACCOUNTING')).toBe(false);
  });
});
