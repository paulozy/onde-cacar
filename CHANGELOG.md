# Changelog

## 2.8.1 — 02/11/2026

### Corrigido
- **Comissão do Mercado em Coins:** a avaliação de venda usava 10% e mostrava o valor recebido acima do real. Agora usa 15%, a mesma do ranking da Outland.
- O diagnóstico mostra a versão certa da extensão (estava parado na 2.4.2).

## 2.8.0 — 02/11/2026

### Por quanto vender um pokémon seu
- **Ao abrir a ficha de um pokémon seu no jogo**, a gaveta lateral abre sozinha com a avaliação de venda: preço em Coins e em Gemas (shiny só em Gemas), cada um em três faixas, vender rápido, preço justo e sem pressa, com quanto você recebe depois da comissão (10% em Coins, 15% em Gemas) e o equivalente em US$ das Gemas. Um botão copia o número para colar no anúncio.
- **A concorrência entra na conta:** a extensão olha os anúncios abertos da espécie e nenhuma sugestão passa do mais barato igual ou melhor que o seu, porque acima disso o comprador leva o outro. Quando isso trava o preço, "sem pressa" some.
- **Quão bom ele é:** a nota dele contra as dos vendidos da espécie nos últimos 30 dias, e o valor no NPC para comparar.
- **Pode ou não ir ao Mercado:** avisa quando não dá (nota abaixo de 3,5 ou nível abaixo de 50, sem ser shiny nem P5; pokémon inicial).
- **Nota:** usa a do jogo quando ele manda. Senão, estima pelas vendas da espécie (a nota mede o nascimento: qualidade, IV, potência e refino) e mostra que é estimada. Dá para digitar a nota da ficha, e a digitada fica guardada.
- **Na aba Preço**, a seção "Por quanto vender um pokémon seu" avalia qualquer pokémon da box sem abrir a ficha. Lá também liga ou desliga a avaliação automática.
- Com o Mercado e uma ficha abertos ao mesmo tempo, a gaveta tem as abas "Este pokémon" e "Anúncios na tela".

## 2.7.0 — 02/11/2026

### Preço justo ao lado do Mercado
- **Gaveta "Preço justo":** abre sozinha na lateral da tela quando o Mercado do jogo está aberto, por cima dele, sem tampar o meio. Clicou numa espécie, os anúncios aparecem avaliados ali mesmo, sem precisar sair do Mercado nem abrir o painel. Dá para trocar de lado (⇆) e recolher (–) numa abinha que mostra quantos anúncios estão baratos. Desliga na aba Preço.
- **Filtros:** Gemas ou Coins, só baratos ou barato e justo, shiny (tanto faz, só, sem), potência mínima, nota mínima e esconder quem tem igual ou melhor por menos. Ordena por melhor negócio, menor preço, maior nota ou maior nível. Os filtros ficam guardados e valem na gaveta e na aba Preço.
- **Anúncios em cartões**, que cabem na gaveta: preço, preço justo, faixa normal, diferença e veredito à vista; um clique abre as vendas parecidas e o "comparar com o meu".

### Corrigido
- Clicar no painel ou na gaveta não chega mais ao jogo como "clique fora da janela", o que podia fechar o Mercado do jogo. Teclas digitadas nos campos da extensão também não vão mais para o jogo.

## 2.6.0 — 02/11/2026

### Mercado: alvos de compra refeitos
- **Alvo livre:** dá para criar "qualquer pokémon até 20 mi" sem preencher filtro nenhum. A nota mínima é opcional: o próprio Mercado já exige 3,5 (menos shiny, P5 e lendário).
- **Editar alvo:** o alvo volta para o formulário, mantém o que já comprou (ou zera, se você marcar) e é olhado de novo na hora. Um alvo que tinha parado por ter comprado tudo volta a valer quando ganha mais quantidade.
- **Duplicar alvo**, para criar variações sem preencher tudo de novo, e **remover com confirmação**.
- **Campos de preço com pontos de milhar** enquanto você digita (20.000.000), com a dica por extenso embaixo ("20 milhões") para conferir as casas. Aceita atalhos: 20m, 1,5b, 500k, 20kk. Vale também para os limites diários, a reserva de ouro, os preços dos Ajustes e o preço da aba Preço.
- **O formulário não perde mais o que você digitou** quando o painel se atualiza no meio do preenchimento.
- **Resumo antes de salvar**, em uma frase ("Comprar Charizard (sem shiny · nv 100+) por 15.000.000 Coins, até 1 pokémon"), com avisos: shiny em Coins (o jogo só vende shiny em Gemas), compra em Gemas desligada, sem limite de quantidade, qualquer espécie no modo comprar.
- **Filtros novos:** nível máximo, shiny "tanto faz / só shiny / sem shiny", só com TM AoE e sem variantes de Outland.
- **Preço relativo:** comprar ou avisar quando o anúncio estiver pelo menos X% abaixo do preço justo da aba Preço (precisa de espécie; recusa quando a conta tem confiança fraca). Pode ser usado junto com o preço máximo.
- O formulário mostra só os campos do tipo escolhido (Pokémon ou Item), confirma a espécie reconhecida e, para itens, a média de 7 dias e o menor anúncio na moeda escolhida.

