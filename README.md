# Caderneta — finanças pessoais + educação financeira (PWA)

App web instalável, em pt-BR, que junta **controle de ganhos e gastos** com **educação financeira**.
Os dados da pessoa alimentam as dicas e as lições (ex.: "gastos com lazer subiram 78% vs. mês passado",
"sua reserva cobre 0,5 mês de gastos — veja a lição Reserva de emergência").

- HTML + CSS + JavaScript puro (ES modules). **Sem build.** Dependências empacotadas em `js/vendor/`, ambas carregadas só
  quando usadas: o supabase-js (se a pessoa entrar numa conta) e o ExcelJS (se baixar ou importar a planilha do Excel).
- Offline-first: dados no aparelho (IndexedDB → fallback localStorage → memória com aviso) e service worker com cache do app.
- **Conta opcional** (Supabase, e-mail e senha) para sincronizar entre aparelhos. Sem conta, o app funciona como sempre e nada sai do aparelho.
- Instalável no Android, iOS e desktop (manifest + ícones SVG/PNG 192/512 + maskable + apple-touch-icon).
- Mobile-first, tema claro/escuro/automático, foco visível, rótulos em todos os campos, `prefers-reduced-motion` respeitado.

> Conteúdo educativo. Não é recomendação de investimento nem consultoria financeira.

## Como rodar

O service worker só funciona em `http://localhost`/`127.0.0.1` ou em HTTPS (abrir o `index.html` direto pelo
`file://` não registra o SW nem permite instalar). Use qualquer servidor estático na pasta do projeto:

```powershell
cd "C:\Users\Editing Sector 01\Desktop\Mateus\financas-pwa"
npx serve .            # ou: npx http-server . -p 8080
# ou, com Python instalado: python -m http.server 8080
```

Com o **Laragon**: copie/aponte a pasta para `C:\laragon\www\financas-pwa` e abra `http://localhost/financas-pwa/`
(todos os caminhos do app são relativos, então funciona em subpasta).

Para testar no celular na mesma rede, o navegador exige HTTPS para o service worker (exceto `localhost`).
Publique em qualquer hospedagem estática com HTTPS (Netlify, Vercel, GitHub Pages, Cloudflare Pages) ou use um túnel.

## Como instalar

- **Android (Chrome/Edge):** abra o site, toque em "Instalar app" no menu (ou no botão em Ajustes → Instalar no aparelho).
- **iPhone/iPad (Safari):** Compartilhar → "Adicionar à Tela de Início".
- **Desktop (Chrome/Edge):** ícone de instalar na barra de endereço, ou Ajustes → Instalar a Caderneta.

## Funcionalidades

**Gestão**
1. Lançamentos de receitas/despesas: valor, data, categoria, descrição, fixo/variável e **repetir todo mês**
   (as ocorrências são geradas automaticamente até o mês atual, sem duplicar; dá para parar a série).
   - **Despesa paga ou a pagar**: switch "Pago" no formulário (só em despesa; em despesa nova começa ligado se a data é
     hoje ou passada e desligado se é futura, e acompanha a data até a pessoa tocar nele) e um botão redondo em cada despesa
     da lista que alterna pago/a pagar com um toque, sem abrir o formulário. Despesa não paga leva o selo "A pagar";
     se a data já passou, "Atrasada". Filtro Todas / A pagar / Pagas em Lançamentos (só despesas). No Início:
     "A pagar no mês: R$ X (N contas)" e "Atrasadas: R$ Y", com atalho para a lista filtrada, e uma dica quando há
     contas atrasadas. Os totais (despesas, saldo, 50/30/20, orçamento) continuam contando todas as despesas, pagas ou não.
   - Regra única (`isPaid` em `js/finance.js`): o campo `paid` (boolean) só é gravado na despesa quando alguém decide;
     sem ele vale a data (hoje ou passada = paga, futura = a pagar). Por isso os dados antigos não precisaram de migração
     e as ocorrências geradas pela recorrência não levam o campo; marcar/editar uma ocorrência grava `paid` só nela.
   - **De onde saiu a despesa: salário ou cartão de crédito**: controle "Saiu do: Salário | Cartão de crédito" no
     formulário (só em despesa; em despesa nova começa com o último valor usado neste aparelho, guardado no
     `localStorage`; na 1ª vez, Salário). Na lista, despesa no cartão leva o selo "Cartão"; um seletor ao lado do de
     categoria filtra "Saiu do salário" / "No cartão" (só despesas). No Início, o card do mês mostra "Do salário R$ X ·
     No cartão R$ Y" (as duas somam as despesas do mês; totais e saldo não mudam).
   - Regra única (`paidWithOf` em `js/finance.js`): campo `paidWith` ('salario' | 'cartao') só em despesa; sem ele conta
     como salário (dados antigos não precisam de migração). Diferente de `paid`, é atributo fixo da conta: a série
     (recorrência) guarda `paidWith`, as ocorrências geradas herdam e "aplicar aos próximos meses" leva junto.
