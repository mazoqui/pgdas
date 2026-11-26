import type { ReactNode } from "react";
import { AlertTriangle, CheckCircle2, Info } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { computeAnexo, CEILINGS, FATOR_R_ANEXO_III, type Anexo, type AnexoCheck } from "@/lib/anexos";
import { brl, brlReais, comma, pct, PORTAL_URL } from "@/lib/format";
import { RATE_TOLERANCE, type PgdasResult } from "@/lib/pgdas";

const ORDINAL = ["1ª", "2ª", "3ª", "4ª", "5ª", "6ª"];

function Step({ n, title, children }: { n: number; title: string; children: ReactNode }) {
  return (
    <section className="grid grid-cols-[2rem_1fr] gap-x-3 gap-y-2">
      <span className="flex size-8 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
        {n}
      </span>
      <h3 className="self-center font-semibold">{title}</h3>
      <div className="col-start-2 space-y-3 text-sm leading-relaxed text-muted-foreground [&_strong]:text-foreground">
        {children}
      </div>
    </section>
  );
}

/** A division written out: "numerador ÷ denominador = resultado". */
function Formula({ children }: { children: ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-md bg-muted px-3 py-2 font-mono text-[13px] text-foreground">{children}</div>
  );
}

function Rate({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="rounded-lg border bg-background p-4">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-1 text-4xl font-bold tabular-nums tracking-tight">{value}</p>
      <p className="mt-2 text-xs text-muted-foreground">{hint}</p>
    </div>
  );
}

const anexoFor = (result: PgdasResult): { anexo: Anexo; fatorR: number | null } | null => {
  const base = result.rbt12p ?? result.rbt12;
  const fatorR = base && result.payroll12 !== null ? result.payroll12 / base : null;
  if (result.anexo === "III" || result.anexo === "V") return { anexo: result.anexo, fatorR };
  if (result.anexo === null && fatorR !== null) return { anexo: fatorR >= FATOR_R_ANEXO_III ? "III" : "V", fatorR };
  return null;
};

