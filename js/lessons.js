// Trilha de micro-aulas. Conteúdo educativo, linguagem simples, sem recomendar produto específico.
// `personal(ctx)` devolve um trecho calculado com os dados da própria pessoa (ou null).
// ctx = { income, avgExpense, fmtBRL, fmtPct }  — valores em centavos.
// `goalNotes[objetivo]`: como a lição se liga àquele objetivo (aparece no topo da lição para quem o escolheu).
// `goal`: só nas lições de objetivo (uma por objetivo, abrem a trilha dele).

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
    goalNotes: {
      organizar: `Esta é a base do seu objetivo: organizar é saber para onde vai cada real. Os seus lançamentos são o
        registro, e o <strong>Orçamento do mês</strong>, em Planejar, dá um limite para cada categoria.`,
      reserva: `A reserva sai daqui: é a fatia dos 20% para o futuro. Separe a parcela da reserva assim que o salário
        cair, antes dos outros gastos (é o "pague-se primeiro").`,
      dividas: `O orçamento mostra a folga real do mês para pagar as dívidas. Enquanto houver dívida cara, os 20% do
        futuro e o que der para tirar dos desejos vão para quitar, começando pelos juros mais altos.`,
    },
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
    goalNotes: {
      organizar: `Com as contas organizadas, a reserva é o passo seguinte: ela impede que um imprevisto desfaça o que
        você arrumou. Comece com uma meta de um mês de gastos.`,
      reserva: `Esta lição é o seu objetivo em detalhe. Ao final, crie a meta em <strong>Planejar → Metas de
        economia</strong> com o valor calculado a partir dos seus gastos.`,
      investir: `Antes de investir para ganhar mais, a reserva precisa estar pronta: é ela que evita vender um
        investimento no prejuízo quando aparece um imprevisto.`,
    },
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
    goalNotes: {
      organizar: `Organizar as contas inclui não deixar a fatura virar rotativo. Marque o que já foi pago e o que está
        a pagar, e acompanhe o que saiu do cartão para a fatura não surpreender.`,
      dividas: `Esta é a lição central do seu objetivo. Depois dela, use a calculadora <strong>Custo de
        dívida</strong>, em Ferramentas, para ver quanto cada uma das suas dívidas custa de verdade.`,
    },
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
    goalNotes: {
      investir: `É o motor do seu objetivo: aportes constantes por muito tempo valem mais que um valor alto uma vez só.
        Simule em <strong>Ferramentas → Juros compostos</strong> com o valor que você consegue investir por mês.`,
    },
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
    goalNotes: {
      reserva: `Reserva parada na conta corrente perde valor todo ano. Por isso ela precisa render pelo menos perto da
        inflação, sem abrir mão de segurança e de poder sacar rápido.`,
      investir: `Ao comparar investimentos, olhe o ganho acima da inflação (o juro real). Um rendimento que parece alto
        pode ficar pequeno depois de descontar o IPCA.`,
    },
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
    goalNotes: {
      reserva: `Para a reserva, servem as opções de baixo risco e resgate diário desta lição. Prefixado e IPCA+ oscilam
        se vendidos antes do vencimento e combinam mais com objetivos longos.`,
      investir: `Esta é a lição central do seu objetivo. Repare como cada opção equilibra risco, liquidez e
        rentabilidade, e associe cada uma a um prazo: dinheiro de curto prazo pede liquidez; o de longo prazo aguenta oscilação.`,
    },
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
    goalNotes: {
      organizar: `Depois de registrar, os gastos variáveis são onde você ajusta mais rápido. Veja no Início quais
        categorias pesam mais e comece por elas.`,
      reserva: `Cada compra adiada ou assinatura cancelada é dinheiro que pode ir direto para a reserva. Experimente
        guardar na meta o valor que você deixou de gastar.`,
      dividas: `Enquanto estiver pagando dívidas, evite novas parcelas: elas disputam a mesma renda que precisa quitar
        o que já existe. A regra das 24 horas ajuda muito aqui.`,
    },
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
    goalNotes: {
      dividas: `Quem está endividado vira alvo de "empréstimo fácil" e "limpa nome" que pedem pagamento adiantado.
        Instituição séria não cobra taxa antes de liberar crédito: confira se ela é autorizada pelo Banco Central.`,
      investir: `Quem começa a investir é o alvo preferido de pirâmides e falsos gurus. Retorno alto e garantido não
        existe: confira sempre se a empresa é autorizada pela CVM ou pelo Banco Central.`,
    },
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

  // ---------- Lições de objetivo ----------
  // Uma por objetivo (`goal`), abre a trilha dele: o passo a passo prático, ligando o conteúdo às telas do app.
  {
    id: 'plano-organizar',
    goal: 'organizar',
    icon: '🗂️',
    title: 'Organize as contas em 4 semanas',
    minutes: 4,
    summary: 'Um roteiro de um mês para sair do "não sei para onde vai o dinheiro" e criar uma rotina que dura.',
    body: [
      {
        h: 'Semana 1: registre tudo',
        html: `<p>Lance no app <strong>todo</strong> dinheiro que entra e sai, inclusive Pix pequenos e taxas. Não
        tente mudar nada ainda: a meta da primeira semana é só enxergar. Contas que ainda vão vencer entram como
        <strong>a pagar</strong>; as que já saíram, como pagas.</p>`,
      },
      {
        h: 'Semana 2: separe fixos e cartão',
        html: `<p>Nas contas que se repetem (aluguel, internet, escola), marque <strong>Repetir todo mês</strong> e indique de onde
        cada despesa saiu: <strong>salário</strong> ou <strong>cartão</strong>. O que foi no cartão hoje é a fatura
        do mês que vem, e é aí que muita gente perde o controle.</p>`,
      },
      {
        h: 'Semana 3: dê um limite a cada categoria',
        html: `<p>Em Planejar, use o <strong>Orçamento do mês</strong> para definir quanto pode ir para mercado,
        lazer, delivery e o resto. O 50/30/20 serve de ponto de partida. Limite não é proibição: é o aviso de
        que está na hora de frear.</p>`,
      },
      {
        h: 'Semana 4: crie a rotina',
        html: `<p>Reserve 10 minutos por semana, sempre no mesmo dia, para lançar o que faltou, conferir as contas
        a pagar e ver quanto ainda cabe em cada categoria. Organização é hábito, não faxina de uma vez só.</p>`,
      },
    ],
    personal: (ctx) => ctx.income > 0
      ? `Com a sua renda de <strong>${ctx.fmtBRL(ctx.income)}</strong>, os 30% de desejos dão cerca de
         <strong>${ctx.fmtBRL(ctx.income * 0.3 / 4.3)}</strong> por semana. É um bom número para acompanhar na revisão semanal.`
      : null,
    takeaways: ['Primeiro enxergar, depois mudar.', 'Gasto no cartão hoje é fatura no mês que vem.', '10 minutos por semana mantêm tudo em dia.'],
    quiz: [
      {
        q: 'Qual é a meta da primeira semana de organização?',
        options: ['Cortar todos os gastos com lazer', 'Registrar tudo, sem tentar mudar nada ainda', 'Quitar todas as dívidas'],
        answer: 1,
        explain: 'Sem saber para onde o dinheiro vai, qualquer corte é chute. Primeiro vem o registro.',
      },
      {
        q: 'Por que vale anotar se a despesa saiu do salário ou do cartão?',
        options: ['Porque o que foi no cartão vira a fatura do mês seguinte', 'Porque o cartão sempre cobra juros', 'Porque o banco exige essa informação'],
        answer: 0,
        explain: 'Compras no cartão comprometem a renda do mês seguinte; separar ajuda a prever a fatura.',
      },
      {
        q: 'O que mantém as contas organizadas depois do primeiro mês?',
        options: ['Uma grande revisão por ano', 'Usar só dinheiro em espécie', 'Uma revisão curta toda semana'],
        answer: 2,
        explain: 'Poucos minutos com frequência evitam que os lançamentos se acumulem e o controle se perca.',
      },
    ],
  },
  {
    id: 'plano-reserva',
    goal: 'reserva',
    icon: '🧱',
    title: 'Reserva de emergência passo a passo',
    minutes: 4,
    summary: 'Do primeiro mês guardado até a reserva completa: alvo, aporte mensal, onde guardar e como não mexer.',
    body: [
      {
        h: '1. Calcule o alvo',
        html: `<p>Some quanto você gasta por mês (custo de vida, não renda) e multiplique por 3 a 6. Se o número
        assustar, divida em degraus: <strong>primeiro um mês</strong>, depois três, depois seis. Cada degrau
        alcançado já protege você de uma dívida cara.</p>`,
      },
      {
        h: '2. Transforme em parcela mensal',
        html: `<p>Escolha um prazo e divida: R$ 6.000 em 12 meses são R$ 500 por mês. Crie a meta em
        <strong>Planejar → Metas de economia</strong>: o app mostra quanto guardar por mês para chegar no prazo.
        Se a parcela não couber, aumente o prazo em vez de desistir.</p>`,
      },
      {
        h: '3. Guarde primeiro, gaste depois',
        html: `<p>Separe a parcela da reserva no dia em que o salário cair, antes de qualquer outro gasto. Se der,
        programe uma transferência automática. O que fica para "o fim do mês" costuma não existir.</p>`,
      },
      {
        h: '4. Deixe longe do dia a dia',
        html: `<p>Guarde numa aplicação segura e de resgate rápido, separada da conta que você usa para pagar
        contas. Defina antes o que é emergência (perda de renda, saúde, conserto essencial) e o que não é
        (promoção, viagem). Usou? Volte a repor antes de outras metas.</p>`,
      },
    ],
    personal: (ctx) => ctx.avgExpense > 0
      ? `Pelos seus lançamentos, o primeiro degrau (um mês) é de <strong>${ctx.fmtBRL(ctx.avgExpense)}</strong> e a reserva
         de 3 meses, de ${ctx.fmtBRL(ctx.avgExpense * 3)}. Para chegar nos 3 meses em um ano, guarde cerca de
         <strong>${ctx.fmtBRL(ctx.avgExpense * 3 / 12)}</strong> por mês.`
      : null,
    takeaways: ['Vá por degraus: 1 mês, 3 meses, 6 meses.', 'Alvo ÷ prazo = quanto guardar por mês.', 'Separe no dia do salário, numa conta à parte.'],
    quiz: [
      {
        q: 'Seu custo de vida é R$ 2.000 por mês. Qual é um bom primeiro degrau para a reserva?',
        options: ['R$ 2.000', 'R$ 24.000', 'R$ 500'],
        answer: 0,
        explain: 'Um mês de gastos é um primeiro degrau alcançável; depois vêm 3 e 6 meses.',
      },
      {
        q: 'Você quer juntar R$ 6.000 em 12 meses. Quanto precisa guardar por mês?',
        options: ['R$ 600', 'R$ 72.000', 'R$ 500'],
        answer: 2,
        explain: '6.000 ÷ 12 = 500 por mês.',
      },
      {
        q: 'Qual destas situações é um bom uso da reserva de emergência?',
        options: ['Uma promoção imperdível', 'Perder o emprego por alguns meses', 'Uma viagem de férias'],
        answer: 1,
        explain: 'A reserva cobre imprevistos que ameaçam o básico; desejos ganham metas próprias.',
      },
    ],
  },
  {
    id: 'plano-dividas',
    goal: 'dividas',
    icon: '🧯',
    title: 'Plano para sair das dívidas',
    minutes: 5,
    summary: 'Fazer a lista, parar de aumentar, escolher a ordem de pagamento e negociar sem cair em armadilha.',
    body: [
      {
        h: '1. Tire uma foto das dívidas',
        html: `<p>Liste todas: com quem, saldo devedor, juros ao mês, valor da parcela e se está em atraso. Não deixe
        nenhuma de fora, nem a do parente. O <strong>Registrato</strong>, do Banco Central, mostra de graça os
        empréstimos e financiamentos no seu CPF.</p>`,
      },
      {
        h: '2. Pare de aumentar',
        html: `<p>Enquanto houver rotativo ou cheque especial, evite novas compras no cartão e novos parcelamentos.
        Registre no app o que sai do cartão: assim você vê a fatura crescendo antes que ela chegue.</p>`,
      },
      {
        h: '3. Escolha a ordem',
        html: `<ul>
          <li>Primeiro, o essencial em dia: aluguel, água, luz, gás. Corte de serviço custa caro.</li>
          <li>Depois, a dívida de <strong>juros mais altos</strong> (avalanche), pagando o mínimo nas outras.</li>
          <li>Prefere ganhar ânimo? Quite a menor primeiro (bola de neve). Custa um pouco mais de juros, mas funciona
          para quem precisa ver resultado rápido.</li>
        </ul>`,
      },
      {
        h: '4. Negocie com cuidado',
        html: `<p>Bancos e lojas dão desconto para quitar à vista ou trocar dívida cara por uma parcela menor. Antes de
        aceitar, compare o <strong>CET</strong> e o total que você vai pagar, não só o valor da parcela. Desconfie
        de quem pede pagamento adiantado para "limpar o nome" ou liberar empréstimo.</p>`,
      },
      {
        h: '5. Crie um colchão pequeno',
        html: `<p>Um valor pequeno guardado, mesmo de algumas centenas de reais, evita que o próximo imprevisto vá
        para o cartão e desfaça o seu progresso.</p>`,
      },
    ],
    personal: (ctx) => ctx.income > 0
      ? `Uma referência comum é manter as parcelas de dívidas somadas abaixo de 30% da renda. Para a sua renda de
         ${ctx.fmtBRL(ctx.income)}, isso é até <strong>${ctx.fmtBRL(ctx.income * 0.3)}</strong> por mês. Acima disso,
         renegociar o prazo ou a taxa costuma ser o primeiro passo.`
      : null,
    takeaways: ['Liste tudo: saldo, juros, parcela, atraso.', 'Contas essenciais em dia, depois os juros mais altos.', 'Na negociação, compare o CET e o total pago.'],
    quiz: [
      {
        q: 'Qual é o primeiro passo de um plano para sair das dívidas?',
        options: ['Pegar um empréstimo novo', 'Listar todas as dívidas com saldo, juros e parcela', 'Pagar a mais antiga'],
        answer: 1,
        explain: 'Sem a lista completa não dá para escolher a ordem nem negociar bem.',
      },
      {
        q: 'Uma proposta reduz a sua parcela pela metade, mas dobra o prazo. O que conferir antes de aceitar?',
        options: ['Só o valor da parcela', 'A cor do boleto', 'O CET e o total que você vai pagar'],
        answer: 2,
        explain: 'Parcela menor com prazo maior pode sair bem mais cara no total.',
      },
      {
        q: 'Alguém promete "limpar seu nome" se você pagar uma taxa antes. Isso é:',
        options: ['Um sinal típico de golpe', 'O procedimento normal dos bancos', 'Exigência do Banco Central'],
        answer: 0,
        explain: 'Instituições sérias não cobram adiantado para liberar crédito ou renegociar.',
      },
    ],
  },
  {
    id: 'plano-investir',
    goal: 'investir',
    icon: '🧭',
    title: 'Antes do primeiro investimento',
    minutes: 5,
    summary: 'O checklist de largada, objetivo e prazo, perfil de risco e como começar simples e constante.',
    body: [
      {
        h: 'Checklist de largada',
        html: `<ul>
          <li><strong>Sem dívida cara</strong>: nenhum investimento seguro rende mais que os juros do rotativo.</li>
          <li><strong>Reserva de emergência</strong> pronta ou bem encaminhada.</li>
          <li><strong>Sobra mensal</strong> conhecida: os seus lançamentos mostram quanto dá para investir sem apertar.</li>
        </ul>`,
      },
      {
        h: 'Cada dinheiro tem um prazo',
        html: `<p>Antes de escolher onde investir, pergunte <strong>para quê</strong> e <strong>para quando</strong>.
        Dinheiro para daqui a um ano pede segurança e liquidez; para daqui a 10 anos, aguenta mais oscilação.
        Um objetivo com valor e data também vira meta em Planejar.</p>`,
      },
      {
        h: 'Conheça o seu perfil',
        html: `<p>Bancos e corretoras aplicam um questionário de perfil (conservador, moderado, arrojado). Responda com
        sinceridade: a pergunta-chave é como você reagiria vendo o investimento cair 10% num mês.</p>`,
      },
      {
        h: 'Comece simples e constante',
        html: `<p>Um valor fixo todo mês, em aplicações que você entende, vale mais que tentar acertar o momento certo.
        Com o tempo, dá para diversificar. Fique de olho nos custos: taxa de administração, custódia e Imposto de
        Renda comem parte do rendimento.</p>`,
      },
    ],
    personal: (ctx) => {
      if (!(ctx.income > 0)) return null;
      // Exemplo ilustrativo: 10% da renda por mês, 120 meses, 0,5% ao mês (valor futuro de aportes mensais).
      const monthly = ctx.income * 0.1;
      const total = monthly * ((1.005 ** 120 - 1) / 0.005);
      return `Investindo 10% da sua renda (${ctx.fmtBRL(monthly)}) todo mês por 10 anos, a 0,5% ao mês, você teria
        cerca de <strong>${ctx.fmtBRL(total)}</strong>, tendo aportado ${ctx.fmtBRL(monthly * 120)}. É só um exemplo
        para mostrar o efeito do tempo, não uma promessa de rendimento.`;
    },
    takeaways: ['Dívida cara e reserva vêm antes.', 'O prazo do objetivo define o tipo de investimento.', 'Constância e custos baixos pesam mais que acertar o momento.'],
    quiz: [
      {
        q: 'Você tem saldo no rotativo do cartão e R$ 1.000 sobrando. O que costuma fazer mais sentido?',
        options: ['Investir os R$ 1.000', 'Quitar o rotativo', 'Deixar parado na conta'],
        answer: 1,
        explain: 'Os juros do rotativo são muito maiores que o rendimento de qualquer investimento seguro.',
      },
      {
        q: 'Para um dinheiro que você vai usar daqui a um ano, o mais importante é:',
        options: ['Segurança e liquidez', 'O maior rendimento possível', 'Ativos que oscilam bastante'],
        answer: 0,
        explain: 'No curto prazo não há tempo para recuperar uma queda; segurança vem primeiro.',
      },
      {
        q: 'Qual hábito costuma dar mais resultado para quem está começando?',
        options: ['Esperar o momento perfeito para entrar', 'Seguir dicas de grupos de mensagem', 'Investir um valor fixo todo mês'],
        answer: 2,
        explain: 'Aportes constantes somados aos juros compostos são a base de qualquer plano de longo prazo.',
      },
    ],
  },
];