2. Categorias padrão editáveis (moradia, contas, mercado, transporte, saúde, educação, restaurantes, lazer,
   compras, assinaturas, dívidas, guardar e investir…), cada uma num grupo do 50/30/20. Categorias próprias são criadas
   em Ajustes → Categorias ou **direto no lançamento** (opção "+ Nova categoria…" no fim da lista de categorias: abre o
   formulário por cima do lançamento, já com o tipo dele; ao salvar, a categoria nova fica selecionada).
3. Visão mensal com navegação entre meses: saldo, receitas, despesas, gastos fixos, **régua 50/30/20 da renda**,
   gastos por categoria e gráfico dos últimos 6 meses (SVG próprio, com tabela acessível).
4. Orçamento por categoria com alerta (aviso ao lançar e nas dicas) e **sugestão automática pelo 50/30/20**
   proporcional ao histórico de gastos.
5. Metas de economia (reserva de emergência e outras) com progresso, prazo e "quanto guardar por mês";
   guardar/retirar pode gerar o lançamento correspondente.
   **Minhas dívidas** (Planejar): cada dívida com saldo, juros ao mês e parcela, na ordem do método avalanche (juros mais
   altos primeiro), com a previsão de quitação e o aviso de parcela que não cobre os juros. "Paguei" registra o pagamento
   (lançamento em "Dívidas e parcelas"). Por dentro, a dívida é uma meta com `kind: 'divida'` (`target` = quanto devia,
   `saved` = quanto já pagou, mais `rate` e `installment`): sincroniza, entra no backup e não precisa de mudança no banco.
6. Exportar/importar backup JSON (importação validada e atômica: arquivo inválido não altera nada).
7. **Planilha do Excel** (Lançamentos → Planilha, ou Ajustes → Planilha do Excel):
   - *Baixar planilha modelo (.xlsx)*: aba "Lançamentos" (Data, Tipo, Categoria, Descrição, Valor (R$), Natureza, Pago,
     Saiu do) com cabeçalho em negrito e congelado, data dd/mm/aaaa, valor em moeda e listas suspensas em Tipo, Categoria
     (as categorias da pessoa, da aba "Categorias"), Natureza, Pago (Sim/Não) e Saiu do (Salário/Cartão de crédito);
     aba "Como preencher". Sem linhas de exemplo.
   - Coluna **Pago** (opcional, só em despesa): aceita Sim/Não, S/N, Pago, X (sem diferença de maiúscula/acento) e
     VERDADEIRO/FALSO; vazia = regra da data (o campo não é gravado); em receita é ignorada.
   - Coluna **Saiu do** (opcional, só em despesa): aceita Salário/S e Cartão/Cartão de crédito/Crédito/C (sem diferença de
     maiúscula/acento); vazia = salário (o campo não é gravado); em receita é ignorada.
   - Planilhas sem as colunas opcionais continuam valendo (as colunas são achadas pelo cabeçalho). A prévia mostra quantas
     despesas entram como a pagar e quantas saíram no cartão.
   - *Importar planilha*: lê e valida tudo antes de gravar e mostra uma prévia (lançamentos a importar, categorias novas,
     linhas que já existem e linhas com erro, com número e motivo). Aceita data real do Excel ou texto dd/mm/aaaa, valor
     número ou texto ("1.234,56", "R$ 1.234,56"), Tipo/Natureza sem diferença de maiúscula/acento (Natureza vazia = Variável).
     Categoria casa pelo nome dentro do tipo; nome desconhecido vira categoria própria nova (ícone 🏷️, grupo "Desejos").
     Linhas iguais a lançamentos já existentes (data, tipo, valor, categoria e descrição; "Pago" e "Saiu do" não entram na comparação) são ignoradas: importar o mesmo
     arquivo duas vezes não duplica. A gravação é um lote atômico (`importTransactions` no `store.js`): um redesenho e
     tudo entra na fila de sincronização de uma vez. Limites: 10 MB por arquivo, 5.000 linhas por importação.

