import { describe, expect, it } from 'vitest';

import {
  getSafeRedirectPath,
  isAllowedEmail,
  isPublicAuthPath,
  parseAllowedEmails,
} from '../apps/web/src/lib/auth/config';

describe('web auth config helpers', () => {
  it('parses and normalizes allowed emails', () => {
    expect(
      parseAllowedEmails(' netradesolution@gmail.com,SECOND@example.com,second@example.com ')
    ).toEqual(['netradesolution@gmail.com', 'second@example.com']);
  });

  it('matches allowed emails case-insensitively', () => {
    expect(
      isAllowedEmail('NETRADESOLUTION@GMAIL.COM', ['netradesolution@gmail.com'])
    ).toBe(true);
    expect(isAllowedEmail('nope@example.com', ['netradesolution@gmail.com'])).toBe(false);
  });

  it('classifies public auth paths', () => {
    expect(isPublicAuthPath('/login')).toBe(true);
    expect(isPublicAuthPath('/auth/callback')).toBe(true);
    expect(isPublicAuthPath('/dashboard')).toBe(false);
  });

  it('keeps redirects relative and safe', () => {
    expect(getSafeRedirectPath('/pipeline-status')).toBe('/pipeline-status');
    expect(getSafeRedirectPath('https://example.com')).toBe('/dashboard');
    expect(getSafeRedirectPath('//evil.example.com')).toBe('/dashboard');
  });
});
