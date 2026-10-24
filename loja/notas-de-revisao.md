# Notas para os revisores (cole no campo de notas de cada loja)

## Propósito único
Ajudante para o jogo de navegador PokeIdle (pokeidle.io): estima as melhores áreas de caça para o pokémon do jogador e o consumo de itens.

## Permissões
- Acesso ao site: só https://pokeidle.io/* (content script). Nenhuma outra permissão, nenhum service worker, nenhum acesso a abas, histórico ou cookies.
- O content script roda em "world": "MAIN" porque precisa ler as mensagens do WebSocket do próprio jogo, que só existem no contexto da página.

## Código remoto
A extensão não baixa nem executa código de servidores próprios ou de terceiros. Todo o código dela está no pacote, sem minificação.
Para usar as mesmas fórmulas do jogo (XP por abate, recargas de golpes, catálogo de espécies), ela importa, no contexto da página, os módulos JavaScript que o próprio site pokeidle.io já serve e já executa (mesma origem, ex.: https://pokeidle.io/shared/cooldown-golpes.mjs) e lê os JSON públicos do catálogo (https://pokeidle.io/assets/creatures.json). É o mesmo código que a página carrega sozinha; a extensão não o modifica nem o injeta em outro contexto.

## Dados
Nenhum dado é coletado ou transmitido. Preferências e medições ficam no localStorage do site pokeidle.io. Política: [link da política de privacidade].

## Automação (opcional, desligada por padrão)
Quando o usuário liga, a extensão envia ao servidor do jogo as mesmas mensagens que os botões do jogo enviam (comprar poção/pokébola na loja do NPC, selecionar uma área e, se o usuário gravar, usar a Escape Rope ou desistir do combate), com intervalo mínimo de 2,5 s, limite de gasto definido pelo usuário e confirmação explícita no modo manual. A documentação do jogo informa que os Termos de Uso permitem automação.

## Saída forçada (opcional)
A extensão não traz nenhuma mensagem pronta para sair do combate. Quando o usuário liga essa opção, ele clica uma vez no botão do próprio jogo (Escape Rope ou Desistir do combate) e a extensão guarda a mensagem que o jogo enviou, para repetir depois. Ela observa as mensagens que saem só para isso; nada é enviado a terceiros.

## Como testar
1. Crie uma conta grátis em https://pokeidle.io e entre numa área de caça.
2. Clique no botão dourado "Onde caçar", acima do pokémon em campo.
3. As abas mostram o ranking de áreas, o setup de itens, a sessão e o progresso.