**Educação**
8. Trilha de 12 micro-aulas com quiz (3 perguntas cada): 8 de base (orçamento, reserva de emergência, dívidas e juros
   (rotativo/cheque especial), juros compostos, inflação, investimentos básicos (poupança, Tesouro Direto, CDB),
   consumo consciente e golpes financeiros) e 4 **lições de objetivo**, o passo a passo prático de cada objetivo
   (Organize as contas em 4 semanas, Reserva de emergência passo a passo, Plano para sair das dívidas, Antes do primeiro
   investimento). Algumas lições mostram um bloco "Com os seus números".
   **O conteúdo segue o objetivo da pessoa** (`settings.goal`, escolhido na apresentação inicial): a tela Aprender abre com
   "Para o seu objetivo: …", começando pela lição desse objetivo e seguindo pelas essenciais na ordem certa, com o
   progresso delas. Cada lição essencial abre com um bloco "No seu objetivo: …" (`goalNotes` em `js/lessons.js`) que liga
   o assunto ao objetivo e às telas do app. "Outras lições" fica recolhida (abre sozinha quando a trilha do objetivo
   termina; nada some). A lição recomendada (Aprender, Início e dicas) é a 1ª não concluída dessa ordem, e as dicas que
   apontam para lições fora das essenciais vão para depois das outras do mesmo tom.
   "Mudar objetivo" abre um seletor ali mesmo (o mesmo campo de Ajustes → Objetivo principal). O mapa objetivo → trilha
   fica em `GOAL_TRACKS` (`js/lessons.js`):
   - Organizar as contas: 4 semanas, orçamento, consumo consciente, dívidas, reserva | depois golpes, inflação, juros compostos, investimentos.
   - Reserva de emergência: passo a passo, reserva, orçamento, consumo consciente, inflação, investimentos | depois juros compostos, dívidas, golpes.
   - Sair das dívidas: plano, dívidas, orçamento, consumo consciente, golpes | depois reserva, juros compostos, inflação, investimentos.
   - Começar a investir: antes do primeiro investimento, juros compostos, inflação, reserva, investimentos, golpes | depois orçamento, consumo consciente, dívidas.
   (As lições de objetivo dos outros objetivos ficam no fim de "Outras lições".)
   Toda lição com passo prático termina em **"Faça agora"**, um botão que abre a tela que aplica o assunto (criar a meta
   da reserva, cadastrar as dívidas, aplicar o 50/30/20, fazer a revisão da semana…): `lessonAction` em `js/lessons.js`.
   **Perguntas que voltam** (`js/recall.js`): as perguntas dos quizzes de lições concluídas reaparecem no Início
   ("Pergunta para fixar") e na revisão da semana 1, 3, 7, 21 e 60 dias depois; errou, volta no dia seguinte.
   Ficam em `progress.recall`.
8b. **Painel do objetivo** no Início (`js/objective.js`): o objetivo vira um número que anda e um próximo passo. Reserva:
   quanto já guardou, quantos meses cobre e o próximo degrau (1, 3, 6 meses). Dívidas: quanto falta quitar, a prioridade e
   quando fica livre. Organizar e investir: checklist calculado do que a pessoa já fez no app (registro, contas fixas,
   limites, revisão; sem dívida cara, reserva de 3 meses, mês no azul, meta de investimento).
