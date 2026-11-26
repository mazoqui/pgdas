import { useState } from "react";
import { AlertCircle, RotateCcw, ShieldCheck } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Result } from "@/components/Result";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Upload } from "@/components/Upload";
import { ERROR_MESSAGES } from "@/lib/format";
import { extractPdfText } from "@/lib/pdf";
import { parsePgdas, PgdasError, type PgdasErrorCode, type PgdasResult } from "@/lib/pgdas";

type State =
  | { kind: "idle" }
  | { kind: "busy" }
  | { kind: "error"; code: PgdasErrorCode; fileName: string }
  | { kind: "done"; result: PgdasResult; fileName: string };

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

        <footer className="border-t pt-6 text-xs text-muted-foreground">
          Ferramenta informativa e gratuita. Os números vêm do extrato que você enviou; em caso de dúvida, confirme com o
          seu contador.
        </footer>
      </main>
    </div>
  );
}
