import { describe, expect, it } from 'vitest';
import { getAvatarCanvasSize } from './avatar-upload';

describe('avatar upload helpers', () => {
  it('keeps small images unchanged', () => {
    expect(getAvatarCanvasSize(320, 240)).toEqual({ width: 320, height: 240 });
  });

  it('scales landscape images down to the max dimension', () => {
    expect(getAvatarCanvasSize(1600, 900)).toEqual({ width: 512, height: 288 });
  });

  it('scales portrait images down to the max dimension', () => {
    expect(getAvatarCanvasSize(900, 1600)).toEqual({ width: 288, height: 512 });
  });
});