### Corrigido
- Uma compra agendada confere o alvo de novo na hora de sair: se você baixou o preço ou mudou um filtro depois, o anúncio que não serve mais não é comprado.

## 2.5.0 — 02/11/2026

### Novo
- **Aba Preço (price check do Mercado):** abra uma espécie na aba Pokemon do Mercado do jogo e a extensão compara cada anúncio com as vendas reais dos últimos 30 dias, lidas da Tabela de preços do jogo. Para cada um: o preço justo, a faixa normal (do 25º ao 75º percentil), quanto ele está acima ou abaixo, e um veredito (barato, justo, caro, muito caro), do melhor negócio para o pior.
- **Como a conta compara:** só vendas da mesma espécie, na mesma moeda e com o mesmo brilho (P5 só com P5). Cada venda é ajustada para a nota do anúncio por uma curva preço × nota medida nas vendas da própria espécie. As mais recentes e mais parecidas em potência, nível, TM AoE, TM elemental e refino pesam mais, e o preço justo é a mediana, para uma venda absurda não arrastar a conta. Com poucas vendas parecidas, a confiança aparece como média ou fraca.
- **Igual ou melhor por menos:** avisa quando a mesma vitrine tem um anúncio igual ou melhor em tudo (potência, nota, nível, TM e refino) por um preço menor.
- **Ver vendas:** cada anúncio abre as vendas parecidas que entraram na conta, com o preço de cada uma e o preço puxado para a nota do anúncio.
- **Comparar com o meu:** quanto XP/h o pokémon anunciado faria no nível do seu pokémon em campo, nas mesmas hunts, e quanto custa cada +1% de XP/h.
- **Avaliar um pokémon específico:** espécie, nível, potência, nota, shiny, TM, refino, moeda e preço, sem precisar do anúncio aberto.
- As vendas lidas ficam guardadas neste navegador (até 4.000, dos últimos 30 dias), e a Tabela de preços aberta no próprio jogo também alimenta a conta. Os pedidos usam a mesma fila do sniper, um a cada 3 s, e a mesma espécie não é pedida de novo antes de 10 minutos.

## 2.4.2 — 28/10/2026

Ajustes para a segunda atualização da Wiki de 28/10/2026.

- **Pódio de ginásio:** novo campo nos Ajustes para dizer em que lugar você está em cada ginásio. O dano do pokémon do tipo sobe +25% (líder), +10% (2º) ou +5% (3º) na hunt, nos golpes e na Investida, valendo o melhor lugar entre os tipos dele, sem empilhar.
- **Ritmo das hunts:** os selvagens passaram a nascer em bandos calibrados em todas as áreas, de Kanto a Paldea e na Outland. As medições de abates por hora feitas antes de 28/10 deixam de valer, e a extensão volta a usar o modelo até medir de novo (15 min na hunt).
- **Troca de pokémon em campo:** respeita a nova espera de 3 s entre uma troca e a seguinte.
- Alvo padrão do Boost dos Atrasados: nv 943 (só vale quando o jogo não informa).

## 2.4.1 — 27/10/2026

### Corrigido
- **Bola diferente da que o jogo usa:** a extensão percebe pela queda do estoque qual bola o lançamento automático do jogo está arremessando. Se for outra que a dos Ajustes, o Setup avisa e oferece trocar com um clique. Antes, com Beast Ball escolhida e o jogo gastando Ultra, a Ultra nunca era reposta e as capturas por hora apareciam dobradas.
- **Compra parada pela reserva de ouro:** o Setup avisa antes do clique quando a reserva dos Ajustes não deixa ouro livre para o setup, e a automação manda uma notificação quando para por causa dela.
- **Relógio do servidor medido também pelo estado do jogo**, não só pelo mapa da hunt: vale mesmo fora da hunt e corrige PCs com o relógio adiantado ou atrasado.
- O diagnóstico traz o registro da automação e a bola que o jogo está usando.

## 2.4.0 — 27/10/2026

