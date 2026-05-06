import { describe, expect, it } from 'vitest';
import { USERNAME_CHECK_COLUMN_CLASS, USERNAME_CONTROL_HEIGHT_CLASS } from './profile-form-layout';

describe('profile form layout constants', () => {
  it('keeps username input and verify button on an aligned fixed-height row', () => {
    expect(USERNAME_CHECK_COLUMN_CLASS).toContain('_128px');
    expect(USERNAME_CONTROL_HEIGHT_CLASS).toBe('h-12');
  });
});