export const lessonById = (id) => LESSONS.find((l) => l.id === id);

// ---------- Faça agora ----------
// O passo prático no fim da lição: leva direto à tela que aplica o que foi ensinado. Recebe o estado do app
// (para escolher entre criar e continuar) e devolve { label, href }; lição sem ação não aparece no mapa.
const reserveAction = (s) => (s.goals.some((g) => g.kind === 'reserva')
  ? { label: 'Guardar na reserva agora', href: '#/planejar?guardar=reserva' }
  : { label: 'Criar a meta da reserva', href: '#/planejar?nova-meta=reserva' });
const debtAction = (s) => (s.goals.some((g) => g.kind === 'divida')
  ? { label: 'Ver a ordem de pagamento', href: '#/planejar?ver=dividas' }
  : { label: 'Cadastrar minhas dívidas', href: '#/planejar?nova-divida=1' });
const LESSON_ACTIONS = {
  orcamento: (s) => {
    if (!(s.settings.income > 0)) return { label: 'Informar minha renda', href: '#/ajustes' };
    return s.categories.some((c) => c.type === 'expense' && c.budget > 0)
      ? { label: 'Ver meus limites do mês', href: '#/planejar' }
      : { label: 'Aplicar o 50/30/20 nos meus limites', href: '#/planejar?sugerir=1' };
  },
  reserva: reserveAction,
  'plano-reserva': reserveAction,
  dividas: debtAction,
  'plano-dividas': debtAction,
  'plano-organizar': () => ({ label: 'Fazer a revisão da semana', href: '#/revisao' }),
  consumo: () => ({ label: 'Ver meus gastos por categoria', href: '#/inicio' }),
  'juros-compostos': () => ({ label: 'Simular com o valor que consigo investir', href: '#/ferramentas' }),
  investimentos: () => ({ label: 'Simular um investimento', href: '#/ferramentas' }),
  'plano-investir': () => ({ label: 'Criar a meta do primeiro investimento', href: '#/planejar?nova-meta=investir' }),
};

