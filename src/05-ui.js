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
    precoDiamante: 7, alvoAtrasados: 870, contarLive: false, avisoSom: false, avisoPotMin: 3, avisoQualMin: 1.5, avisoIvMin: 150,
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
  let painel = null, mostrando = 25, confirmando = null, diagMsg = '';
  const pkAtivo = () => eu?.pokemons?.find((p) => p.id === eu.activeId) ?? null;
  const assinar = (pk) => (pk ? `${pk.id}|${pk.level}|${pk.tmElemental ?? ''}|${JSON.stringify(pk.stats)}|${eu?.level}` : '');

  async function recalcular(forcar = false) {
    const pk = pkAtivo();
    if (!welcome || !eu || !pk) { analise = null; return; }
    const sig = assinar(pk) + JSON.stringify([prefs.ordem, prefs.pocao, prefs.bola, prefs.vender, prefs.bike, prefs.hpMinimo, prefs.precoBeast, prefs.tipoDiaManual, prefs.precoToken, prefs.precoFragChave, prefs.precoFragShiny, prefs.precoFragBike]);
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
    painel = document.createElement('div');
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
    const pk = pkAtivo();
    if (!welcome || !eu) { pintar(painel, cab(pk) + '<div class="oc-carga">Esperando o jogo conectar…</div>'); ligar(); return; }
    if (!pk) { pintar(painel, cab(null) + '<div class="oc-aviso">Coloque um pokémon em campo para ver onde caçar.</div>'); ligar(); return; }
    if (!analise || forcar) {
      pintar(painel, cab(pk) + abas() + '<div class="oc-carga">Lendo o jogo…</div>');
      ligar();
      await recalcular(forcar);
      if (!painel) return;
    }
    const corpo = erro ? `<div class="oc-aviso">Não consegui calcular: ${esc(erro)}</div>`
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
    const sub = pk ? [esc(pk.nome), `Nv ${num(pk.level)}`, `P${pk.potencia ?? 1}`, Number.isFinite(q) ? `Q ${dec(q, 3)}` : '', eu?.level ? `treinador ${num(eu.level)}` : '']
      .filter(Boolean).join(', ') : 'nenhum pokémon em campo';
    return `<div class="oc-cab"><div class="oc-titulo"><h3>Onde caçar</h3><small>${sub}</small></div>
      <button type="button" class="oc-fechar" data-acao="fechar" aria-label="Fechar">×</button></div>`;
  }
  function abas() {
    const A = [['hunts', 'Hunts'], ['setup', 'Setup'], ['sessao', 'Sessão'], ['drops', 'Drops'], ['progresso', 'Progresso'], ['alvo', 'Capturar'], ['ajustes', 'Ajustes']];
    return `<div class="oc-abas" role="tablist">${A.map(([k, r]) => `<button type="button" role="tab" data-aba="${k}" aria-selected="${prefs.aba === k}">${r}</button>`).join('')}</div>`;
  }

  const risco = (r) => {
    if (r.umHit) return '<span class="oc-tag oc-ruim">morre num golpe</span>';
    if (r.mortesH >= 0.5) return `<span class="oc-tag oc-ruim">desmaia ${dec(r.mortesH)}×/h</span>`;
    if (r.hitPct >= 0.5) return `<span class="oc-tag oc-atencao">${pct(r.hitPct)} do HP</span>`;
    return `<span class="oc-tag oc-bom">${pct(r.hitPct)} do HP</span>`;
  };
  const selRow = () => analise?.linhas.find((l) => l.slug === prefs.sel && !l.inviavel) ?? analise?.melhor ?? analise?.linhas.find((l) => !l.inviavel) ?? null;

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
        ${aqui ? '' : `<button type="button" class="oc-btn" data-outland="${esc(melhor.slug)}" data-nome="${esc(melhor.nome)}" data-tier="${tiers.melhor.tier}" ${OC.auto?.ocupado() ? 'disabled' : ''}>Ir para ${esc(melhor.nome)} na ${nomeTier(tiers.melhor)}</button>`}
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
    return `${topo}
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
    return `${topo}
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
    const autoTxt = OC.auto ? `<div class="oc-auto">
        ${confirmando === r.slug
          ? `<p>Vou comprar ${lista.filter((i) => i.falta > 0 && !i.premium).map((i) => `${num(i.falta)} ${esc(i.nome)}`).join(' e ') || 'nada'} (${curto(custo)} de ouro; você tem ${curto(Number(eu?.gold) || 0)})${aqui ? '' : ` e levar você para ${esc(r.nome)} assim que sair de combate`}.${(Number(eu?.gold) || 0) - custo < (Number(prefs.autoReserva) || 0) ? ` <b class="oc-neg">Isso deixaria o ouro abaixo da reserva de ${curto(Number(prefs.autoReserva) || 0)} (Ajustes): a compra vai parar antes.</b>` : ''}</p>
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
      <label>Quanto custa uma Beast Ball para você (ouro)<input type="number" min="0" step="100" value="${Number(prefs.precoBeast) || 0}" data-pref-num="precoBeast" class="oc-num"></label>
      <label>Bicicleta<select data-pref-sel="bike">${[[0, 'Sem bicicleta'], [0.15, 'Comum (+15%)'], [0.25, 'Incomum (+25%)'], [0.5, 'Rara (+50%)'], [0.75, 'Mítica (+75%)'], [1, 'Lendária (+100%)']].map(([v, r]) => opt(v, r, prefs.bike)).join('')}</select></label>
      <label>Tipagem do dia (Dias Sazonais)<select data-pref-sel="tipoDiaManual">${opt('auto', OC.tipoDoDia?.({ welcome, eu }) ? `Do jogo: ${TIPO[OC.tipoDoDia({ welcome, eu })]}` : 'Do jogo (se ele informar)', prefs.tipoDiaManual ?? 'auto')}${opt('nenhum', 'Ignorar', prefs.tipoDiaManual)}${Object.entries(TIPO).map(([k, r]) => opt(k, r, prefs.tipoDiaManual)).join('')}</select></label>
      <label>Nunca deixar o HP cair abaixo de<select data-pref-sel="hpMinimo">${[[0.25, '25%'], [0.35, '35%'], [0.5, '50%'], [0.65, '65%']].map(([v, r]) => opt(v, r, prefs.hpMinimo)).join('')}</select></label>
      </div>
      <h4 class="oc-sub">Diagnóstico</h4>
      <div class="oc-caixa">Junta o que a extensão está lendo do jogo e as contas dela (seu pokémon, a hunt atual, bônus, XP, a sessão), sem nick nem dados de conta, para conferir se está tudo certo.
        <div class="oc-ctrl" style="margin:8px 0 0"><button type="button" class="oc-btn" data-acao="diag-copiar">Copiar diagnóstico</button> <button type="button" class="oc-link" data-acao="diag-baixar">baixar como arquivo</button></div>
        ${diagMsg ? `<p class="oc-nota">${esc(diagMsg)}</p>` : ''}</div>
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
      <label>Gemas por diamante no Mercado<input type="number" class="oc-num" min="1" step="0.5" value="${prefs.precoDiamante}" data-pref-num="precoDiamante"></label>
      <label>Bronze Boss Token no Mercado (Coins)<input type="number" class="oc-num" min="0" step="10000" value="${Number(prefs.precoToken) || 0}" data-pref-num="precoToken"></label>
      <label>Fragmento de Chave (Coins)<input type="number" class="oc-num" min="0" step="10000" value="${Number(prefs.precoFragChave) || 0}" data-pref-num="precoFragChave"></label>
      <label>Fragmento de Shiny Stone (Coins)<input type="number" class="oc-num" min="0" step="10000" value="${Number(prefs.precoFragShiny) || 0}" data-pref-num="precoFragShiny"></label>
      <label>Fragmento de Bicicleta (Coins)<input type="number" class="oc-num" min="0" step="10000" value="${Number(prefs.precoFragBike) || 0}" data-pref-num="precoFragBike"></label>
      <label>Alvo do Boost dos Atrasados (se o jogo não informar)<input type="number" class="oc-num" min="1" value="${prefs.alvoAtrasados}" data-pref-num="alvoAtrasados"></label>
      </div>
      <h4 class="oc-sub">Automação (desligada até você ligar)</h4>
      <div class="oc-form">
      <label class="oc-chk"><input type="checkbox" data-pref="autoRepor" ${prefs.autoRepor ? 'checked' : ''}> Repor poção e bola sozinho durante a hunt</label>
      <label class="oc-chk"><input type="checkbox" data-pref="autoTrocar" ${prefs.autoTrocar ? 'checked' : ''}> Trocar de hunt quando a recomendada render 10% mais XP</label>
      <label>Repor quando o estoque durar menos de (horas)<input type="number" class="oc-num" min="0.25" max="24" step="0.25" value="${prefs.autoMinHoras}" data-pref-num="autoMinHoras"></label>
      <label>Comprar para (horas)<input type="number" class="oc-num" min="0.5" max="48" step="0.5" value="${prefs.horas}" data-pref-num="horas"></label>
      <label>Nunca deixar o ouro abaixo de<input type="number" class="oc-num" min="0" step="100000" value="${prefs.autoReserva}" data-pref-num="autoReserva"></label>
      <label>Gastar no máximo por hora<input type="number" class="oc-num" min="0" step="100000" value="${prefs.autoTetoHora}" data-pref-num="autoTetoHora"></label>
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
        : `<b>Boost dos Atrasados</b> até o nv ${num(alvo)}: ~<b>${num(preco)} 💎</b>${preco === 50 ? ' (o preço mínimo)' : ''} no seu nível (pela fórmula da Wiki; o card da Loja mostra o valor exato), ~${num(gemas)} Gemas (~US$ ${dec(gemas / 100, 2)}) com o diamante a ${num(prefs.precoDiamante)} Gemas.`}</div>
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
    for (const b of painel.querySelectorAll('[data-gravar]')) b.addEventListener('click', () => { if (OC.auto.gravando()) OC.auto.cancelarGravacao(); else OC.auto.gravarSaida(b.dataset.gravar); desenhar(); });
    painel.querySelector('[data-acao="preparar"]')?.addEventListener('click', () => { confirmando = selRow()?.slug ?? null; desenhar(); });
    painel.querySelector('[data-acao="preparar-nao"]')?.addEventListener('click', () => { confirmando = null; desenhar(); });
    painel.querySelector('[data-acao="preparar-ok"]')?.addEventListener('click', () => {
      const r = selRow(); confirmando = null;
      if (r) OC.auto.preparar(r, OC.mochila(r, Math.max(0.5, Number(prefs.horas) || 4)));
      desenhar();
    });
    for (const b of painel.querySelectorAll('[data-aba]')) b.addEventListener('click', () => { prefs.aba = b.dataset.aba; salvarPrefs(); desenhar(); });
    for (const b of painel.querySelectorAll('[data-ordem]')) b.addEventListener('click', async () => { prefs.ordem = b.dataset.ordem; salvarPrefs(); await recalcular(true); desenhar(); });
    for (const b of painel.querySelectorAll('[data-sel]')) b.addEventListener('click', () => { prefs.sel = b.dataset.sel || null; prefs.aba = 'setup'; salvarPrefs(); desenhar(); });
    for (const c of painel.querySelectorAll('[data-pref]')) c.addEventListener('change', async () => { prefs[c.dataset.pref] = c.checked; salvarPrefs(); if (c.dataset.pref === 'vender') await recalcular(true); desenhar(); });
    for (const s of painel.querySelectorAll('[data-pref-sel]')) s.addEventListener('change', async () => {
      const k = s.dataset.prefSel; prefs[k] = ['bike', 'hpMinimo', 'avisoPotMin', 'avisoQualMin', 'avisoIvMin'].includes(k) ? Number(s.value) : s.value; salvarPrefs(); await recalcular(true); desenhar();
    });
    for (const i of painel.querySelectorAll('[data-pref-num]')) i.addEventListener('change', async () => {
      const k = i.dataset.prefNum; prefs[k] = k === 'horas' ? (Number(i.value) || 4) : k === 'autoForcarApos' ? Math.max(0.5, Number(i.value) || 2) : Math.max(0, Number(i.value) || 0); salvarPrefs();
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
  OC.on('auto', () => { if (painel && (prefs.aba === 'setup' || prefs.aba === 'ajustes') && !painel.querySelector('input:focus, select:focus')) desenhar(); });
  OC.ui = { abrir, fechar, desenhar, prefs, salvarPrefs, analiseFresca: async () => { await recalcular(false); return analise; },
    interno: () => ({ welcome, eu, jogo, itens, analise, xpDoTreinador: eu ? xpDoTreinador() : null, ritmo: eu ? ritmoTreinador() : null }) };
})(globalThis);
