# Como publicar o Onde Caçar

## Antes de tudo
1. **Fale com os desenvolvedores do PokeIdle** (Discord, #open-ticket) e mostre a extensão. Com o aval deles, o risco de pedirem remoção cai muito.
2. **Publique a política de privacidade** num endereço público. O jeito mais simples: suba este projeto num repositório do GitHub e ative o GitHub Pages; o link fica `https://<seu-usuario>.github.io/<repositorio>/loja/privacidade.html`. Preencha o contato no fim de `loja/privacidade.md` e `loja/privacidade.html`.
3. **Tire as capturas de tela** no jogo (1280×800), como descrito em `loja/descricao-loja.md`.
4. **Gere os pacotes:** no PowerShell, dentro desta pasta, rode `.\build.ps1` (ou `.\build.ps1 -Versao 2.0.1` para mudar a versão). Os zips saem em `dist\`.
   Se o Windows bloquear o script: `powershell -ExecutionPolicy Bypass -File .\build.ps1`.

## Chrome Web Store (taxa única de US$ 5)
1. https://chrome.google.com/webstore/devconsole → crie a conta de desenvolvedor.
2. **New item** → envie `dist\onde-cacar-<versão>-chrome-edge-opera.zip`.
3. Store listing: textos de `loja/descricao-loja.md`, ícone `loja/icone-loja-128.png`, telha `loja/promo-440x280.png`, marquee `loja/marquee-1400x560.png` (opcional) e as capturas.
4. Privacy practices: propósito único (copie de `loja/notas-de-revisao.md`); justificativa do acesso a pokeidle.io; "Are you using remote code?" → **No** (explique na justificativa que só os módulos do próprio site são carregados, no contexto da página); marque que **não coleta dados**; link da política.
5. Submit for review.

## Microsoft Edge Add-ons (grátis)
1. https://partner.microsoft.com/dashboard/microsoftedge → conta de desenvolvedor.
2. **Create new extension** → envie o mesmo zip do Chrome.
3. Mesmos textos e imagens; no campo "Notes for certification", cole `loja/notas-de-revisao.md`.

## Firefox — addons.mozilla.org (grátis)
1. https://addons.mozilla.org/developers → **Submit a New Add-on** → **On this site** (listada).
2. Envie `dist\onde-cacar-<versão>-firefox.zip`. Ele já passou no validador da Mozilla sem erros nem avisos.
3. Se perguntarem do código-fonte: o código não é minificado, então não precisa enviar outro arquivo.
4. Notas para o revisor: cole `loja/notas-de-revisao.md`.
5. **O ID do Firefox (`onde-cacar@ajudante-pokeidle`, em build.ps1 e build.py) não pode mudar depois da primeira publicação.**

## Opera Add-ons (grátis)
1. https://addons.opera.com/developer → envie o zip do Chrome.

## Atualizações
Mude o código, rode `.\build.ps1 -Versao <nova>` e envie os zips novos em cada loja. A versão precisa sempre subir (2.0.0 → 2.0.1 → 2.1.0…).

## O que NÃO publicar
O **Lançador** (arremesso automático de pokébolas) faz de graça o que o VIP do jogo vende. Deixe ele fora das lojas.
