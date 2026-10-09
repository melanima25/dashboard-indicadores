import { useQuery } from '@tanstack/react-query';
import { buscarUnidades } from './api';

export function App() {
  const { data, isPending, isError, error, refetch } = useQuery({
    queryKey: ['unidades'],
    queryFn: buscarUnidades,
  });

  return (
    <div className="mx-auto min-h-screen max-w-3xl px-4 py-10 sm:px-6">
      <a
        href="#conteudo"
        className="sr-only focus:not-sr-only focus:rounded focus:bg-accent focus:px-3 focus:py-2 focus:text-accent-contrast"
      >
        Pular para o conteúdo
      </a>
      <header className="mb-8">
        <p className="text-sm text-text-muted">Projeto de portfólio · dados fictícios</p>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard de indicadores</h1>
        <p className="mt-2 text-text-muted">
          Semana 1: base do projeto. A lista abaixo vem da API, que lê do PostgreSQL.
        </p>
      </header>

      <main id="conteudo">
        <section
          aria-labelledby="titulo-unidades"
          className="rounded-lg border border-border bg-surface p-5"
        >
          <h2 id="titulo-unidades" className="mb-4 text-xl font-semibold">
            Unidades
          </h2>

          {isPending && <p role="status">Carregando unidades...</p>}

          {isError && (
            <div role="alert" className="text-warn">
              <p>Não foi possível carregar as unidades: {error.message}</p>
              <button
                type="button"
                onClick={() => void refetch()}
                className="mt-3 rounded border border-border px-3 py-1.5 text-text hover:border-accent"
              >
                Tentar de novo
              </button>
            </div>
          )}

          {data && data.length === 0 && (
            <p>
              Nenhuma unidade cadastrada. Rode <code>npm run seed</code>.
            </p>
          )}

          {data && data.length > 0 && (
            <ul className="grid gap-2 sm:grid-cols-2" aria-label="Lista de unidades">
              {data.map((u) => (
                <li
                  key={u.id}
                  className="flex items-center justify-between rounded border border-border px-3 py-2"
                >
                  <span>{u.nome}</span>
                  <span className="text-sm text-accent">{u.ativa ? 'ativa' : 'inativa'}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </div>
  );
}
