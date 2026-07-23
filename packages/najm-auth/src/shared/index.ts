
import * as fs from 'fs/promises';
import * as path from 'path';
import _isEmpty from 'lodash.isempty';
import { Err } from 'najm-core';

export { AuthQueries } from './queries';

export const avatarsPath = path.join(process.cwd(), 'avatars');

export const parseSchema = async (schema, data) => {
  try {
    return await schema.parseAsync(data);
  } catch (error) {
    const errors = error.issues || error.errors || [];
    const errorMessage = errors
      .map(err => `${err.path.join('.')}: ${err.message}`)
      .join('; ');
    Err(errorMessage);
  }
};

export const clean = (obj: any): any => {
  const cleaned = {};

  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined && value !== '') {
      cleaned[key] = value;
    }
  }

  return cleaned;
}

export const getAvatarFile = async (fileName) => {
  try {
    const filePath = path.join(avatarsPath, fileName);
    const buffer: any = await fs.readFile(filePath);
    const file = new File([buffer], fileName, {
      type: 'image/png'
    });
    return file;
  }
  catch (error) {
    return null;
  }
}

export const formatDate = (dateValue) => {
  if (!dateValue) return null;

  let date: Date;

  if (dateValue instanceof Date) {
    date = dateValue;
  } else if (typeof dateValue === 'string') {
    date = new Date(dateValue);
  } else {
    return null;
  }

  if (isNaN(date.getTime())) return null;

  return date.toISOString().split('T')[0];
}

export function calculateAge(dateOfBirth) {
  if (!dateOfBirth) return null;

  const formattedDate = formatDate(dateOfBirth);
  if (!formattedDate) return null;

  const birth = new Date(formattedDate);
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();

  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age--;
  }

  return age;
}

export function calculateYearsOfExperience(hireDate) {
  if (!hireDate) return null;

  const formattedDate = formatDate(hireDate);
  if (!formattedDate) return null;

  const hire = new Date(formattedDate);
  const today = new Date();
  let years = today.getFullYear() - hire.getFullYear();
  const monthDiff = today.getMonth() - hire.getMonth();

  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < hire.getDate())) {
    years--;
  }

  return years;
}

export function pickProps<T>(source: T, keys): Partial<T> {
  const result = {};

  for (const key of keys) {
    if (source[key] !== undefined) {
      result[key] = source[key];
    }
  }

  return result;
}

export const isEmpty = _isEmpty;


export const isPath = (img) =>
  typeof img === 'string' && img.trim().length > 0 && (img.startsWith('/') || img.startsWith('http') || img.startsWith('storage/'));


export const isFile = (img) =>
  !!img && typeof img !== 'string' && img instanceof File;