8c. **Revisão da semana** (`#/revisao`, fora do menu; aberta pelo Início, pelas lições e pelo lembrete): 4 passos em uns
   2 minutos: lançar o que faltou, marcar as contas atrasadas ou que vencem em 7 dias, ver o objetivo e responder as
   perguntas que voltaram. Conta "semanas seguidas" (semana de segunda a domingo; `progress.reviews`).
8d. **Lembretes no calendário** (Ajustes → Lembretes, e no fim da revisão): gera um `.ics` (`js/calendar.js`) com a revisão
   semanal (dia e hora à escolha), o dia do salário (com o que separar de acordo com o objetivo) e o vencimento das contas
   fixas e das a pagar nos próximos 60 dias (aviso um dia antes). Funciona em qualquer celular, sem servidor e sem conta.
9. Dicas contextuais geradas dos dados (déficit, contas atrasadas, orçamento estourado, categoria que subiu, peso das dívidas,
   reserva, metas com prazo, 50/30/20, sobra parada, hábito de registro).
10. Simuladores: juros compostos (com gráfico), tempo até a meta, custo real do parcelamento (juros embutidos
    no "sem juros") e quitação de dívida (detecta quando o pagamento não cobre os juros).
11. Onboarding (renda, objetivo, situação) que personaliza dicas e a lição recomendada e pode já criar
    renda recorrente, limites 50/30/20 e a meta de reserva.
12. Gamificação leve: sequência de dias registrando, semanas seguidas com revisão e 14 conquistas.

**Conta e sincronização (opcional)**
13. Ajustes → Conta e sincronização: criar conta, entrar, esqueci a senha, status (último sync, pendências,
    "Sincronizar agora"), sair (mantendo ou apagando os dados do aparelho) e excluir a conta (LGPD).

## Estrutura

```
financas-pwa/
├── index.html               # shell do app
├── manifest.webmanifest     # PWA (ícones, atalhos, cores)
├── sw.js                    # service worker (cache do app shell)
├── supabase/schema.sql      # banco no Supabase (tabelas, RLS, gatilho, exclusão de conta)
├── css/styles.css           # tokens de cor claro/escuro + layout mobile-first
├── icons/                   # icon.svg, icon-maskable.svg, 192/512/maskable PNG, apple-touch-icon
└── js/
    ├── app.js               # boot, rotas (#/inicio, #/lancamentos, #/planejar, #/aprender, #/ferramentas, #/ajustes, #/revisao)
    ├── app-shell.js         # tema, instalação, registro do SW
    ├── db.js                # IndexedDB (v2: + outbox, syncstate) / localStorage / memória
    ├── config.js            # URL e chave PÚBLICA do Supabase; caminhos das bibliotecas em vendor/
    ├── auth.js              # login/cadastro/senha (carrega o supabase-js sob demanda)
    ├── account.js           # fluxos da conta + bloco "Conta e sincronização" em Ajustes
    ├── sync.js              # motor de sincronização (push/pull, cursores, erros)
    ├── merge.js             # carimbos de tempo e junção do progresso (funções puras)
    ├── vendor/              # supabase-js 2.117.2 (UMD) e ExcelJS 4.4.0 (dist/exceljs.min.js), ambos licença MIT
    ├── store.js             # estado + operações (lançamentos, recorrência, metas, backup, importação em lote)
    ├── spreadsheet.js       # planilha .xlsx: monta o modelo, lê e valida a importação (funções puras)
    ├── finance.js           # cálculos de mês, 50/30/20, orçamento, reserva
    ├── insights.js          # dicas contextuais (dados → lições)
    ├── lessons.js           # conteúdo das micro-aulas e quizzes
    ├── objective.js         # painel do objetivo, dívidas (ordem avalanche), semanas de revisão (funções puras)
    ├── recall.js            # perguntas que voltam: repetição espaçada dos quizzes (funções puras)
    ├── calendar.js          # arquivo .ics dos lembretes (função pura)
    ├── calc.js              # simuladores (funções puras)
    ├── gamification.js      # sequência e conquistas
    ├── charts.js            # gráficos SVG sem dependência
    ├── ui.js, icons.js, utils.js
    └── views/               # home, transactions, txform, plan, learn, tools, settings, onboarding,
                             # category-form (criar/editar categoria), spreadsheet-dialog (baixar/importar planilha),
                             # review (revisão da semana), coach (painel do objetivo e pergunta para fixar), reminders
```