### Novo
- **Aba Mercado (alvos de compra):** escolha um item ou um pokémon (espécie e filtros de potência, IV, qualidade, nota, nível e shiny), o preço máximo e a moeda. A extensão olha cada alvo a cada ~20 s e avisa quando aparece algo dentro do preço.
- **Comprar sozinho**, alvo por alvo: um pedido por anúncio, entre 0,8 e 1,8 s depois da liberação, no meio dos 3 s do sorteio, com o preço visto (a trava de preço do jogo recusa se o vendedor subir). O gatilho vem das mensagens do mapa da hunt, então funciona mesmo com a aba em segundo plano, quando o navegador freia os timers. O registro diz quando cada pedido saiu em relação à liberação.
- **Travas:** limite de gasto por dia em Coins; compra em Gemas desligada até você ligar, com limite próprio; quantidade total por alvo; espera enquanto o Mercado do jogo está aberto na sua tela.
- **Média de 7 dias** de cada item na tabela, e o preço do token e dos fragmentos da visão Outland preenchido pela média do Mercado.

### Corrigido
- O diagnóstico esconde também quem capturou, quem vende e quem compra.

## 2.3.1 — 27/10/2026

Ajustes para a Wiki de 27/10/2026.

- **Dias Sazonais:** a tipagem do dia agora troca às **18:00 de Brasília**. A extensão segue a troca sem recarregar: lê a mensagem do jogo sobre o dia e, se ela não vier, o ícone do dia na tela da hunt. A escolha manual em Ajustes vale só até a próxima virada.
- **Diamante:** o Mercado deixou de negociar diamante. O campo dos Ajustes passou a ser "quanto vale 1 💎 para você", pelo que você paga na Loja.
- **Boost do Sacrifício** (+20% de XP no treinador e no pokémon) entra no ritmo de XP.
- Alvo padrão do Boost dos Atrasados atualizado para o nv 941 (só vale quando o jogo não informa).

## 2.3.0 — 25/10/2026

### Novo
- **Upar outro pokémon:** na aba Hunts, o seletor "Upar" simula as hunts para qualquer pokémon da equipe sem tirar quem está em campo.
- **Colocar em campo e caçar:** depois da confirmação, a extensão troca o pokémon em campo e leva você para a hunt (também pelo botão do Setup). A mensagem de troca é aprendida uma vez, com um clique seu no jogo.

### Corrigido
- **Troca de hunt presa em combate:** a extensão passou a usar o instante que o servidor manda (`trocaLivreEm`), no relógio do servidor, em vez de tratar qualquer mensagem de batalha (XP, abate, loot) como luta. Ela também tenta no momento exato em que libera, sem perder a janela esperando o intervalo entre ações.
- Quando a troca não libera depois do tempo dos Ajustes e a saída forçada está desligada, o registro avisa e sugere ligá-la.

## 2.2.0 — 25/10/2026

### Novo
- **Outland** na aba Hunts: ranqueia as 58 hunts da Outland pelo valor por hora (ouro, venda das capturas, Bronze Boss Token e os fragmentos de Chave, Shiny Stone e Bicicleta), já na Outland mais alta que você liberou.
- Botão para ir à melhor Outland: escolhe o tier (`outland.tier`) e a hunt, como o jogo faz, só fora de combate.
- Preço do token e dos três fragmentos em Ajustes, já descontando os 15% de comissão do Mercado.
- Diagnóstico mostra o tier atual, os tiers e a chance do token que o jogo informa.

### Corrigido
- Venda ao NPC respeita o teto de 64.907 de valor base (Wiki). Espécies caras, como o Furious Scizor, eram superestimadas.
- A chance do token nos Drops usa o multiplicador da Outland em que você está.

## 2.1.0 — 24/10/2026

### Novo
- Aba **Capturar** (no lugar de Comprar): escolha uma espécie e veja em que hunts ela aparece, quantas dela você derruba por hora, a chance de cada bola e o tempo até uma captura, uma P3+ ou uma shiny.
- **Dias Sazonais**: a tipagem do dia entra no cálculo de dano (×2 para quem é do tipo, ×¼ para quem apanha dele).
- **Saída forçada** na automação: numa hunt que não para de lutar, sai com Escape Rope ou desistindo do combate, depois de um tempo que você escolhe.

### Corrigido
- Drops mostram só o que cai de verdade desde 15/10/2026: a pedra de cada tipo pelo estágio da espécie e, na Outland, o Bronze Boss Token.
- A troca de hunt usa o aviso do próprio jogo de quando a área fica livre.

## 2.0.0 — 24/10/2026
- Primeira versão preparada para as lojas: nome sem marca, sem tabela de captura embutida, endereços dos módulos do jogo por extenso, painel sem `innerHTML`, pacotes separados para Chrome/Edge/Opera e Firefox, política de privacidade e material da loja.