/** Ação "Faça agora" da lição ({ label, href }) ou null. */
export const lessonAction = (lesson, state) => LESSON_ACTIONS[lesson.id]?.(state) || null;

// ---------- Trilha por objetivo ----------
// O objetivo vem de settings.goal (os mesmos de GOAL_TYPES em js/finance.js: escolhido na apresentação inicial,
// editável em Ajustes ou no próprio Aprender). `essentials`: as lições essenciais para o objetivo, na ordem em que
// faz sentido estudar; `others`: o resto, também em ordem. Nada some: só muda a ordem e o destaque.
// A 1ª essencial de cada objetivo é a lição de objetivo (o passo a passo), usada também nas dicas. Toda essencial
// tem um `goalNotes` para o objetivo; as lições de objetivo dos outros objetivos ficam no fim de `others`.
export const DEFAULT_GOAL = 'organizar';
export const GOAL_TRACKS = {
  // Organizar: o roteiro de 4 semanas, saber para onde vai o dinheiro, cortar o que escapa, não deixar a dívida crescer e montar o colchão.
  organizar: { essentials: ['plano-organizar', 'orcamento', 'consumo', 'dividas', 'reserva'], others: ['golpes', 'inflacao', 'juros-compostos', 'investimentos'] },
  // Reserva: o passo a passo, o porquê e o quanto, de onde tirar (orçamento e consumo), por que não deixar parada (inflação) e onde guardar.
  reserva: { essentials: ['plano-reserva', 'reserva', 'orcamento', 'consumo', 'inflacao', 'investimentos'], others: ['juros-compostos', 'dividas', 'golpes'] },
  // Dívidas: o plano, entender os juros e priorizar, achar folga no orçamento, cortar gastos e escapar do "empréstimo fácil" falso.
  dividas: { essentials: ['plano-dividas', 'dividas', 'orcamento', 'consumo', 'golpes'], others: ['reserva', 'juros-compostos', 'inflacao', 'investimentos'] },
  // Investir: o checklist de largada, como o dinheiro cresce (e perde valor), a base segura antes de arriscar, as opções básicas e as pirâmides.
  investir: { essentials: ['plano-investir', 'juros-compostos', 'inflacao', 'reserva', 'investimentos', 'golpes'], others: ['orcamento', 'consumo', 'dividas'] },
};

/**
 * Trilha do objetivo: { goal, essentials: [lição], others: [lição], order: [lição] }.
 * Objetivo desconhecido usa o padrão. Lição que não estiver no mapa entra no fim de `others` (nunca some).
 */
export function goalTrack(goal) {
  const key = GOAL_TRACKS[goal] ? goal : DEFAULT_GOAL;
  const t = GOAL_TRACKS[key];
  const seen = new Set();
  const pick = (ids) => ids.map(lessonById).filter((l) => l && !seen.has(l.id) && seen.add(l.id));
  const essentials = pick(t.essentials);
  const others = pick([...t.others, ...LESSONS.map((l) => l.id)]);
  return { goal: key, essentials, others, order: [...essentials, ...others] };
}

/** Próxima lição recomendada: a 1ª não concluída na ordem da trilha do objetivo (essenciais primeiro); null se fez todas. */
export function nextLessonFor(goal, progress) {
  return goalTrack(goal).order.find((l) => !progress?.lessons?.[l.id]?.done) || null;
}
