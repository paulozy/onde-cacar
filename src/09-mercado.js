// Onde Caçar — Mercado da Comunidade: alvos de compra (snipe).
//
// Como o Mercado funciona (Wiki + mensagens gravadas em 27/10/2026):
// - todo anúncio fica 2 min retido; "compravelEm" diz, no relógio do servidor, quando ele libera;
// - todo pedido nos 3 primeiros segundos depois da liberação entra num sorteio com a mesma chance,
//   então ser rápido não ajuda: basta pedir uma vez, dentro da janela;
// - o pedido leva o preço visto (trava de preço): se o vendedor subir, a compra é recusada.
// Por isso o sniper olha cada alvo a cada ~20 s (nunca mais que um pedido a cada 3 s), agenda a
// compra para logo depois da liberação e manda UM pedido por anúncio. Nada roda com ele desligado.
(function (root) {
  'use strict';
  const OC = root.__ondeCacar;
  if (!OC || OC.mercado) return;

  const ESPACO_MS = 3000;          // entre dois pedidos ao Mercado
  const CICLO_MS = 20000;          // cada alvo é olhado a cada 20 s (a retenção é de 120 s)
  const JANELA_MS = [400, 2200];   // depois da liberação: dentro dos 3 s do sorteio
  const MEDIAS_MS = 30 * 60000;    // médias de 7 dias: relidas a cada 30 min
  const CATEGORIAS = [['stone', 'Pedras'], ['fragment', 'Fragmentos'], ['boss', 'Boss Tokens'], ['ticket', 'Tickets']];

  const prefs = () => OC.ui?.prefs ?? {};
  const salvar = () => OC.ui?.salvarPrefs?.();
  const eu = () => OC.ui?.interno?.().eu ?? null;
  const dormir = (ms) => new Promise((r) => setTimeout(r, ms));
  const agoraSrv = () => OC.agoraServidor?.() ?? Date.now();
  const hoje = () => new Date().toLocaleDateString('sv-SE'); // AAAA-MM-DD, no fuso do PC

  let ultimoPedido = 0, esperando = null, rodando = false, status = 'desligado';
  const olhadoEm = new Map();    // alvo → último olhar
  const vistos = new Map();      // id do anúncio → { alvo, quando }
  const agendados = new Map();   // id do anúncio → timeout
  const enviados = new Set();    // anúncios já pedidos (o jogo aceita um pedido por jogador)
  const registro = [];           // o que aconteceu, para a aba
  const medias = {};             // itemId → { gold, orb, minGold, minOrb, categoria }
  let mediasEm = 0;

  function registrar(txt, tipo = 'info') {
    registro.unshift({ t: Date.now(), txt, tipo });
    registro.length = Math.min(registro.length, 40);
    OC.emit('mercado', null);
  }

  // ---- nomes dos itens: aprendidos com o próprio Mercado, depois o catálogo do jogo ------------
  function nomes() { const p = prefs(); return (p.mercadoNomes ??= {}); }
  function nomeItem(id) {
    const n = nomes()[id];
    if (n) return n;
    return OC.ui?.interno?.().itens?.porId?.get(String(id))?.nome ?? `item #${id}`;
  }
  function idDoItem(nome) {
    const alvo = String(nome ?? '').trim().toLowerCase();
    if (!alvo) return null;
    for (const [id, n] of Object.entries(nomes())) if (n.toLowerCase() === alvo) return Number(id);
    const r = OC.ui?.interno?.().itens?.porNome;
    if (r) for (const [n, reg] of r) if (n.toLowerCase() === alvo && reg.id != null) return Number(reg.id);
    return null;
  }

  // ---- pedidos e respostas -------------------------------------------------------------------
  OC.on('market', (m) => {
    if (!m || typeof m !== 'object') return;
    if (m.aba === 'item') for (const l of m.linhas ?? []) if (l?.ficha?.nome && l.itemId != null) nomes()[l.itemId] = l.ficha.nome;
    if (m.aba === 'itens') {
      for (const [id, r] of Object.entries(m.resumo ?? {})) medias[id] = { ...(medias[id] ?? {}), minGold: r.minGold, minOrb: r.minOrb, anuncios: r.anuncios };
      for (const [id, r] of Object.entries(m.medias ?? {})) medias[id] = { ...(medias[id] ?? {}), gold: r.gold?.media ?? null, orb: r.orb?.media ?? null };
      precosDaOutland();
    }
    if (esperando && esperando.bate(m)) { const e = esperando; esperando = null; e.ok(m); }
  });

  // um pedido por vez: a resposta do Mercado não traz o número do pedido, então a fila garante
  // que a próxima resposta é a deste pedido
  let fila = Promise.resolve();
  function pedir(msg, bate) {
    const p = fila.then(() => pedirAgora(msg, bate));
    fila = p.catch(() => {});
    return p;
  }
  async function pedirAgora(msg, bate) {
    const espera = ultimoPedido + ESPACO_MS - Date.now();
    if (espera > 0) await dormir(espera);
    if (OC.socket?.readyState !== 1) throw new Error('sem conexão com o jogo');
    ultimoPedido = Date.now();
    const resposta = new Promise((ok, falha) => {
      esperando = { bate, ok };
      setTimeout(() => { if (esperando?.ok === ok) { esperando = null; falha(new Error('o Mercado não respondeu')); } }, 6000);
    });
    OC.enviar(msg);
    return resposta;
  }

  /** O Mercado do jogo aberto na tela: o sniper espera, para não trocar o que você está vendo. */
  function mercadoNaTela() {
    for (const el of document.querySelectorAll('h1,h2,h3,h4,[class*="titulo"],[class*="title"],[class*="header"]')) {
      if (el.closest?.('.oc-painel')) continue;
      if (/MERCADO DA COMUNIDADE/i.test(el.textContent ?? '') && el.offsetParent !== null) return true;
    }
    return false;
  }

  // ---- orçamento -----------------------------------------------------------------------------
  function gasto() {
    const p = prefs();
    if (p.mercadoGasto?.dia !== hoje()) p.mercadoGasto = { dia: hoje(), gold: 0, orb: 0 };
    return p.mercadoGasto;
  }
  function limite(moeda) {
    const p = prefs();
    if (moeda === 'orb') return p.mercadoGemas ? Math.max(0, Number(p.mercadoLimiteOrb) || 0) : 0;
    return Math.max(0, Number(p.mercadoLimiteGold) || 0);
  }
  const sobra = (moeda) => limite(moeda) - (gasto()[moeda] || 0);
  function saldo(moeda) {
    const e = eu() ?? {};
    if (moeda === 'gold') return Number(e.gold);
    const v = e.gemas ?? e.orb ?? e.orbs ?? e.rmt?.saldo ?? e.loja?.gemas;
    return v == null ? NaN : Number(v);
  }

  // ---- os alvos ------------------------------------------------------------------------------
  const alvos = () => (prefs().mercadoAlvos ??= []);
  const faltam = (a) => (Number(a.qtdMax) > 0 ? Math.max(0, a.qtdMax - (a.comprados || 0)) : Infinity);

  function filtrosPokemon(a) {
    const f = a.filtros ?? {};
    const s = (v) => (v == null || v === '' ? '' : String(v));
    return {
      t: 'market.listar', tipo: 'pokemon', moeda: a.moeda, busca: '', ordem: 'baratos', criterios: [], elementos: [], categoria: '',
      soShiny: !!f.soShiny, soP5: false, soMega: false, soLendario: false, soTmElemental: false, soTmAoe: false, semOutland: false,
      nivelMin: s(f.nivelMin), nivelMax: '', potenciaMin: s(f.potenciaMin), potenciaMax: '', ivMin: s(f.ivMin), ivMax: '',
      qualidadeMin: s(f.qualidadeMin), qualidadeMax: '', notaMin: s(f.notaMin), notaMax: '', pagina: 0,
      ...(a.especieId ? { especieId: Number(a.especieId) } : {}),
    };
  }
  /** Confere de novo do lado de cá: o filtro do servidor pode ignorar um campo. */
  function pokemonServe(a, fi) {
    const f = a.filtros ?? {};
    if (!fi) return false;
    if (a.especieId && Number(fi.speciesId) !== Number(a.especieId)) return false;
    if (f.soShiny && !fi.shiny) return false;
    if (f.potenciaMin && (Number(fi.potencia) || 0) < Number(f.potenciaMin)) return false;
    if (f.ivMin && (Number(fi.ivTotal) || 0) < Number(f.ivMin)) return false;
    if (f.qualidadeMin && (Number(fi.quality) || 0) < Number(f.qualidadeMin)) return false;
    if (f.notaMin && (Number(fi.nota) || 0) < Number(f.notaMin)) return false;
    if (f.nivelMin && (Number(fi.level) || 0) < Number(f.nivelMin)) return false;
    return true;
  }
  const meu = (l) => { const n = String(eu()?.nick ?? '').toLowerCase(); return !!n && String(l.vendedor ?? '').toLowerCase() === n; };

  function descrever(l, a) {
    const q = l.tipo === 'pokemon' ? `${l.ficha?.nome ?? a.nome} nv ${l.ficha?.level ?? '?'} P${l.ficha?.potencia ?? '?'} IV ${l.ficha?.ivTotal ?? '?'} N ${l.ficha?.nota ?? '?'}` : `${l.qtd}× ${l.ficha?.nome ?? a.nome}`;
    return `${q} a ${OC.mercado.preco(l.preco, l.moeda)}`;
  }

  async function checar(a) {
    let r;
    if (a.tipo === 'item') r = await pedir({ t: 'market.item', itemId: Number(a.itemId), moeda: a.moeda }, (m) => m.aba === 'item' && Number(m.itemId) === Number(a.itemId) && m.moeda === a.moeda);
    else r = await pedir(filtrosPokemon(a), (m) => m.aba === 'vitrine');
    const agora = agoraSrv();
    for (const l of r.linhas ?? []) {
      if (!l || l.estado !== 'aberto' || l.moeda !== a.moeda || !(Number(l.preco) <= Number(a.teto))) continue;
      if (a.tipo === 'pokemon' && !pokemonServe(a, l.ficha)) continue;
      if (meu(l) || vistos.has(l.id)) continue;
      vistos.set(l.id, { alvo: a.id, quando: Date.now() });
      const libera = Number(l.compravelEm) || 0;
      const em = libera > agora ? `libera em ${Math.ceil((libera - agora) / 1000)} s` : 'já liberado';
      registrar(`achei ${descrever(l, a)} (${em})`);
      OC.avisos?.avisar?.(`mercado-${l.id}`, 'Mercado: oportunidade', `${descrever(l, a)}, teto ${OC.mercado.preco(a.teto, a.moeda)} · ${em}`);
      if (a.modo === 'comprar') agendar(l, a);
    }
  }

  function agendar(l, a) {
    if (agendados.has(l.id) || enviados.has(l.id)) return;
    const jitter = JANELA_MS[0] + Math.random() * (JANELA_MS[1] - JANELA_MS[0]);
    const daqui = Math.max(0, (Number(l.compravelEm) || 0) - agoraSrv()) + jitter;
    agendados.set(l.id, setTimeout(() => { agendados.delete(l.id); comprar(l, a).catch((e) => registrar(`erro na compra: ${e.message}`, 'erro')); }, daqui));
  }

  async function comprar(l, a) {
    const p = prefs();
    const alvo = alvos().find((x) => x.id === a.id);
    if (!p.mercadoLigado || !alvo?.ativo || alvo.modo !== 'comprar' || enviados.has(l.id)) return;
    if (l.moeda === 'orb' && !p.mercadoGemas) return registrar('compra em Gemas desligada nos ajustes do Mercado', 'erro');
    const preco = Number(l.preco);
    let qtd = l.tipo === 'pokemon' ? 1 : Math.min(Number(l.qtd) || 1, faltam(alvo));
    qtd = Math.min(qtd, Math.floor(sobra(l.moeda) / preco));
    if (!(qtd >= 1)) return registrar(`limite do dia em ${l.moeda === 'orb' ? 'Gemas' : 'Coins'} alcançado: não comprei ${descrever(l, a)}`, 'erro');
    const antes = saldo(l.moeda);
    if (Number.isFinite(antes) && antes < preco * qtd) return registrar(`saldo insuficiente para ${descrever(l, a)}`, 'erro');
    enviados.add(l.id);
    gasto()[l.moeda] += preco * qtd; salvar();   // reservado; volta se a compra não sair
    ouvirDepois();
    OC.enviar({ t: 'market.comprar', id: l.id, qtd, preco, moeda: l.moeda, sorteioUi: 1 });
    registrar(`pedi ${qtd}× ${l.ficha?.nome ?? a.nome} a ${OC.mercado.preco(preco, l.moeda)}`);
    // o sorteio fecha 3 s depois da liberação; depois disso o saldo diz se levou
    const decide = Math.max(Date.now(), Date.now() + ((Number(l.compravelEm) || 0) + 3000 - agoraSrv())) + 6000;
    let levou = false;
    while (Date.now() < decide) {
      await dormir(500);
      const d = antes - saldo(l.moeda);
      if (Number.isFinite(d) && d >= preco * qtd * 0.98) { levou = true; break; }
    }
    if (levou) {
      alvo.comprados = (alvo.comprados || 0) + qtd;
      if (faltam(alvo) === 0) { alvo.ativo = false; registrar(`alvo "${alvo.nome}" completo: pausei`); }
      salvar();
      registrar(`comprei ${qtd}× ${l.ficha?.nome ?? a.nome} a ${OC.mercado.preco(preco, l.moeda)}`, 'ok');
      OC.avisos?.avisar?.(`mercado-ok-${l.id}`, 'Mercado: comprado', `${qtd}× ${l.ficha?.nome ?? a.nome} a ${OC.mercado.preco(preco, l.moeda)}`);
    } else if (Number.isFinite(antes)) {
      gasto()[l.moeda] = Math.max(0, gasto()[l.moeda] - preco * qtd); salvar();
      registrar(`não levei ${l.ficha?.nome ?? a.nome} (sorteio perdido, vendido antes ou preço mudou)`);
    } else {
      registrar(`pedido enviado para ${l.ficha?.nome ?? a.nome}; confira o resultado no jogo (não consigo ler o saldo em Gemas)`);
    }
  }

  // o resultado da compra não chega como "market": guarda os tipos que chegam logo depois,
  // para o diagnóstico mostrar onde ele vem (sem conteúdo, só o tipo e o começo)
  const posCompra = [];
  function ouvirDepois() {
    const ws = OC.socket;
    if (!ws) return;
    const fim = Date.now() + 8000;
    const f = (ev) => {
      if (Date.now() > fim) return ws.removeEventListener('message', f);
      if (typeof ev.data !== 'string') return;
      const t = (ev.data.match(/"t"\s*:\s*"([^"]+)"/) || [])[1] || '?';
      if (/^(campo|batalha|pong|chat|market)$/.test(t)) return;
      posCompra.unshift({ t, inicio: ev.data.slice(0, 160).replace(/"(nick|vendedor|comprador|caughtBy)"\s*:\s*"[^"]*"/g, '"$1":"[oculto]"') });
      posCompra.length = Math.min(posCompra.length, 15);
    };
    ws.addEventListener('message', f);
  }

  // ---- médias de 7 dias e os preços da Outland --------------------------------------------------
  async function lerMedias(forcar = false) {
    if (!forcar && Date.now() - mediasEm < MEDIAS_MS) return;
    mediasEm = Date.now();
    for (const [cat] of CATEGORIAS) {
      try { await pedir({ t: 'market.itens', elementos: [], categoria: cat }, (m) => m.aba === 'itens'); } catch { /* categoria vazia */ }
    }
    // fragmentos e tokens sem nome: uma olhada em cada um ensina o nome
    if (forcar) {
      for (const id of Object.keys(medias)) {
        if (nomes()[id]) continue;
        try { await pedir({ t: 'market.item', itemId: Number(id), moeda: 'gold' }, (m) => m.aba === 'item' && Number(m.itemId) === Number(id)); } catch { /* sem oferta */ }
      }
      precosDaOutland();
    }
  }
  function precosDaOutland() {
    const p = prefs();
    if (p.precoOutlandDoMercado === false) return;
    const acha = (re, nao) => Object.keys(medias).find((id) => re.test(nomeItem(id)) && !(nao && nao.test(nomeItem(id))));
    const pares = [['precoToken', acha(/bronze boss token/i)], ['precoFragChave', acha(/fragmento de chave|key fragment/i)],
      ['precoFragShiny', acha(/shiny stone/i, /mega/i)], ['precoFragBike', acha(/bicicleta|bike|bicycle/i)]];
    let mudou = false;
    for (const [k, id] of pares) {
      const v = id != null ? Math.round(Number(medias[id]?.gold) || 0) : 0;
      if (v > 0 && p[k] !== v) { p[k] = v; mudou = true; }
    }
    if (mudou) { salvar(); OC.emit('mercado', null); }
  }

  // ---- o laço ---------------------------------------------------------------------------------
  async function ciclo() {
    if (rodando) return;
    const p = prefs();
    if (!p.mercadoLigado) { status = 'desligado'; return; }
    if (OC.socket?.readyState !== 1) { status = 'sem conexão com o jogo'; return; }
    if (mercadoNaTela()) { status = 'esperando: o Mercado do jogo está aberto na tela'; return; }
    rodando = true;
    try {
      const lista = alvos().filter((a) => a.ativo && faltam(a) > 0);
      status = lista.length ? `olhando ${lista.length} alvo${lista.length > 1 ? 's' : ''}` : 'sem alvos ativos';
      for (const a of lista) {
        if (Date.now() - (olhadoEm.get(a.id) ?? 0) < CICLO_MS) continue;
        olhadoEm.set(a.id, Date.now());
        try { await checar(a); } catch (e) { registrar(`${a.nome}: ${e.message}`, 'erro'); }
        if (!prefs().mercadoLigado || mercadoNaTela()) break;
      }
      if (lista.length) await lerMedias();
    } finally { rodando = false; }
  }
  setInterval(() => { ciclo().catch(() => { rodando = false; }); }, 2000);
  // anúncios vistos há mais de 10 min saem da memória (se voltarem com preço novo, são olhados de novo)
  setInterval(() => { const lim = Date.now() - 600000; for (const [id, v] of vistos) if (v.quando < lim && !agendados.has(id)) vistos.delete(id); }, 60000);

  OC.mercado = {
    status: () => status,
    registro: () => registro,
    medias: () => medias,
    nomeItem, idDoItem, gasto, limite, sobra,
    agendados: () => agendados.size,
    posCompra: () => posCompra,
    categorias: CATEGORIAS,
    lerMedias: () => lerMedias(true),
    preco: (v, moeda) => (moeda === 'orb' ? `${Number(v).toLocaleString('pt-BR')} Gemas` : `${Number(v).toLocaleString('pt-BR')} Coins`),
    cancelarAgendados: () => { for (const t of agendados.values()) clearTimeout(t); agendados.clear(); },
    _checar: checar, _comprar: comprar, _ciclo: ciclo, // para testes
  };
})(globalThis);