Valores monetários são guardados em **centavos inteiros** (sem erro de ponto flutuante). Datas são locais
(`AAAA-MM-DD`), sem conversão para UTC.

## Atualizar o app (deploy de nova versão)

O service worker serve os arquivos do cache. **Sempre que alterar qualquer arquivo, aumente `VERSION` em `sw.js`**
(e inclua arquivos novos na lista `SHELL`). Quem estiver com o app aberto verá "Nova versão disponível → Atualizar".

## Conta e sincronização (Supabase)

A conta é **opcional**. Sem login, nada muda: os dados ficam só no aparelho e a biblioteca do Supabase nem é carregada.

### Como funciona

- Cada store local (`meta`, `categories`, `transactions`, `recurrences`, `goals`) tem uma tabela igual no Supabase:
  `user_id`, `id`, `data` (o registro inteiro, JSON), `deleted`, `client_updated_at`, `server_updated_at`.
- Toda gravação local carimba `updatedAt` e entra numa fila (`outbox`, só no aparelho). Exclusão vira "lápide" (`deleted = true`).
  O vínculo com a conta, os cursores e o id do aparelho ficam na store local `syncstate`; a sessão fica no `localStorage`
  (`caderneta:auth`). Nada disso é sincronizado.
- Cada rodada: baixa o que mudou desde o último cursor (`server_updated_at`, com 30 s de margem), aplica sem pisar em alteração
  local mais nova, e envia a fila em lotes (upsert por `user_id,id`). Só sai da fila o que foi enviado e não mudou durante o envio.
  Em conflito vence a edição mais recente (`client_updated_at`, regra aplicada pelo gatilho do banco); o **progresso das lições é
  juntado** (dias de atividade, melhor nota, tentativas por aparelho, conquistas, dias de revisão da semana e, nas perguntas
  que voltam, a resposta mais recente de cada uma), nada se perde entre aparelhos.
- Recorrências: as ocorrências têm id fixo (`<série>:<AAAA-MM>`), então dois aparelhos não duplicam; a ocorrência gerada
  automaticamente leva o carimbo mais antigo possível, então qualquer edição ou exclusão feita em outro aparelho sempre vence.
  Meses apagados de uma série (`skipped`) são unidos entre aparelhos.
- Quando sincroniza: ao abrir o app, ao entrar na conta, quando a internet volta, ao voltar para o app e ~2 s depois de cada
  alteração. Sem internet, as alterações só se acumulam na fila. Um registro recusado pelo servidor (dado inválido) fica marcado
  e não trava os outros.
- Primeiro login num aparelho que já tem dados: o app pergunta se quer **juntar** (padrão, não apaga nada) ou **usar só os dados
  da conta** (apaga os deste aparelho; útil quando ele só tem o que a apresentação inicial criou).
- Com a conta conectada, "Apagar todos os dados" e "Importar backup" valem também para a conta (todos os aparelhos). Para limpar
  só um aparelho, use "Sair da conta" → apagar os dados deste aparelho.

### Configurar o projeto Supabase

1. **Banco:** Supabase → SQL Editor → New query → cole `supabase/schema.sql` → Run (idempotente; pode rodar de novo).
2. **Config do app:** `js/config.js` tem a URL do projeto e a chave **pública** (publishable). Nunca coloque ali a chave secreta
   (`service_role`/secret): ela ignora o RLS e daria acesso aos dados de todo mundo.
