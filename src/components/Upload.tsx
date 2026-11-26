import { useRef, useState } from "react";
import { ExternalLink, FileUp, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PORTAL_URL } from "@/lib/format";
import { cn } from "@/lib/utils";

export function Upload({ busy, onFile }: { busy: boolean; onFile: (file: File) => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const pick = (files: FileList | null) => {
    const file = files?.[0];
    if (file) onFile(file);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Envie o extrato do PGDAS-D</CardTitle>
        <CardDescription className="space-y-2">
          <p>Onde baixar o extrato:</p>
          <ol className="list-decimal space-y-1 pl-5">
            <li>
              Acesse o{" "}
              <a
                href={PORTAL_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 font-medium text-foreground underline underline-offset-4"
              >
                portal do Simples Nacional
                <ExternalLink className="size-3.5" aria-hidden />
              </a>{" "}
              e entre no <strong>PGDAS-D</strong> com o CNPJ, o CPF do responsável e o código de acesso (ou com
              certificado digital).
            </li>
            <li>
              Em <strong>Consultar Declaração</strong>, escolha o ano e o último mês com faturamento.
            </li>
            <li>
              Baixe o <strong>Extrato</strong> desse mês, não a Declaração: é o PDF que começa com “Extrato do Simples
              Nacional”.
            </li>
          </ol>
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div
          role="button"
          tabIndex={0}
          aria-label="Escolher o arquivo PDF do extrato"
          onClick={() => !busy && input.current?.click()}
          onKeyDown={(event) => {
            if ((event.key === "Enter" || event.key === " ") && !busy) {
              event.preventDefault();
              input.current?.click();
            }
          }}
          onDragOver={(event) => {
            event.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(event) => {
            event.preventDefault();
            setDragging(false);
            if (!busy) pick(event.dataTransfer.files);
          }}
          className={cn(
            "flex cursor-pointer flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed px-6 py-12 text-center transition-colors outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
            dragging ? "border-primary bg-accent" : "border-input hover:bg-accent/50",
            busy && "cursor-wait opacity-70",
          )}
        >
          {busy ? (
            <Loader2 className="size-10 animate-spin text-muted-foreground" aria-hidden />
          ) : (
            <FileUp className="size-10 text-muted-foreground" aria-hidden />
          )}
          <p className="text-sm">
            {busy ? "Lendo o extrato…" : "Arraste o PDF para cá ou clique para escolher"}
          </p>
          <Button type="button" variant="outline" size="sm" disabled={busy} tabIndex={-1}>
            Escolher arquivo
          </Button>
          <input
            ref={input}
            type="file"
            accept="application/pdf,.pdf"
            className="hidden"
            onChange={(event) => {
              pick(event.target.files);
              event.target.value = "";
            }}
          />
        </div>
      </CardContent>
    </Card>
  );
}
