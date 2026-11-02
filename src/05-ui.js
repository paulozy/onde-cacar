// Onde Caçar — a tela. Um botão acima do pokémon em campo e o painel com as abas.
(function (root) {
  'use strict';
  const OC = (root.__ondeCacar ??= {});
  if (!OC.on || !OC.analisar) return;

  const CHAVE_PREFS = 'onde-cacar:prefs:v1';
  const lerJ = (k, p) => { try { return JSON.parse(localStorage.getItem(k)) ?? p; } catch { return p; } };
  const gravarJ = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* sem espaço */ } };
  const prefs = {
    aba: 'hunts', ordem: 'xp', soLiberadas: true, esconderPerigo: true,
    pocao: 'auto', bola: 'auto', vender: true, bike: 0, precoBeast: 100, hpMinimo: 0.35, horas: 4, sel: null,
    autoRepor: false, autoTrocar: false, autoMinHoras: 1, autoReserva: 1000000, autoTetoHora: 3000000,
    mercadoLigado: false, mercadoLimiteGold: 50000000, mercadoGemas: false, mercadoLimiteOrb: 0, precoOutlandDoMercado: true,
    precoDiamante: 7, alvoAtrasados: 943, ginasios: [], contarLive: false, avisoSom: false, avisoPotMin: 3, avisoQualMin: 1.5, avisoIvMin: 150,
    ...lerJ(CHAVE_PREFS, {}),
  };
  if (prefs.aba === 'comprar') prefs.aba = 'alvo'; // a aba Comprar saiu na 2.1
  const salvarPrefs = () => gravarJ(CHAVE_PREFS, prefs);

  // Desenha o painel a partir do HTML montado abaixo (todo texto variável passa por esc()).
  const parser = new DOMParser();
  const pintar = (el, html) => el.replaceChildren(...parser.parseFromString(`<body>${html}</body>`, 'text/html').body.childNodes);

  // ---- formatação ------------------------------------------------------------------------
  const nf = new Intl.NumberFormat('pt-BR');
  const nfc = new Intl.NumberFormat('pt-BR', { notation: 'compact', maximumFractionDigits: 1 });
  const num = (v) => nf.format(Math.round(v));
  const curto = (v) => (Math.abs(v) >= 10000 ? nfc.format(v) : num(v));
  const sinal = (v) => `${v >= 0 ? '+' : '−'}${curto(Math.abs(v))}`;
  const pct = (v) => `${Math.round(v * 100)}%`;
  const dec = (v, d = 1) => v.toFixed(d).replace('.', ',');
  const seg = (s) => (s < 1 ? '<1 s' : s < 60 ? `${dec(s)} s` : `${Math.floor(s / 60)} min ${Math.round(s % 60)} s`);
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const REG = { kanto: 'Kanto', johto: 'Johto', outland: 'Outland', orre: 'Orre', hoenn: 'Hoenn', sinnoh: 'Sinnoh', unova: 'Unova', kalos: 'Kalos', alola: 'Alola', galar: 'Galar', paldea: 'Paldea' };
  const regiao = (r) => REG[r] ?? (r ? r[0].toUpperCase() + r.slice(1) : '');
  const TIPO = { NORMAL: 'Normal', FIRE: 'Fogo', WATER: 'Água', GRASS: 'Planta', ELECTRIC: 'Elétrico', ICE: 'Gelo', FIGHTING: 'Lutador', POISON: 'Veneno', GROUND: 'Terra', FLYING: 'Voador', PSYCHIC: 'Psíquico', BUG: 'Inseto', ROCK: 'Pedra', GHOST: 'Fantasma', DRAGON: 'Dragão', DARK: 'Sombrio', STEEL: 'Aço', FAIRY: 'Fada' };

  // ---- estado ----------------------------------------------------------------------------
  let welcome = null, eu = null, jogo = null, itens = null, analise = null, assinatura = '', erro = null;
  let painel = null, mostrando = 25, confirmando = null, confirmandoUpar = null, diagMsg = '';
  const pkAtivo = () => eu?.pokemons?.find((p) => p.id === eu.activeId) ?? null;
  // o pokémon que a aba Hunts simula: o escolhido em "Upar" ou, sem escolha, o que está em campo
  const pkAnalise = () => {
    if (prefs.pkUpar != null) {
      if (prefs.pkUpar === eu?.activeId) prefs.pkUpar = null; // já está em campo
      else { const p = eu?.pokemons?.find((x) => String(x.id) === String(prefs.pkUpar)); if (p) return p; }
    }
    return pkAtivo();
  };
  const simulandoOutro = () => { const p = pkAnalise(); return !!p && p.id !== eu?.activeId; };
  const assinar = (pk) => (pk ? `${pk.id}|${pk.level}|${pk.tmElemental ?? ''}|${JSON.stringify(pk.stats)}|${eu?.level}` : '');

  async function recalcular(forcar = false) {
    const pk = pkAnalise();
    if (!welcome || !eu || !pk) { analise = null; return; }
    const sig = assinar(pk) + JSON.stringify([prefs.ordem, prefs.pocao, prefs.bola, prefs.vender, prefs.bike, prefs.hpMinimo, prefs.precoBeast, prefs.tipoDiaManual, prefs.tipoDiaManualAte, OC.proximaViradaSazonal?.(), OC.tipoDoDia?.({ welcome, eu }), prefs.precoToken, prefs.precoFragChave, prefs.precoFragShiny, prefs.precoFragBike, JSON.stringify(prefs.ginasios ?? [])]);
    if (!forcar && analise && sig === assinatura) return;
    try {
      jogo ??= await OC.carregarJogo();
      itens ??= OC.montarItens(jogo.itensBrutos, welcome);
      const ctx = { mod: jogo.mod, especies: jogo.especies, itens, hunts: welcome.hunts ?? [], welcome, eu };
      analise = OC.analisar(pk, ctx, prefs);
      assinatura = sig; erro = null;
    } catch (e) {
      console.error('[onde-cacar]', e);
      erro = e?.message ?? String(e); analise = null;
    }
  }

  /** O que levar para H horas na hunt r: quanto precisa, quanto tem e quanto falta. */
  OC.mochila = (r, H) => {
    const folga = (x) => Math.ceil(x * 1.1);
    const lista = [];
    const preco = (tipo, id, padrao) => (tipo === 'bola' ? OC.auto?.precoBola?.(id) : OC.auto?.precoItem?.(id)) || padrao;
    if (r.pocao && !r.umHit && prefs.pocao !== 'nenhuma') lista.push({ tipo: 'item', id: r.pocao.id, nome: r.pocao.nome, precisa: folga(r.pocao.porH * H), preco: preco('item', r.pocao.id, r.pocao.preco) });
    const b = r.bola;
    if (b && b.chave !== 'nenhuma') lista.push({ tipo: 'bola', id: b.id, nome: b.nome, precisa: folga(r.kph * H), preco: b.premium ? 0 : preco('bola', b.id, b.preco), premium: !!b.premium });
    if (r.hitPct >= 0.6) lista.push({ tipo: 'item', id: OC.REVIVE.id, nome: OC.REVIVE.nome, precisa: 5, preco: preco('item', OC.REVIVE.id, OC.REVIVE.preco) });
    for (const i of lista) { i.tem = OC.estoque(eu, i.tipo, i.id); i.falta = Math.max(0, i.precisa - (i.tem ?? 0)); }
    return lista;
  };

  // ---- o botão ---------------------------------------------------------------------------
  const botao = document.createElement('button');
  botao.type = 'button';
  botao.className = 'oc-btn oc-barra';
  botao.textContent = 'Onde caçar';
  botao.title = 'As melhores hunts e o setup de itens para o seu pokémon em campo';
  botao.addEventListener('click', (ev) => { ev.preventDefault(); ev.stopPropagation(); alternar(); });

  function posicionarBotao() {
    if (!document.body) return;
    const card = document.getElementById('ativo-card');
    if (card?.parentElement) {
      botao.classList.remove('oc-solto');
      if (card.previousElementSibling !== botao) card.before(botao);
    } else {
      botao.classList.add('oc-solto');
      if (botao.parentElement !== document.body) document.body.append(botao);
    }
  }
  const iniciarBotao = () => { posicionarBotao(); setInterval(posicionarBotao, 2000); };
  if (document.readyState === 'loading') addEventListener('DOMContentLoaded', iniciarBotao, { once: true });
  else iniciarBotao();

  // ---- o painel --------------------------------------------------------------------------
  function alternar() { if (painel) fechar(); else abrir(); }
  function abrir() {
    painel = isolar(document.createElement('div'));
    painel.className = 'oc-painel';
    painel.setAttribute('role', 'dialog');
    painel.setAttribute('aria-label', 'Onde caçar');
    document.body.append(painel);
    mostrando = 25;
    desenhar(true);
    addEventListener('keydown', aoTeclar, true);
  }
  function fechar() { painel?.remove(); painel = null; removeEventListener('keydown', aoTeclar, true); }
  const aoTeclar = (ev) => { if (ev.key === 'Escape') fechar(); };

  async function desenhar(forcar = false) {
    if (!painel) return;
    const pk = pkAnalise();
    if (!welcome || !eu) { pintar(painel, cab(pk) + '<div class="oc-carga">Esperando o jogo conectar…</div>'); ligar(); return; }
    if (!pk) { pintar(painel, cab(null) + '<div class="oc-aviso">Coloque um pokémon em campo para ver onde caçar.</div>'); ligar(); return; }
    if (!analise || forcar) {
      pintar(painel, cab(pk) + abas() + '<div class="oc-carga">Lendo o jogo…</div>');
      ligar();
      await recalcular(forcar);
      if (!painel) return;
    }
    const corpo = prefs.aba === 'mercado' ? abaMercado()
      : prefs.aba === 'preco' ? abaPreco()
      : erro ? `<div class="oc-aviso">Não consegui calcular: ${esc(erro)}</div>`
      : prefs.aba === 'setup' ? abaSetup()
      : prefs.aba === 'sessao' ? abaSessao()
      : prefs.aba === 'drops' ? abaDrops()
      : prefs.aba === 'progresso' ? abaProgresso()
      : prefs.aba === 'alvo' ? abaAlvo()
      : prefs.aba === 'ajustes' ? abaAjustes()
      : abaHunts();
    pintar(painel, cab(pk) + abas() + corpo);
    ligar();
  }

  function cab(pk) {
    const q = Number(pk?.quality ?? pk?.qualidade);
    const sub = pk ? [esc(pk.nome) + (simulandoOutro() ? ' (simulando, não está em campo)' : ''), `Nv ${num(pk.level)}`, `P${pk.potencia ?? 1}`, Number.isFinite(q) ? `Q ${dec(q, 3)}` : '', eu?.level ? `treinador ${num(eu.level)}` : '']
      .filter(Boolean).join(', ') : 'nenhum pokémon em campo';
    return `<div class="oc-cab"><div class="oc-titulo"><h3>Onde caçar</h3><small>${sub}</small></div>
      <button type="button" class="oc-fechar" data-acao="fechar" aria-label="Fechar">×</button></div>`;
  }
  function abas() {
    const A = [['hunts', 'Hunts'], ['setup', 'Setup'], ['sessao', 'Sessão'], ['drops', 'Drops'], ['progresso', 'Progresso'], ['alvo', 'Capturar'], ['mercado', 'Mercado'], ['preco', 'Preço'], ['ajustes', 'Ajustes']];
    return `<div class="oc-abas" role="tablist">${A.map(([k, r]) => `<button type="button" role="tab" data-aba="${k}" aria-selected="${prefs.aba === k}">${r}</button>`).join('')}</div>`;
  }

  const risco = (r) => {
    if (r.umHit) return '<span class="oc-tag oc-ruim">morre num golpe</span>';
    if (r.mortesH >= 0.5) return `<span class="oc-tag oc-ruim">desmaia ${dec(r.mortesH)}×/h</span>`;
    if (r.hitPct >= 0.5) return `<span class="oc-tag oc-atencao">${pct(r.hitPct)} do HP</span>`;
    return `<span class="oc-tag oc-bom">${pct(r.hitPct)} do HP</span>`;
  };
  const selRow = () => analise?.linhas.find((l) => l.slug === prefs.sel && !l.inviavel) ?? analise?.melhor ?? analise?.linhas.find((l) => !l.inviavel) ?? null;

  function seletorUpar() {
    const lista = (eu?.pokemons ?? []).slice().sort((a, b) => ((b.id === eu.activeId) - (a.id === eu.activeId)) || ((Number(b.level) || 0) - (Number(a.level) || 0)));
    if (lista.length < 2) return '';
    const atual = pkAnalise()?.id;
    return `<div class="oc-ctrl"><label>Upar <select data-upar>${lista.map((p) => `<option value="${esc(String(p.id))}" ${p.id === atual ? 'selected' : ''}>${esc(p.nome)} · nv ${num(p.level)}${p.id === eu.activeId ? ' (em campo)' : ''}</option>`).join('')}</select></label>
      ${simulandoOutro() ? '<span class="oc-nota">simulando sem trocar quem está em campo</span>' : ''}</div>`;
  }
  function blocoUpar(r) {
    const pk = pkAnalise(), ativo = pkAtivo();
    if (!r || !pk || !simulandoOutro()) return '';
    if ((Number(pk.level) || 0) > (Number(eu?.level) || 0) + 5) return `<div class="oc-aviso">${esc(pk.nome)} está mais de 5 níveis acima do treinador (nv ${num(eu.level)}), e o jogo não deixa ele entrar em campo. Dá para usar “Reduzir o nível” na ficha dele ou esperar o treinador subir.</div>`;
    const grav = OC.auto?.gravando() === 'ativar';
    if (!prefs.ativar?.caminho) return `<div class="oc-caixa">Para trocar o pokémon em campo, a extensão precisa aprender a mensagem do jogo uma vez. ${grav ? '<b>Gravando:</b> ponha agora, pelo jogo, qualquer outro pokémon da equipe em campo.' : 'Aperte o botão e, pelo jogo, ponha qualquer outro pokémon da equipe em campo.'}
      <div class="oc-ctrl" style="margin:8px 0 0"><button type="button" class="oc-btn" data-gravar="ativar">${grav ? 'Cancelar' : 'Ensinar a troca de pokémon'}</button></div></div>`;
    const forca = prefs.autoForcar && prefs.autoForcar !== 'nao';
    if (confirmandoUpar === r.slug) return `<div class="oc-caixa"><p>Vou tirar ${esc(ativo?.nome ?? 'o pokémon atual')} de campo, colocar <b>${esc(pk.nome)}</b> e levar você para <b>${esc(r.nome)}</b>${r.outland ? ` na Outland ${r.tierAlvo}` : ''} assim que a troca de área liberar${forca ? ` (se não liberar em ${dec(Number(prefs.autoForcarApos) || 2, 1)} min, com a saída forçada)` : ''}.</p>
      <button type="button" class="oc-btn" data-acao="upar-ok" data-slug="${esc(r.slug)}">Confirmar</button> <button type="button" class="oc-link" data-acao="upar-nao">cancelar</button></div>`;
    return `<div class="oc-ctrl"><button type="button" class="oc-btn" data-acao="upar" data-slug="${esc(r.slug)}" ${OC.auto?.ocupado() ? 'disabled' : ''}>Colocar ${esc(pk.nome)} em campo e caçar em ${esc(r.nome)}</button>${OC.auto ? `<span class="oc-nota">${esc(OC.auto.status())}</span>` : ''}</div>`;
  }

  function abaOutland() {
    const { melhor, tiers } = analise;
    const ativa = OC.sessao?.ativa();
    const precos = [prefs.precoToken, prefs.precoFragChave, prefs.precoFragShiny, prefs.precoFragBike].some((v) => Number(v) > 0);
    const melhorXp = analise.linhas.filter((l) => !l.inviavel && l.liberada && !OC.perigosa(l)).reduce((m, l) => Math.max(m, l.xpPkH), 0);
    const cada = (h) => (h > 0 ? (1 / h < 1 ? `${dec(h, 1)}/h` : `1 a cada ${1 / h < 48 ? `${dec(1 / h)} h` : `${dec(1 / h / 24)} dias`}`) : '—');
    const nomeTier = (t) => esc(t?.rotulo ?? `Outland ${t?.tier}`);
    const linhas = analise.linhas.filter((l) => l.outland && !(prefs.esconderPerigo && !l.inviavel && OC.perigosa(l)));
    let topo = '<div class="oc-caixa">Nenhuma hunt da Outland é segura com este pokémon agora.</div>';
    if (melhor?.outland) {
      const noTier = Number(eu?.outlandTier) === tiers.melhor.tier, aqui = noTier && ativa === melhor.slug;
      topo = `<div class="oc-veredito">
        <span class="oc-rot">Melhor Outland agora</span>
        <b class="oc-nome">${esc(melhor.nome)}</b>
        <span class="oc-onde">${nomeTier(tiers.melhor)} (drops raros ×${dec(tiers.melhor.mult, 2)}), nível 150</span>
        <div class="oc-nums">
          <div><b>${precos ? sinal(melhor.valorOutH) : sinal(melhor.liq)}</b><span>${precos ? 'valor/h com os raros' : 'ouro líquido/h'}</span></div>
          <div><b>${cada(melhor.raros.token)}</b><span>Bronze Boss Token</span></div>
          <div><b>${num(melhor.kph)}</b><span>abates/h</span></div>
          <div><b>${curto(melhor.xpPkH)}</b><span>XP/h${melhorXp > melhor.xpPkH ? ` (${Math.round((1 - melhor.xpPkH / melhorXp) * 100)}% menos que o seu melhor farm)` : ''}</span></div>
        </div>
        <p>Você está na ${nomeTier(tiers.atual)}${noTier ? ', a mais alta que você liberou' : `, mas já liberou a ${nomeTier(tiers.melhor)}: ela tem os mesmos selvagens, XP e ouro, com ${Math.round((tiers.melhor.mult / tiers.atual.mult - 1) * 100)}% mais drops raros`}.
        ${aqui || simulandoOutro() ? '' : `<button type="button" class="oc-btn" data-outland="${esc(melhor.slug)}" data-nome="${esc(melhor.nome)}" data-tier="${tiers.melhor.tier}" ${OC.auto?.ocupado() ? 'disabled' : ''}>Ir para ${esc(melhor.nome)} na ${nomeTier(tiers.melhor)}</button>`}
        <button type="button" class="oc-link" data-sel="${esc(melhor.slug)}">Ver o setup</button></p>
      </div>`;
    }
    const corpo = linhas.slice(0, mostrando).map((l, i) => {
      if (l.inviavel) return `<tr class="oc-dim"><td>${i + 1}</td><td><b>${esc(l.h?.nome ?? l.slug)}</b></td><td colspan="7">não mata o selvagem</td></tr>`;
      const cls = [l === melhor ? 'oc-top' : '', l.slug === ativa ? 'oc-campo' : '', l.liberada ? '' : 'oc-dim'].join(' ');
      const frag = l.raros.chave + l.raros.shiny + l.raros.bike;
      return `<tr class="${cls}"><td>${i + 1}</td>
        <td><button type="button" class="oc-hunt" data-sel="${esc(l.slug)}">${esc(l.nome)}</button>${l.slug === ativa ? '<span class="oc-aqui">você está aqui</span>' : ''}<small>×${dec(l.ef)} ${esc(l.melhorGolpe?.nome ?? '')}</small></td>
        <td>${num(l.kph)}${l.calibrada ? '<small>medido</small>' : ''}</td><td>${cada(l.raros.token)}</td><td>${cada(frag)}</td>
        ${precos ? `<td class="${l.valorOutH >= 0 ? 'oc-pos' : 'oc-neg'}">${sinal(l.valorOutH)}</td>` : ''}
        <td class="${l.liq >= 0 ? 'oc-pos' : 'oc-neg'}">${sinal(l.liq)}</td><td>${curto(l.xpPkH)}</td><td>${risco(l)}</td></tr>`;
    }).join('');
    return `${seletorUpar()}${topo}${melhor?.outland ? blocoUpar(melhor) : ''}
      <div class="oc-ctrl">
        <span class="oc-seg">${[['xp', 'XP/h'], ['ouro', 'Ouro líquido'], ['abates', 'Abates/h'], ['outland', 'Outland']].map(([k, r]) => `<button type="button" data-ordem="${k}" aria-pressed="${prefs.ordem === k}">${r}</button>`).join('')}</span>
        <label><input type="checkbox" data-pref="esconderPerigo" ${prefs.esconderPerigo ? 'checked' : ''}> esconder perigosas</label>
      </div>
      <div class="oc-tabela"><table><thead><tr><th>#</th><th>Hunt</th><th>Abates/h</th><th>Token</th><th>Fragmentos</th>${precos ? '<th>Valor/h</th>' : ''}<th>Ouro líq./h</th><th>XP/h</th><th>Pior golpe</th></tr></thead>
      <tbody>${corpo || '<tr><td colspan="9">Nenhuma hunt passa nos filtros.</td></tr>'}</tbody></table>
      ${linhas.length > mostrando ? `<button type="button" class="oc-mais" data-acao="mais">mostrar mais (${linhas.length - mostrando})</button>` : ''}</div>
      <p class="oc-rodape">As 8 Outlands têm os mesmos selvagens, XP, ouro e captura; só os drops raros mudam (Bronze Boss Token ${dec(analise.raros.token * 100, 3)}% e cada fragmento — Chave, Shiny Stone, Bicicleta — ${dec(analise.raros.chave * 100, 4)}% por abate na Outland 1), e a tabela já usa a mais alta que você liberou${(analise.op.multLoot || 1) > 1 ? ` e o seu bônus de loot (×${dec(analise.op.multLoot, 2)})` : ''}. “Fragmentos” soma os três tipos. ${precos ? 'O valor/h soma o ouro líquido com os raros pelos preços dos Ajustes, já tirando os 15% de comissão do Mercado.' : 'Ponha o preço do token e dos fragmentos em Ajustes para ver o valor por hora.'} O ouro líquido inclui a venda das capturas ao NPC: as variantes da Outland nascem no Nv 100 e valem ×3.</p>`;
  }

  function abaHunts() {
    if (!analise) return '';
    if (prefs.ordem === 'outland') return abaOutland();
    const { melhor, alternativa, bonus } = analise;
    const ativa = OC.sessao?.ativa();
    let topo = '<div class="oc-caixa">Nenhuma hunt liberada é segura e lucrativa com este pokémon agora.</div>';
    if (melhor) {
      topo = `<div class="oc-veredito">
        <span class="oc-rot">Melhor farm agora${prefs.ordem === 'ouro' ? ', por ouro' : prefs.ordem === 'abates' ? ', por abates' : ''}</span>
        <b class="oc-nome">${esc(melhor.nome)}</b>
        <span class="oc-onde">${regiao(melhor.regiao)}, nível ${num(melhor.nivel)}</span>
        <div class="oc-nums">
          <div><b>${curto(melhor.xpPkH)}</b><span>XP/h do pokémon</span></div>
          <div><b>${sinal(melhor.liq)}</b><span>ouro líquido/h</span></div>
          <div><b>${seg(melhor.ttk)}</b><span>por abate</span></div>
          <div><b>${pct(melhor.hitPct)}</b><span>pior golpe dele</span></div>
        </div>
        <p>${melhor.melhorGolpe ? `${esc(melhor.melhorGolpe.nome)} acerta ×${dec(melhor.ef)}. ` : ''}${alternativa ? `Para fazer ouro: <button type="button" class="oc-link" data-sel="${esc(alternativa.slug)}">${esc(alternativa.nome)}</button> dá ${Math.round((1 - alternativa.xpPkH / melhor.xpPkH) * 100)}% menos XP e ${sinal(alternativa.liq - melhor.liq)} de ouro líquido/h${prefs.vender ? ' (contando a venda das capturas, que varia muito de hora em hora)' : ''}. ` : ''}<button type="button" class="oc-link" data-sel="${esc(melhor.slug)}">Ver o setup</button></p>
      </div>`;
    }
    const bon = bonus.itens.length
      ? bonus.itens.map((i) => `${esc(i.nome)} ${i.mult >= 2 ? `×${dec(i.mult, 2)}` : `+${Math.round((i.mult - 1) * 100)}%`}`).join(', ')
      : 'nenhum bônus de XP ativo';
    const linhas = analise.linhas.filter((l) => (!prefs.soLiberadas || l.liberada) && !(prefs.esconderPerigo && !l.inviavel && OC.perigosa(l)));
    const corpo = linhas.slice(0, mostrando).map((l, i) => {
      if (l.inviavel) return `<tr class="oc-dim"><td>${i + 1}</td><td><b>${esc(l.h?.nome ?? l.slug)}</b><small>nível ${num(l.nivel)}</small></td><td colspan="6">não mata o selvagem</td></tr>`;
      const cls = [l === melhor ? 'oc-top' : '', l.slug === ativa ? 'oc-campo' : '', l.liberada ? '' : 'oc-dim'].join(' ');
      return `<tr class="${cls}"><td>${i + 1}</td>
        <td><button type="button" class="oc-hunt" data-sel="${esc(l.slug)}">${esc(l.nome)}</button>${l.slug === ativa ? '<span class="oc-aqui">você está aqui</span>' : ''}<small>${regiao(l.regiao)}, nível ${num(l.nivel)}${l.liberada ? '' : ', bloqueada'}</small></td>
        <td>${curto(l.xpPkH)}</td><td class="${l.liq >= 0 ? 'oc-pos' : 'oc-neg'}">${sinal(l.liq)}</td>
        <td>${seg(l.ttk)}</td><td>${num(l.kph)}${l.calibrada ? `<small title="medido na aba Sessão (${num(l.calib.min)} min); o modelo dava ${num(l.kphModelo)}">medido</small>` : ''}</td>
        <td>×${dec(l.ef)}<small>${esc(l.melhorGolpe?.nome ?? '')}</small></td><td>${risco(l)}</td></tr>`;
    }).join('');
    return `${seletorUpar()}${topo}${blocoUpar(melhor)}
      <div class="oc-linha">Bônus de XP: ${bon}${bonus.itens.length ? ` <b>(pokémon ×${dec(bonus.pk, 2)}, treinador ×${dec(bonus.tr, 2)})</b>` : ''}</div>
      <div class="oc-ctrl">
        <span class="oc-seg">${[['xp', 'XP/h'], ['ouro', 'Ouro líquido'], ['abates', 'Abates/h'], ['outland', 'Outland']].map(([k, r]) => `<button type="button" data-ordem="${k}" aria-pressed="${prefs.ordem === k}">${r}</button>`).join('')}</span>
        <label><input type="checkbox" data-pref="soLiberadas" ${prefs.soLiberadas ? 'checked' : ''}> só liberadas</label>
        <label><input type="checkbox" data-pref="esconderPerigo" ${prefs.esconderPerigo ? 'checked' : ''}> esconder perigosas</label>
      </div>
      <div class="oc-tabela"><table><thead><tr><th>#</th><th>Hunt</th><th>XP/h</th><th>Ouro líq./h</th><th>Mata em</th><th>Abates/h</th><th>Seu golpe</th><th>Pior golpe</th></tr></thead>
      <tbody>${corpo || '<tr><td colspan="8">Nenhuma hunt passa nos filtros.</td></tr>'}</tbody></table>
      ${linhas.length > mostrando ? `<button type="button" class="oc-mais" data-acao="mais">mostrar mais (${linhas.length - mostrando})</button>` : ''}</div>
      <p class="oc-rodape">${analise.linhas.length} hunts simuladas em ${analise.ms} ms com os dados do jogo${jogo?.versao ? ` v${esc(jogo.versao)}` : ''}. Toque numa hunt para ver o setup. Ferramenta da comunidade, sem ligação com os desenvolvedores do PokeIdle.${analise.P.aoe ? ' Seu pokémon tem TM AoE: o modelo conta um alvo por golpe, então o real deve render mais.' : ''}</p>`;
  }

  function abaSetup() {
    const r = selRow();
    if (!r) return '<div class="oc-aviso">Nenhuma hunt para montar setup.</div>';
    const H = Math.max(0.5, Number(prefs.horas) || 4);
    const folga = (x) => Math.ceil(x * 1.1);
    const tem = (tipo, id) => OC.estoque(eu, tipo, id);
    const temTxt = (v) => (v == null ? '?' : num(v));

    let pocHtml;
    if (r.umHit) pocHtml = '<b class="oc-grande">Nenhuma resolve</b><p>O pior golpe daqui passa do seu HP inteiro. Poção não salva de um golpe só.</p>';
    else if (prefs.pocao === 'nenhuma') pocHtml = `<b class="oc-grande">Sem poção</b><p>O pokemon ativo cai ${dec(r.mortesH)} vez(es) por hora. Se a equipe inteira cair, o treinador perde 10% do XP do nível. ${esc(r.pocoes[0].nome)} sairia por ${curto(r.pocoes[0].custoH)}/h.</p>`;
    else {
      const p = r.pocao;
      pocHtml = `<b class="oc-grande">${esc(p.nome)}</b>
        <p>Em “Usar Poções”, cure quando o HP cair abaixo de <b>${pct(p.thr)}</b>. Uns ${num(p.porH)} por hora, ${curto(p.custoH)} de ouro.</p>
        <table class="oc-mini"><thead><tr><th>Poção</th><th>Por hora</th><th>Ouro/h</th></tr></thead><tbody>
        ${r.pocoes.map((x) => `<tr class="${x.id === p.id ? 'oc-esta' : ''}"><td>${esc(x.nome)}</td><td>${num(x.porH)}</td><td>${curto(x.custoH)}</td></tr>`).join('')}
        </tbody></table>`;
    }
    const b = r.bola;
    const bolaHtml = `<b class="oc-grande">${esc(b.nome)}</b>
      <p>${b.chave === 'nenhuma' ? (prefs.vender ? 'Aqui nenhuma bola se paga vendendo as capturas.' : 'Sem vender as capturas, bola é só gasto.') + ' Lançar ainda é o único jeito de pegar um shiny.'
        : `Captura ${dec(b.ch * 100, 2)}% dos corpos, uns ${dec(b.capH)} por hora. Bolas: ${curto(b.custoH)}/h${prefs.vender ? `; vendendo as capturas: ${curto(b.vendaH)}/h; saldo <b class="${b.saldo >= 0 ? 'oc-pos' : 'oc-neg'}">${sinal(b.saldo)}/h</b>` : ''}.`}</p>
      <table class="oc-mini"><thead><tr><th>Bola</th><th>Captura</th><th>Saldo/h</th></tr></thead><tbody>
      ${r.bolas.map((x) => `<tr class="${x.chave === b.chave ? 'oc-esta' : ''}"><td>${esc(x.nome)}${x.premium ? ' <small>(diamante)</small>' : ''}</td><td>${x.chave === 'nenhuma' ? '—' : `${dec(x.ch * 100, 2)}%`}</td><td class="${x.saldo >= 0 ? 'oc-pos' : 'oc-neg'}">${sinal(x.saldo)}</td></tr>`).join('')}
      </tbody></table>
      ${(() => { const be = r.bolas.find((x) => x.chave === 'beast'); if (!be || !prefs.vender) return '';
        const porArr = be.capH > 0 ? be.vendaH / Math.max(1, r.kph) : 0;
        return `<p class="oc-nota">Beast Ball aqui rende ~${num(porArr)} de ouro por arremesso, contra ~${num(prefs.precoBeast)} que ela custa (Ajustes). Ela não vai ao Mercado: se você tem, ela entra no automático. O shiny é sorteado no arremesso e foge se a bola falhar, então bola melhor também segura mais shiny.</p>`; })()}`;

    const lista = OC.mochila(r, H);
    const reviveNeed = r.hitPct >= 0.6;
    let custo = 0;
    const mochila = lista.map((i) => {
      if (!i.premium) custo += i.falta * i.preco;
      const falta = i.premium ? (i.falta ? 'sem estoque' : 'ok') : (i.falta ? num(i.falta) : 'ok');
      return `<tr><td>${esc(i.nome)}</td><td>${num(i.precisa)}</td><td>${i.tem == null ? '?' : num(i.tem)}</td><td class="${i.falta ? 'oc-neg' : 'oc-pos'}">${falta}</td></tr>`;
    }).join('');
    const aqui = eu?.huntSlug === r.slug && !eu?.noCentro;
    const bj = OC.bolaDoJogo?.(), bolaJogo = bj ? OC.BOLAS.find((b) => b.id === bj.id) : null;
    const avisoBola = bolaJogo && r.bola && bolaJogo.id !== r.bola.id && prefs.bola !== 'nenhuma'
      ? `<div class="oc-aviso">O jogo está arremessando <b>${esc(bolaJogo.nome)}</b> (${num(bj.n)} nos últimos 15 min), mas a extensão está calculando${r.bola.premium ? ' e repondo' : ''} com <b>${esc(r.bola.nome)}</b>${r.bola.premium ? `, que não se compra com ouro: a ${esc(bolaJogo.nome)} nunca é reposta` : ''}. A ordem das bolas é escolhida no próprio jogo, na automação de lançar. <button type="button" class="oc-btn" data-bola-jogo="${esc(bolaJogo.chave)}">Usar ${esc(bolaJogo.nome)} na extensão</button></div>` : '';
    const reserva = Number(prefs.autoReserva) || 0, livre = (Number(eu?.gold) || 0) - reserva;
    const avisoReserva = custo > 0 && reserva > 0 && custo > livre
      ? `<div class="oc-aviso">A reserva de ouro (${curto(reserva)}, em Ajustes) deixa só ${curto(Math.max(0, livre))} livres para compras, e este setup custa ${curto(custo)}. A compra para antes: baixe a reserva ou espere juntar.</div>` : '';
    const autoTxt = OC.auto ? `${avisoBola}${avisoReserva}<div class="oc-auto">
        ${confirmando === r.slug
          ? `<p>Vou comprar ${lista.filter((i) => i.falta > 0 && !i.premium).map((i) => `${num(i.falta)} ${esc(i.nome)}`).join(' e ') || 'nada'} (${curto(custo)} de ouro; você tem ${curto(Number(eu?.gold) || 0)})${simulandoOutro() ? `, colocar ${esc(pkAnalise().nome)} em campo` : ''}${aqui && !simulandoOutro() ? '' : ` e levar você para ${esc(r.nome)} assim que a troca de área liberar`}.${simulandoOutro() && !prefs.ativar?.caminho ? ' <b class="oc-neg">Antes, ensine a troca de pokémon na aba Hunts.</b>' : ''}${(Number(eu?.gold) || 0) - custo < (Number(prefs.autoReserva) || 0) ? ` <b class="oc-neg">Isso deixaria o ouro abaixo da reserva de ${curto(Number(prefs.autoReserva) || 0)} (Ajustes): a compra vai parar antes.</b>` : ''}</p>
             <button type="button" class="oc-btn" data-acao="preparar-ok">Confirmar</button> <button type="button" class="oc-link" data-acao="preparar-nao">cancelar</button>`
          : `<button type="button" class="oc-btn" data-acao="preparar" ${OC.auto.ocupado() ? 'disabled' : ''}>${aqui ? 'Comprar o que falta' : 'Comprar o que falta e caçar aqui'}</button>`}
        <p class="oc-nota">${esc(OC.auto.status())}</p></div>` : '';
    return `<div class="oc-linha"><b>${esc(r.nome)}</b>, ${regiao(r.regiao)} nível ${num(r.nivel)}. O pior golpe daqui tira ${pct(r.hitPct)} do seu HP (${num(analise.P.hp)}).${r === analise.melhor ? ' É a hunt recomendada.' : ' <button type="button" class="oc-link" data-sel="">voltar à recomendada</button>'}</div>
      <div class="oc-cols">
        <div class="oc-card"><h4>Poção</h4>${pocHtml}</div>
        <div class="oc-card"><h4>Pokébola</h4>${bolaHtml}</div>
        <div class="oc-card"><h4>Mochila para <input type="number" class="oc-horas" min="0.5" max="48" step="0.5" value="${H}" data-pref-num="horas" aria-label="horas"> h</h4>
          <table class="oc-mini"><thead><tr><th>Item</th><th>Precisa</th><th>Tem</th><th>Falta</th></tr></thead><tbody>${mochila || '<tr><td colspan="4">Nada a levar.</td></tr>'}</tbody></table>
          <p>Comprar o que falta: <b>${curto(custo)}</b> de ouro. A hunt rende ${curto((r.ouroH + b.vendaH) * H)} no mesmo tempo.</p>
          <p class="oc-nota">${reviveNeed ? 'O pior golpe passa de 60% do HP: leve Revives de reserva.' : 'Revive é desnecessário aqui com a poção ligada.'} Quantidades com 10% de folga.</p>
          ${autoTxt}
        </div>
      </div>`;
  }

  function abaSessao() {
    const s = OC.sessao?.atual();
    if (!s || !s.slug) return '<div class="oc-aviso">Entre numa hunt para começar a medir. A medição começa sozinha quando você muda de hunt.</div>';
    const est = analise?.linhas.find((l) => l.slug === s.slug && !l.inviavel);
    const comp = (real, prev) => (real != null && prev ? ` <small>(${pct(real / prev)} da estimativa de ${curto(prev)})</small>` : '');
    const c = s.consumo;
    const hist = OC.sessao.historico();
    return `<div class="oc-linha"><b>${esc(s.nome)}</b> há ${num(s.minutos)} min. ${s.minutos < 10 ? 'Com menos de 10 minutos os números ainda oscilam bastante.' : ''}</div>
      <div class="oc-grade">
        <div class="oc-card"><h4>Abates</h4><b class="oc-grande">${num(s.abates)}</b><p>${num(s.abatesH)}/h${comp(s.abatesH, est?.kph)}</p></div>
        <div class="oc-card"><h4>XP do pokémon</h4><b class="oc-grande">${s.xpPk != null ? curto(s.xpPk) : '—'}</b><p>${s.xpPkH != null ? `${curto(s.xpPkH)}/h${comp(s.xpPkH, est?.xpPkH)}` : 'o jogo não expôs a sessão'}</p></div>
        <div class="oc-card"><h4>Ouro</h4><b class="oc-grande">${s.gold != null ? curto(s.gold) : '—'}</b><p>${s.goldH != null ? `${curto(s.goldH)}/h` : ''}</p></div>
        <div class="oc-card"><h4>Consumo</h4><p>${c ? `${num(c.bolas)} bolas, ${num(c.pocoes)} poções, ${num(c.revives)} revives` : '—'}</p><p>${s.capturas != null ? `${num(s.capturas)} capturas` : ''}</p></div>
      </div>
      <div class="oc-ctrl"><button type="button" class="oc-btn" data-acao="zerar">Zerar medição</button>
        ${Object.keys(OC.sessao.calibracao()).length ? `<button type="button" class="oc-link" data-acao="esquecer-calib">esquecer as ${Object.keys(OC.sessao.calibracao()).length} hunts medidas</button>` : ''}</div>
      <p class="oc-nota">Depois de 15 min e 100 abates na mesma hunt, o ranking passa a usar os abates/h medidos aqui no lugar do modelo (vale por 3 dias).</p>
      ${hist.length ? `<h4 class="oc-sub">Hunts anteriores</h4><div class="oc-tabela"><table><thead><tr><th>Hunt</th><th>Tempo</th><th>Abates/h</th><th>XP/h</th><th>Ouro/h</th></tr></thead><tbody>
        ${hist.map((h) => `<tr><td>${esc(h.nome)}</td><td>${num(h.minutos)} min</td><td>${num(h.abatesH)}</td><td>${h.xpPkH != null ? curto(h.xpPkH) : '—'}</td><td>${h.goldH != null ? curto(h.goldH) : '—'}</td></tr>`).join('')}
        </tbody></table></div>` : ''}`;
  }

  function abaDrops() {
    const s = OC.sessao?.atual();
    if (!s || !s.slug) return '<div class="oc-aviso">Entre numa hunt para começar a contar os drops.</div>';
    const est = analise?.linhas.find((l) => l.slug === s.slug && !l.inviavel);
    const nomeDe = (id) => itens?.porId.get(String(id))?.nome ?? `Item #${id}`;
    const esperadoDe = (nome, id) => est?.loot.find((l) => (id != null && String(l.id) === String(id)) || l.nome === nome);
    const vistos = new Set();
    const linhas = s.drops.map((d) => {
      const nome = nomeDe(d.id); vistos.add(nome);
      const e = esperadoDe(nome, d.id);
      const real = s.abates > 0 ? s.abates / d.qtd : null;
      const esp = e?.porAbate > 0 ? 1 / e.porAbate : null;
      return `<tr><td>${esc(nome)}</td><td>${num(d.qtd)}</td><td>${real ? `1 a cada ${num(real)}` : '—'}</td><td>${esp ? `1 a cada ${num(esp)}` : 'não cai aqui'}</td><td>${e ? dec(e.porAbate * s.abates) : '—'}</td></tr>`;
    }).join('');
    const faltando = (est?.loot ?? []).filter((l) => !vistos.has(l.nome)).map((l) =>
      `<tr class="oc-dim"><td>${esc(l.nome)}</td><td>0</td><td>—</td><td>1 a cada ${num(1 / l.porAbate)}</td><td>${dec(l.porAbate * s.abates)}</td></tr>`).join('');
    return `<div class="oc-linha"><b>${esc(s.nome)}</b>: ${num(s.abates)} abates desde ${new Date(s.inicio).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}.</div>
      <div class="oc-tabela"><table><thead><tr><th>Item</th><th>Caiu</th><th>Real</th><th>Regra do jogo</th><th>Esperado até agora</th></tr></thead>
      <tbody>${linhas || ''}${faltando}${!linhas && !faltando ? '<tr><td colspan="5">Nenhum drop ainda.</td></tr>' : ''}</tbody></table></div>
      <p class="oc-nota">“Real” é a diferença da sua bolsa desde o começo da medição dividida pelos abates. “Regra do jogo” é a chance da Wiki: cada selvagem solta só a pedra de cada tipo dele (0,2% no 1º estágio, 0,35% no meio, 0,5% na forma final) e, na Outland, o Bronze Boss Token (0,05% na Outland 1). O loot antigo que ainda aparece no catálogo não cai mais. Item raro precisa de centenas de abates para a média aparecer: com chance de 0,5%, passar 500 abates sem nenhum ainda acontece em ~8% das vezes. Se você comprar ou vender um item durante a medição, ele entra na conta.</p>`;
  }

  function abaAjustes() {
    const opt = (v, r, atual) => `<option value="${v}" ${String(atual) === String(v) ? 'selected' : ''}>${r}</option>`;
    return `<div class="oc-form">
      <label>Poção automática<select data-pref-sel="pocao">${opt('auto', 'A mais barata em cada hunt', prefs.pocao)}${opt('nenhuma', 'Sem poção', prefs.pocao)}${OC.POCOES.map((p) => opt(p.id, p.nome, prefs.pocao)).join('')}</select></label>
      <label>Pokébola<select data-pref-sel="bola">${opt('auto', 'A de melhor saldo em cada hunt', prefs.bola)}${opt('nenhuma', 'Não lançar', prefs.bola)}${OC.BOLAS.map((b) => opt(b.chave, b.nome, prefs.bola)).join('')}</select></label>
      <label class="oc-chk"><input type="checkbox" data-pref="vender" ${prefs.vender ? 'checked' : ''}> Vendo as capturas no NPC</label>
      <label>Quanto custa uma Beast Ball para você (ouro)${campoDin('data-pref-num="precoBeast"', prefs.precoBeast)}</label>
      <label>Bicicleta<select data-pref-sel="bike">${[[0, 'Sem bicicleta'], [0.15, 'Comum (+15%)'], [0.25, 'Incomum (+25%)'], [0.5, 'Rara (+50%)'], [0.75, 'Mítica (+75%)'], [1, 'Lendária (+100%)']].map(([v, r]) => opt(v, r, prefs.bike)).join('')}</select></label>
      <label>Pódio de ginásio <small>· +25% líder, +10% 2º, +5% 3º no dano do pokémon do tipo, na hunt e no boss</small>
        <span class="oc-ginasios">${OC.TIPOS18.map((t) => { const g = (prefs.ginasios ?? []).find((x) => x.tipo === t); return `<select data-ginasio="${t}" title="${t}"><option value="">${t}: —</option>${[1, 2, 3].map((p) => `<option value="${p}" ${g?.pos === p ? 'selected' : ''}>${t}: ${p === 1 ? 'líder' : `${p}º`}</option>`).join('')}</select>`; }).join('')}</span></label>
      <label>Tipagem do dia (troca às 18:00)${prefs.tipoDiaManual && prefs.tipoDiaManual !== 'auto' && prefs.tipoDiaManualAte ? ` <small>· sua escolha vale até ${new Date(prefs.tipoDiaManualAte).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</small>` : ''}<select data-pref-sel="tipoDiaManual">${opt('auto', OC.tipoDoDia?.({ welcome, eu }) ? `Do jogo: ${TIPO[OC.tipoDoDia({ welcome, eu })]}` : 'Do jogo (se ele informar)', prefs.tipoDiaManual ?? 'auto')}${opt('nenhum', 'Ignorar', prefs.tipoDiaManual)}${Object.entries(TIPO).map(([k, r]) => opt(k, r, prefs.tipoDiaManual)).join('')}</select></label>
      <label>Nunca deixar o HP cair abaixo de<select data-pref-sel="hpMinimo">${[[0.25, '25%'], [0.35, '35%'], [0.5, '50%'], [0.65, '65%']].map(([v, r]) => opt(v, r, prefs.hpMinimo)).join('')}</select></label>
      </div>
      <h4 class="oc-sub">Diagnóstico</h4>
      <div class="oc-caixa">Junta o que a extensão está lendo do jogo e as contas dela (seu pokémon, a hunt atual, bônus, XP, a sessão), sem nick nem dados de conta, para conferir se está tudo certo.
        <div class="oc-ctrl" style="margin:8px 0 0"><button type="button" class="oc-btn" data-acao="diag-copiar">Copiar diagnóstico</button> <button type="button" class="oc-link" data-acao="diag-baixar">baixar como arquivo</button></div>
        ${diagMsg && !diagMsg.startsWith('mk:') ? `<p class="oc-nota">${esc(diagMsg)}</p>` : ''}</div>
      <h4 class="oc-sub">Avisos</h4>
      <div class="oc-form">
      ${[['captura', 'Captura boa'], ['drop', 'Drop raro (token, fragmento, ticket)'], ['hunt', 'Hunt melhor liberada'], ['estoque', 'Estoque acabando'], ['equipe', 'Equipe inteira caiu'], ['auto', 'Automação parou'], ['boss', 'Boss derrotado']]
        .map(([k, r]) => `<label class="oc-chk"><input type="checkbox" data-pref="aviso_${k}" ${prefs[`aviso_${k}`] !== false ? 'checked' : ''}> ${r}</label>`).join('')}
      <label class="oc-chk"><input type="checkbox" data-pref="avisoSom" ${prefs.avisoSom ? 'checked' : ''}> Tocar um bip</label>
      <label>Captura boa: potência a partir de<select data-pref-sel="avisoPotMin">${[[2, 'P2'], [3, 'P3'], [4, 'P4'], [5, 'P5']].map(([v, r]) => opt(v, r, prefs.avisoPotMin)).join('')}</select></label>
      <label>ou qualidade a partir de<select data-pref-sel="avisoQualMin">${[[1.3, '1,3'], [1.5, '1,5'], [1.7, '1,7']].map(([v, r]) => opt(v, r, prefs.avisoQualMin)).join('')}</select></label>
      <label>ou IV somado a partir de<select data-pref-sel="avisoIvMin">${[[130, '130'], [140, '140'], [150, '150'], [160, '160']].map(([v, r]) => opt(v, r, prefs.avisoIvMin)).join('')}</select></label>
      </div>
      <div class="oc-ctrl" style="margin-top:8px">
        <button type="button" class="oc-btn" data-acao="notif">${OC.avisos?.permissao() === 'granted' ? 'Notificações ativas' : 'Ativar notificações do navegador'}</button>
        <button type="button" class="oc-link" data-acao="notif-teste">testar</button>
      </div>
      ${OC.avisos?.historico().length ? `<div class="oc-caixa">${OC.avisos.historico().slice(0, 8).map((a) => `<div>${new Date(a.t).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })} <b>${esc(a.titulo)}</b> ${esc(a.texto)}</div>`).join('')}</div>` : ''}
      <h4 class="oc-sub">Valores de referência</h4>
      <div class="oc-form">
      <label>Quanto vale 1 💎 para você (Gemas) <small>· o Mercado não negocia mais diamante: use o que você paga na Loja (1 Gema = US$ 0,01)</small><input type="number" class="oc-num" min="1" step="0.5" value="${prefs.precoDiamante}" data-pref-num="precoDiamante"></label>
      <label>Bronze Boss Token no Mercado (Coins)${campoDin('data-pref-num="precoToken"', prefs.precoToken)}</label>
      <label>Fragmento de Chave (Coins)${campoDin('data-pref-num="precoFragChave"', prefs.precoFragChave)}</label>
      <label>Fragmento de Shiny Stone (Coins)${campoDin('data-pref-num="precoFragShiny"', prefs.precoFragShiny)}</label>
      <label>Fragmento de Bicicleta (Coins)${campoDin('data-pref-num="precoFragBike"', prefs.precoFragBike)}</label>
      <label>Alvo do Boost dos Atrasados (se o jogo não informar)<input type="number" class="oc-num" min="1" value="${prefs.alvoAtrasados}" data-pref-num="alvoAtrasados"></label>
      </div>
      <h4 class="oc-sub">Automação (desligada até você ligar)</h4>
      <div class="oc-form">
      <label class="oc-chk"><input type="checkbox" data-pref="autoRepor" ${prefs.autoRepor ? 'checked' : ''}> Repor poção e bola sozinho durante a hunt</label>
      <label class="oc-chk"><input type="checkbox" data-pref="autoTrocar" ${prefs.autoTrocar ? 'checked' : ''}> Trocar de hunt quando a recomendada render 10% mais XP</label>
      <label>Repor quando o estoque durar menos de (horas)<input type="number" class="oc-num" min="0.25" max="24" step="0.25" value="${prefs.autoMinHoras}" data-pref-num="autoMinHoras"></label>
      <label>Comprar para (horas)<input type="number" class="oc-num" min="0.5" max="48" step="0.5" value="${prefs.horas}" data-pref-num="horas"></label>
      <label>Nunca deixar o ouro abaixo de${campoDin('data-pref-num="autoReserva"', prefs.autoReserva)}</label>
      <label>Gastar no máximo por hora${campoDin('data-pref-num="autoTetoHora"', prefs.autoTetoHora)}</label>
      <label>Se a troca não liberar (a hunt não para de lutar)<select data-pref-sel="autoForcar">${opt('nao', 'Esperar', prefs.autoForcar ?? 'nao')}${opt('rope', 'Usar uma Escape Rope (1 💎, sem perder XP)', prefs.autoForcar)}${opt('desistir', 'Desistir do combate (perde 10% do XP do nível)', prefs.autoForcar)}</select></label>
      <label>depois de esperar (min)<input type="number" class="oc-num" min="0.5" max="30" step="0.5" value="${prefs.autoForcarApos ?? 2}" data-pref-num="autoForcarApos"></label>
      </div>
      ${prefs.autoForcar && prefs.autoForcar !== 'nao' ? `<div class="oc-caixa">${(() => {
        const t = prefs.autoForcar, gravado = prefs[`saida_${t}`], ativo = OC.auto?.gravando() === t;
        const nome = t === 'rope' ? 'a Escape Rope' : 'o Desistir do Combate';
        const tGrav = (() => { try { return JSON.parse(gravado)?.t; } catch { return null; } })();
        return `${gravado ? `Saída gravada: <b>${esc(tGrav ?? 'mensagem do jogo')}</b>.` : `Falta ensinar ${nome}.`}
          ${ativo ? ` <b>Gravando:</b> clique agora em ${nome} no jogo (ele vai mesmo sair da hunt${t === 'rope' ? ' e gastar uma corda' : ''}).` : ` A extensão não conhece essa mensagem: aperte o botão abaixo e use ${nome} uma vez, que ela guarda o que o jogo mandou.`}
          <div class="oc-ctrl" style="margin:8px 0 0"><button type="button" class="oc-btn" data-gravar="${t}">${ativo ? 'Cancelar' : gravado ? 'Gravar de novo' : 'Gravar agora'}</button></div>`;
      })()}</div>` : ''}
      <p class="oc-nota">A automação só faz o que os botões do jogo fazem: compra na loja do NPC e escolhe a hunt no Mapa, uma ação a cada poucos segundos, e só troca de área fora de combate. A troca automática espera 15 min na hunt atual antes de mudar. Numa hunt que não para de lutar a troca nunca libera; a saída forçada resolve: a Escape Rope custa 1 💎 e não tira XP, desistir custa 10% do XP do nível atual (nada, com o Boost dos Atrasados). Ela não mexe na % da cura automática do jogo: ajuste no “Usar Poções” o valor que a aba Setup indica. Sem automação ligada, a extensão só lê o jogo. Seus ajustes ficam neste navegador e nada é enviado a lugar nenhum.</p>
      <p class="oc-nota">Onde Caçar é uma ferramenta não oficial, feita pela comunidade, sem ligação com os desenvolvedores do PokeIdle.</p>
      ${OC.auto?.log().length ? `<h4 class="oc-sub">O que a automação fez</h4><div class="oc-caixa">${OC.auto.log().slice(0, 10).map((l) => `<div class="${l.tipo === 'erro' ? 'oc-neg' : ''}">${new Date(l.t).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })} ${esc(l.txt)}</div>`).join('')}</div>` : ''}`;
  }


  // ---- Progresso ----------------------------------------------------------------------------
  // Curva da Wiki: xpTotal(L) = arred(50/3 × (L³ − 6L² + 17L − 12)), a mesma para treinador e pokémon.
  const xpTotal = (L) => (L <= 1 ? 0 : Math.round(50 / 3 * (L ** 3 - 6 * L ** 2 + 17 * L - 12)));
  OC.xpTotal = xpTotal;
  const tempo = (h) => {
    if (!Number.isFinite(h) || h < 0) return '—';
    if (h < 1) return `${Math.max(1, Math.round(h * 60))} min`;
    if (h < 48) { const hh = Math.floor(h), mm = Math.round((h - hh) * 60); return `${hh} h${mm ? ` ${mm} min` : ''}`; }
    if (h / 24 > 365) return 'mais de 1 ano';
    return `${dec(h / 24)} dias`;
  };
  const xpDoTreinador = () => {
    const L = eu?.level ?? 1, base = xpTotal(L), x = Number(eu?.xp) || 0;
    if (x >= base) return x; // o jogo mandou o XP total
    return base + Math.min(x, xpTotal(L + 1) - base - 1); // ou só o do nível atual
  };
  function ritmoTreinador() {
    const s = OC.sessao?.atual();
    if (s && s.slug === eu?.huntSlug && s.minutos >= 10 && s.xpTrH > 0) return { v: s.xpTrH, fonte: `medido nesta hunt (${num(s.minutos)} min)` };
    const aqui = analise?.linhas.find((l) => l.slug === eu?.huntSlug && !l.inviavel) ?? analise?.melhor;
    return aqui ? { v: aqui.xpTrH, fonte: `estimado em ${aqui.nome}` } : null;
  }

  /** Os multiplicadores do treinador que estão no ritmo, cada um com quando acaba (ms; Infinity = fixo). */
  function boostsDoTreinador() {
    const l = eu?.loja ?? {}, agora = Number(eu?.servidorAgora) || Date.now();
    const venc = { 'VIP': Number(l.vipAte), 'XP Boost': Number(l.boosts?.xp), 'Kick': Number(eu?.kick?.bonus?.xp), 'Evento (treinador)': Number(eu?.evento?.terminaEm) };
    return (analise?.bonus?.itens ?? []).filter((i) => i.quem !== 'pk').map((i) => {
      let ate = venc[i.nome];
      if (i.nome === 'Twitch') ate = prefs.contarLive ? Infinity : agora; // só enquanto você assiste
      else if (i.nome === 'Atrasados') ate = Infinity;                     // tratado à parte
      else if (!Number.isFinite(ate) || !ate) ate = Infinity;              // guild e outros: sem data
      return { ...i, horas: ate === Infinity ? Infinity : Math.max(0, (ate - agora) / 3.6e6) };
    });
  }
  /** Horas para juntar `falta` de XP, com o ritmo caindo a cada boost que vence. */
  function horasCom(falta, rAgora, lista, fator = 1) {
    const todos = lista.reduce((p, b) => p * b.mult, 1);
    const base = rAgora / todos; // o ritmo sem nenhum dos boosts da lista
    const quebras = [...new Set(lista.map((b) => b.horas).filter((h) => Number.isFinite(h) && h > 0))].sort((a, b) => a - b);
    let t = 0, resto = falta;
    for (const q of [...quebras, Infinity]) {
      const ritmo = base * fator * lista.filter((b) => b.horas > t).reduce((p, b) => p * b.mult, 1);
      if (ritmo <= 0) return Infinity;
      const cabe = ritmo * (q - t);
      if (cabe >= resto) return t + resto / ritmo;
      resto -= cabe; t = q;
    }
    return Infinity;
  }

  function abaProgresso() {
    if (!eu) return '';
    const L = eu.level ?? 1, xp = xpDoTreinador(), r = ritmoTreinador();
    const at = eu.loja?.atrasados;
    const alvoJogo = Number(eu.loja?.alvoAtrasados) || Number(at?.alvo) || 0;
    const alvo = alvoJogo || Number(prefs.alvoAtrasados) || 870;
    const ativo = Number(at?.mult) > 1 && L < alvo;
    const mostraBoost = !ativo && L < alvo; // passou do alvo: o boost não existe para você
    const marcos = [[L + 1, 'próximo nível'], [150, 'Outland, Ginásio e PvP Ranqueado'], [300, 'bosses Regirock e Regice (Mega Stone, peças de TM)'],
      [500, 'Hoenn e Orre (Z-Move e AoE fazem falta)'], [650, 'bosses Registeel e Kyogre'], [alvo, 'nível dos veteranos (fim do Boost dos Atrasados)'], [1000, 'Sinnoh e Outland 2 (token 25% mais rápido)'],
      [2000, 'Outland 3'], [3100, 'bosses Groudon e Rayquaza (1,5% de peça e de Mega)'], [4000, 'Outland 4 (token ×2)'],
      [5000, 'Unova (fragmento de Ovo Shiny)'], [8000, 'Outland 5'], [9750, 'bosses Uxie e Mesprit'], [10000, 'Kalos'],
      [16000, 'Outland 6'], [22700, 'bosses Azelf e Dialga'], [25000, 'Alola'], [40000, 'Galar'], [75000, 'Paldea']];
    const johto = [200, 230, 260, 290, 320, 350, 380, 410, 440, 470].find((t) => t > L);
    if (johto) marcos.push([johto, `próxima faixa de Johto (nv ${johto})`]);
    const lista = marcos.filter(([n]) => n > L && !(n === alvo && L >= alvo)).sort((a, b) => a[0] - b[0]).filter((m, i, a) => i === 0 || m[0] !== a[i - 1][0]).slice(0, 7);
    const bt = r ? boostsDoTreinador() : [];
    const tempoAte = (n) => (r ? horasCom(Math.max(0, xpTotal(n) - xp), r.v, bt) : NaN);
    const comBoost = (n) => {
      if (!r) return NaN;
      const xa = xpTotal(alvo), xn = xpTotal(n);
      const comDez = Math.max(0, Math.min(xn, xa) - xp);   // até o alvo, ×10
      const semDez = Math.max(0, xn - Math.max(xa, xp));   // depois do alvo, ×1
      const t1 = horasCom(comDez, r.v, bt, 10);
      const bt2 = bt.map((b) => ({ ...b, horas: Math.max(0, b.horas - t1) }));
      return t1 + horasCom(semDez, r.v, bt2);
    };
    const linhas = lista.map(([n, nome]) => `<tr><td><b>${num(n)}</b><small>${esc(nome)}</small></td><td>${curto(Math.max(0, xpTotal(n) - xp))}</td><td>${r ? tempo(tempoAte(n)) : '—'}</td>${mostraBoost ? `<td>${r ? tempo(comBoost(n)) : '—'}</td>` : ''}</tr>`).join('');
    const xpAlvo = xpTotal(alvo);
    const preco = Math.max(50, Math.ceil(1000 * Math.max(0, xpAlvo - xp) / xpAlvo));
    const gemas = preco * (Number(prefs.precoDiamante) || 7);
    const pk = pkAtivo();
    return `<div class="oc-linha">Treinador nv <b>${num(L)}</b> com ${curto(xp)} de XP. Ritmo: <b>${r ? `${curto(r.v)}/h` : '—'}</b>${r ? ` <small>(${esc(r.fonte)})</small>` : ''}.${pk ? ` Seu pokémon pode chegar até o nv ${num(L + 5)}.` : ''}</div>
      ${bt.length ? `<div class="oc-linha">Bônus no ritmo: ${bt.map((b) => `${esc(b.nome)} ×${dec(b.mult, 2)}${b.nome === 'Twitch' ? (prefs.contarLive ? ' (contando a live)' : ' (fora dos tempos: só vale enquanto você assiste)') : Number.isFinite(b.horas) ? ` (acaba em ${tempo(b.horas)})` : ''}`).join(', ')}.
        <label class="oc-chk" style="margin-left:8px"><input type="checkbox" data-pref="contarLive" ${prefs.contarLive ? 'checked' : ''}> contar a live nos tempos</label></div>` : ''}
      <div class="oc-tabela"><table><thead><tr><th>Nível</th><th>XP que falta</th><th>No ritmo atual</th>${mostraBoost ? '<th>Com Atrasados ×10</th>' : ''}</tr></thead><tbody>${linhas}</tbody></table></div>
      <div class="oc-caixa" style="margin-top:8px">${ativo
        ? `<b>Boost dos Atrasados ativo</b>: XP ×10 até o nv ${num(alvo)}. O ritmo acima já conta com ele.`
        : L >= alvo ? 'Você já passou do nível dos veteranos: o Boost dos Atrasados não se aplica.'
        : `<b>Boost dos Atrasados</b> até o nv ${num(alvo)}: ~<b>${num(preco)} 💎</b>${preco === 50 ? ' (o preço mínimo)' : ''} no seu nível (pela fórmula da Wiki; o card da Loja mostra o valor exato), ~${num(gemas)} Gemas (~US$ ${dec(gemas / 100, 2)}) contando o diamante a ${num(prefs.precoDiamante)} Gemas (o valor dos Ajustes).`}</div>
      <p class="oc-nota">Cada boost conta só até vencer. Conforme você sobe, abrem hunts melhores e o ritmo cresce, então os tempos longos tendem a ser menores. O alvo do Atrasados é recalculado todo dia pelo jogo (${alvoJogo ? `hoje: nv ${num(alvo)}, mediana de ${num(Number(eu.loja?.alvoAtrasadosN) || 0)} veteranos, lido do jogo` : `usando ${num(alvo)}; ajuste em Ajustes`}).</p>`;
  }

  // ---- Capturar: onde e em quanto tempo sai um pokémon específico ---------------------------
  let alvoTxt = '';
  // Os 110 lendários e míticos da Arena Mística (Wiki)
  const LENDARIOS = new Set('Articuno Zapdos Moltres Mewtwo Raikou Entei Suicune Lugia Ho-oh Regirock Regice Registeel Latias Latios Kyogre Groudon Rayquaza Uxie Mesprit Azelf Dialga Palkia Heatran Regigigas Giratina Cresselia Cobalion Terrakion Virizion Tornadus Thundurus Reshiram Zekrom Landorus Kyurem Xerneas Yveltal Zygarde Type:_Null Silvally Tapu_Koko Tapu_Lele Tapu_Bulu Tapu_Fini Cosmog Cosmoem Solgaleo Lunala Nihilego Buzzwole Pheromosa Xurkitree Celesteela Kartana Guzzlord Necrozma Poipole Naganadel Stakataka Blacephalon Zacian Zamazenta Eternatus Kubfu Urshifu Regieleki Regidrago Glastrier Spectrier Calyrex Wo-Chien Chien-Pao Ting-Lu Chi-Yu Koraidon Miraidon Walking_Wake Iron_Leaves Okidogi Munkidori Fezandipiti Ogerpon Gouging_Fire Raging_Bolt Iron_Boulder Iron_Crown Terapagos Mew Celebi Jirachi Deoxys Phione Manaphy Darkrai Shaymin Arceus Victini Keldeo Meloetta Genesect Diancie Hoopa Volcanion Magearna Marshadow Zeraora Meltan Melmetal Zarude Pecharunt'.split(' ').map((n) => n.replace(/_/g, ' ').toLowerCase()));
  const POT3 = 0.055, QUAL15 = 0.0596; // chances de P3+ e de qualidade 1,5+ (tabelas da Wiki)
  function especiesEmHunt() {
    const ids = new Set();
    for (const h of welcome?.hunts ?? []) for (const e of h.especies ?? []) if (Number(e.pontos) > 0) ids.add(e.pokeId);
    return ids;
  }
  function acharEspecie(txt) {
    const t = String(txt ?? '').trim().toLowerCase().replace(/^#/, '');
    if (!t || !jogo) return null;
    if (/^\d+$/.test(t)) return jogo.especies.get(Number(t)) ?? null;
    let parcial = null;
    for (const e of jogo.especies.values()) {
      const n = String(e.name ?? '').toLowerCase();
      if (n === t) return e;
      if (!parcial && n.startsWith(t)) parcial = e;
    }
    return parcial;
  }
  // ---- Campos de dinheiro: 20.000.000 com pontos enquanto digita; aceita 20m, 1,5b, 500k --------------
  /** "20.000.000" → 20000000; "20m" / "20 mi" / "20kk" → 20000000; "1,5b" → 1500000000; "500k" → 500000. */
  function parseValor(txt) {
    const t = String(txt ?? '').trim().toLowerCase().replace(/\s+/g, '');
    if (!t) return NaN;
    const m = t.match(/^([\d.,]+)(kk|k|mil|mi|m|bi|b)?$/);
    if (!m) return NaN;
    const mult = { k: 1e3, mil: 1e3, kk: 1e6, m: 1e6, mi: 1e6, b: 1e9, bi: 1e9 }[m[2]] ?? 1;
    let n = m[1];
    if (mult === 1) n = /,\d{1,2}$/.test(n) ? n.replace(/\./g, '').replace(',', '.') // "20.000,50": vírgula no fim é decimal
      : n.replace(/[.,]/g, '');                                       // sem sufixo: pontos e vírgulas são milhar
    else n = n.replace(/\.(?=\d{3}(\D|$))/g, '').replace(',', '.');  // com sufixo: vírgula (ou ponto) é decimal
    const v = Number(n) * mult;
    return Number.isFinite(v) ? Math.round(v) : NaN;
  }
  const fmtDin = (v) => (Number(v) > 0 ? Math.round(Number(v)).toLocaleString('pt-BR') : '');
  /** "20.000.000" → "20 milhões" (a dica embaixo do campo, para conferir as casas). */
  function porExtenso(v) {
    if (!(v > 0)) return '';
    const c = (x, um, varios) => { const r = Math.round(x * 100) / 100; return `${String(r).replace('.', ',')} ${r < 2 ? um : varios}`; };
    if (v >= 1e9) return c(v / 1e9, 'bilhão', 'bilhões');
    if (v >= 1e6) return c(v / 1e6, 'milhão', 'milhões');
    if (v >= 1e3) return c(v / 1e3, 'mil', 'mil');
    return String(v);
  }
  /** Um campo de dinheiro: texto com pontos, dica por extenso embaixo. */
  function campoDin(attrs, valor, ph = '') {
    const n = typeof valor === 'string' ? parseValor(valor) : Number(valor);
    const mostra = Number.isFinite(n) && n > 0 ? fmtDin(n) : (typeof valor === 'string' ? valor : '');
    return `<input type="text" inputmode="decimal" autocomplete="off" class="oc-num oc-din" ${attrs} value="${esc(mostra)}" placeholder="${esc(ph)}"><small class="oc-din-dica">${esc(Number.isFinite(n) ? porExtenso(n) : '')}</small>`;
  }
  /** Põe os pontos de milhar enquanto digita, sem tirar o cursor do lugar (só quando é número puro). */
  function formatarDin(el) {
    const v = el.value;
    const dica = el.parentElement?.querySelector('.oc-din-dica');
    if (dica) { const x = parseValor(v); dica.textContent = v.trim() ? (Number.isFinite(x) ? porExtenso(x) : 'não entendi o valor') : ''; }
    if (!/^[\d.\s]*$/.test(v)) return; // tem sufixo ou vírgula: arruma quando sair do campo
    const pos = el.selectionStart ?? v.length;
    const antes = v.slice(0, pos).replace(/\D/g, '').length;
    const dig = v.replace(/\D/g, '').replace(/^0+(?=\d)/, '');
    const novo = dig ? Number(dig).toLocaleString('pt-BR') : '';
    if (novo === v) return;
    el.value = novo;
    let i = 0, c = 0;
    while (i < novo.length && c < antes) { if (/\d/.test(novo[i])) c++; i++; }
    try { el.setSelectionRange(i, i); } catch { /* campo sem cursor */ }
  }
  const valorDe = (el) => (el.classList.contains('oc-din') ? parseValor(el.value) : Number(el.value));

  // ---- Mercado da Comunidade: alvos de compra ---------------------------------------------
  // O formulário vive aqui, e não na tela: o painel redesenha a cada evento do Mercado, e o que
  // estivesse só na tela se perderia no meio do preenchimento.
  const formNovo = () => ({ tipo: 'pokemon', nome: '', teto: '', moeda: 'gold', qtd: '1', modo: 'avisar', relPct: '',
    potenciaMin: '', notaMin: '', ivMin: '', qualidadeMin: '', nivelMin: '', nivelMax: '', shiny: 'qualquer', soTmAoe: false, semOutland: false, zerar: false });
  const mk = { f: formNovo(), editando: null, msg: '', msgTipo: '', remover: null };
  const shinyDeAlvo = (f) => f?.shiny ?? (f?.soShiny ? 'so' : 'qualquer');
  const decimal = (v) => String(v ?? '').trim().replace(',', '.');
  function especiePorNome(nome) {
    const n = String(nome ?? '').trim().toLowerCase().replace(/^#/, '');
    if (!n || !jogo) return null;
    return [...jogo.especies.values()].find((e) => String(e.name).toLowerCase() === n || String(e.pokeId) === n) ?? null;
  }
  function filtrosTxt(a) {
    const f = a.filtros ?? {}, sh = shinyDeAlvo(f);
    return [f.potenciaMin && `P${f.potenciaMin}+`, f.notaMin && `nota ${String(f.notaMin).replace('.', ',')}+`, f.ivMin && `IV ${f.ivMin}+`,
      f.qualidadeMin && `Q ${String(f.qualidadeMin).replace('.', ',')}+`, (f.nivelMin || f.nivelMax) && `nv ${f.nivelMin || 1}${f.nivelMax ? `–${f.nivelMax}` : '+'}`,
      sh === 'so' && 'só shiny', sh === 'nao' && 'sem shiny', f.soTmAoe && 'com TM AoE', f.semOutland && 'sem Outland'].filter(Boolean).join(' · ');
  }
  const precoAlvoTxt = (a) => [Number(a.teto) > 0 && OC.mercado.preco(a.teto, a.moeda), Number(a.relPct) > 0 && `${a.relPct}% abaixo do preço justo`].filter(Boolean).join(' e ');

  /** O alvo que o formulário descreve, ou { erro }. */
  function alvoDoForm() {
    const f = mk.f, M = OC.mercado;
    const teto = parseValor(f.teto), relPct = Number(decimal(f.relPct)) || 0;
    if (f.teto.trim() && !Number.isFinite(teto)) return { erro: `Não entendi o preço "${f.teto}". Use só números (20.000.000) ou com k, m, b (20m, 1,5b).` };
    const a = { tipo: f.tipo, teto: Number.isFinite(teto) ? teto : 0, moeda: f.moeda, qtdMax: Math.max(0, Number(f.qtd) || 0), modo: f.modo };
    if (f.tipo === 'item') {
      a.itemId = M.idDoItem(f.nome.trim());
      if (a.itemId == null) return { erro: f.nome.trim() ? `Não conheço o item "${f.nome}". Use "carregar itens do Mercado" e escolha um nome da lista.` : 'Diga qual item.' };
      a.nome = M.nomeItem(a.itemId);
      if (!(a.teto > 0)) return { erro: 'Diga o preço máximo por unidade.' };
      return { a };
    }
    const esp = especiePorNome(f.nome);
    if (f.nome.trim() && !esp) return { erro: `Não achei a espécie "${f.nome}". Escolha um nome da lista, ou deixe vazio para qualquer pokémon.` };
    a.especieId = esp?.pokeId ?? null; a.nome = esp?.name ?? '';
    if (relPct > 0 && !a.especieId) return { erro: 'O preço relativo ao preço justo precisa de uma espécie: o preço justo é calculado por espécie.' };
    if (relPct >= 100) return { erro: 'O desconto sobre o preço justo vai de 1% a 99%.' };
    a.relPct = relPct > 0 ? relPct : 0;
    if (!(a.teto > 0) && !(a.relPct > 0)) return { erro: 'Diga o preço máximo, ou o desconto mínimo sobre o preço justo.' };
    const nMin = Number(f.nivelMin) || 0, nMax = Number(f.nivelMax) || 0;
    if (nMin && nMax && nMax < nMin) return { erro: 'O nível máximo está abaixo do mínimo.' };
    a.filtros = { potenciaMin: f.potenciaMin, notaMin: decimal(f.notaMin), ivMin: f.ivMin, qualidadeMin: decimal(f.qualidadeMin),
      nivelMin: f.nivelMin, nivelMax: f.nivelMax, shiny: f.shiny, soTmAoe: !!f.soTmAoe, semOutland: !!f.semOutland };
    return { a };
  }
  /** O alvo em uma frase, para conferir antes de salvar. */
  function resumoDoForm() {
    const r = alvoDoForm();
    if (r.erro) return { txt: r.erro, erro: true };
    const a = r.a, M = OC.mercado;
    const oque = a.tipo === 'item' ? a.nome : `${a.nome || 'qualquer pokémon'}${filtrosTxt(a) ? ` (${filtrosTxt(a)})` : ''}`;
    const quanto = a.qtdMax > 0 ? `até ${a.qtdMax} ${a.tipo === 'item' ? 'unidade' : 'pokémon'}${a.qtdMax > 1 ? 's' : ''}` : 'sem limite de quantidade';
    const avisos = [];
    if (a.tipo === 'pokemon' && a.filtros.shiny === 'so' && a.moeda === 'gold') avisos.push('Shiny só é vendido em Gemas: em Coins este alvo nunca vai achar nada.');
    if (a.modo === 'comprar' && a.moeda === 'orb' && !prefs.mercadoGemas) avisos.push('A compra em Gemas está desligada nos limites abaixo: ele só vai avisar até você ligar.');
    if (a.modo === 'comprar' && !a.qtdMax) avisos.push(`Sem limite de quantidade, a única trava é o gasto máximo por dia (${M.preco(M.limite(a.moeda), a.moeda)}).`);
    if (a.modo === 'comprar' && !a.especieId && a.tipo === 'pokemon') avisos.push('Qualquer espécie no modo comprar: ele compra o primeiro que aparecer dentro do preço.');
    if (Number(a.filtros?.notaMin) > 0 && Number(a.filtros.notaMin) < 3.5) avisos.push('O Mercado só aceita nota 3,5 ou mais (menos shiny, P5 e lendário): abaixo disso o filtro não muda nada.');
    return { txt: `${a.modo === 'comprar' ? 'Comprar' : 'Avisar quando aparecer'} ${oque} por ${precoAlvoTxt(a)}, ${quanto}.`, avisos };
  }
  function atualizarResumo() {
    const el = painel?.querySelector('[data-mk-resumo]');
    if (!el) return;
    const r = resumoDoForm();
    el.className = `oc-caixa ${r.erro ? 'oc-neg' : ''}`;
    el.innerHTML = `${r.erro ? '' : '<b>Resumo:</b> '}${esc(r.txt)}${(r.avisos ?? []).map((x) => `<br><span class="oc-neg">${esc(x)}</span>`).join('')}`;
  }
  function editarAlvo(a) {
    const f = a.filtros ?? {};
    mk.f = { ...formNovo(), tipo: a.tipo, nome: a.nome || '', teto: Number(a.teto) > 0 ? String(a.teto) : '', moeda: a.moeda, qtd: String(a.qtdMax ?? 0), modo: a.modo,
      relPct: Number(a.relPct) > 0 ? String(a.relPct) : '', potenciaMin: f.potenciaMin ?? '', notaMin: f.notaMin ?? '', ivMin: f.ivMin ?? '', qualidadeMin: f.qualidadeMin ?? '',
      nivelMin: f.nivelMin ?? '', nivelMax: f.nivelMax ?? '', shiny: shinyDeAlvo(f), soTmAoe: !!f.soTmAoe, semOutland: !!f.semOutland };
    mk.editando = a.id; mk.msg = ''; mk.remover = null;
  }

  function abaMercado() {
    const M = OC.mercado;
    if (!M) return '<div class="oc-aviso">O módulo do Mercado não carregou. Recarregue a página.</div>';
    const g = M.gasto(), md = M.medias(), alvos = prefs.mercadoAlvos ?? [], f = mk.f;
    const linhas = alvos.map((a, i) => {
      const media = a.tipo === 'item' ? md[a.itemId]?.[a.moeda] : null;
      const minimo = a.tipo === 'item' ? md[a.itemId]?.[a.moeda === 'orb' ? 'minOrb' : 'minGold'] : null;
      const confirmaDel = mk.remover === a.id;
      return `<tr class="${[a.ativo ? '' : 'oc-dim', mk.editando === a.id ? 'oc-campo' : ''].join(' ')}"><td><b>${esc(a.nome || (a.tipo === 'item' ? 'item' : 'qualquer pokémon'))}</b><small>${a.tipo === 'pokemon' ? `pokémon${filtrosTxt(a) ? ` · ${esc(filtrosTxt(a))}` : ''}` : 'item'}</small></td>
        <td>${esc(precoAlvoTxt(a))}</td>
        <td>${media ? esc(M.preco(Math.round(media), a.moeda)) : '—'}${minimo ? `<small>menor agora: ${esc(M.preco(minimo, a.moeda))}</small>` : ''}</td>
        <td>${a.modo === 'comprar' ? '<b>compra sozinho</b>' : 'só avisa'}${a.ativo ? '' : '<small>pausado</small>'}</td>
        <td>${num(a.comprados || 0)}${Number(a.qtdMax) > 0 ? ` de ${num(a.qtdMax)}` : ''}</td>
        <td class="oc-acoes"><button type="button" class="oc-link" data-mk-editar="${i}">editar</button> <button type="button" class="oc-link" data-mk-dup="${i}">duplicar</button>
          <button type="button" class="oc-link" data-mk-pausa="${i}">${a.ativo ? 'pausar' : 'ativar'}</button>
          ${confirmaDel ? `<button type="button" class="oc-link oc-neg" data-mk-del="${i}">confirmar remoção</button> <button type="button" class="oc-link" data-mk-del-nao>não</button>` : `<button type="button" class="oc-link" data-mk-del-pede="${i}">remover</button>`}</td></tr>`;
    }).join('');
    const nomesItens = [...new Set(Object.keys(md).map((id) => M.nomeItem(id)).filter((n) => !/^item #/.test(n)))].sort();
    const nomesEsp = jogo ? [...jogo.especies.values()].map((e) => e.name).filter(Boolean).sort() : [];
    const reg = M.registro().slice(0, 12).map((r) => `<li class="${r.tipo === 'erro' ? 'oc-neg' : r.tipo === 'ok' ? 'oc-pos' : ''}"><small>${new Date(r.t).toLocaleTimeString('pt-BR')}</small> ${esc(r.txt)}</li>`).join('');
    const opt = (v, r, at) => `<option value="${esc(v)}" ${String(at) === String(v) ? 'selected' : ''}>${r}</option>`;
    const pk = f.tipo === 'pokemon';
    const editando = alvos.find((a) => a.id === mk.editando);
    const itemRef = !pk ? (() => { const id = M.idDoItem(f.nome.trim()); const x = id != null ? md[id] : null; return x ? `média 7 dias: ${x[f.moeda] ? M.preco(Math.round(x[f.moeda]), f.moeda) : '—'} · menor agora: ${x[f.moeda === 'orb' ? 'minOrb' : 'minGold'] ? M.preco(x[f.moeda === 'orb' ? 'minOrb' : 'minGold'], f.moeda) : '—'}` : ''; })() : '';
    const esp = pk ? especiePorNome(f.nome) : null;
    const resumo = resumoDoForm();
    return `<div class="oc-caixa"><b>Como funciona:</b> todo anúncio fica 2 minutos retido, e quem pede nos 3 primeiros segundos depois de ele liberar entra num sorteio com a mesma chance. A extensão olha cada alvo a cada ~20 s, avisa quando aparece algo dentro do seu preço e, no modo "comprar sozinho", manda <b>um</b> pedido dentro da janela do sorteio, com o preço que viu (se o vendedor subir, o jogo recusa). Enquanto o Mercado do jogo estiver aberto na sua tela, ela espera.</div>
      <div class="oc-ctrl"><label><input type="checkbox" data-pref="mercadoLigado" ${prefs.mercadoLigado ? 'checked' : ''}> <b>Mercado ligado</b></label><span class="oc-nota">${esc(M.status())}${M.agendados() ? ` · ${M.agendados()} compra(s) agendada(s)` : ''}</span></div>
      ${prefs.mercadoLigado && alvos.some((a) => a.modo === 'comprar' && a.ativo) && !M.relogioOk() ? '<div class="oc-aviso">Entre numa hunt antes de deixar comprando: o relógio do servidor e o gatilho da compra vêm das mensagens do mapa. Sem elas, a extensão usa o relógio do PC e pode errar a janela do sorteio.</div>' : ''}
      <div class="oc-tabela"><table><thead><tr><th>Alvo</th><th>Preço máximo</th><th>Média 7 dias</th><th>Modo</th><th>Comprados</th><th></th></tr></thead>
      <tbody>${linhas || '<tr><td colspan="6">Nenhum alvo ainda: crie um abaixo.</td></tr>'}</tbody></table></div>
      <h4 class="oc-sub" data-mk-topo>${editando ? `Editando: ${esc(editando.nome || (editando.tipo === 'item' ? 'item' : 'qualquer pokémon'))}` : 'Novo alvo'}</h4>
      <div class="oc-ctrl"><span class="oc-seg">${[['pokemon', 'Pokémon'], ['item', 'Item']].map(([k, r]) => `<button type="button" data-mk-tipo="${k}" aria-pressed="${f.tipo === k}">${r}</button>`).join('')}</span></div>
      <div class="oc-form">
        <label>${pk ? 'Espécie <small>(vazio = qualquer pokémon)</small>' : 'Item'}<input type="text" class="oc-txt" data-mk="nome" list="oc-mk-nomes" value="${esc(f.nome)}" placeholder="${pk ? 'qualquer pokémon' : 'Fire Stone, Bronze Boss Token…'}">
          <small data-mk-esp>${pk ? (f.nome.trim() ? (esp ? `✓ ${esc(esp.name)} (#${esp.pokeId})` : 'não achei essa espécie') : 'qualquer espécie') : esc(itemRef)}</small></label>
        <datalist id="oc-mk-nomes">${(pk ? nomesEsp : nomesItens).map((n) => `<option value="${esc(n)}"></option>`).join('')}</datalist>
        <label>Preço máximo${pk ? '' : ' por unidade'}${campoDin('data-mk="teto"', f.teto, pk ? '20.000.000 ou 20m' : '50.000')}</label>
        <label>Moeda<select data-mk="moeda">${opt('gold', 'Coins', f.moeda)}${opt('orb', 'Gemas', f.moeda)}</select></label>
        ${pk ? `<label>Ou: pelo menos <small>% abaixo do preço justo (aba Preço)</small><input type="number" class="oc-num" min="0" max="99" step="1" data-mk="relPct" value="${esc(f.relPct)}" placeholder="ex.: 20"></label>` : ''}
        <label>Quantas no total <small>(0 = sem limite)</small><input type="number" class="oc-num" min="0" data-mk="qtd" value="${esc(f.qtd)}"></label>
        <label>Quando achar<select data-mk="modo">${opt('avisar', 'Só avisar', f.modo)}${opt('comprar', 'Comprar sozinho', f.modo)}</select></label>
      </div>
      ${pk ? `<h4 class="oc-sub">Filtros <small>(todos opcionais)</small></h4>
      <div class="oc-form">
        <label>Potência mínima<select data-mk="potenciaMin">${opt('', 'qualquer', f.potenciaMin)}${[2, 3, 4, 5].map((v) => opt(v, `P${v} ou mais`, f.potenciaMin)).join('')}</select></label>
        <label>Nota mínima<input type="number" class="oc-num" min="0" max="10" step="0.1" data-mk="notaMin" value="${esc(f.notaMin)}" placeholder="3,5 (piso do Mercado)"></label>
        <label>IV somado mínimo<input type="number" class="oc-num" min="0" max="192" data-mk="ivMin" value="${esc(f.ivMin)}" placeholder="qualquer"></label>
        <label>Qualidade mínima<input type="number" class="oc-num" min="0.8" max="1.8" step="0.01" data-mk="qualidadeMin" value="${esc(f.qualidadeMin)}" placeholder="qualquer"></label>
        <label>Nível mínimo<input type="number" class="oc-num" min="1" data-mk="nivelMin" value="${esc(f.nivelMin)}" placeholder="qualquer"></label>
        <label>Nível máximo<input type="number" class="oc-num" min="1" data-mk="nivelMax" value="${esc(f.nivelMax)}" placeholder="qualquer"></label>
        <label>Shiny<select data-mk="shiny">${opt('qualquer', 'tanto faz', f.shiny)}${opt('so', 'só shiny', f.shiny)}${opt('nao', 'sem shiny', f.shiny)}</select></label>
        <label class="oc-chk"><input type="checkbox" data-mk="soTmAoe" ${f.soTmAoe ? 'checked' : ''}> Só com TM AoE</label>
        <label class="oc-chk"><input type="checkbox" data-mk="semOutland" ${f.semOutland ? 'checked' : ''}> Sem variantes de Outland <small>(Furious, Brave, Ancient…)</small></label>
      </div>` : ''}
      <div data-mk-resumo class="oc-caixa ${resumo.erro ? 'oc-neg' : ''}">${resumo.erro ? '' : '<b>Resumo:</b> '}${esc(resumo.txt)}${(resumo.avisos ?? []).map((x) => `<br><span class="oc-neg">${esc(x)}</span>`).join('')}</div>
      <div class="oc-ctrl"><button type="button" class="oc-btn" data-acao="mk-salvar">${editando ? 'Salvar alterações' : 'Adicionar alvo'}</button>
        ${editando ? `<label class="oc-chk"><input type="checkbox" data-mk="zerar" ${f.zerar ? 'checked' : ''}> zerar os comprados (${num(editando.comprados || 0)})</label> <button type="button" class="oc-link" data-acao="mk-cancelar">cancelar edição</button>` : '<button type="button" class="oc-link" data-acao="mk-limpar">limpar</button>'}
        ${!pk ? '<button type="button" class="oc-link" data-acao="mk-medias">carregar itens do Mercado</button>' : ''}
        ${mk.msg ? `<span class="oc-nota ${mk.msgTipo === 'erro' ? 'oc-neg' : 'oc-pos'}">${esc(mk.msg)}</span>` : ''}</div>
      <h4 class="oc-sub">Limites e travas</h4>
      <div class="oc-form">
        <label>Gastar no máximo por dia (Coins)${campoDin('data-pref-num="mercadoLimiteGold"', prefs.mercadoLimiteGold, '0 = não compra em Coins')}</label>
        <label class="oc-chk"><input type="checkbox" data-pref="mercadoGemas" ${prefs.mercadoGemas ? 'checked' : ''}> Permitir comprar com Gemas</label>
        <label>Gastar no máximo por dia (Gemas)${campoDin('data-pref-num="mercadoLimiteOrb"', prefs.mercadoLimiteOrb, '0 = não compra em Gemas')}</label>
        <label class="oc-chk"><input type="checkbox" data-pref="precoOutlandDoMercado" ${prefs.precoOutlandDoMercado !== false ? 'checked' : ''}> Usar a média do Mercado como preço do token e dos fragmentos na visão Outland</label>
      </div>
      <p class="oc-nota">Hoje: ${esc(M.preco(g.gold || 0, 'gold'))} de ${esc(M.preco(M.limite('gold'), 'gold'))}${prefs.mercadoGemas ? ` · ${esc(M.preco(g.orb || 0, 'orb'))} de ${esc(M.preco(M.limite('orb'), 'orb'))}` : ' · Gemas desligadas'}. O limite conta o pedido na hora em que ele sai, e devolve se a compra não acontecer. Nos campos de preço dá para digitar 20m, 1,5b ou 500k.</p>
      <h4 class="oc-sub">Registro</h4><ul class="oc-lista">${reg || '<li>Nada ainda.</li>'}</ul>`;
  }

  // ---- Preço justo (price check) -------------------------------------------------------------
  // Aparece em dois lugares com o mesmo conteúdo: na aba Preço do painel e na gaveta que abre ao lado
  // do Mercado do jogo (o painel fica no meio da tela e tamparia o Mercado).
  const pc = { status: '', erro: null, aberto: null, lendo: false, lidoVitrine: 0, paraMim: new Map(), manualRes: null,
    manual: { nome: '', nivel: '', pot: '1', nota: '', shiny: false, aoe: false, el: false, rf: '', preco: '', moeda: 'orb' } };
  const ha = (ms) => { const m = Math.max(0, (Date.now() - ms) / 60000); return m < 60 ? `há ${Math.max(1, Math.round(m))} min` : m < 48 * 60 ? `há ${Math.round(m / 60)} h` : `há ${Math.round(m / 1440)} dias`; };
  const precoTxt = (v, moeda) => (Number.isFinite(v) ? `${num(Math.round(v))} ${moeda === 'orb' ? 'Gemas' : 'Coins'}` : '—');
  const tagVer = { barato: 'oc-bom', justo: '', caro: 'oc-atencao', 'muito caro': 'oc-ruim' };
  const etiquetas = (a) => [a.sh && '<span class="oc-tag oc-bom">shiny</span>', a.aoe && '<span class="oc-tag">TM AoE</span>', a.el && `<span class="oc-tag">TM ${esc(a.el)}</span>`, a.rf ? `<span class="oc-tag">+${a.rf} refino</span>` : ''].filter(Boolean).join(' ');
  const pcFiltroPadrao = { moeda: 'todas', ver: 'todos', ordem: 'negocio', shiny: 'qualquer', potMin: '', notaMin: '', semDominados: false };
  const pcF = () => (prefs.pcFiltro = { ...pcFiltroPadrao, ...(prefs.pcFiltro ?? {}) });
  let gaveta = null, pilula = null;

  /** Redesenha onde o preço aparece. Sem `forcar`, não atropela quem está digitando. */
  function redesenharPreco(forcar = false) {
    if (painel && prefs.aba === 'preco' && (forcar || !painel.querySelector('input:focus, select:focus, textarea:focus'))) desenhar();
    desenharGaveta(forcar);
    atualizarPilula();
  }

  async function lerVitrine(forcar = false) {
    const v = OC.preco?.vitrine();
    if (!v || pc.lendo || (!forcar && pc.lidoVitrine >= v.t)) return;
    pc.lendo = true; pc.erro = null;
    try {
      const grupos = new Map();
      for (const l of v.linhas) { const a = OC.preco.resumir(l.ficha); grupos.set(`${a.sp}:${a.sh}`, a); }
      for (const a of [...grupos.values()].slice(0, 3)) {
        const nome = `${a.nome}${a.sh ? ' shiny' : ''}`;
        pc.status = `lendo as vendas de ${nome}…`; redesenharPreco();
        await OC.preco.ler(a.sp, a.nome, a.sh, { forcar, aoProgredir: (n) => { pc.status = `lendo as vendas de ${nome}: página ${n}`; redesenharPreco(); } });
      }
      pc.lidoVitrine = v.t; pc.status = '';
    } catch (e) { pc.erro = e?.message ?? String(e); pc.status = ''; }
    pc.lendo = false; redesenharPreco();
  }

  /** XP/h que o pokémon do anúncio faria no nível do seu, comparado ao seu, nas mesmas hunts. */
  async function calcularParaMim(chave, ficha, preco, moeda) {
    const atual = pkAtivo();
    if (!atual) { pc.paraMim.set(chave, { erro: 'coloque o seu pokémon principal em campo' }); return; }
    try {
      jogo ??= await OC.carregarJogo();
      itens ??= OC.montarItens(jogo.itensBrutos, welcome);
      if (!jogo.especies.get(Number(ficha.speciesId))) throw new Error(`a espécie #${ficha.speciesId} não está no catálogo`);
      const L = Number(atual.level) || 1, k = L / (Number(ficha.level) || 1), s = ficha.stats ?? {};
      const st = { hp: s.hp * k, atk: s.atk * k, def: s.def * k, spAtk: s.spAtk * k, spDef: s.spDef * k, speed: s.speed * k };
      const pk = { id: '__mercado', speciesId: Number(ficha.speciesId), nome: ficha.nome, level: L, potencia: ficha.potencia, quality: ficha.quality,
        stats: st, ivs: ficha.ivs ?? {}, maxHp: Math.max(24, Math.round(st.hp * 12)), tmAoe: ficha.tmAoe, tmElemental: ficha.tmElemental };
      const ctx = { mod: jogo.mod, especies: jogo.especies, itens, hunts: welcome.hunts ?? [], welcome, eu };
      const op = { ...prefs, ordem: 'xp' };
      const seu = OC.analisar(atual, ctx, op).melhor, dele = OC.analisar(pk, ctx, op).melhor;
      const ganho = seu && dele ? dele.xpPkH / seu.xpPkH - 1 : null;
      pc.paraMim.set(chave, { L, seu, dele, ganho, preco, moeda, nomeSeu: atual.nome, nivelDele: Number(ficha.level) });
    } catch (e) { pc.paraMim.set(chave, { erro: e?.message ?? String(e) }); }
  }
  function blocoParaMim(chave) {
    const r = pc.paraMim.get(chave);
    if (!r) return `<button type="button" class="oc-link" data-pc-mim="${esc(chave)}">comparar com o meu pokémon em campo</button>`;
    if (r.erro) return `<div class="oc-aviso">${esc(r.erro)}</div>`;
    const custo = r.ganho > 0 ? (r.moeda === 'orb' ? `~US$ ${dec(r.preco / 100 / (r.ganho * 100), 2)} por +1% de XP/h` : `~${curto(r.preco / (r.ganho * 100))} Coins por +1% de XP/h`) : '';
    return `<div class="oc-caixa">No nv ${num(r.L)} (o do seu ${esc(r.nomeSeu)}), ele faria <b>${r.dele ? curto(r.dele.xpPkH) : '—'} XP/h</b>${r.dele ? ` em ${esc(r.dele.nome)}` : ' (nenhuma hunt segura)'} contra <b>${r.seu ? curto(r.seu.xpPkH) : '—'}</b> do seu${r.ganho != null ? `: <b class="${r.ganho >= 0 ? 'oc-pos' : 'oc-neg'}">${r.ganho >= 0 ? '+' : '−'}${Math.round(Math.abs(r.ganho) * 100)}%</b>` : ''}.
      ${custo ? ` Dá ${custo}.` : r.ganho != null ? ' No mesmo nível ele não supera o seu no seu melhor farm.' : ''}${r.nivelDele < r.L ? ` Ele está no nv ${num(r.nivelDele)}: até chegar no ${num(r.L)}, rende menos.` : ''}</div>`;
  }

  function blocoVizinhos(res, alvo) {
    if (!res?.vizinhos?.length) return '';
    const linhas = res.vizinhos.slice(0, 10).map((v) => `<tr><td>${ha(v.em)}</td><td>${num(v.lv)}</td><td>P${v.p}</td><td>${dec(v.n, 2)}</td><td>${etiquetas(v) || '—'}</td><td>${precoTxt(v.preco, v.moeda)}</td><td>${precoTxt(v.ajustado, v.moeda)}</td></tr>`).join('');
    return `<div class="oc-tabela"><table><thead><tr><th>Vendido</th><th>Nv</th><th>P</th><th>Nota</th><th></th><th>Por</th><th>Na nota ${dec(alvo.n, 2)}</th></tr></thead><tbody>${linhas}</tbody></table></div>
      <p class="oc-nota">As ${res.vizinhos.length} vendas mais parecidas entre ${num(res.grupo)} da espécie nos últimos 30 dias, das que mais pesam para as que menos pesam. “Na nota” é o preço da venda puxado para a nota deste anúncio: nas vendas desta espécie, cada ponto de nota ${res.bMedida ? 'multiplicou' : 'multiplica (estimativa padrão, poucas vendas para medir)'} o preço por ${dec(Math.exp(res.b), 1)}. Confiança <b>${res.confianca}</b>${res.confianca !== 'boa' ? ': poucas vendas parecidas, use como referência solta' : ''}.</p>`;
  }

  /** Os anúncios da vitrine avaliados, filtrados e na ordem escolhida. */
  function anunciosAvaliados() {
    const v = OC.preco?.vitrine();
    if (!v) return null;
    const todos = v.linhas.map((l) => {
      const a = OC.preco.resumir(l.ficha), preco = Number(l.preco);
      return { l, a, preco, res: OC.preco.avaliar({ ...a, moeda: l.moeda, preco }), melhor: OC.preco.melhorPorMenos(l, v.linhas) };
    });
    const f = pcF(), notaMin = Number(String(f.notaMin).replace(',', '.')) || 0;
    const passa = todos.filter((x) => (f.moeda === 'todas' || x.l.moeda === f.moeda)
      && (f.shiny === 'qualquer' || (f.shiny === 'so') === x.a.sh)
      && (!f.potMin || x.a.p >= Number(f.potMin))
      && (!notaMin || x.a.n >= notaMin)
      && (!f.semDominados || !x.melhor)
      && (f.ver === 'todos' || (f.ver === 'barato' ? x.res?.veredito === 'barato' : x.res?.veredito === 'barato' || x.res?.veredito === 'justo')));
    const moedaOrd = (x) => (x.l.moeda === 'orb' ? 0 : 1);
    const ordem = {
      negocio: (x, y) => (x.res?.delta ?? 9) - (y.res?.delta ?? 9),
      preco: (x, y) => moedaOrd(x) - moedaOrd(y) || x.preco - y.preco,
      nota: (x, y) => y.a.n - x.a.n,
      nivel: (x, y) => y.a.lv - x.a.lv,
    }[f.ordem] ?? ((x, y) => (x.res?.delta ?? 9) - (y.res?.delta ?? 9));
    return { v, todos, lista: passa.sort(ordem), baratos: todos.filter((x) => x.res?.veredito === 'barato').length };
  }

  function filtrosPreco(todos) {
    const f = pcF(), opt = (v, r, at) => `<option value="${esc(v)}" ${String(at) === String(v) ? 'selected' : ''}>${r}</option>`;
    const temOrb = todos.some((x) => x.l.moeda === 'orb'), temGold = todos.some((x) => x.l.moeda === 'gold');
    return `<div class="oc-pc-filtros">
      <span class="oc-seg">${[['todas', 'Todas'], ['orb', `Gemas${temOrb ? '' : ' (0)'}`], ['gold', `Coins${temGold ? '' : ' (0)'}`]].map(([k, r]) => `<button type="button" data-pcf-moeda="${k}" aria-pressed="${f.moeda === k}">${r}</button>`).join('')}</span>
      <select data-pcf="ordem" title="Ordenar">${opt('negocio', 'Melhor negócio', f.ordem)}${opt('preco', 'Menor preço', f.ordem)}${opt('nota', 'Maior nota', f.ordem)}${opt('nivel', 'Maior nível', f.ordem)}</select>
      <select data-pcf="ver" title="Veredito">${opt('todos', 'Todos os preços', f.ver)}${opt('justo', 'Barato ou justo', f.ver)}${opt('barato', 'Só baratos', f.ver)}</select>
      <select data-pcf="shiny" title="Shiny">${opt('qualquer', 'Shiny: tanto faz', f.shiny)}${opt('so', 'Só shiny', f.shiny)}${opt('nao', 'Sem shiny', f.shiny)}</select>
      <select data-pcf="potMin" title="Potência mínima">${opt('', 'Qualquer potência', f.potMin)}${[2, 3, 4, 5].map((p) => opt(p, `P${p} ou mais`, f.potMin)).join('')}</select>
      <input type="number" class="oc-num" data-pcf="notaMin" min="0" max="10" step="0.1" value="${esc(f.notaMin)}" placeholder="nota mín." title="Nota mínima">
      <label class="oc-chk"><input type="checkbox" data-pcf="semDominados" ${f.semDominados ? 'checked' : ''}> esconder quem tem igual ou melhor por menos</label>
      ${JSON.stringify(f) !== JSON.stringify(pcFiltroPadrao) ? '<button type="button" class="oc-link" data-pcf-limpar>limpar filtros</button>' : ''}
    </div>`;
  }

  function cartaoAnuncio({ l, a, preco, res, melhor }, agoraS) {
    const chave = `v${l.id}`, aberto = pc.aberto === chave;
    const retido = Number(l.compravelEm) > agoraS ? ` · <span class="oc-nota">retido mais ${Math.ceil((Number(l.compravelEm) - agoraS) / 1000)} s</span>` : '';
    const justo = res?.estimado ? `justo <b>${precoTxt(res.estimado, l.moeda)}</b> <small>(normal ${curto(Math.round(res.p25))}–${curto(Math.round(res.p75))})</small>`
      : res?.grupo ? '<small>sem venda parecida para comparar</small>' : '<small>nenhuma venda em 30 dias nesta moeda</small>';
    const dif = res?.delta != null ? ` · <b class="${res.delta <= 0 ? 'oc-pos' : 'oc-neg'}">${res.delta >= 0 ? '+' : '−'}${Math.round(Math.abs(res.delta) * 100)}%</b>` : '';
    const ver = res?.veredito ? ` <span class="oc-tag ${tagVer[res.veredito]}">${res.veredito}</span>${res.confianca !== 'boa' ? ` <small>confiança ${res.confianca}</small>` : ''}` : '';
    return `<div class="oc-pc-card ${res?.veredito === 'barato' ? 'oc-pc-barato' : ''} ${aberto ? 'oc-pc-aberto' : ''}">
      <div class="oc-pc-topo" data-pc-abrir="${esc(chave)}" role="button" tabindex="0" title="${aberto ? 'fechar' : 'ver as vendas parecidas'}">
        <div class="oc-pc-l1"><span><b>${esc(a.nome)}</b> nv ${num(a.lv)} ${etiquetas(a)}</span><b class="oc-pc-preco">${precoTxt(preco, l.moeda)}</b></div>
        <div class="oc-pc-l2">P${a.p} · nota ${dec(a.n, 2)} · IV ${num(a.iv)} · Q ${dec(a.q, 3)}${retido}</div>
        <div class="oc-pc-l3">${justo}${dif}${ver}</div>
        ${melhor ? `<div class="oc-pc-l3 oc-neg">tem igual ou melhor por ${precoTxt(Number(melhor.preco), melhor.moeda)}</div>` : ''}
      </div>
      ${aberto ? `<div class="oc-pc-det">${blocoVizinhos(res, a)}${blocoParaMim(chave)}</div>` : ''}
    </div>`;
  }

  /** Filtros + os anúncios avaliados (o mesmo conteúdo na aba e na gaveta). */
  function listaPreco() {
    if (!OC.preco || !OC.mercado) return '<div class="oc-aviso">O módulo do Mercado não carregou. Recarregue a página.</div>';
    const r = anunciosAvaliados();
    if (!r) return '<div class="oc-caixa">No Mercado do jogo, abra a aba <b>Pokemon</b> e clique numa espécie. Os anúncios dela aparecem aqui, cada um comparado com as vendas reais dos últimos 30 dias, já ajustado pela nota, potência, nível e TM.</div>';
    const nomes = [...new Set(r.todos.map((x) => `${x.a.nome}${x.a.sh ? ' shiny' : ''}`))].join(', ');
    const agoraS = OC.agoraServidor?.() ?? Date.now();
    return `${filtrosPreco(r.todos)}
      <div class="oc-ctrl"><span><b>${esc(nomes)}</b>: ${r.lista.length === r.todos.length ? `${r.todos.length} anúncio${r.todos.length > 1 ? 's' : ''}` : `${r.lista.length} de ${r.todos.length} anúncios`}${r.baratos ? ` · <b class="oc-pos">${r.baratos} barato${r.baratos > 1 ? 's' : ''}</b>` : ''} · aberto ${ha(r.v.t)}</span>
        <button type="button" class="oc-link" data-acao="pc-reler" ${pc.lendo ? 'disabled' : ''}>reler as vendas</button></div>
      ${pc.status ? `<div class="oc-nota">${esc(pc.status)}</div>` : ''}
      ${pc.erro ? `<div class="oc-aviso">Não consegui ler as vendas: ${esc(pc.erro)}</div>` : ''}
      <div class="oc-pc-lista">${r.lista.map((x) => cartaoAnuncio(x, agoraS)).join('') || '<div class="oc-caixa">Nenhum anúncio passa nos filtros.</div>'}</div>`;
  }

  function abaPreco() {
    const m = pc.manual, opt = (val, r, at) => `<option value="${val}" ${String(at) === String(val) ? 'selected' : ''}>${r}</option>`;
    const nomesEsp = jogo ? [...jogo.especies.values()].map((e) => e.name).filter(Boolean).sort() : [];
    let manual = '';
    if (pc.manualRes?.erro) manual = `<div class="oc-aviso">${esc(pc.manualRes.erro)}</div>`;
    else if (pc.manualRes) {
      const { res, alvo } = pc.manualRes;
      manual = !res?.estimado ? `<div class="oc-aviso">${res?.grupo ? 'Há vendas da espécie, mas nenhuma parecida o bastante (outra potência, nível ou TM).' : `Nenhuma venda de ${esc(alvo.nome)}${alvo.sh ? ' shiny' : ''} em ${alvo.moeda === 'orb' ? 'Gemas' : 'Coins'} nos últimos 30 dias.`}</div>`
        : `<div class="oc-veredito"><span class="oc-rot">Preço justo</span><b class="oc-nome">${precoTxt(res.estimado, alvo.moeda)}</b>
          <span class="oc-onde">faixa normal ${precoTxt(res.p25, alvo.moeda)} a ${precoTxt(res.p75, alvo.moeda)}${res.veredito ? ` · pedindo ${precoTxt(alvo.preco, alvo.moeda)}: <span class="oc-tag ${tagVer[res.veredito]}">${res.veredito}</span> (${res.delta >= 0 ? '+' : '−'}${Math.round(Math.abs(res.delta) * 100)}%)` : ''}</span></div>
          ${blocoVizinhos(res, alvo)}`;
    }
    return `<div class="oc-ctrl"><label class="oc-chk"><input type="checkbox" data-pref="pcGaveta" ${prefs.pcGaveta === false ? '' : 'checked'}> Mostrar a gaveta de preço ao lado do Mercado do jogo</label></div>
      ${listaPreco()}
      <h4 class="oc-sub">Avaliar um pokémon específico</h4>
      <div class="oc-form">
        <label>Espécie<input type="text" class="oc-txt" data-pc="nome" list="oc-pc-nomes" value="${esc(m.nome)}" placeholder="Charizard, Mega Charizard Y…"></label>
        <datalist id="oc-pc-nomes">${nomesEsp.map((n) => `<option value="${esc(n)}"></option>`).join('')}</datalist>
        <label>Nível<input type="number" class="oc-num" min="1" data-pc="nivel" value="${esc(m.nivel)}"></label>
        <label>Potência<select data-pc="pot">${[1, 2, 3, 4, 5].map((p) => opt(p, `P${p}`, m.pot)).join('')}</select></label>
        <label>Nota<input type="number" class="oc-num" min="0" max="10" step="0.01" data-pc="nota" value="${esc(m.nota)}"></label>
        <label>Refino total<input type="number" class="oc-num" min="0" data-pc="rf" value="${esc(m.rf)}"></label>
        <label>Moeda<select data-pc="moeda">${opt('orb', 'Gemas', m.moeda)}${opt('gold', 'Coins', m.moeda)}</select></label>
        <label>Preço pedido <small>(opcional)</small>${campoDin('data-pc="preco"', m.preco, 'opcional')}</label>
        <label class="oc-chk"><input type="checkbox" data-pc="shiny" ${m.shiny ? 'checked' : ''}> Shiny</label>
        <label class="oc-chk"><input type="checkbox" data-pc="aoe" ${m.aoe ? 'checked' : ''}> TM AoE</label>
        <label class="oc-chk"><input type="checkbox" data-pc="el" ${m.el ? 'checked' : ''}> TM elemental</label>
      </div>
      <div class="oc-ctrl"><button type="button" class="oc-btn" data-acao="pc-avaliar" ${pc.lendo ? 'disabled' : ''}>Avaliar</button></div>
      ${manual}
      <p class="oc-nota">Compara só com vendas da mesma espécie, na mesma moeda, com o mesmo brilho (e P5 só com P5), dos últimos 30 dias. As vendas mais recentes e mais parecidas em potência, nível, TM AoE, TM elemental e refino pesam mais, e cada uma é ajustada para a nota do anúncio. Uma venda isolada a preço absurdo não arrasta a conta: o preço justo é a mediana. ${num(OC.preco?.total() ?? 0)} vendas guardadas neste navegador, lidas da Tabela de preços do jogo (um pedido a cada 3 s, só quando você abre uma espécie ou clica em Avaliar). <button type="button" class="oc-link" data-acao="pc-esquecer">esquecer as vendas guardadas</button></p>`;
  }

  // ---- a gaveta ao lado do Mercado do jogo ----------------------------------------------------
  /** Cliques dentro da extensão não chegam ao jogo: senão o jogo entende "clicou fora" e fecha o Mercado. */
  const naExtensao = (t) => !!t?.closest?.('.oc-painel, .oc-pilula');
  for (const tipo of ['mousedown', 'pointerdown', 'touchstart']) root.addEventListener(tipo, (e) => { if (naExtensao(e.target)) e.stopImmediatePropagation(); }, true);
  const isolar = (el) => { for (const tipo of ['click', 'mouseup', 'pointerup', 'touchend', 'keydown']) el.addEventListener(tipo, (e) => { if (e.key !== 'Escape') e.stopPropagation(); }); return el; };

  function desenharGaveta(forcar = false) {
    if (!gaveta) return;
    if (!forcar && gaveta.querySelector('input:focus')) return;
    const sc = gaveta.querySelector('.oc-gv-corpo')?.scrollTop ?? 0;
    gaveta.className = `oc-painel oc-gaveta${prefs.pcLado === 'esq' ? ' oc-esq' : ''}`;
    gaveta.innerHTML = `<div class="oc-cab"><div class="oc-titulo"><h3>Preço justo</h3><small>vendas reais dos últimos 30 dias</small></div>
        <button type="button" class="oc-fechar" data-gv="lado" title="Mudar de lado" aria-label="Mudar de lado">⇆</button>
        <button type="button" class="oc-fechar" data-gv="recolher" title="Recolher" aria-label="Recolher">–</button></div>
      <div class="oc-gv-corpo">${listaPreco()}</div>`;
    gaveta.querySelector('.oc-gv-corpo').scrollTop = sc;
    ligarPreco(gaveta);
    gaveta.querySelector('[data-gv="lado"]').addEventListener('click', () => { prefs.pcLado = prefs.pcLado === 'esq' ? 'dir' : 'esq'; salvarPrefs(); desenharGaveta(true); });
    gaveta.querySelector('[data-gv="recolher"]').addEventListener('click', () => { prefs.pcGavetaRecolhida = true; salvarPrefs(); controlarGaveta(); });
  }
  function atualizarPilula() {
    if (!pilula) return;
    const r = anunciosAvaliados();
    pilula.className = `oc-pilula${prefs.pcLado === 'esq' ? ' oc-esq' : ''}`;
    pilula.innerHTML = `💰 Preço justo${r?.baratos ? ` <b>${r.baratos}</b>` : ''}`;
    pilula.title = r ? `${r.todos.length} anúncios avaliados${r.baratos ? `, ${r.baratos} baratos` : ''}` : 'Abra uma espécie no Mercado';
  }
  /** Mostra a gaveta (ou a abinha recolhida) enquanto o Mercado do jogo estiver na tela. */
  function controlarGaveta() {
    if (!document.body) return;
    const naTela = prefs.pcGaveta !== false && !!OC.mercado?.naTela?.();
    if (!naTela) { gaveta?.remove(); gaveta = null; pilula?.remove(); pilula = null; return; }
    if (!prefs.pcGavetaRecolhida) {
      pilula?.remove(); pilula = null;
      if (!gaveta) { gaveta = isolar(document.createElement('div')); gaveta.setAttribute('role', 'complementary'); gaveta.setAttribute('aria-label', 'Preço justo'); document.body.append(gaveta); desenharGaveta(true); lerVitrine(); }
    } else {
      gaveta?.remove(); gaveta = null;
      if (!pilula) {
        pilula = isolar(document.createElement('button')); pilula.type = 'button';
        pilula.addEventListener('click', () => { prefs.pcGavetaRecolhida = false; salvarPrefs(); controlarGaveta(); });
        document.body.append(pilula); atualizarPilula();
      }
    }
  }
  setInterval(controlarGaveta, 700);

  /** Os controles do preço, no painel ou na gaveta. */
  function ligarPreco(raiz) {
    for (const b of raiz.querySelectorAll('[data-pcf-moeda]')) b.addEventListener('click', () => { pcF().moeda = b.dataset.pcfMoeda; salvarPrefs(); redesenharPreco(true); });
    for (const el of raiz.querySelectorAll('[data-pcf]')) el.addEventListener('change', () => {
      pcF()[el.dataset.pcf] = el.type === 'checkbox' ? el.checked : el.value; salvarPrefs(); redesenharPreco(true);
    });
    raiz.querySelector('[data-pcf-limpar]')?.addEventListener('click', () => { prefs.pcFiltro = { ...pcFiltroPadrao }; salvarPrefs(); redesenharPreco(true); });
    for (const t of raiz.querySelectorAll('[data-pc-abrir]')) {
      const abrir = () => { pc.aberto = pc.aberto === t.dataset.pcAbrir ? null : t.dataset.pcAbrir; redesenharPreco(true); };
      t.addEventListener('click', abrir);
      t.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); abrir(); } });
    }
    for (const b of raiz.querySelectorAll('[data-pc-mim]')) b.addEventListener('click', async () => {
      const chave = b.dataset.pcMim, l = OC.preco.vitrine()?.linhas.find((x) => `v${x.id}` === chave);
      if (!l) return;
      b.disabled = true; b.textContent = 'calculando…';
      await calcularParaMim(chave, l.ficha, Number(l.preco), l.moeda); redesenharPreco(true);
    });
    raiz.querySelector('[data-acao="pc-reler"]')?.addEventListener('click', () => lerVitrine(true));
    // só no painel
    for (const el of raiz.querySelectorAll('[data-pc]')) el.addEventListener(el.type === 'checkbox' || el.tagName === 'SELECT' ? 'change' : 'input', () => { pc.manual[el.dataset.pc] = el.type === 'checkbox' ? el.checked : el.value; });
    raiz.querySelector('[data-acao="pc-esquecer"]')?.addEventListener('click', () => { OC.preco.esquecer(); pc.manualRes = null; pc.lidoVitrine = 0; redesenharPreco(true); });
    raiz.querySelector('[data-acao="pc-avaliar"]')?.addEventListener('click', async () => {
      const m = pc.manual;
      jogo ??= await OC.carregarJogo().catch(() => null);
      const esp = [...(jogo?.especies.values() ?? [])].find((e) => String(e.name).toLowerCase() === m.nome.trim().toLowerCase() || String(e.pokeId) === m.nome.trim().replace('#', ''));
      if (!esp) { pc.manualRes = { erro: `Não achei a espécie "${m.nome}". Escolha um nome da lista.` }; return redesenharPreco(true); }
      if (!(Number(String(m.nota).replace(',', '.')) > 0)) { pc.manualRes = { erro: 'Diga a nota (a N= da ficha).' }; return redesenharPreco(true); }
      const alvo = { sp: Number(esp.pokeId), nome: esp.name, sh: !!m.shiny, p: Number(m.pot) || 1, n: Number(String(m.nota).replace(',', '.')), lv: Number(m.nivel) || 100, aoe: !!m.aoe, el: m.el ? 'sim' : null, rf: Number(m.rf) || 0, moeda: m.moeda, preco: parseValor(m.preco) || 0 };
      pc.lendo = true; pc.status = `lendo as vendas de ${esp.name}…`; redesenharPreco(true);
      try { await OC.preco.ler(alvo.sp, alvo.nome, alvo.sh); pc.manualRes = { alvo, res: OC.preco.avaliar(alvo) }; }
      catch (e) { pc.manualRes = { erro: `Não consegui ler as vendas: ${e?.message ?? e}` }; }
      pc.lendo = false; pc.status = ''; redesenharPreco(true);
    });
  }

  function abaAlvo() {
    const ids = especiesEmHunt();
    const lista = jogo ? [...ids].map((id) => jogo.especies.get(id)).filter(Boolean).sort((a, b) => String(a.name).localeCompare(String(b.name))) : [];
    const esp = prefs.alvo ? jogo?.especies.get(prefs.alvo) : null;
    const topo = `<div class="oc-form"><label style="grid-column:1/-1">Que pokémon você quer capturar?
        <input type="text" class="oc-txt" list="oc-especies" data-alvo="busca" placeholder="nome ou número da Pokédex" value="${esc(esp ? esp.name : alvoTxt)}"></label>
        <datalist id="oc-especies">${lista.map((e) => `<option value="${esc(e.name)}"></option>`).join('')}</datalist></div>`;
    if (!esp) return topo + (alvoTxt ? '<div class="oc-aviso">Não achei essa espécie. Escreva o nome em inglês, como no jogo (ex.: Larvitar), ou o número.</div>'
      : '<p class="oc-nota">Escolha uma espécie para ver em que hunts ela aparece, quantas dela você derruba por hora com o seu pokémon, a chance de cada bola e quanto tempo leva para sair uma, uma P3+ ou uma shiny.</p>');
    const ctx = { especies: jogo.especies, welcome, eu };
    const mc = analise?.op?.multCaptura || 1;
    const agora = Number(eu?.servidorAgora) || Date.now();
    const lure = agora < (Number(eu?.loja?.boosts?.shiny) || 0) ? 2 : 1;
    const pShiny = (Number(welcome?.chanceShiny) || 1 / 24000) * lure;
    const temBeast = (OC.estoque?.(eu, 'bola', 5) ?? 0) > 0;
    const bolas = OC.BOLAS.filter((b) => !b.premium || temBeast);
    const melhorBola = bolas.reduce((m, b) => (b.forca > m.forca ? b : m), bolas[0]);
    const chance = (b) => Math.min(0.1, OC.chanceCaptura(esp, b.forca, ctx) * mc);
    const teto = OC.tetoDe(esp, ctx) ?? 100;
    const melhorXp = analise?.melhor?.xpPkH || 0;
    const tempo = (h) => (!Number.isFinite(h) ? '—' : h < 1 ? `${Math.max(1, Math.round(h * 60))} min` : h < 48 ? `${dec(h)} h` : `${dec(h / 24)} dias`);
    const hunts = (welcome?.hunts ?? []).map((h) => {
      const tot = (h.especies ?? []).reduce((s, e) => s + (Number(e.pontos) || 0), 0);
      const meu = (h.especies ?? []).find((e) => e.pokeId === esp.pokeId);
      if (!meu || !tot) return null;
      const r = analise?.linhas.find((l) => l.slug === h.slug);
      const parte = Number(meu.pontos) / tot, nv = Number(h.nivel ?? h.level ?? r?.nivel) || 0;
      const corposH = r && !r.inviavel ? r.kph * parte : 0;
      const cap = corposH * chance(melhorBola);
      return { h, r, parte, nv, corposH, cap, liberada: (eu?.level ?? 0) >= nv, perigo: r && !r.inviavel && OC.perigosa(r) };
    }).filter(Boolean).sort((a, b) => (b.liberada - a.liberada) || (b.cap - a.cap) || (a.nv - b.nv));
    const lend = LENDARIOS.has(String(esp.name).toLowerCase());
    const mega = /^(Mega|Primal) /i.test(String(esp.name));
    const nascem = (nv) => (nv <= 100 ? nv : teto);
    const chances = bolas.map((b) => `${esc(b.nome)} ${dec(chance(b) * 100, 2)}%`).join(' · ');
    const linhas = hunts.map((x) => {
      const ir = x.liberada && x.r && !x.r.inviavel;
      return `<tr class="${x.liberada ? '' : 'oc-dim'}"><td>${esc(x.h.nome ?? x.h.slug)}<small>${esc(regiao(x.h.regiao ?? ''))} · nível ${num(x.nv)}${x.perigo ? ' · perigosa' : ''}</small></td>
        <td>${pct(x.parte)}</td><td>${x.corposH ? num(x.corposH) : (x.liberada ? 'não mata' : 'trancada')}</td>
        <td>${x.cap ? `${dec(x.cap, 1)}/h<small>1 a cada ${tempo(1 / x.cap)}</small>` : '—'}</td>
        <td>${x.cap ? tempo(1 / (x.cap * POT3)) : '—'}</td>
        <td>${x.corposH ? tempo(1 / (x.corposH * pShiny * chance(melhorBola))) : '—'}</td>
        <td>${ir ? `${curto(x.r.xpPkH)}${melhorXp ? `<small>${x.r.xpPkH >= melhorXp ? 'o seu melhor' : `${Math.round((1 - x.r.xpPkH / melhorXp) * 100)}% menos`}</small>` : ''}` : '—'}</td>
        <td>${ir ? `<button type="button" class="oc-link" data-alvo-ir="${esc(x.h.slug)}" data-bola="${esc(melhorBola.chave)}">caçar aqui</button>` : ''}</td></tr>`;
    }).join('');
    const semHunt = !hunts.length ? `<div class="oc-aviso">${esc(esp.name)} não aparece em hunt nenhuma. ${lend ? 'Lendário e mítico só saem da Arena Mística: o Mystic Ticket abre a arena com um dos 110 sorteado (0,91% de ser ele) e dá uma bola só (0,4% na Ultra, 0,5% na Beast, o dobro com Capture Boost).' : mega ? 'Mega não se captura: é fabricada a partir da espécie base, com a Mega Stone dela.' : 'Dá para tentar no Safari (cada aparição tem 0,10% de ser ela, e ela sai no dobro do nível de captura) ou evoluir uma forma anterior.'}</div>` : '';
    return topo + `<div class="oc-linha"><b>${esc(esp.name)}</b> (#${esp.pokeId}) · ${OC.tiposDe(esp).map((t) => TIPO[t] ?? t).join('/')} · ${teto === 100 ? 'nasce no nível da hunt, até o 100' : `nasce no nível da hunt até o 100; acima disso, no ${teto}`} ·
        <button type="button" class="oc-link" data-acao="alvo-limpar">trocar</button></div>
      <div class="oc-linha">Chance por corpo caído${mc > 1 ? ` (com ×${dec(mc, 2)} de captura)` : ''}: ${chances}. Shiny: 1 em ${num(1 / pShiny)} arremessos${lure > 1 ? ' (Secret Lure ligado)' : ''}.</div>
      ${semHunt}
      ${hunts.length ? `<div class="oc-tabela"><table><thead><tr><th>Hunt</th><th>Dela</th><th>Corpos dela/h</th><th>Capturas (${esc(melhorBola.nome)})</th><th>Uma P3+</th><th>Uma shiny</th><th>XP/h</th><th></th></tr></thead><tbody>${linhas}</tbody></table></div>` : ''}
      <p class="oc-nota">“Dela” é a parte dos selvagens da hunt que são dessa espécie. Os tempos usam o ritmo de abates do seu pokémon em cada hunt e a melhor bola que você tem; P3 ou mais sai em ${dec(POT3 * 100, 1)}% das capturas e qualidade 1,5+ em ${dec(QUAL15 * 100, 1)}%. Nas hunts acima do Nv 100 o capturado nasce no teto da espécie (${teto}). Em “caçar aqui”, a pokébola dos Ajustes passa a ser a ${esc(melhorBola.nome)} e a aba Setup monta a mochila e leva você até lá.</p>`;
  }
  // ---- eventos ---------------------------------------------------------------------------
  function ligar() {
    if (!painel) return;
    for (const el of painel.querySelectorAll('.oc-din')) {
      el.addEventListener('input', () => formatarDin(el));
      el.addEventListener('blur', () => { const v = parseValor(el.value); if (Number.isFinite(v) && v > 0) el.value = fmtDin(v); });
    }
    painel.querySelector('[data-acao="fechar"]')?.addEventListener('click', fechar);
    painel.querySelector('[data-acao="mais"]')?.addEventListener('click', () => { mostrando += 25; desenhar(); });
    painel.querySelector('[data-acao="zerar"]')?.addEventListener('click', () => { OC.sessao.zerar(); desenhar(); });
    painel.querySelector('[data-acao="esquecer-calib"]')?.addEventListener('click', async () => { OC.sessao.esquecerCalibracao(); await recalcular(true); desenhar(); });
    painel.querySelector('[data-acao="diag-copiar"]')?.addEventListener('click', async () => {
      diagMsg = 'Coletando…'; desenhar();
      try { const r = await OC.debug.copiar(); diagMsg = `Copiado (${num(r.tamanho / 1024)} KB). Cole na conversa com o Claude.`; }
      catch (e) { diagMsg = `Não consegui copiar (${e?.message ?? e}). Use “baixar como arquivo”.`; }
      desenhar();
    });
    painel.querySelector('[data-acao="diag-baixar"]')?.addEventListener('click', async () => {
      try { await OC.debug.baixar(); diagMsg = 'Arquivo baixado. Envie o .json na conversa com o Claude.'; } catch (e) { diagMsg = `Falhou: ${e?.message ?? e}`; }
      desenhar();
    });
    painel.querySelector('[data-acao="notif"]')?.addEventListener('click', async () => { await OC.avisos?.pedir(); desenhar(); });
    painel.querySelector('[data-acao="notif-teste"]')?.addEventListener('click', () => OC.avisos?.testar());
    const busca = painel.querySelector('[data-alvo="busca"]');
    busca?.addEventListener('change', () => { const e = acharEspecie(busca.value); prefs.alvo = e?.pokeId ?? null; alvoTxt = busca.value; salvarPrefs(); desenhar(); });
    painel.querySelector('[data-acao="alvo-limpar"]')?.addEventListener('click', () => { prefs.alvo = null; alvoTxt = ''; salvarPrefs(); desenhar(); });
    for (const b of painel.querySelectorAll('[data-alvo-ir]')) b.addEventListener('click', async () => { prefs.sel = b.dataset.alvoIr; prefs.aba = 'setup'; if (b.dataset.bola) prefs.bola = b.dataset.bola; salvarPrefs(); await recalcular(true); desenhar(); });
    for (const b of painel.querySelectorAll('[data-outland]')) b.addEventListener('click', () => {
      b.disabled = true; b.textContent = 'Indo…';
      OC.auto.irPara(b.dataset.outland, b.dataset.nome, { tier: Number(b.dataset.tier) }).then(() => desenhar());
    });
    painel.querySelector('[data-upar]')?.addEventListener('change', async (ev) => {
      const p = eu?.pokemons?.find((x) => String(x.id) === ev.target.value);
      prefs.pkUpar = p && p.id !== eu.activeId ? p.id : null; confirmandoUpar = null; prefs.sel = null; salvarPrefs();
      await desenhar(true);
    });
    painel.querySelector('[data-acao="upar"]')?.addEventListener('click', (ev) => { confirmandoUpar = ev.currentTarget.dataset.slug; desenhar(); });
    painel.querySelector('[data-acao="upar-nao"]')?.addEventListener('click', () => { confirmandoUpar = null; desenhar(); });
    painel.querySelector('[data-acao="upar-ok"]')?.addEventListener('click', (ev) => {
      const r = analise?.linhas.find((l) => l.slug === ev.currentTarget.dataset.slug), pk = pkAnalise();
      confirmandoUpar = null;
      if (r && pk) OC.auto.uparEm(pk.id, r.slug, r.nome, r.outland ? { tier: r.tierAlvo } : {})
        .then(async (ok) => { if (ok) { prefs.pkUpar = null; salvarPrefs(); } await recalcular(true); desenhar(); });
      desenhar();
    });
    ligarPreco(painel);
    // ---- Mercado
    for (const el of painel.querySelectorAll('[data-mk]')) {
      const k = el.dataset.mk, tipoEv = el.type === 'checkbox' || el.tagName === 'SELECT' ? 'change' : 'input';
      el.addEventListener(tipoEv, () => {
        mk.f[k] = el.type === 'checkbox' ? el.checked : el.value;
        if (k === 'nome' && mk.f.tipo === 'pokemon') {
          const d = painel.querySelector('[data-mk-esp]'), e = especiePorNome(el.value);
          if (d) d.textContent = el.value.trim() ? (e ? `✓ ${e.name} (#${e.pokeId})` : 'não achei essa espécie') : 'qualquer espécie';
        }
        if (mk.f.tipo === 'item' && (k === 'moeda' || (k === 'nome' && OC.mercado.idDoItem(el.value.trim()) != null))) {
          const d = painel.querySelector('[data-mk-esp]'), id = OC.mercado.idDoItem(mk.f.nome.trim()), x = id != null ? OC.mercado.medias()[id] : null, m = mk.f.moeda;
          if (d) d.textContent = x ? `média 7 dias: ${x[m] ? OC.mercado.preco(Math.round(x[m]), m) : '—'} · menor agora: ${x[m === 'orb' ? 'minOrb' : 'minGold'] ? OC.mercado.preco(x[m === 'orb' ? 'minOrb' : 'minGold'], m) : '—'}` : '';
        }
        atualizarResumo();
      });
    }
    for (const b of painel.querySelectorAll('[data-mk-tipo]')) b.addEventListener('click', () => { if (mk.f.tipo !== b.dataset.mkTipo) { mk.f.tipo = b.dataset.mkTipo; mk.f.nome = ''; mk.msg = ''; } desenhar(); });
    const irProForm = () => painel?.querySelector('[data-mk-topo]')?.scrollIntoView?.({ block: 'start', behavior: 'smooth' });
    painel.querySelector('[data-acao="mk-salvar"]')?.addEventListener('click', () => {
      const r = alvoDoForm();
      if (r.erro) { mk.msg = r.erro; mk.msgTipo = 'erro'; return desenhar(); }
      const lista = (prefs.mercadoAlvos ??= []);
      if (mk.editando) {
        const i = lista.findIndex((a) => a.id === mk.editando);
        if (i < 0) { mk.editando = null; mk.msg = 'Esse alvo não existe mais.'; mk.msgTipo = 'erro'; return desenhar(); }
        const velho = lista[i], falta = (a) => (Number(a.qtdMax) > 0 ? a.qtdMax - (a.comprados || 0) : Infinity);
        const novo = { ...r.a, id: velho.id, ativo: velho.ativo, comprados: mk.f.zerar ? 0 : (velho.comprados || 0) };
        if (!velho.ativo && falta(velho) <= 0 && falta(novo) > 0) novo.ativo = true; // estava pausado por ter comprado tudo
        lista[i] = novo;
        OC.mercado.reolhar?.(velho.id);
        mk.msg = 'Alvo atualizado.';
      } else {
        lista.push({ ...r.a, id: `a${Date.now().toString(36)}`, ativo: true, comprados: 0 });
        mk.msg = 'Alvo adicionado.';
      }
      mk.msgTipo = 'ok'; mk.editando = null; mk.f = formNovo(); salvarPrefs(); desenhar();
    });
    painel.querySelector('[data-acao="mk-cancelar"]')?.addEventListener('click', () => { mk.editando = null; mk.f = formNovo(); mk.msg = ''; desenhar(); });
    painel.querySelector('[data-acao="mk-limpar"]')?.addEventListener('click', () => { mk.f = formNovo(); mk.msg = ''; desenhar(); });
    painel.querySelector('[data-acao="mk-medias"]')?.addEventListener('click', (ev) => {
      ev.currentTarget.disabled = true; mk.msg = 'carregando os itens do Mercado (alguns segundos)…'; mk.msgTipo = 'ok'; desenhar();
      OC.mercado.lerMedias().then(() => { mk.msg = 'Itens e médias carregados.'; desenhar(); }).catch((e) => { mk.msg = e.message; mk.msgTipo = 'erro'; desenhar(); });
    });
    for (const b of painel.querySelectorAll('[data-mk-editar]')) b.addEventListener('click', () => { editarAlvo(prefs.mercadoAlvos[Number(b.dataset.mkEditar)]); desenhar(); irProForm(); });
    for (const b of painel.querySelectorAll('[data-mk-dup]')) b.addEventListener('click', () => {
      editarAlvo(prefs.mercadoAlvos[Number(b.dataset.mkDup)]); mk.editando = null;
      mk.msg = 'Cópia carregada no formulário: ajuste e clique em Adicionar.'; mk.msgTipo = 'ok'; desenhar(); irProForm();
    });
    for (const b of painel.querySelectorAll('[data-mk-pausa]')) b.addEventListener('click', () => {
      const a = prefs.mercadoAlvos[Number(b.dataset.mkPausa)]; a.ativo = !a.ativo;
      if (a.ativo && Number(a.qtdMax) > 0 && (a.comprados || 0) >= a.qtdMax) { mk.msg = `"${a.nome || 'qualquer pokémon'}" já comprou tudo o que devia: edite e aumente a quantidade, ou zere os comprados.`; mk.msgTipo = 'erro'; }
      salvarPrefs(); desenhar();
    });
    for (const b of painel.querySelectorAll('[data-mk-del-pede]')) b.addEventListener('click', () => { mk.remover = prefs.mercadoAlvos[Number(b.dataset.mkDelPede)]?.id ?? null; desenhar(); });
    painel.querySelector('[data-mk-del-nao]')?.addEventListener('click', () => { mk.remover = null; desenhar(); });
    for (const b of painel.querySelectorAll('[data-mk-del]')) b.addEventListener('click', () => {
      const [a] = prefs.mercadoAlvos.splice(Number(b.dataset.mkDel), 1);
      if (a && mk.editando === a.id) { mk.editando = null; mk.f = formNovo(); }
      mk.remover = null; salvarPrefs(); desenhar();
    });
    for (const b of painel.querySelectorAll('[data-gravar]')) b.addEventListener('click', () => { if (OC.auto.gravando()) OC.auto.cancelarGravacao(); else OC.auto.gravarSaida(b.dataset.gravar); desenhar(); });
    for (const sel of painel.querySelectorAll('[data-ginasio]')) sel.addEventListener('change', async () => {
      const t = sel.dataset.ginasio, pos = Number(sel.value) || 0;
      prefs.ginasios = (prefs.ginasios ?? []).filter((g) => g.tipo !== t);
      if (pos) prefs.ginasios.push({ tipo: t, pos });
      salvarPrefs(); await recalcular(true); desenhar();
    });
    painel.querySelector('[data-bola-jogo]')?.addEventListener('click', async (ev) => { prefs.bola = ev.currentTarget.dataset.bolaJogo; salvarPrefs(); await recalcular(true); desenhar(); });
    painel.querySelector('[data-acao="preparar"]')?.addEventListener('click', () => { confirmando = selRow()?.slug ?? null; desenhar(); });
    painel.querySelector('[data-acao="preparar-nao"]')?.addEventListener('click', () => { confirmando = null; desenhar(); });
    painel.querySelector('[data-acao="preparar-ok"]')?.addEventListener('click', () => {
      const r = selRow(); confirmando = null;
      if (r) OC.auto.preparar(r, OC.mochila(r, Math.max(0.5, Number(prefs.horas) || 4)), simulandoOutro() ? pkAnalise().id : null)
        .then(async (ok) => { if (ok && simulandoOutro()) { prefs.pkUpar = null; salvarPrefs(); } await recalcular(true); desenhar(); });
      desenhar();
    });
    for (const b of painel.querySelectorAll('[data-aba]')) b.addEventListener('click', () => { prefs.aba = b.dataset.aba; salvarPrefs(); desenhar(); if (prefs.aba === 'preco') lerVitrine(); });
    for (const b of painel.querySelectorAll('[data-ordem]')) b.addEventListener('click', async () => { prefs.ordem = b.dataset.ordem; salvarPrefs(); await recalcular(true); desenhar(); });
    for (const b of painel.querySelectorAll('[data-sel]')) b.addEventListener('click', () => { prefs.sel = b.dataset.sel || null; prefs.aba = 'setup'; salvarPrefs(); desenhar(); });
    for (const c of painel.querySelectorAll('[data-pref]')) c.addEventListener('change', async () => { prefs[c.dataset.pref] = c.checked; salvarPrefs(); if (c.dataset.pref === 'vender') await recalcular(true); desenhar(); });
    for (const s of painel.querySelectorAll('[data-pref-sel]')) s.addEventListener('change', async () => {
      const k = s.dataset.prefSel; prefs[k] = ['bike', 'hpMinimo', 'avisoPotMin', 'avisoQualMin', 'avisoIvMin'].includes(k) ? Number(s.value) : s.value;
      // a escolha manual da tipagem vale só até a próxima virada (18:00 de Brasília)
      if (k === 'tipoDiaManual') prefs.tipoDiaManualAte = s.value === 'auto' ? null : OC.proximaViradaSazonal();
      salvarPrefs(); await recalcular(true); desenhar();
    });
    for (const i of painel.querySelectorAll('[data-pref-num]')) i.addEventListener('change', async () => {
      const k = i.dataset.prefNum; prefs[k] = k === 'horas' ? (Number(i.value) || 4) : k === 'autoForcarApos' ? Math.max(0.5, Number(i.value) || 2) : Math.max(0, valorDe(i) || 0); salvarPrefs();
      if (['precoBeast', 'precoToken', 'precoFragChave', 'precoFragShiny', 'precoFragBike'].includes(k)) await recalcular(true); desenhar();
    });
  }

  // ---- ligação com o jogo ----------------------------------------------------------------
  OC.on('welcome', (m) => {
    welcome = m; itens = null; analise = null;
    (root.requestIdleCallback ?? ((f) => setTimeout(f, 1500)))(() => OC.carregarJogo().catch((e) => console.warn('[onde-cacar] pré-carga falhou', e)));
  });
  let pendente = null;
  OC.on('estado', (e) => {
    eu = e;
    posicionarBotao();
    if (!painel) return;
    const pk = pkAtivo();
    if (analise && assinar(pk) !== assinatura.split('[')[0] && !pendente) {
      pendente = setTimeout(async () => { pendente = null; if (painel && !painel.querySelector('input:focus, select:focus')) { await recalcular(true); desenhar(); } }, 800);
    }
  });
  setInterval(() => { if (painel && (prefs.aba === 'sessao' || prefs.aba === 'drops') && !painel.querySelector('input:focus, select:focus')) desenhar(); }, 3000);
  setInterval(() => { if (painel && prefs.aba === 'progresso' && !painel.querySelector('input:focus, select:focus')) desenhar(); }, 15000);
  OC.on('aviso', () => { if (painel && prefs.aba === 'ajustes' && !painel.querySelector('input:focus, select:focus, textarea:focus')) desenhar(); });
  OC.on('mercado', () => { if (painel && prefs.aba === 'mercado' && !painel.querySelector('input:focus, select:focus')) desenhar(); });
  // anúncios novos na tela do jogo: com a aba Preço aberta, lê as vendas da espécie e redesenha
  // anúncios novos na tela do jogo: lê as vendas da espécie e atualiza a gaveta e a aba Preço
  OC.on('preco', () => { pc.aberto = null; redesenharPreco(); if (gaveta || pilula || (painel && prefs.aba === 'preco')) lerVitrine(); });
  OC.on('auto', () => { if (painel && (prefs.aba === 'setup' || prefs.aba === 'ajustes' || prefs.aba === 'hunts') && !painel.querySelector('input:focus, select:focus')) desenhar(); });
  OC.ui = { abrir, fechar, desenhar, prefs, salvarPrefs, analiseFresca: async () => { await recalcular(false); return analise; },
    interno: () => ({ welcome, eu, jogo, itens, analise, xpDoTreinador: eu ? xpDoTreinador() : null, ritmo: eu ? ritmoTreinador() : null }) };
})(globalThis);
