# Caderneta — finanças pessoais + educação financeira (PWA)

App web instalável, em pt-BR, que junta **controle de ganhos e gastos** com **educação financeira**.
Os dados da pessoa alimentam as dicas e as lições (ex.: "gastos com lazer subiram 78% vs. mês passado",
"sua reserva cobre 0,5 mês de gastos — veja a lição Reserva de emergência").

- HTML + CSS + JavaScript puro (ES modules). **Sem build.** Única dependência: o supabase-js empacotado em `js/vendor/` (só é carregado se a pessoa entrar numa conta).
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
2. Categorias padrão editáveis (moradia, contas, mercado, transporte, saúde, educação, restaurantes, lazer,
   compras, assinaturas, dívidas, guardar e investir…), cada uma num grupo do 50/30/20.
3. Visão mensal com navegação entre meses: saldo, receitas, despesas, gastos fixos, **régua 50/30/20 da renda**,
   gastos por categoria e gráfico dos últimos 6 meses (SVG próprio, com tabela acessível).
4. Orçamento por categoria com alerta (aviso ao lançar e nas dicas) e **sugestão automática pelo 50/30/20**
   proporcional ao histórico de gastos.
5. Metas de economia (reserva de emergência e outras) com progresso, prazo e "quanto guardar por mês";
   guardar/retirar pode gerar o lançamento correspondente.
6. Exportar/importar backup JSON (importação validada e atômica: arquivo inválido não altera nada).

**Educação**
7. Trilha de 8 micro-aulas com quiz (3 perguntas cada): orçamento, reserva de emergência, dívidas e juros
   (rotativo/cheque especial), juros compostos, inflação, investimentos básicos (poupança, Tesouro Direto, CDB),
   consumo consciente e golpes financeiros. Algumas lições mostram um bloco "Com os seus números".
8. Dicas contextuais geradas dos dados (déficit, orçamento estourado, categoria que subiu, peso das dívidas,
   reserva, metas com prazo, 50/30/20, sobra parada, hábito de registro).
9. Simuladores: juros compostos (com gráfico), tempo até a meta, custo real do parcelamento (juros embutidos
   no "sem juros") e quitação de dívida (detecta quando o pagamento não cobre os juros).
10. Onboarding (renda, objetivo, situação) que personaliza dicas e a lição recomendada e pode já criar
    renda recorrente, limites 50/30/20 e a meta de reserva.
11. Gamificação leve: sequência de dias registrando e 11 conquistas.

**Conta e sincronização (opcional)**
12. Ajustes → Conta e sincronização: criar conta, entrar, esqueci a senha, status (último sync, pendências,
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
    ├── app.js               # boot, rotas (#/inicio, #/lancamentos, #/planejar, #/aprender, #/ferramentas, #/ajustes)
    ├── app-shell.js         # tema, instalação, registro do SW
    ├── db.js                # IndexedDB (v2: + outbox, syncstate) / localStorage / memória
    ├── config.js            # URL e chave PÚBLICA do Supabase
    ├── auth.js              # login/cadastro/senha (carrega o supabase-js sob demanda)
    ├── account.js           # fluxos da conta + bloco "Conta e sincronização" em Ajustes
    ├── sync.js              # motor de sincronização (push/pull, cursores, erros)
    ├── merge.js             # carimbos de tempo e junção do progresso (funções puras)
    ├── vendor/              # supabase-js 2.117.2 (build UMD autocontido, licença MIT)
    ├── store.js             # estado + operações (lançamentos, recorrência, metas, backup)
    ├── finance.js           # cálculos de mês, 50/30/20, orçamento, reserva
    ├── insights.js          # dicas contextuais (dados → lições)
    ├── lessons.js           # conteúdo das micro-aulas e quizzes
    ├── calc.js              # simuladores (funções puras)
    ├── gamification.js      # sequência e conquistas
    ├── charts.js            # gráficos SVG sem dependência
    ├── ui.js, icons.js, utils.js
    └── views/               # home, transactions, txform, plan, learn, tools, settings, onboarding
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
  juntado** (dias de atividade, melhor nota, tentativas por aparelho, conquistas), nada se perde entre aparelhos.
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

### Atualizar o supabase-js

Baixe a versão nova (`npm pack @supabase/supabase-js@<versão>`), copie `package/dist/umd/supabase.js` para
`js/vendor/supabase-js-<versão>.umd.js`, atualize `SUPABASE_LIB` em `js/config.js`, a lista `SHELL` e a `VERSION` do `sw.js`.
Versão atual: **2.117.2** (licença MIT em `js/vendor/LICENSE-supabase-js.txt`).

## Privacidade

- **Sem conta:** nada sai do aparelho. Não há analytics nem rastreadores.
- **Com conta (opcional):** uma cópia dos lançamentos, metas, categorias, perfil e progresso fica no Supabase (região São Paulo),
  ligada ao e-mail da pessoa e protegida por RLS (cada pessoa só lê e grava as próprias linhas; visitante sem login não acessa nada).
  A pessoa pode sair a qualquer momento e **excluir a conta e todos os dados do servidor** em Ajustes (função `delete_my_account`).
- O backup exportado contém dados financeiros pessoais — guarde-o em local seguro.
