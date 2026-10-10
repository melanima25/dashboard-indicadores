import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { enviarCsv } from '../api';
import { formatarData } from '../format';

/**
 * Importar um CSV semanal: a prévia roda sozinha ao escolher o arquivo e nunca grava.
 * Gravar exige a chave de administrador (na demo pública a gravação fica desligada).
 */
export function PainelImportacao() {
  const qc = useQueryClient();
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [chave, setChave] = useState('');

  const previa = useMutation({
    mutationFn: (f: File) => enviarCsv({ arquivo: f, gravar: false }),
  });
  const gravar = useMutation({
    mutationFn: (f: File) => enviarCsv({ arquivo: f, gravar: true, chave }),
    onSuccess: () => qc.invalidateQueries(), // tudo que a tela mostra é recarregado
  });

  const r = previa.data;
  const g = gravar.data;
  const semanaTexto = r?.semanaInicio ? formatarData(r.semanaInicio) : null;

  return (
    <section
      aria-labelledby="titulo-importacao"
      className="rounded-lg border border-border bg-surface p-5"
    >
      <h2 id="titulo-importacao" className="text-xl font-semibold">
        Importar CSV semanal
      </h2>
      <p className="mt-1 text-sm text-text-muted">
        Um arquivo por unidade e por semana. Se houver qualquer erro, o arquivo inteiro é rejeitado
        e nada é gravado. Exemplos na pasta <code>exemplos/</code> do repositório.
      </p>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="arquivo-csv" className="mb-1 block text-sm text-text-muted">
            Arquivo CSV
          </label>
          <input
            id="arquivo-csv"
            type="file"
            accept=".csv,text/csv"
            className="block w-full text-sm file:mr-3 file:rounded file:border file:border-border file:bg-bg file:px-3 file:py-1.5 file:text-text"
            onChange={(e) => {
              const f = e.target.files?.[0] ?? null;
              setArquivo(f);
              gravar.reset();
              if (f) previa.mutate(f);
              else previa.reset();
            }}
          />
        </div>
        <div>
          <label htmlFor="chave-admin" className="mb-1 block text-sm text-text-muted">
            Chave de administrador (só para gravar)
          </label>
          <input
            id="chave-admin"
            type="password"
            autoComplete="off"
            value={chave}
            onChange={(e) => setChave(e.target.value)}
            className="w-full rounded border border-border bg-bg px-3 py-2 text-text focus:border-accent"
          />
        </div>
      </div>

      <div aria-live="polite" className="mt-4 space-y-3" data-testid="resultado-importacao">
        {previa.isPending && <p role="status">Validando o arquivo...</p>}
        {previa.isError && (
          <p role="alert" className="text-warn">
            Não foi possível validar: {previa.error.message}
          </p>
        )}

        {r && r.status === 'rejeitada' && (
          <div role="alert" className="rounded border border-border p-4">
            <p className="font-semibold text-warn">
              Arquivo rejeitado: {r.linhasErro}{' '}
              {r.linhasErro === 1 ? 'linha com erro' : 'linhas com erro'}. Nada foi gravado.
            </p>
            <table className="mt-3 w-full text-left text-sm">
              <caption className="sr-only">Erros encontrados no arquivo</caption>
              <thead>
                <tr className="text-text-muted">
                  <th scope="col" className="py-1 pr-4 font-medium">
                    Linha
                  </th>
                  <th scope="col" className="py-1 pr-4 font-medium">
                    Campo
                  </th>
                  <th scope="col" className="py-1 font-medium">
                    Problema
                  </th>
                </tr>
              </thead>
              <tbody>
                {r.erros.map((e, i) => (
                  <tr key={`${e.linha}-${e.campo}-${i}`} className="border-t border-border">
                    <td className="py-1 pr-4 tabular-nums">{e.linha === 0 ? '—' : e.linha}</td>
                    <td className="py-1 pr-4">{e.campo ?? '—'}</td>
                    <td className="py-1">{e.mensagem}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {r && r.status === 'ok' && !g && (
          <div className="rounded border border-border p-4">
            <p className="font-semibold">
              Arquivo válido: {r.unidade}, semana de {semanaTexto}.
            </p>
            <p className="text-sm text-text-muted">
              Ao gravar: {r.inseridos} {r.inseridos === 1 ? 'lançamento novo' : 'lançamentos novos'}
              {r.substituidos > 0 ? `, ${r.substituidos} substituído(s)` : ''}.
            </p>
            {r.avisos.map((a) => (
              <p key={a} className="text-sm text-warn">
                Aviso: {a}
              </p>
            ))}
            <button
              type="button"
              disabled={!arquivo || gravar.isPending}
              onClick={() => arquivo && gravar.mutate(arquivo)}
              className="mt-3 rounded bg-accent px-4 py-2 font-medium text-accent-contrast disabled:opacity-60"
            >
              {gravar.isPending ? 'Gravando...' : 'Gravar importação'}
            </button>
          </div>
        )}

        {gravar.isError && (
          <p role="alert" className="text-warn">
            Não foi possível gravar: {gravar.error.message}
          </p>
        )}
        {g && g.status === 'ok' && (
          <p role="status" className="rounded border border-accent p-4">
            Importação gravada: {g.unidade}, semana de{' '}
            {g.semanaInicio ? formatarData(g.semanaInicio) : ''}. Os indicadores abaixo já foram
            atualizados.
          </p>
        )}
      </div>
    </section>
  );
}
