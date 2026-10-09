/**
 * Excel em português costuma salvar CSV em Windows-1252, não em UTF-8. Tenta UTF-8 estrito e,
 * se o arquivo não for UTF-8 válido, cai para Windows-1252 em vez de mostrar "�" nas mensagens.
 */
export function decodificarCsv(bytes: ArrayBuffer | Uint8Array): string {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    return new TextDecoder('windows-1252').decode(bytes);
  }
}

/** Remove caminho e caracteres de controle do nome do arquivo antes de gravar/ecoar. */
export function nomeSeguro(nome: string | undefined | null): string {
  const base = (nome ?? '').split(/[\\/]/).pop() ?? '';
  const limpo = [...base]
    .filter((ch) => {
      const code = ch.charCodeAt(0);
      return code > 0x1f && code !== 0x7f;
    })
    .join('')
    .trim()
    .slice(0, 200);
  return limpo === '' ? 'upload.csv' : limpo;
}
