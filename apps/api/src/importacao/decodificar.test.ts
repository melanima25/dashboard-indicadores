import { describe, expect, it } from 'vitest';
import { decodificarCsv, nomeSeguro } from './decodificar';

describe('decodificarCsv', () => {
  it('lê UTF-8', () => {
    expect(decodificarCsv(new TextEncoder().encode('atenção;ok'))).toBe('atenção;ok');
  });
  it('cai para Windows-1252 quando não é UTF-8 (Excel em português)', () => {
    // "atenção" em Windows-1252: ç = 0xE7, ã = 0xE3
    const bytes = Uint8Array.from([0x61, 0x74, 0x65, 0x6e, 0xe7, 0xe3, 0x6f]);
    expect(decodificarCsv(bytes)).toBe('atenção');
  });
});

describe('nomeSeguro', () => {
  it('tira caminho e caracteres de controle', () => {
    expect(nomeSeguro('C:\\temp\\semana 10.csv')).toBe('semana 10.csv');
    expect(nomeSeguro('../../etc/passwd\u0000.csv')).toBe('passwd.csv');
  });
  it('usa nome padrão quando vazio e limita o tamanho', () => {
    expect(nomeSeguro('')).toBe('upload.csv');
    expect(nomeSeguro(undefined)).toBe('upload.csv');
    expect(nomeSeguro('a'.repeat(500))).toHaveLength(200);
  });
});