3. **Autenticação:** Authentication → Sign In / Providers → Email ligado, com "Confirm email" ligado.
4. **Endereços de retorno (obrigatório ao publicar):** Authentication → URL Configuration
   - **Site URL:** o endereço público do app (ex.: `https://caderneta.seudominio.com.br/`).
   - **Redirect URLs:** o mesmo endereço e os de teste, ex.: `https://caderneta.seudominio.com.br/**` e `http://localhost:3000/**`.
   Os links de confirmação e de "esqueci a senha" voltam para o endereço em que o app estava aberto; se ele não estiver nessa
   lista, o Supabase manda para o Site URL.
5. **E-mails:** o SMTP embutido do Supabase no plano grátis serve só para testes: envia pouquíssimos e-mails por hora, com
   remetente do Supabase (cai fácil no spam). Para uso real, configure um SMTP próprio em Authentication → Emails → SMTP Settings.
   Com o **Resend**: host `smtp.resend.com`, porta `465`, usuário `resend`, senha = uma API key do Resend (só com permissão de envio),
   remetente de um domínio verificado no Resend. Ali também dá para traduzir os modelos (Confirm signup, Reset password).
6. **Não deixar pausar:** o plano grátis pausa o projeto após ~7 dias sem uso. O workflow `.github/workflows/keepalive.yml`
   chama a função `ping()` (fim do `schema.sql`) toda segunda e quinta. Em GitHub → Settings → Secrets and variables → Actions,
   cadastre `SUPABASE_URL` e `SUPABASE_KEY` (a chave publishable). Para testar: Actions → Keep-alive Supabase → Run workflow.
   Se pausar mesmo assim: painel do Supabase → projeto → **Restore project**.

### Atualizar o supabase-js

Baixe a versão nova (`npm pack @supabase/supabase-js@<versão>`), copie `package/dist/umd/supabase.js` para
`js/vendor/supabase-js-<versão>.umd.js`, atualize `SUPABASE_LIB` em `js/config.js`, a lista `SHELL` e a `VERSION` do `sw.js`.
Versão atual: **2.117.2** (licença MIT em `js/vendor/LICENSE-supabase-js.txt`).

### Atualizar o ExcelJS

Numa pasta temporária vazia, fora do projeto: `npm pack exceljs@<versão>` e extraia o `.tgz`. Copie **só**
`package/dist/exceljs.min.js` para `js/vendor/exceljs-<versão>.min.js` (sem alterar o arquivo; ele termina com um comentário
`sourceMappingURL` para um `.map` que não é empacotado, então as ferramentas do navegador podem acusar um 404 inofensivo) e
`package/LICENSE` para `js/vendor/LICENSE-exceljs.txt`. Atualize `EXCELJS_LIB` em `js/config.js`, a lista `SHELL` e a
`VERSION` do `sw.js`, apague o arquivo da versão antiga e teste baixar o modelo e importar uma planilha.
Versão atual: **4.4.0** (licença MIT em `js/vendor/LICENSE-exceljs.txt`). O arquivo tem ~0,9 MB: é carregado só quando a
pessoa baixa ou importa uma planilha, mas está no `SHELL` (cache do service worker) para funcionar offline.

## Privacidade

- **Sem conta:** nada sai do aparelho. Não há analytics nem rastreadores.
- **Com conta (opcional):** uma cópia dos lançamentos, metas, categorias, perfil e progresso fica no Supabase (região São Paulo),
  ligada ao e-mail da pessoa e protegida por RLS (cada pessoa só lê e grava as próprias linhas; visitante sem login não acessa nada).
  A pessoa pode sair a qualquer momento e **excluir a conta e todos os dados do servidor** em Ajustes (função `delete_my_account`).
- O backup exportado contém dados financeiros pessoais — guarde-o em local seguro.
- A planilha do Excel é gerada e lida no próprio aparelho (nenhum arquivo é enviado a servidor). A planilha modelo leva os
  nomes das suas categorias; a preenchida, os seus lançamentos: trate as duas com o mesmo cuidado do backup.
