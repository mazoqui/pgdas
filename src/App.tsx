import { useState } from "react";
import { AlertCircle, RotateCcw, ShieldCheck } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Result } from "@/components/Result";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Upload } from "@/components/Upload";
import { ERROR_MESSAGES, REPO_URL } from "@/lib/format";
import { extractPdfText } from "@/lib/pdf";
import { parsePgdas, PgdasError, type PgdasErrorCode, type PgdasResult } from "@/lib/pgdas";

type State =
  | { kind: "idle" }
  | { kind: "busy" }
  | { kind: "error"; code: PgdasErrorCode; fileName: string }
  | { kind: "done"; result: PgdasResult; fileName: string };

/** GitHub's mark (lucide no longer ships brand icons). */
function GitHubMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" fill="currentColor" aria-hidden className={className}>
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
    </svg>
  );
}

export default function App() {
  const [state, setState] = useState<State>({ kind: "idle" });

  const read = async (file: File) => {
    setState({ kind: "busy" });
    try {
      const result = parsePgdas(await extractPdfText(file));
      setState({ kind: "done", result, fileName: file.name });
    } catch (error) {
      const code = error instanceof PgdasError ? error.code : "pgdas_unreadable";
      setState({ kind: "error", code, fileName: file.name });
    }
    window.scrollTo({ top: 0 });
  };

  const reset = () => setState({ kind: "idle" });

  return (
    <div className="min-h-dvh">
      <main className="mx-auto max-w-3xl space-y-6 px-4 py-10 sm:py-14">
        <header className="space-y-3">
          <div className="flex justify-end">
            <ThemeToggle />
          </div>
          <h1 className="text-3xl font-bold tracking-tight sm:text-3xl text-center">Alíquotas do Simples Nacional pelo PGDAS-D</h1>
          <p className="text-muted-foreground">
            Envie o extrato do PGDAS-D e veja a alíquota efetiva do Simples Nacional e a parcela do ISS para informar
            na nota fiscal de serviço, com a explicação passo a passo de como cada número foi obtido.
          </p>
          <p className="flex items-start gap-2 text-sm">
            <ShieldCheck className="mt-0.5 size-4 shrink-0 text-success" aria-hidden />
            <span>
              <strong>O arquivo não sai do seu computador.</strong> Ele é lido aqui mesmo, no navegador, e não é enviado
              nem guardado em lugar nenhum. Sem cadastro, sem login.
            </span>
          </p>
        </header>

        {(state.kind === "idle" || state.kind === "busy") && <Upload busy={state.kind === "busy"} onFile={read} />}

        {state.kind === "error" && (
          <>
            <Alert variant="destructive">
              <AlertCircle />
              <AlertTitle className="line-clamp-none">{ERROR_MESSAGES[state.code].title}</AlertTitle>
              <AlertDescription>
                <p>{ERROR_MESSAGES[state.code].detail}</p>
                <p className="text-xs">Arquivo: {state.fileName}</p>
              </AlertDescription>
            </Alert>
            <Upload busy={false} onFile={read} />
          </>
        )}

        {state.kind === "done" && (
          <>
            <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
              <span className="truncate">Arquivo: {state.fileName}</span>
              <Button variant="outline" size="sm" onClick={reset}>
                <RotateCcw /> Enviar outro extrato
              </Button>
            </div>
            <Result result={state.result} />
          </>
        )}

        <footer className="space-y-3 border-t pt-6 text-xs text-muted-foreground">
          <p>
            Ferramenta informativa e gratuita. Os números vêm do extrato que você enviou; em caso de dúvida, confirme com
            o seu contador.
          </p>
          <p className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <a
              href={REPO_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 font-medium text-foreground underline-offset-4 hover:underline"
            >
              <GitHubMark className="size-4" />
              Código aberto no GitHub
            </a>
            <a
              href={`${REPO_URL}/issues`}
              target="_blank"
              rel="noopener noreferrer"
              className="underline-offset-4 hover:underline"
            >
              Encontrou um erro? Avise aqui
            </a>
            <span>Domínio público (Unlicense)</span>
          </p>
        </footer>
      </main>
    </div>
  );
}
