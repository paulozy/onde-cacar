# Onde Caçar: ajudante não oficial do PokeIdle

Ferramenta da comunidade, sem ligação com os desenvolvedores do PokeIdle.

Para publicar nas lojas, veja `PUBLICAR.md`. Os pacotes de cada loja são gerados pelo `build.ps1` (Windows) ou `build.py`.

Um botão **Onde caçar** aparece acima do seu pokémon em campo. Ele abre um painel com cinco abas:

- **Hunts**: todas as hunts simuladas para o pokémon em campo, com XP/h, ouro líquido/h (já descontando poção e pokébola), tempo por abate, abates/h, efetividade do seu melhor golpe e quanto o pior golpe do selvagem tira do seu HP. No topo, a melhor hunt liberada, segura e lucrativa. Empates de até 5% no XP são decididos por quem rende mais ouro e bate menos.
- **Setup**: para a hunt escolhida, a poção mais barata e em que % do HP ligar a cura, a pokébola de melhor saldo e a mochila: quanto levar para X horas, quanto você já tem na bolsa e quanto falta comprar.
- **Sessão**: medição ao vivo da hunt em que você está (abates/h, XP/h, ouro/h, consumo), comparada com a estimativa. Começa sozinha quando você muda de hunt.
- **Drops**: o que caiu desde o começo da medição, "1 a cada N abates" real contra o que a tabela de loot do jogo promete.
- **Progresso**: quanto XP e quanto tempo faltam para os próximos marcos (próxima faixa de Johto, bosses do 300, Orre no 500, o nível dos veteranos), no seu ritmo e com o Boost dos Atrasados, e o preço estimado dele.
- **Comprar**: cole a ficha de um pokémon à venda e o preço; a extensão compara com o seu em campo, no mesmo nível, e mostra quanto ele renderia, quanto XP falta para upar e o custo por +1% de XP/h.
- **Ajustes**: poção, pokébola, venda das capturas, bicicleta, HP mínimo para a cura, avisos, valores de referência e a automação.

## Diagnóstico

Em Ajustes → Diagnóstico, **Copiar diagnóstico** (ou baixar como arquivo) junta o que a extensão está lendo do jogo e as contas que ela faz: seu pokémon e os golpes montados, a hunt atual, bônus de XP, a curva de XP, XP e ouro por abate (módulo do jogo contra a regra de reserva), as 5 melhores hunts e as duas sessões (a da extensão e a do jogo). Nick, e-mail e afins são retirados antes.

## Avisos

Notificação do navegador (e um bip, opcional) para captura boa (potência, qualidade ou IV acima do que você escolher, ou shiny), drop raro, boss derrotado, hunt melhor liberada, estoque acabando, equipe inteira caída e automação parada. Ative em Ajustes → "Ativar notificações do navegador".

## Automação (desligada por padrão)

- **Comprar o que falta e caçar aqui** (aba Setup): mostra o que vai comprar e quanto custa, e só age depois do seu **Confirmar**. Compra na loja do NPC e leva você à hunt assim que sair de combate.
- **Repor poção e bola sozinho**: durante a hunt, quando o estoque dura menos que o mínimo, compra para a duração da sessão.
- **Trocar de hunt sozinho**: quando a recomendada render 10% mais XP/h, depois de 15 min na hunt atual.
- Travas: reserva mínima de ouro, gasto máximo por hora, uma ação a cada 2,5 s, troca de área só fora de combate. O registro do que ela fez fica em Ajustes.
- Ela não mexe na % da cura automática do jogo: ajuste no "Usar Poções" o valor que a aba Setup indica.

## Como instalar

1. Descompacte o arquivo numa pasta que você não vá apagar.
2. Abra `chrome://extensions` (no Edge: `edge://extensions`).
3. Ligue o **Modo do desenvolvedor**.
4. Clique em **Carregar sem compactação** e escolha a pasta que contém o `manifest.json`.
5. Abra ou recarregue o pokeidle.io (F5).

Para atualizar, substitua os arquivos da pasta e clique em recarregar no cartão da extensão.

### Firefox (128 ou mais novo)

- **Para usar agora (some quando o Firefox fecha):** `about:debugging#/runtime/this-firefox` → **Carregar extensão temporária…** → escolha o `manifest.json`.
- **Para ficar instalada de vez:** assine de graça como extensão não listada em addons.mozilla.org (Developer Hub → Submit a New Add-on → "On your own") e instale o .xpi que voltar; ou use o Firefox Developer Edition com `xpinstall.signatures.required` em `false` (about:config) e instale o .zip renomeado para .xpi em `about:addons`.

## De onde vêm os números

- Seu pokémon, bônus de XP e inventário: lidos das mensagens que o jogo já recebe.
- Golpes, recargas, loot, XP e ouro por abate: o catálogo e os módulos do próprio pokeidle.io, na versão no ar (atualiza sozinho a cada F5).
- Ritmo das ondas e caminhada entre selvagens: medições publicadas pelo guia HardToCapture.

Os valores são estimativas. TM AoE, mapas divididos com outros jogadores e geometria específica de cada mapa não estão modelados; use a aba Sessão para conferir.

## Segurança

Sem automação ligada, a extensão **só lê** o jogo. Com ela ligada, envia apenas as mesmas mensagens dos botões do jogo (comprar na loja do NPC e escolher hunt). A Wiki do PokeIdle (Automações → "Automação de fora do jogo") diz que os Termos de Uso permitem automação. Nenhum dado sai do seu computador; preferências e medições ficam no armazenamento do navegador.
Extensão de fã, sem ligação com os desenvolvedores do PokeIdle.
