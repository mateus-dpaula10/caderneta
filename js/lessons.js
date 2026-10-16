// Trilha de micro-aulas. Conteúdo educativo, linguagem simples, sem recomendar produto específico.
// `personal(ctx)` devolve um trecho calculado com os dados da própria pessoa (ou null).
// ctx = { income, avgExpense, fmtBRL, fmtPct }  — valores em centavos.

export const DISCLAIMER =
  'Conteúdo educativo. Não é recomendação de investimento nem consultoria financeira. ' +
  'Regras, taxas e impostos mudam: confira sempre as condições vigentes antes de decidir.';

export const LESSONS = [
  {
    id: 'orcamento',
    icon: '🧾',
    title: 'Orçamento: para onde vai o seu dinheiro',
    minutes: 4,
    summary: 'Registrar, separar gastos fixos e variáveis e usar o método 50/30/20 como ponto de partida.',
    body: [
      {
        h: 'Primeiro, enxergar',
        html: `<p>Orçamento não é cortar tudo: é decidir antes para onde o dinheiro vai. O primeiro passo é
        registrar <strong>todas</strong> as entradas e saídas por um ou dois meses, inclusive o cafezinho e a
        taxa do aplicativo de entrega. Gastos pequenos e frequentes costumam ser os que mais surpreendem.</p>`,
      },
      {
        h: 'Fixos e variáveis',
        html: `<p><strong>Fixos</strong> se repetem com valor parecido todo mês (aluguel, internet, escola).
        <strong>Variáveis</strong> mudam conforme suas escolhas (mercado, lazer, delivery). É nos variáveis que
        você tem mais controle no curto prazo; nos fixos, a economia vem de renegociar ou trocar de plano.</p>`,
      },
      {
        h: 'O método 50/30/20',
        html: `<p>Uma divisão simples da renda líquida (o que cai na conta):</p>
        <ul>
          <li><strong>50% necessidades</strong>: moradia, contas, mercado, transporte, saúde.</li>
          <li><strong>30% desejos</strong>: lazer, restaurantes, compras, assinaturas.</li>
          <li><strong>20% futuro</strong>: reserva de emergência, investimentos e quitar dívidas.</li>
        </ul>
        <p>É um ponto de partida, não uma lei. Se a moradia já leva metade da renda, ajuste os outros grupos
        e vá melhorando aos poucos.</p>`,
      },
      {
        h: 'Pague-se primeiro',
        html: `<p>Em vez de guardar "o que sobrar", separe a parte do futuro logo que o dinheiro entrar.
        O que sobra no fim do mês costuma ser zero.</p>`,
      },
    ],
    personal: (ctx) => ctx.income > 0
      ? `Com a sua renda informada de <strong>${ctx.fmtBRL(ctx.income)}</strong>, o 50/30/20 sugere:
         ${ctx.fmtBRL(ctx.income * 0.5)} para necessidades, ${ctx.fmtBRL(ctx.income * 0.3)} para desejos e
         ${ctx.fmtBRL(ctx.income * 0.2)} para o futuro. Você pode aplicar isso em Planejar.`
      : null,
    takeaways: ['Registre tudo por pelo menos um mês.', 'Use 50/30/20 como ponto de partida.', 'Separe a parte do futuro assim que receber.'],
    quiz: [
      {
        q: 'No método 50/30/20, a parcela de 20% é destinada a quê?',
        options: ['Lazer e compras', 'Reserva, investimentos e quitar dívidas', 'Moradia e mercado'],
        answer: 1,
        explain: 'Os 20% são do "futuro": reserva de emergência, investimentos e pagamento de dívidas.',
      },
      {
        q: 'Qual destes é tipicamente um gasto variável?',
        options: ['Aluguel', 'Mensalidade da escola', 'Delivery de comida'],
        answer: 2,
        explain: 'Delivery muda de acordo com as suas escolhas no mês; aluguel e escola são fixos.',
      },
      {
        q: 'O que significa "pagar-se primeiro"?',
        options: ['Guardar o dinheiro do futuro assim que receber', 'Gastar com você antes de pagar as contas', 'Guardar o que sobrar no fim do mês'],
        answer: 0,
        explain: 'A ideia é tratar a poupança como uma conta a pagar no início do mês, não como sobra.',
      },
    ],
  },
  {
    id: 'reserva',
    icon: '🛟',
    title: 'Reserva de emergência',
    minutes: 4,
    summary: 'Quanto guardar, onde deixar e por que ela vem antes de investir para ganhar mais.',
    body: [
      {
        h: 'Para que serve',
        html: `<p>É o dinheiro para o imprevisto: perda de renda, conserto do carro, problema de saúde.
        Sem ela, qualquer susto vira dívida cara (cartão, cheque especial). Por isso, costuma ser a primeira
        meta financeira de quem está organizando a vida.</p>`,
      },
      {
        h: 'Quanto guardar',
        html: `<p>Uma referência comum é de <strong>3 a 6 meses do seu custo de vida</strong> (o que você gasta
        por mês, não o que ganha). Quem tem renda variável, é autônomo ou tem dependentes costuma mirar
        mais: 6 a 12 meses. Comece com uma meta menor, como um mês, e vá aumentando.</p>`,
      },
      {
        h: 'Onde deixar',
        html: `<p>A reserva precisa de três coisas, nesta ordem:</p>
        <ul>
          <li><strong>Segurança</strong>: baixo risco de perder valor.</li>
          <li><strong>Liquidez</strong>: poder sacar rápido, de preferência no mesmo dia ou no seguinte.</li>
          <li><strong>Rendimento</strong>: render pelo menos perto da inflação.</li>
        </ul>
        <p>Por isso, aplicações com resgate diário e baixo risco costumam ser usadas para esse fim (por
        exemplo, títulos públicos pós-fixados ou CDBs de liquidez diária). Ações e outros ativos que oscilam
        muito não combinam com reserva: o imprevisto pode chegar justo quando estão em baixa.</p>`,
      },
      {
        h: 'Usou? Reponha',
        html: '<p>Usar a reserva numa emergência é exatamente o objetivo. Depois, volte a reconstruí-la antes de outras metas.</p>',
      },
    ],
    personal: (ctx) => ctx.avgExpense > 0
      ? `Pelos seus lançamentos, você gasta em média <strong>${ctx.fmtBRL(ctx.avgExpense)}</strong> por mês.
         Uma reserva de 3 a 6 meses seria de ${ctx.fmtBRL(ctx.avgExpense * 3)} a ${ctx.fmtBRL(ctx.avgExpense * 6)}.`
      : null,
    takeaways: ['Mire 3 a 6 meses de gastos (mais se a renda for instável).', 'Priorize segurança e liquidez, depois rendimento.', 'Usou, reponha.'],
    quiz: [
      {
        q: 'A reserva de emergência deve ser calculada com base em quê?',
        options: ['No quanto você ganha por mês', 'No quanto você gasta por mês', 'No valor do seu maior sonho'],
        answer: 1,
        explain: 'O que importa é cobrir seu custo de vida por alguns meses, então a base é o gasto mensal.',
      },
      {
        q: 'Qual característica é a MENOS importante para a reserva?',
        options: ['Poder sacar rápido', 'Baixo risco', 'O maior rendimento possível'],
        answer: 2,
        explain: 'Rendimento importa, mas vem depois de segurança e liquidez.',
      },
      {
        q: 'Por que ações não são uma boa escolha para a reserva?',
        options: ['Porque podem estar em queda justo quando você precisar do dinheiro', 'Porque são proibidas para pessoa física', 'Porque não rendem nada'],
        answer: 0,
        explain: 'Ativos que oscilam muito podem forçar você a vender no prejuízo numa emergência.',
      },
    ],
  },
  {
    id: 'dividas',
    icon: '💳',
    title: 'Dívidas e juros: cartão e cheque especial',
    minutes: 5,
    summary: 'Por que o rotativo e o cheque especial são tão caros e como sair deles.',
    body: [
      {
        h: 'Os juros mais caros do mercado',
        html: `<p>O <strong>rotativo do cartão</strong> acontece quando você paga menos que o total da fatura: o
        restante vira dívida com juros. O <strong>cheque especial</strong> é o limite que deixa sua conta ficar
        negativa. Os dois estão historicamente entre as linhas de crédito mais caras do Brasil, com taxas que
        frequentemente passam de centenas por cento ao ano.</p>`,
      },
      {
        h: 'O que diz a regra hoje',
        html: `<ul>
          <li>O rotativo só pode durar até o vencimento da fatura seguinte. Depois disso, o banco precisa
          oferecer um parcelamento, normalmente com juros menores (regra do Conselho Monetário Nacional de 2017).</li>
          <li>Desde janeiro de 2024 (Lei 14.690/2023), os juros e encargos do rotativo e do parcelamento da
          fatura não podem passar de 100% do valor original da dívida.</li>
          <li>Os juros do cheque especial têm teto de 8% ao mês desde 2020.</li>
        </ul>
        <p>Mesmo com esses limites, continuam sendo dívidas muito caras.</p>`,
      },
      {
        h: 'Veja o efeito dos juros',
        html: `<p>Uma dívida de R$ 1.000 a 12% ao mês, sem nenhum pagamento, vira cerca de
        <strong>R$ 1.974 em 6 meses</strong>. É o juro composto trabalhando contra você.</p>`,
      },
      {
        h: 'Como sair',
        html: `<ul>
          <li><strong>Liste todas as dívidas</strong> com saldo, taxa de juros mensal e parcela.</li>
          <li><strong>Pare de aumentar</strong> a dívida: evite novas compras no cartão enquanto estiver no rotativo.</li>
          <li><strong>Ataque a mais cara primeiro</strong> (método avalanche) ou a menor primeiro, para ganhar
          ânimo (bola de neve). A avalanche economiza mais juros.</li>
          <li><strong>Troque dívida cara por barata</strong>: um empréstimo com juros menores (ou a portabilidade
          de crédito) pode quitar o rotativo. Compare sempre o <strong>CET</strong>, o Custo Efetivo Total, que
          inclui juros, tarifas, seguros e impostos.</li>
          <li><strong>Negocie</strong>: bancos e lojas fazem acordos, e há mutirões de renegociação. Reclamações
          podem ser registradas em consumidor.gov.br.</li>
        </ul>`,
      },
    ],
    personal: null,
    takeaways: ['Rotativo e cheque especial são emergência, nunca rotina.', 'Compare dívidas pelo CET.', 'Quite primeiro a dívida de juros mais altos.'],
    quiz: [
      {
        q: 'O que acontece quando você paga só o mínimo da fatura do cartão?',
        options: ['O restante é perdoado', 'O restante entra no rotativo, com juros altos', 'O cartão é cancelado automaticamente'],
        answer: 1,
        explain: 'O saldo não pago vira dívida no rotativo, uma das linhas de crédito mais caras.',
      },
      {
        q: 'Para comparar duas propostas de empréstimo, o melhor indicador é:',
        options: ['O valor da parcela', 'A taxa de juros anunciada', 'O CET (Custo Efetivo Total)'],
        answer: 2,
        explain: 'O CET inclui juros, tarifas, seguros e impostos. Uma parcela menor pode esconder um prazo muito maior.',
      },
      {
        q: 'No método avalanche, qual dívida você quita primeiro?',
        options: ['A de maior taxa de juros', 'A de menor saldo', 'A mais antiga'],
        answer: 0,
        explain: 'Atacar a maior taxa primeiro reduz o total de juros pagos.',
      },
    ],
  },
  {
    id: 'juros-compostos',
    icon: '🌱',
    title: 'Juros compostos: juros sobre juros',
    minutes: 4,
    summary: 'Como o tempo multiplica o dinheiro (ou a dívida) e a regra dos 72.',
    body: [
      {
        h: 'Simples x compostos',
        html: `<p>Nos <strong>juros simples</strong>, você ganha sempre sobre o valor inicial. Nos
        <strong>compostos</strong>, os juros de cada mês passam a render também. É assim que funcionam quase
        todas as aplicações e dívidas.</p>
        <p class="formula">Montante = Capital × (1 + taxa)<sup>tempo</sup></p>`,
      },
      {
        h: 'Um exemplo',
        html: `<p>R$ 1.000 a 1% ao mês por 12 meses viram cerca de <strong>R$ 1.126,83</strong>, e não R$ 1.120 como
        seria nos juros simples. A diferença parece pequena em um ano, mas cresce muito com o tempo.</p>`,
      },
      {
        h: 'O tempo é o ingrediente principal',
        html: `<p>Começar cedo, mesmo com pouco, costuma valer mais do que começar tarde com muito. Aportes
        mensais constantes somados aos juros compostos são a base de qualquer plano de longo prazo.</p>`,
      },
      {
        h: 'Regra dos 72',
        html: `<p>Uma conta de cabeça: divida 72 pela taxa <strong>anual</strong> em %. O resultado é,
        aproximadamente, quantos anos o dinheiro leva para dobrar. A 8% ao ano: 72 ÷ 8 ≈ 9 anos.
        Vale para dívidas também: a 12% ao mês, uma dívida dobra em cerca de 6 meses.</p>`,
      },
    ],
    personal: null,
    takeaways: ['Juros compostos rendem sobre os juros anteriores.', 'Tempo e constância pesam mais que o valor inicial.', 'Regra dos 72: 72 ÷ taxa ≈ tempo para dobrar.'],
    quiz: [
      {
        q: 'R$ 1.000 a 1% ao mês, juros compostos, depois de 12 meses resultam em aproximadamente:',
        options: ['R$ 1.120,00', 'R$ 1.126,83', 'R$ 1.200,00'],
        answer: 1,
        explain: '1.000 × 1,01¹² ≈ 1.126,83. Os R$ 1.120 seriam com juros simples.',
      },
      {
        q: 'Pela regra dos 72, a 6% ao ano o dinheiro dobra em cerca de:',
        options: ['6 anos', '12 anos', '72 anos'],
        answer: 1,
        explain: '72 ÷ 6 = 12 anos, aproximadamente.',
      },
      {
        q: 'Os juros compostos também atuam em:',
        options: ['Apenas investimentos', 'Dívidas, como o rotativo do cartão', 'Somente na poupança'],
        answer: 1,
        explain: 'Dívidas também crescem com juros sobre juros, e por isso ficam caras tão rápido.',
      },
    ],
  },
  {
    id: 'inflacao',
    icon: '🎈',
    title: 'Inflação e poder de compra',
    minutes: 3,
    summary: 'Por que o mesmo dinheiro compra menos com o tempo e o que é juro real.',
    body: [
      {
        h: 'O que é',
        html: `<p>Inflação é o aumento geral dos preços. Com 5% de inflação no ano, o que custava R$ 100 passa a
        custar R$ 105, ou seja, R$ 100 parados compram só cerca de <strong>R$ 95,24</strong> do que compravam antes.
        No Brasil, o índice oficial é o <strong>IPCA</strong>, medido pelo IBGE.</p>`,
      },
      {
        h: 'Quem controla',
        html: `<p>O Conselho Monetário Nacional define a meta de inflação e o Banco Central usa a taxa
        <strong>Selic</strong> para tentar cumpri-la. Selic mais alta tende a encarecer o crédito e esfriar os
        preços; mais baixa, o contrário.</p>`,
      },
      {
        h: 'Juro real',
        html: `<p>O que importa não é só quanto o dinheiro rende, mas quanto rende <strong>acima da inflação</strong>.</p>
        <p class="formula">Juro real = (1 + rendimento) ÷ (1 + inflação) − 1</p>
        <p>Rendendo 10% num ano com 4% de inflação, o ganho real é de cerca de 5,8%. Dinheiro parado na conta
        sem rendimento perde poder de compra todo ano.</p>`,
      },
    ],
    personal: null,
    takeaways: ['Inflação reduz o que o dinheiro compra.', 'IPCA é o índice oficial.', 'Compare rendimentos pelo ganho acima da inflação.'],
    quiz: [
      {
        q: 'Qual é o índice oficial de inflação no Brasil?',
        options: ['Selic', 'IPCA', 'CDI'],
        answer: 1,
        explain: 'O IPCA, calculado pelo IBGE. A Selic é a taxa básica de juros.',
      },
      {
        q: 'Rendendo 10% num ano em que a inflação foi 4%, o ganho real é de aproximadamente:',
        options: ['14%', '6%', '5,8%'],
        answer: 2,
        explain: '(1,10 ÷ 1,04) − 1 ≈ 5,77%. Subtrair direto (6%) é só uma aproximação.',
      },
      {
        q: 'Dinheiro guardado em casa, sem render nada, ao longo dos anos:',
        options: ['Mantém o poder de compra', 'Perde poder de compra', 'Ganha poder de compra'],
        answer: 1,
        explain: 'Com inflação positiva, o mesmo valor compra cada vez menos.',
      },
    ],
  },
  {
    id: 'investimentos',
    icon: '🏛️',
    title: 'Investimentos básicos: poupança, Tesouro e CDB',
    minutes: 6,
    summary: 'Como funcionam as aplicações de renda fixa mais conhecidas, seus riscos e impostos.',
    body: [
      {
        h: 'Antes de investir',
        html: `<p>A ordem que costuma fazer sentido: quitar dívidas caras, montar a reserva de emergência e só
        então pensar em objetivos mais longos. Nenhum rendimento compensa os juros de um rotativo.</p>`,
      },
      {
        h: 'Poupança',
        html: `<ul>
          <li>Rende 0,5% ao mês + TR quando a Selic está acima de 8,5% ao ano; quando está igual ou abaixo, rende 70% da Selic + TR.</li>
          <li>O rendimento é creditado no "aniversário" mensal do depósito.</li>
          <li>É isenta de Imposto de Renda para pessoa física e tem garantia do FGC.</li>
          <li>Ponto de atenção: em muitos períodos, rende menos que outras opções de baixo risco.</li>
        </ul>`,
      },
      {
        h: 'Tesouro Direto',
        html: `<p>Você empresta dinheiro ao governo federal comprando títulos públicos. Os principais tipos:</p>
        <ul>
          <li><strong>Tesouro Selic</strong>: acompanha a taxa Selic, oscila pouco e pode ser vendido antes do vencimento.</li>
          <li><strong>Tesouro Prefixado</strong>: taxa definida na compra.</li>
          <li><strong>Tesouro IPCA+</strong>: paga a inflação mais uma taxa fixa.</li>
        </ul>
        <p>Prefixado e IPCA+ sofrem <strong>marcação a mercado</strong>: se vender antes do vencimento, o valor
        pode ser maior ou menor que o esperado. Há Imposto de Renda sobre o lucro e taxa de custódia da B3
        (confira os valores atuais no site do Tesouro Direto). A garantia é do Tesouro Nacional.</p>`,
      },
      {
        h: 'CDB',
        html: `<p>Você empresta dinheiro a um banco. A rentabilidade costuma ser expressa em % do CDI
        (por exemplo, "100% do CDI"), que anda perto da Selic.</p>
        <ul>
          <li>Garantia do <strong>FGC</strong> até R$ 250 mil por CPF por instituição, com limite total de R$ 1 milhão a cada 4 anos.</li>
          <li>A liquidez varia: alguns permitem resgate diário, outros só no vencimento.</li>
          <li>O Imposto de Renda segue a tabela regressiva: 22,5% até 180 dias, 20% até 360, 17,5% até 720 e 15% acima disso. Resgates em menos de 30 dias também pagam IOF.</li>
        </ul>`,
      },
      {
        h: 'Risco, liquidez e rentabilidade',
        html: `<p>Todo investimento equilibra esses três pontos. Desconfie de qualquer oferta que prometa os três
        ao mesmo tempo, principalmente "rendimento alto garantido".</p>`,
      },
    ],
    personal: null,
    takeaways: ['Dívida cara e reserva vêm antes de investir.', 'Poupança é isenta de IR, mas costuma render menos.', 'Tesouro e CDB pagam IR regressivo; o CDB tem FGC, o Tesouro tem garantia do governo.'],
    quiz: [
      {
        q: 'Quem garante os títulos do Tesouro Direto?',
        options: ['O FGC', 'O Tesouro Nacional', 'A corretora'],
        answer: 1,
        explain: 'Títulos públicos são dívida do governo federal. O FGC cobre CDB e poupança, entre outros.',
      },
      {
        q: 'Um CDB resgatado com 400 dias paga qual alíquota de IR sobre o lucro?',
        options: ['22,5%', '17,5%', '15%'],
        answer: 1,
        explain: 'De 361 a 720 dias a alíquota é de 17,5% pela tabela regressiva.',
      },
      {
        q: 'O que é marcação a mercado?',
        options: ['Uma taxa cobrada pela corretora', 'A variação diária do preço do título se vendido antes do vencimento', 'O rendimento da poupança'],
        answer: 1,
        explain: 'Títulos prefixados e IPCA+ mudam de preço todo dia; quem vende antes do vencimento pode ganhar ou perder.',
      },
    ],
  },
  {
    id: 'consumo',
    icon: '🛍️',
    title: 'Consumo consciente',
    minutes: 3,
    summary: 'Ferramentas simples para comprar com intenção, sem culpa e sem impulso.',
    body: [
      {
        h: 'Quanto trabalho isso custa?',
        html: `<p>Converta o preço em horas de trabalho: divida a renda mensal pelas horas trabalhadas no mês.
        Um tênis de R$ 400, para quem ganha R$ 20 por hora, custa 20 horas de trabalho. A pergunta deixa de
        ser "cabe no cartão?" e vira "vale esse tempo?".</p>`,
      },
      {
        h: 'Espere antes de comprar',
        html: `<p>Para compras que não são necessidade, espere 24 a 48 horas. Se depois disso ainda fizer
        sentido, compre tranquilo. Muitas vezes a vontade passa.</p>`,
      },
      {
        h: '"Sem juros" nem sempre é sem custo',
        html: `<p>Se a loja dá desconto à vista, o parcelado "sem juros" embute juros. Use a calculadora
        <em>Custo real do parcelamento</em> para descobrir a taxa escondida. E lembre: parcelas somadas de
        várias compras comprometem os próximos meses.</p>`,
      },
      {
        h: 'Revise as assinaturas',
        html: '<p>Streaming, aplicativos, academia que você não frequenta: uma revisão a cada trimestre costuma liberar dinheiro sem mudar sua rotina.</p>',
      },
    ],
    personal: (ctx) => ctx.income > 0
      ? `Considerando 44 horas semanais (cerca de 190 horas por mês), cada hora da sua renda vale aproximadamente
         <strong>${ctx.fmtBRL(ctx.income / 190)}</strong>. Uma compra de R$ 300 equivale a
         ${Math.round(30000 / (ctx.income / 190))} horas de trabalho.`
      : null,
    takeaways: ['Pense no preço em horas de trabalho.', 'Espere 24 a 48h antes de compras por impulso.', 'Desconto à vista revela juros no "sem juros".'],
    quiz: [
      {
        q: 'Uma loja vende por R$ 900 à vista ou 10× de R$ 100 "sem juros". O que isso indica?',
        options: ['Que o parcelado é mais vantajoso', 'Que há juros embutidos no parcelado', 'Que os dois custam igual'],
        answer: 1,
        explain: 'Você paga R$ 1.000 em vez de R$ 900: há juros escondidos no parcelamento.',
      },
      {
        q: 'A "regra das 24 horas" serve para:',
        options: ['Pagar a fatura no prazo', 'Reduzir compras por impulso', 'Conseguir cashback'],
        answer: 1,
        explain: 'Dar um tempo antes de comprar ajuda a separar desejo passageiro de vontade real.',
      },
      {
        q: 'Ganhando R$ 25 por hora, um celular de R$ 2.000 custa quantas horas de trabalho?',
        options: ['50 horas', '80 horas', '200 horas'],
        answer: 1,
        explain: '2.000 ÷ 25 = 80 horas.',
      },
    ],
  },
  {
    id: 'golpes',
    icon: '🛡️',
    title: 'Golpes financeiros: como se proteger',
    minutes: 4,
    summary: 'Os golpes mais comuns no Pix, no WhatsApp e em falsos investimentos, e o que fazer se cair em um.',
    body: [
      {
        h: 'Os mais comuns',
        html: `<ul>
          <li><strong>Falso parente ou amigo</strong>: mensagem de "número novo" pedindo Pix urgente.</li>
          <li><strong>Falsa central do banco</strong>: ligação ou SMS sobre "compra suspeita" pedindo senha,
          código ou transferência para uma "conta segura".</li>
          <li><strong>Boleto ou link falso</strong>: cobranças por e-mail ou mensagem com dados de pagamento alterados.</li>
          <li><strong>Investimento milagroso</strong>: retorno alto e "garantido", pressa para entrar, bônus por indicar amigos
          (sinal típico de pirâmide).</li>
          <li><strong>Falsa venda</strong>: produto muito abaixo do preço em perfil recém-criado.</li>
        </ul>`,
      },
      {
        h: 'Regras de ouro',
        html: `<ul>
          <li>O banco <strong>nunca</strong> pede senha, código de verificação ou transferência para "proteger" seu dinheiro.</li>
          <li>Na dúvida, desligue e ligue você mesmo para o número oficial (o que está no cartão ou no app).</li>
          <li>Confirme pedidos de dinheiro por ligação de voz com a pessoa, usando o número antigo.</li>
          <li>Antes de pagar um boleto ou Pix, confira o nome e o CNPJ ou CPF de quem vai receber.</li>
          <li>Ofertas de investimento: confira se a empresa é autorizada pelo Banco Central ou pela CVM.</li>
        </ul>`,
      },
      {
        h: 'Caiu em um golpe?',
        html: `<ul>
          <li>Avise o seu banco imediatamente pelo canal oficial. No Pix, peça a devolução pelo
          <strong>MED (Mecanismo Especial de Devolução)</strong>: quanto antes, maior a chance de recuperar.</li>
          <li>Registre um boletim de ocorrência (muitos estados permitem pela internet).</li>
          <li>Troque senhas e avise seus contatos se sua conta de mensagem foi clonada.</li>
        </ul>`,
      },
    ],
    personal: null,
    takeaways: ['Banco não pede senha nem código.', 'Urgência e retorno garantido são sinais de alerta.', 'Golpe no Pix: banco + MED o quanto antes.'],
    quiz: [
      {
        q: 'Alguém liga dizendo ser do seu banco e pede o código que chegou por SMS. O que fazer?',
        options: ['Passar o código, já que é do banco', 'Desligar e ligar para o número oficial do banco', 'Passar só metade do código'],
        answer: 1,
        explain: 'Bancos não pedem códigos por telefone. Desligue e use o canal oficial.',
      },
      {
        q: 'Qual é um sinal típico de pirâmide financeira?',
        options: ['Rendimento garantido muito acima do mercado e bônus por indicação', 'Garantia do FGC', 'Rendimento atrelado ao CDI'],
        answer: 0,
        explain: 'Promessa de ganho alto e garantido, com bônus por trazer novas pessoas, é o padrão das pirâmides.',
      },
      {
        q: 'Você fez um Pix para um golpista. Qual é o primeiro passo?',
        options: ['Esperar alguns dias para ver se o dinheiro volta', 'Avisar o banco pelo canal oficial e pedir o MED', 'Fazer outro Pix para testar'],
        answer: 1,
        explain: 'O MED permite pedir a devolução, e a rapidez aumenta a chance de bloquear o valor na conta do golpista.',
      },
    ],
  },
];

export const lessonById = (id) => LESSONS.find((l) => l.id === id);
