import { describe, expect, it } from 'vitest';
import { readJsonObject } from './request';

function requestWithBody(body: string) {
  return new Request('http://localhost', {
    method: 'POST',
    body,
  }) as never;
}

describe('readJsonObject', () => {
  it('reads JSON objects', async () => {
    await expect(readJsonObject(requestWithBody('{"battleId":"battle-1"}'))).resolves.toEqual({
      battleId: 'battle-1',
    });
  });

  it('rejects malformed JSON', async () => {
    await expect(readJsonObject(requestWithBody('{'))).rejects.toMatchObject({
      status: 400,
      message: 'JSON invalido',
    });
  });

  it('rejects non-object JSON bodies', async () => {
    await expect(readJsonObject(requestWithBody('[]'))).rejects.toMatchObject({
      status: 400,
      message: 'Corpo da requisicao invalido',
    });
  });
});
