# Alíquotas do Simples Nacional pelo PGDAS-D

Página web gratuita, pública e sem login que lê o **Extrato do Simples Nacional** (PDF do PGDAS-D) e mostra:

- a **alíquota efetiva do Simples Nacional**, e
- a **parcela do ISS** dentro do Simples,

que a empresa informa na **nota fiscal de serviço (NFS-e)**. Junto com os números, a página traz a **explicação passo a
passo** de como cada um foi obtido e uma **conferência pelas tabelas da Lei Complementar 123/2006**.

Basta enviar o PDF. Não é preciso digitar nenhum outro dado.

> [!WARNING]
> **Este projeto pode conter erros.** Ele não é uma ferramenta oficial, não tem relação com a Receita Federal nem com o
> Comitê Gestor do Simples Nacional, e **não substitui a orientação de um contador**. A legislação do Simples Nacional
> muda com frequência, e a interpretação de alguns pontos depende do caso concreto. Antes de usar os números em
> documentos fiscais, **peça a um profissional de contabilidade que os valide**. Veja
> [Pontos que precisam de validação](#pontos-que-precisam-de-validação-contábil).

---

## Sumário

- [Privacidade: o arquivo não sai do seu computador](#privacidade-o-arquivo-não-sai-do-seu-computador)
- [Onde baixar o extrato do PGDAS-D](#onde-baixar-o-extrato-do-pgdas-d)
- [Como o cálculo é feito](#como-o-cálculo-é-feito)
- [Conferência pelas tabelas da LC 123/2006](#conferência-pelas-tabelas-da-lc-1232006)
- [Quando a página se recusa a dar um resultado](#quando-a-página-se-recusa-a-dar-um-resultado)
- [Base legal](#base-legal)
- [Fontes e referências](#fontes-e-referências)
- [Pontos que precisam de validação contábil](#pontos-que-precisam-de-validação-contábil)
- [Desenvolvimento](#desenvolvimento)
- [Licença](#licença)

---

## Privacidade: o arquivo não sai do seu computador

Todo o processamento acontece **no navegador**:

- o PDF é lido com o [pdf.js](https://mozilla.github.io/pdf.js/) na própria página, e o componente que faz a leitura
  é servido junto com o site, não por terceiros;
- **não há servidor, banco de dados, cadastro nem login**. O site é um conjunto de arquivos estáticos;
- a versão publicada tem uma _Content-Security-Policy_ (`connect-src 'self'`, `form-action 'none'`) que **impede o
  navegador de enviar dados para qualquer outro endereço**, mesmo que alguém tentasse;
- o único dado guardado no navegador é a preferência de tema (claro, escuro ou do sistema), em `localStorage`.

## Onde baixar o extrato do PGDAS-D

1. Acesse o **Portal do Simples Nacional**, em
   [Serviços → Simples Nacional](https://www8.receita.fazenda.gov.br/SimplesNacional/Servicos/Grupo.aspx?grp=5), e entre
   no **PGDAS-D** com o CNPJ, o CPF do responsável e o código de acesso (ou com certificado digital).
2. Em **Consultar Declaração**, escolha o ano e o último mês com faturamento.
3. Baixe o **Extrato** desse mês, não a Declaração. O arquivo certo começa com **“Extrato do Simples Nacional”**.

A página reconhece a Declaração e avisa quando ela é enviada no lugar do Extrato.

## Como o cálculo é feito

**Nada é estimado.** O extrato já informa quanto o DAS cobrou sobre cada receita, e as alíquotas são essas duas
informações divididas. O código está em [`src/lib/pgdas.ts`](src/lib/pgdas.ts).

### 1. Leitura e conferência do extrato

A página extrai o texto do PDF e localiza:

| Item do extrato | Uso |
| --- | --- |
| `Período de Apuração (PA)` | o mês a que o extrato se refere |
| `CNPJ Básico`, `Nome Empresarial` | identificação exibida no resultado |
| `Receita Bruta do PA (RPA)` | receita total do mês |
| `RBT12`, `RBT12p` (item 2.1) | receita dos 12 meses anteriores, para a conferência |
| `Total de Folhas de Salários Anteriores` (item 2.3.1) | folha dos 12 meses (FS12), para a conferência |
| `Fator r = … - Anexo …` (item 2.4) | o anexo que o próprio PGDAS-D aplicou |
| `2.5) Valores Fixos` | se o ISS é pago em valor fixo |
| `Impedido de recolher ICMS/ISS no DAS` | se o sublimite foi ultrapassado |
| `Valor do Débito por Tributo para a Atividade` | receita e tributos de cada atividade |

Antes de calcular, a página confere que:

- **em cada atividade, os tributos somam o total do DAS** daquela atividade;
- **as receitas das atividades somam exatamente a RPA**, ou seja, nenhuma atividade ficou de fora.

As colunas de tributos são lidas **pelo nome do cabeçalho, não pela posição**. A partir de 2027 a CBS e o IBS entram no
DAS (LC 214/2025), e a coluna do ISS muda de lugar.

### 2. Exclusão da receita com ISS retido

Quando o **tomador retém o ISS** (LC 123/2006, art. 21, §4º), o imposto não entra no DAS e aparece como R$ 0,00. Essa
receita paga só a parte federal, então dividir o extrato inteiro **subestimaria** as duas alíquotas. Por isso elas são
lidas apenas na atividade **sem retenção**, em que o ISS está dentro do DAS.

Exemplo real (extrato de 09/2026 com duas atividades):

| Atividade | Receita | ISS no DAS | Total do DAS | Total ÷ receita |
| --- | ---: | ---: | ---: | ---: |
| Sem retenção de ISS | R$ 38.355,49 | R$ 1.229,17 | R$ 6.469,32 | **16,87 %** |
| Com retenção de ISS | R$ 11.735,00 | R$ 0,00 | R$ 1.603,24 | 13,66 % |
| Extrato inteiro | R$ 50.090,49 | | R$ 8.072,56 | 16,12 % (errado) |

A receita retida é conferida mesmo assim: ela precisa ter sido tributada pela mesma alíquota, sem a parcela do ISS.

### 3. A conta

Na atividade sem retenção:

```
Alíquota efetiva do Simples = Total do DAS da atividade ÷ Receita da atividade
Parcela do ISS              = ISS no DAS da atividade   ÷ Receita da atividade
```

Os resultados são arredondados para duas casas decimais. Exemplo (Anexo V, 1ª faixa):

```
Simples: R$ 2.108,00 ÷ R$ 13.600,00 = 15,50 %
ISS:     R$   295,12 ÷ R$ 13.600,00 =  2,17 %
```

### 4. O mês em que as alíquotas valem

O extrato do período **M** gera as alíquotas das notas emitidas **a partir do mês M+1**. Na retenção do ISS, a nota deve
informar _“a alíquota efetiva de ISS a que a microempresa ou a empresa de pequeno porte estiver sujeita no mês anterior
ao da prestação”_ (LC 123/2006, art. 21, §4º, I). A alíquota do Simples segue o mesmo mês.

### 5. Sublimite

Se o extrato informa **“Impedido de recolher ICMS/ISS no DAS: Sim”**, a receita ultrapassou o sublimite de
R$ 3.600.000,00 (LC 123/2006, art. 19, §4º, e art. 20, §1º). O ISS sai do DAS e é pago ao município pela alíquota
municipal. A página então mostra a alíquota do Simples **sem** o ISS, e nenhuma parcela de ISS.

## Conferência pelas tabelas da LC 123/2006

Para dar mais segurança, a página refaz a conta pelas tabelas da lei usando os números do próprio extrato, e diz se
o resultado confere. O código está em [`src/lib/anexos.ts`](src/lib/anexos.ts). **Vale sempre o extrato**, que é o que a
Receita Federal efetivamente cobrou. A conferência só serve para mostrar de onde vêm os números e para detectar
situações incomuns.

### Fator r: Anexo III ou Anexo V

Para as atividades sujeitas ao fator r, entre elas várias profissões da saúde, como medicina e psicologia (LC 123/2006,
art. 18, §5º-B, XIX e XXI, e §5º-M) e os serviços do §5º-I:

```
Fator r = FS12 ÷ RBT12
```

- **FS12**: folha de salários dos 12 meses anteriores, incluídos encargos, INSS patronal, FGTS e pró-labore (art. 18,
  §24). Aluguéis e distribuição de lucros não entram (art. 18, §26).
- **Fator r ≥ 28 %**: Anexo III (art. 18, §5º-J). **Fator r < 28 %**: Anexo V (art. 18, §5º-M).

### Alíquota efetiva (art. 18, §1º-A)

```
Alíquota efetiva = (RBT12 × Alíquota nominal − Parcela a deduzir) ÷ RBT12
```

No início de atividade, a receita é proporcionalizada aos meses de atividade (art. 18, §2º). O extrato mostra esse valor
como **RBT12p**, e a página o usa quando ele existe.

### Tabelas vigentes até 2026 (LC 123/2006, com a redação da LC 155/2016)

**Anexo V**

| Faixa | RBT12 | Alíquota nominal | Parcela a deduzir | ISS na repartição |
| :---: | --- | ---: | ---: | ---: |
| 1ª | até R$ 180.000,00 | 15,50 % | – | 14,00 % |
| 2ª | de R$ 180.000,01 a R$ 360.000,00 | 18,00 % | R$ 4.500,00 | 17,00 % |
| 3ª | de R$ 360.000,01 a R$ 720.000,00 | 19,50 % | R$ 9.900,00 | 19,00 % |
| 4ª | de R$ 720.000,01 a R$ 1.800.000,00 | 20,50 % | R$ 17.100,00 | 21,00 % |
| 5ª | de R$ 1.800.000,01 a R$ 3.600.000,00 | 23,00 % | R$ 62.100,00 | 23,50 % |
| 6ª | de R$ 3.600.000,01 a R$ 4.800.000,00 | 30,50 % | R$ 540.000,00 | – |

**Anexo III**

| Faixa | RBT12 | Alíquota nominal | Parcela a deduzir | ISS na repartição |
| :---: | --- | ---: | ---: | ---: |
| 1ª | até R$ 180.000,00 | 6,00 % | – | 33,50 % |
| 2ª | de R$ 180.000,01 a R$ 360.000,00 | 11,20 % | R$ 9.360,00 | 32,00 % |
| 3ª | de R$ 360.000,01 a R$ 720.000,00 | 13,50 % | R$ 17.640,00 | 32,50 % |
| 4ª | de R$ 720.000,01 a R$ 1.800.000,00 | 16,00 % | R$ 35.640,00 | 32,50 % |
| 5ª | de R$ 1.800.000,01 a R$ 3.600.000,00 | 21,00 % | R$ 125.640,00 | 33,50 % (\*) |
| 6ª | de R$ 3.600.000,01 a R$ 4.800.000,00 | 33,00 % | R$ 648.000,00 | – |

(\*) _“O percentual efetivo máximo devido ao ISS será de 5%, transferindo-se a diferença, de forma proporcional, aos
tributos federais da mesma faixa de receita bruta anual.”_ (nota do Anexo III)

Na 6ª faixa não há ISS no DAS: acima do sublimite, o ISS é pago diretamente ao município.

```
Parcela do ISS = Alíquota efetiva × % do ISS na repartição da faixa   (limitada ao teto, quando houver)
```

Exemplo (Anexo V, 1ª faixa, RBT12 de R$ 175.511,38): alíquota efetiva de 15,50 % (na 1ª faixa não há parcela a deduzir),
e ISS de 15,50 % × 14,00 % = **2,17 %**. É exatamente o que o DAS cobrou.

### A partir de 2027 (reforma tributária)

A **LC 214/2025** (IBS, CBS e Imposto Seletivo), alterada pela **LC 227/2026**, muda os Anexos do Simples Nacional: a
CBS e o IBS passam a integrar o DAS, e a parcela do ISS diminui ano a ano até deixar de existir em 2033. A página usa:

| Ano do período | 6ª faixa (III / V) | Repartição do ISS | Teto do ISS (Anexo III, 5ª faixa) |
| --- | --- | --- | --- |
| até 2026 | 33,00 % / 30,50 % | tabela acima | 5,0 % |
| 2027–2028 | 32,90 % / 30,40 % | igual à atual | 5,0 % |
| 2029 | 33,00 % / 30,50 % | 90 % da atual | 4,5 % |
| 2030 | 33,00 % / 30,50 % | 80 % da atual | 4,0 % |
| 2031 | 33,00 % / 30,50 % | 70 % da atual | 3,5 % |
| 2032 | 33,00 % / 30,50 % | 60 % da atual | 3,0 % |
| 2033 em diante | – | sem ISS | – |

> [!CAUTION]
> Os valores de 2027 em diante **não foram conferidos diretamente no texto consolidado da LC 123/2006** e são os pontos
> com maior chance de erro deste projeto. Mesmo assim, **o resultado principal não depende deles**: ele vem sempre do
> extrato. Só a conferência usa essas tabelas.

## Quando a página se recusa a dar um resultado

Esses números vão para documentos fiscais, então a página **prefere não responder a arriscar um número errado**:

| Situação | Motivo |
| --- | --- |
| O arquivo não é um extrato do PGDAS-D (ou é digitalizado) | não há texto a ler |
| É a **Declaração**, não o Extrato | a declaração não traz o DAS por atividade |
| ISS em **valor fixo** (item 2.5; LC 123/2006, art. 18, §18) | o ISS não é um percentual da receita |
| Sem receita no período | não há DAS a dividir |
| As atividades não somam a RPA | alguma atividade não foi reconhecida |
| Toda a receita teve ISS retido | o extrato não mostra a parcela do ISS |
| Atividades com alíquotas diferentes | não existe uma alíquota única |
| ISS zerado sem retenção e sem impedimento | situação que precisa de análise (p.ex. isenção ou redução municipal, art. 18, §20) |

## Base legal

| Norma | O que define | Texto |
| --- | --- | --- |
| **Lei Complementar nº 123, de 14/12/2006** (Estatuto Nacional da Microempresa e da Empresa de Pequeno Porte) | Simples Nacional. Art. 18: RBT12 (§1º), alíquota efetiva (§1º-A), início de atividade (§2º), atividades e fator r (§§5º-B, 5º-I, 5º-J, 5º-K, 5º-M), ISS em valor fixo (§18), isenção ou redução municipal (§20), folha de salários (§§24 e 26). Arts. 19 e 20: sublimites. Art. 21, §4º: retenção do ISS. Anexos I a V. | [planalto.gov.br](https://www.planalto.gov.br/ccivil_03/leis/lcp/lcp123.htm) |
| **Lei Complementar nº 155, de 27/10/2016** | Reorganizou o cálculo do Simples a partir de 2018: alíquota efetiva com parcela a deduzir, novas tabelas dos Anexos, fator r. | [planalto.gov.br](https://www.planalto.gov.br/ccivil_03/leis/lcp/lcp155.htm) |
| **Lei Complementar nº 116, de 31/07/2003** | Normas gerais do ISS. Alíquota mínima de 2 % (art. 8º-A) e máxima de 5 % (art. 8º, II), que valem para empresas **fora** do Simples ou acima do sublimite. | [planalto.gov.br](https://www.planalto.gov.br/ccivil_03/leis/lcp/lcp116.htm) |
| **Lei Complementar nº 214, de 16/01/2025** | Reforma tributária do consumo: institui o IBS, a CBS e o Imposto Seletivo, com reflexos nos Anexos do Simples Nacional a partir de 2027. | [planalto.gov.br](https://www.planalto.gov.br/ccivil_03/leis/lcp/lcp214.htm) |
| **Lei Complementar nº 227, de 13/01/2026** | Institui o Comitê Gestor do IBS e altera, entre outras, a LC 123/2006. | [planalto.gov.br](https://www.planalto.gov.br/ccivil_03/leis/lcp/lcp227.htm) |
| **Resolução CGSN nº 140, de 22/05/2018** | Regulamento do Simples Nacional: cálculo, segregação de receitas, PGDAS-D, retenção do ISS. | [normas.receita.fazenda.gov.br](http://normas.receita.fazenda.gov.br/sijut2consulta/link.action?idAto=92278) |

### Por que a prefeitura não escolhe a alíquota do ISS no Simples

Fora do Simples Nacional, cada município fixa a alíquota do ISS por lei, entre 2 % e 5 % (LC 116/2003). **No Simples é
diferente**: o ISS é pago dentro do DAS, e o percentual vem da repartição prevista nos Anexos da LC 123/2006. O município
continua sendo o dono do imposto (no extrato aparece como _“Ente Federativo de Destino”_), mas não escolhe a alíquota.
Duas empresas no mesmo anexo e na mesma faixa pagam o mesmo percentual de ISS em qualquer cidade.

As exceções são o ISS em **valor fixo** (art. 18, §18), a **isenção ou redução** concedida por lei municipal (art. 18,
§20) e o **sublimite** (art. 20, §1º).

## Fontes e referências

- [Portal do Simples Nacional](https://www8.receita.fazenda.gov.br/SimplesNacional/): legislação, serviços e
  [PGDAS-D](https://www8.receita.fazenda.gov.br/SimplesNacional/Servicos/Grupo.aspx?grp=5)
- [Perguntas e Respostas do Simples Nacional (PDF)](https://www8.receita.fazenda.gov.br/SimplesNacional/Arquivos/manual/PerguntaoSN.pdf),
  manual oficial em formato de perguntas
- [Portal da NFS-e Nacional](https://www.gov.br/nfse/pt-br)
- Textos das leis no [Planalto](https://www.planalto.gov.br/ccivil_03/leis/lcp/lcp123.htm) (versões compiladas)

Na redação deste README, as tabelas dos Anexos III e V e os dispositivos citados foram conferidos com o texto da
LC 155/2016 publicado no Planalto. O cálculo também foi testado contra extratos reais do PGDAS-D, e o resultado bateu com
as tabelas nos dois casos verificados: Anexo V, 1ª faixa (15,50 % / 2,17 %), e Anexo V, 3ª faixa, com receita retida
(16,87 % / 3,20 %).

## Pontos que precisam de validação contábil

Este projeto foi escrito por desenvolvedores, não por contadores. **Revisões de profissionais de contabilidade são muito
bem-vindas.** Os pontos com maior chance de erro ou de interpretação discutível são:

1. **Mês de vigência:** usar as alíquotas do extrato de M nas notas de M+1. A lei fala expressamente da alíquota de ISS
   na retenção (art. 21, §4º, I). Aplicar o mesmo critério à alíquota total do Simples é uma convenção deste projeto.
2. **Tabelas de 2027 em diante** (LC 214/2025 e LC 227/2026): 6ª faixa, redução da repartição do ISS e tetos de 2029 a
   2032.
3. **Tolerância de 0,02 ponto percentual** ao comparar atividades, para absorver o arredondamento dos centavos no DAS.
4. **Primeiro mês de atividade:** a retenção usa 2 % (art. 21, §4º, II), e a página não trata esse caso de forma
   específica.
5. **Atividades fora do fator r**, ou dos Anexos I, II e IV: a página lê as alíquotas do extrato, mas só confere pelas
   tabelas dos Anexos III e V.
6. **Benefícios municipais** (isenção, redução ou valor fixo de ISS), exportação de serviços e outras particularidades
   que mudam o DAS.
7. **Leitura do PDF:** o leiaute do extrato pode mudar. A página recusa o que não reconhece, mas pode haver casos não
   previstos.

Encontrou um erro, ou tem uma referência melhor? Abra uma _issue_ ou um _pull request_ com a explicação e, se possível,
o dispositivo legal. **Nunca anexe extratos reais**: eles contêm CNPJ, nome e faturamento da empresa. Descreva os números
ou use valores fictícios.

## Desenvolvimento

Feito com [React](https://react.dev/), [TypeScript](https://www.typescriptlang.org/), [Vite](https://vite.dev/),
[Tailwind CSS](https://tailwindcss.com/), [shadcn/ui](https://ui.shadcn.com/) e [pdf.js](https://mozilla.github.io/pdf.js/).

Requer **Node.js 22** (veja [`.nvmrc`](.nvmrc)).

```bash
nvm use            # Node 22
npm install
npm run dev        # servidor de desenvolvimento
npm test           # testes (Vitest)
npm run lint       # oxlint
npm run build      # gera o site estático em dist/
npm run build:single  # gera tudo num único arquivo: dist-single/pgdas.html
npm run preview    # serve o dist/ localmente
```

Para rodar um único teste: `npx vitest run -t "withheld revenue"`.

| Caminho | Conteúdo |
| --- | --- |
| [`src/lib/pgdas.ts`](src/lib/pgdas.ts) | leitura e validação do extrato, cálculo das alíquotas |
| [`src/lib/anexos.ts`](src/lib/anexos.ts) | tabelas dos Anexos III e V e a conferência |
| [`src/lib/pdf.ts`](src/lib/pdf.ts) | extração do texto do PDF no navegador |
| [`src/components/Result.tsx`](src/components/Result.tsx) | resultado e explicação passo a passo |
| [`src/lib/pgdas.test.ts`](src/lib/pgdas.test.ts) | testes com extratos sintéticos |

O resultado de `npm run build` é um site estático, sem servidor, que pode ser publicado em qualquer hospedagem de
arquivos (GitHub Pages, Netlify, Cloudflare Pages etc.).

### Versão em arquivo único

`npm run build:single` gera **`dist-single/pgdas.html`**, um único arquivo HTML (cerca de 2 MB) com tudo dentro: o
código, os estilos, o leitor de PDF e o ícone. Ele funciona aberto direto do computador, com duplo clique e sem
internet, e pode ser enviado por e-mail ou guardado num pendrive.

Nessa versão a _Content-Security-Policy_ é ainda mais restrita: libera só os scripts que estão no próprio arquivo,
identificados pelo hash SHA-256, e **proíbe qualquer conexão** (`connect-src 'none'`). O leitor de PDF roda na própria
página, e não num _worker_ à parte, porque os navegadores não permitem iniciar esse _worker_ num arquivo aberto do disco.
Para um extrato de duas ou três páginas a diferença não é perceptível.

## Licença

Domínio público, sob [The Unlicense](LICENSE). Qualquer pessoa pode copiar, modificar, publicar, usar, vender e
distribuir este código, para qualquer finalidade e sem precisar pedir permissão ou dar crédito.

O software é fornecido **“como está”, sem garantia de nenhum tipo**. Os autores não se responsabilizam por decisões
tomadas com base nos resultados.
