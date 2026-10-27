# Changelog

## 2.4.0 — 27/10/2026

### Novo
- **Aba Mercado (alvos de compra):** escolha um item ou um pokémon (espécie e filtros de potência, IV, qualidade, nota, nível e shiny), o preço máximo e a moeda. A extensão olha cada alvo a cada ~20 s e avisa quando aparece algo dentro do preço.
- **Comprar sozinho**, alvo por alvo: um pedido por anúncio, logo depois da liberação, dentro dos 3 s do sorteio, com o preço visto (a trava de preço do jogo recusa se o vendedor subir).
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