export function Result({ result }: { result: PgdasResult }) {
  const ref = result.reference;
  const withheld = result.activities.filter((activity) => activity.withheld);
  const allDas = result.activities.reduce((sum, activity) => sum + activity.total, 0);
  const allIss = result.activities.reduce((sum, activity) => sum + activity.iss, 0);
  const year = Number(result.period.slice(3));

  const which = anexoFor(result);
  const base = result.rbt12p ?? result.rbt12;
  const check: AnexoCheck | null =
    which && base
      ? computeAnexo({ year, rbt12: base / 100, anexo: which.anexo, aboveSublimit: result.issOutside })
      : null;
  const agrees =
    check !== null &&
    Math.abs(check.total - result.totalExact) <= RATE_TOLERANCE &&
    Math.abs(check.iss - result.issExact) <= RATE_TOLERANCE;

  // The third step only exists when there is something to say about mixing activities.
  const extra = withheld.length > 0 || result.activities.length > 1 ? 1 : 0;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-xl">Alíquotas para as notas a partir de {result.from}</CardTitle>
          <CardDescription>
            {result.companyName && <>{result.companyName} · </>}CNPJ básico {result.companyCnpj} · Extrato do período de
            apuração {result.period}
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Rate
            label="Alíquota efetiva do Simples Nacional"
            value={pct(Number(result.total))}
            hint={
              result.issOutside
                ? "Tudo o que o DAS cobra, sem o ISS (que está fora do DAS)."
                : "Tudo o que o DAS cobra: tributos federais, CPP e ISS."
            }
          />
          {result.iss ? (
            <Rate
              label="Parcela do ISS dentro do Simples"
              value={pct(Number(result.iss))}
              hint="A alíquota de ISS a informar na nota quando o tomador retém o ISS."
            />
          ) : (
            <Rate
              label="Parcela do ISS dentro do Simples"
              value="—"
              hint="A empresa está impedida de recolher o ISS no DAS: o ISS é pago ao município pela alíquota dele."
            />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Como chegamos a esses números</CardTitle>
          <CardDescription>
            Nada foi estimado: os valores são os que o próprio extrato informa. A página só os lê, confere e divide.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-8">
          <Step n={1} title="O período e o mês em que as alíquotas valem">
            <p>
              O extrato é do período de apuração <strong>{result.period}</strong>. Pela LC 123/2006, art. 21, §4º, I, a
              nota fiscal usa a alíquota efetiva apurada <strong>no mês anterior ao da prestação</strong>. Por isso estas
              alíquotas valem para os serviços prestados a partir de <strong>{result.from}</strong>, até sair o extrato do
              mês seguinte.
            </p>
          </Step>

          <Step n={2} title="As atividades declaradas no período">
            <p>
              A receita bruta do período (RPA) é de <strong>{brl(result.declaredRevenue)}</strong>, dividida em{" "}
              {result.activities.length === 1 ? "uma atividade" : `${result.activities.length} atividades`}. Para cada uma
              o extrato mostra a receita e quanto o DAS cobrou, tributo por tributo:
            </p>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Atividade</TableHead>
                  <TableHead className="text-right">Receita</TableHead>
                  <TableHead className="text-right">ISS no DAS</TableHead>
                  <TableHead className="text-right">Total do DAS</TableHead>
                  <TableHead className="text-right">Total ÷ receita</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {result.activities.map((activity, index) => (
                  <TableRow key={index}>
                    <TableCell className="whitespace-normal">
                      <Badge variant={activity.withheld ? "secondary" : "default"} className="mb-1">
                        {activity.withheld ? "ISS retido pelo tomador" : "ISS no DAS"}
                      </Badge>
                      <p className="max-w-xs text-xs text-muted-foreground">{activity.description}</p>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{brl(activity.revenue)}</TableCell>
                    <TableCell className="text-right tabular-nums">{brl(activity.iss)}</TableCell>
                    <TableCell className="text-right tabular-nums">{brl(activity.total)}</TableCell>
                    <TableCell className="text-right tabular-nums">{pct(activity.totalRate)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
              {result.activities.length > 1 && (
                <TableFooter>
                  <TableRow>
                    <TableCell>Soma</TableCell>
                    <TableCell className="text-right tabular-nums">{brl(result.declaredRevenue)}</TableCell>
                    <TableCell className="text-right tabular-nums">{brl(allIss)}</TableCell>
                    <TableCell className="text-right tabular-nums">{brl(allDas)}</TableCell>
                    <TableCell />
                  </TableRow>
                </TableFooter>
              )}
            </Table>
            <p className="flex items-start gap-2">
              <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" aria-hidden />
              <span>
                Conferido: as receitas das atividades somam exatamente a RPA, e em cada atividade os tributos somam o total
                do DAS. Nenhuma atividade ficou de fora.
              </span>
            </p>
          </Step>

          {withheld.length > 0 && (
            <Step n={3} title="Por que a receita com ISS retido fica de fora">
              <p>
                Quando o tomador retém o ISS, ele não entra no DAS e aparece como R$ 0,00. Essa receita paga só a parte
                federal, então dividir o extrato inteiro daria um número menor que o verdadeiro:
              </p>
              <Formula>
                {brl(allDas)} ÷ {brl(result.declaredRevenue)} = {pct((allDas / result.declaredRevenue) * 100, 4)}{" "}
                <span className="text-muted-foreground">(errado: mistura receita com e sem ISS)</span>
              </Formula>
              <p>
                Por isso as alíquotas são lidas só na atividade em que o ISS está dentro do DAS. A receita retida foi
                conferida mesmo assim: ela foi tributada pela mesma alíquota, sem a parcela do ISS, então o extrato tem uma
                alíquota só.
              </p>
            </Step>
          )}

          {withheld.length === 0 && result.activities.length > 1 && (
            <Step n={3} title="Todas as atividades têm a mesma alíquota">
              <p>
                Cada atividade foi tributada pela mesma alíquota (diferença máxima de {comma(String(RATE_TOLERANCE))} ponto
                percentual, que vem só do arredondamento dos centavos no DAS). Por isso basta a primeira para o cálculo.
              </p>
            </Step>
          )}

          <Step n={3 + extra} title="A conta">
            <p>
              Na atividade com receita de <strong>{brl(ref.revenue)}</strong>, o DAS cobrou{" "}
              <strong>{brl(ref.total)}</strong>
              {result.iss && (
                <>
                  , dos quais <strong>{brl(ref.iss)}</strong> são ISS
                </>
              )}
              . A alíquota é o valor cobrado dividido pela receita:
            </p>
            <Formula>
              Simples: {brl(ref.total)} ÷ {brl(ref.revenue)} = {pct(ref.totalRate, 4)} →{" "}
              <strong>{pct(Number(result.total))}</strong>
            </Formula>
            {result.iss && (
              <Formula>
                ISS: {brl(ref.iss)} ÷ {brl(ref.revenue)} = {pct(ref.issRate, 4)} →{" "}
                <strong>{pct(Number(result.iss))}</strong>
              </Formula>
            )}
            <p>Os resultados são arredondados para duas casas decimais, como pedem os emissores de NFSe.</p>
            {result.issOutside && (
              <p>
                O extrato informa <strong>“Impedido de recolher ICMS/ISS no DAS: Sim”</strong>: a receita dos últimos 12
                meses passou do sublimite do Simples, então o ISS sai do DAS e é pago diretamente ao município, pela
                alíquota do município. Por isso não há parcela de ISS a informar, e a alíquota do Simples já vem sem ela.
              </p>
            )}
          </Step>

          <Step n={4 + extra} title="Para onde vai cada parte">
            <p>A mesma conta, tributo por tributo, mostra como a alíquota do Simples se divide:</p>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tributo</TableHead>
                  <TableHead className="text-right">Valor no DAS</TableHead>
                  <TableHead className="text-right">% da receita</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ref.taxes
                  .filter((tax) => tax.value > 0)
                  .map((tax) => (
                    <TableRow key={tax.name}>
                      <TableCell>{tax.name}</TableCell>
                      <TableCell className="text-right tabular-nums">{brl(tax.value)}</TableCell>
                      <TableCell className="text-right tabular-nums">{pct((tax.value / ref.revenue) * 100, 4)}</TableCell>
                    </TableRow>
                  ))}
              </TableBody>
              <TableFooter>
                <TableRow>
                  <TableCell>Total</TableCell>
                  <TableCell className="text-right tabular-nums">{brl(ref.total)}</TableCell>
                  <TableCell className="text-right tabular-nums">{pct(ref.totalRate, 4)}</TableCell>
                </TableRow>
              </TableFooter>
            </Table>
          </Step>

          <Step n={5 + extra} title="Conferência pela tabela do Simples">
            {check && which ? (
              <>
                <p>
                  Para ter certeza, refizemos a conta pelas tabelas da LC 123/2006, com os números do próprio extrato
                  {year >= 2027 && " (com as tabelas da LC 214/2025, que valem a partir de 2027)"}:
                </p>
                <ul className="list-disc space-y-1 pl-5">
                  <li>
                    Receita bruta dos 12 meses anteriores ({result.rbt12p ? "RBT12p, proporcionalizada" : "RBT12"}):{" "}
                    <strong>{brl(base!)}</strong>
                  </li>
                  {result.payroll12 !== null && (
                    <li>
                      Folha de salários dos 12 meses (FS12): <strong>{brl(result.payroll12)}</strong>
                    </li>
                  )}
                  {(result.fatorR || which.fatorR !== null) && (
                    <li>
                      Fator r = FS12 ÷ RBT12 = <strong>{result.fatorR ?? comma(which.fatorR!.toFixed(2))}</strong>,{" "}
                      {which.anexo === "III"
                        ? "28 % ou mais: a atividade é tributada pelo Anexo III"
                        : "abaixo de 28 %: a atividade é tributada pelo Anexo V"}
                    </li>
                  )}
                  <li>
                    RBT12 até {brlReais(CEILINGS[check.faixa - 1])}: <strong>{ORDINAL[check.faixa - 1]} faixa</strong>{" "}
                    do Anexo {check.anexo}, alíquota nominal de <strong>{pct(check.nominal)}</strong> e parcela a deduzir
                    de <strong>{brlReais(check.deduction)}</strong>
                  </li>
                </ul>
                <Formula>
                  ({brl(base!)} × {pct(check.nominal)} − {brlReais(check.deduction)}) ÷ {brl(base!)} ={" "}
                  {pct(check.effective, 4)}
                </Formula>
                {check.issShare !== null ? (
                  <>
                    <p>
                      Nessa faixa, o ISS é <strong>{pct(check.issShare)}</strong> da alíquota efetiva
                      {check.cap !== null && <>, limitado a {pct(check.cap)}</>}:
                    </p>
                    <Formula>
                      {pct(check.effective, 4)} × {pct(check.issShare)} = {pct(check.issRaw, 4)}
                      {check.capped && <> → limitado a {pct(check.cap!)}</>}
                    </Formula>
                    {check.outside && (
                      <p>
                        Como o ISS está fora do DAS, a alíquota do Simples fica sem essa parcela:{" "}
                        {pct(check.effective, 4)} − {pct(Math.min(check.issRaw, check.cap ?? Infinity), 4)} ={" "}
                        {pct(check.total, 4)}.
                      </p>
                    )}
                  </>
                ) : (
                  <p>Nessa faixa não há parcela de ISS no DAS: o ISS é pago diretamente ao município.</p>
                )}
                {agrees ? (
                  <Alert className="border-success/40">
                    <CheckCircle2 className="text-success" />
                    <AlertTitle>A tabela confere com o extrato</AlertTitle>
                    <AlertDescription>
                      Pela tabela: Simples {pct(check.total)}
                      {!check.outside && <>, ISS {pct(check.iss)}</>}. Pelo extrato: Simples{" "}
                      {pct(Number(result.total))}
                      {result.iss && <>, ISS {pct(Number(result.iss))}</>}.
                    </AlertDescription>
                  </Alert>
                ) : (
                  <Alert>
                    <AlertTriangle />
                    <AlertTitle>A tabela não bate exatamente com o extrato</AlertTitle>
                    <AlertDescription>
                      <p>
                        Pela tabela: Simples {pct(check.total)}
                        {!check.outside && <>, ISS {pct(check.iss)}</>}. Pelo extrato: Simples{" "}
                        {pct(Number(result.total))}
                        {result.iss && <>, ISS {pct(Number(result.iss))}</>}.
                      </p>
                      <p>
                        Vale o extrato: é o que a Receita Federal efetivamente cobrou. A diferença costuma vir de uma
                        atividade que não segue o Fator r, de receita de exportação ou de uma regra especial do município.
                        Se tiver dúvida, confirme com o seu contador.
                      </p>
                    </AlertDescription>
                  </Alert>
                )}
              </>
            ) : (
              <p>
                {which === null && result.anexo
                  ? `O extrato indica o Anexo ${result.anexo}. A conferência pela tabela só é feita para os Anexos III e V (atividades sujeitas ao Fator r); para os demais vale o que o extrato informa.`
                  : "O extrato não traz a receita dos 12 meses e a folha necessárias para refazer a conta pela tabela, então vale o que ele informa."}
              </p>
            )}
          </Step>
        </CardContent>
      </Card>

      <Alert>
        <Info />
        <AlertTitle>Como usar na NFSe</AlertTitle>
        <AlertDescription>
          <p>
            Informe a alíquota do Simples Nacional ({pct(Number(result.total))}) nas notas de serviços prestados a partir
            de {result.from}.
            {result.iss &&
              ` Quando o tomador reter o ISS, a alíquota do ISS na nota é a parcela do ISS (${pct(Number(result.iss))}).`}{" "}
            No mês seguinte, baixe o extrato novo no{" "}
            <a href={PORTAL_URL} target="_blank" rel="noopener noreferrer" className="text-foreground underline underline-offset-4">
              portal do Simples Nacional
            </a>{" "}
            e envie aqui: as alíquotas mudam conforme a receita dos últimos 12 meses.
          </p>
        </AlertDescription>
      </Alert>
    </div>
  );
}
