import { describe, expect, it } from 'vitest';
import {
  extractApiKey,
  hasValidApiKey,
  normalizeApiKeyText
} from '@/pages/admina/components/aiAssistantKey';

describe('aiAssistantKey', () => {
  it('normalizes control and invisible chars', () => {
    const value = '\u200Bsk-proj-abcDEF_1234567890\u0000';
    expect(normalizeApiKeyText(value)).toBe('sk-proj-abcDEF_1234567890');
  });

  it('extracts api key from plain text input', () => {
    const value = 'sk-proj-pOXuDnB_rbRs_QPH21UB1GW0QE9OTdFX2zyljF4QZ30pQEBI5vVU3MEyflD571oyFX';
    expect(extractApiKey(value)).toBe(value);
  });

  it('extracts api key embedded in mixed text', () => {
    const key = 'sk-proj-abcdefghijklmnopqrstuvwxyzABCDEFGHIJKL_1234567890';
    const value = `OpenAI key:\n${key}\nusa questa`;
    expect(extractApiKey(value)).toBe(key);
  });

  it('extracts api key even with accidental spaces/newlines inside', () => {
    const value = 'sk-proj-abcde fghij\nklmno_pqrstuvwxyz1234567890ABCDE';
    expect(extractApiKey(value)).toBe('sk-proj-abcdefghijklmno_pqrstuvwxyz1234567890ABCDE');
  });

  it('returns empty when key is invalid', () => {
    expect(extractApiKey('no key here')).toBe('');
    expect(hasValidApiKey('no key here')).toBe(false);
  });
});
