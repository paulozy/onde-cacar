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
  // depois da liberação: no meio dos 3 s do sorteio, com folga dos dois lados para o erro do relógio
  // (cedo demais o anúncio ainda está retido; tarde demais o sorteio já fechou)
  const JANELA_MS = [800, 1800];
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

  // ---- gravador: aprende as mensagens do Mercado que a extensão ainda não conhece --------------
  // Anunciar, cancelar anúncio e afins nunca passaram por aqui. Quando o jogo manda uma mensagem
  // "market.*" nova (você clicou num botão dele), ela e as respostas dos 4 s seguintes ficam guardadas
  // neste navegador e vão no Diagnóstico. Nada é enviado; é só para conhecer o formato.
  const CONHECIDAS = new Set(['market.listar', 'market.item', 'market.itens', 'market.historicoGlobal', 'market.especies', 'market.comprar', 'market.criar', 'market.cancelar', 'market.meus']);
  const CHAVE_APRENDIDO = 'oc-mercado-aprendido';
  const PESSOAL = /^(nick|nome_?treinador|vendedor|vendedorId|comprador|compradorId|email|e-?mail|senha|password|token|auth|carteira|wallet|endereco|address|ip|telefone|phone)$/i;
  const semPessoal = (v, prof = 0) => {
    if (v == null || typeof v !== 'object' || prof > 8) return v;
    if (Array.isArray(v)) return v.slice(0, 20).map((x) => semPessoal(x, prof + 1));
    const o = {};
    for (const [k, x] of Object.entries(v)) o[k] = PESSOAL.test(k) ? '[oculto]' : semPessoal(x, prof + 1);
    return o;
  };
  let aprendidas = [];
  try { aprendidas = JSON.parse(localStorage.getItem(CHAVE_APRENDIDO) || '[]'); } catch { aprendidas = []; }
  const guardarAprendidas = () => { try { localStorage.setItem(CHAVE_APRENDIDO, JSON.stringify(aprendidas.slice(-12))); } catch { /* sem espaço */ } };
  let gravando = null;
  OC.on('enviado', (txt) => {
    if (typeof txt !== 'string' || !txt.includes('"market.')) return;
    let m; try { m = JSON.parse(txt); } catch { return; }
    if (typeof m?.t !== 'string' || !m.t.startsWith('market.') || CONHECIDAS.has(m.t)) return;
    gravando = { t: m.t, enviado: semPessoal(m), em: Date.now(), respostas: [] };
    aprendidas.push(gravando);
    OC.escutaAte = Date.now() + 4000;
    guardarAprendidas();
    registrar(`aprendi uma mensagem nova do Mercado: ${m.t}`);
  });
  OC.on('bruto', (txt) => {
    if (!gravando || Date.now() - gravando.em > 4000 || gravando.respostas.length >= 6) return;
    let m; try { m = JSON.parse(txt); } catch { return; }
    let r = semPessoal(m);
    if (r?.t === 'estado') r = { t: 'estado', mudou: Object.keys(m.estado ?? {}) }; // o estado é grande: basta saber o que mudou
    let j = JSON.stringify(r);
    if (j.length > 2500) j = `${j.slice(0, 2500)}…`;
    gravando.respostas.push({ ms: Date.now() - gravando.em, msg: j });
    guardarAprendidas();
  });

  // ---- anunciar e cancelar (as mesmas mensagens que os botões do jogo mandam) ---------------------
  // Formato aprendido do próprio jogo: market.criar {tipo, pokemonId, casaId, bicicletaId, qtd, preco,
  // moeda, dias} responde {aba:"criado", anuncio}; market.cancelar {id} e market.meus respondem {aba:"meus"}.
  /** Quantos dias o anúncio dura: o mesmo do último anúncio que você fez pelo jogo (o jogo usou 1). */
  const precoTxt = (v, moeda) => `${Number(v).toLocaleString('pt-BR')} ${moeda === 'orb' ? 'Gemas' : 'Coins'}`;
  const diasDoJogo = () => Number([...aprendidas].reverse().find((a) => a.t === 'market.criar')?.enviado?.dias) || 1;
  async function meusAnuncios() {
    const r = await pedir({ t: 'market.meus' }, (m) => m.aba === 'meus', { aceitaErro: true });
    return r.linhas ?? [];
  }
  /**
   * Anuncia um pokémon seu. Só sai com um clique seu de confirmação (a interface pede). Se o jogo não
   * responder, confere em "meus anúncios" antes de dizer que falhou, e nunca reenvia sozinho.
   */
  async function anunciar({ pokemonId, preco, moeda, dias, nome = 'pokémon' }) {
    preco = Math.floor(Number(preco));
    if (!(preco > 0)) throw new Error('preço inválido');
    if (moeda !== 'gold' && moeda !== 'orb') throw new Error('moeda inválida');
    if (pokemonId == null) throw new Error('sem o pokémon');
    dias = Math.min(30, Math.max(1, Math.floor(Number(dias) || diasDoJogo()))); // Wiki: pensão de 1 a 30 dias
    const msg = { t: 'market.criar', tipo: 'pokemon', pokemonId, casaId: null, bicicletaId: null, qtd: 1, preco, moeda, dias };
    const txt = `${nome} por ${precoTxt(preco, moeda)}`;
    try {
      const r = await pedir(msg, (m) => m.aba === 'criado' && String(m.anuncio?.pokemonId) === String(pokemonId), { aceitaErro: true });
      registrar(`anunciei ${txt} (anúncio ${r.anuncio?.id})`, 'ok');
      return r.anuncio;
    } catch (e) {
      if (e.doJogo) { registrar(`o jogo recusou o anúncio de ${txt}: ${e.message}`, 'erro'); throw e; }
      // sem resposta: o anúncio pode ter entrado mesmo assim
      try {
        const meu = (await meusAnuncios()).find((l) => String(l.pokemonId) === String(pokemonId));
        if (meu) { registrar(`anunciei ${txt} (anúncio ${meu.id}; confirmado em "meus anúncios")`, 'ok'); return meu; }
      } catch { /* segue para o erro */ }
      registrar(`não consegui confirmar o anúncio de ${txt}: ${e.message}`, 'erro');
      throw new Error(`${e.message}. Confira em "Meus anúncios" no jogo antes de tentar de novo.`);
    }
  }
  async function cancelarAnuncio(id) {
    const r = await pedir({ t: 'market.cancelar', id }, (m) => m.aba === 'meus', { aceitaErro: true });
    const ainda = (r.linhas ?? []).some((l) => String(l.id) === String(id));
    if (ainda) throw new Error('o anúncio continua na lista');
    registrar(`cancelei o anúncio ${id}`, 'ok');
    return true;
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

  // quando o pedido é uma ação (anunciar, cancelar), a recusa do jogo chega como t:"erro"
  OC.on('erro', (m) => {
    if (!esperando?.aceitaErro) return;
    const e = esperando; esperando = null;
    e.falha(Object.assign(new Error(m?.msg ?? m?.texto ?? m?.mensagem ?? m?.chave ?? 'o jogo recusou'), { doJogo: true }));
  });

  // um pedido por vez: a resposta do Mercado não traz o número do pedido, então a fila garante
  // que a próxima resposta é a deste pedido
  let fila = Promise.resolve();
  let listouEm = 0; // quando o sniper pediu uma vitrine (para o price check não confundir com a sua)
  function pedir(msg, bate, opcoes) {
    const p = fila.then(() => pedirAgora(msg, bate, opcoes));
    fila = p.catch(() => {});
    return p;
  }
  async function pedirAgora(msg, bate, { aceitaErro = false } = {}) {
    const espera = ultimoPedido + ESPACO_MS - Date.now();
    if (espera > 0) await dormir(espera);
    if (OC.socket?.readyState !== 1) throw new Error('sem conexão com o jogo');
    ultimoPedido = Date.now();
    const resposta = new Promise((ok, falha) => {
      esperando = { bate, ok, falha, aceitaErro };
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

  /** Shiny do alvo: 'qualquer' | 'so' | 'nao' (alvos antigos guardavam soShiny: true). */
  const shinyDe = (f) => f.shiny ?? (f.soShiny ? 'so' : 'qualquer');
  const OUTLAND = (sp) => sp >= 2001 && sp < 3000;
  function filtrosPokemon(a) {
    const f = a.filtros ?? {};
    const s = (v) => (v == null || v === '' ? '' : String(v));
    return {
      t: 'market.listar', tipo: 'pokemon', moeda: a.moeda, busca: '', ordem: 'baratos', criterios: [], elementos: [], categoria: '',
      soShiny: shinyDe(f) === 'so', soP5: false, soMega: false, soLendario: false, soTmElemental: false, soTmAoe: !!f.soTmAoe, semOutland: !!f.semOutland,
      nivelMin: s(f.nivelMin), nivelMax: s(f.nivelMax), potenciaMin: s(f.potenciaMin), potenciaMax: '', ivMin: s(f.ivMin), ivMax: '',
      // nota vazia = qualquer: o Mercado já exige 3,5 (menos shiny, P5 e lendário, que entram com qualquer nota)
      qualidadeMin: s(f.qualidadeMin), qualidadeMax: '', notaMin: s(f.notaMin), notaMax: '', pagina: 0,
      ...(a.especieId ? { especieId: Number(a.especieId) } : {}),
    };
  }
  /** Confere de novo do lado de cá: o filtro do servidor pode ignorar um campo. */
  function pokemonServe(a, fi) {
    const f = a.filtros ?? {};
    if (!fi) return false;
    const sp = Number(fi.speciesId), sh = shinyDe(f);
    if (a.especieId && sp !== Number(a.especieId)) return false;
    if (sh === 'so' && !fi.shiny) return false;
    if (sh === 'nao' && fi.shiny) return false;
    if (f.soTmAoe && !(fi.tmAoe === true || fi.tmAoe === 1)) return false;
    if (f.semOutland && OUTLAND(sp)) return false;
    if (f.potenciaMin && (Number(fi.potencia) || 0) < Number(f.potenciaMin)) return false;
    if (f.ivMin && (Number(fi.ivTotal) || 0) < Number(f.ivMin)) return false;
    if (f.qualidadeMin && (Number(fi.quality) || 0) < Number(f.qualidadeMin)) return false;
    if (f.notaMin && (Number(fi.nota) || 0) < Number(f.notaMin)) return false;
    if (f.nivelMin && (Number(fi.level) || 0) < Number(f.nivelMin)) return false;
    if (f.nivelMax && (Number(fi.level) || 0) > Number(f.nivelMax)) return false;
    return true;
  }
  /** Teto do alvo: o preço fixo, se houver (sem preço fixo, só o relativo ao preço justo decide). */
  const tetoDe = (a) => (Number(a.teto) > 0 ? Number(a.teto) : Infinity);
  /**
   * Teto relativo: o anúncio precisa estar pelo menos X% abaixo do preço justo da aba Preço.
   * Lê as vendas da espécie (no máximo 1 vez a cada 10 min) e recusa quando a conta é fraca.
   */
  async function abaixoDoJusto(a, l) {
    if (!(Number(a.relPct) > 0)) return { ok: true };
    if (!OC.preco || !a.especieId) return { ok: false };
    const r = OC.preco.resumir(l.ficha);
    try { await OC.preco.ler(r.sp, r.nome || a.nome, r.sh); } catch { return { ok: false }; }
    const res = OC.preco.avaliar({ ...r, moeda: l.moeda, preco: Number(l.preco) });
    if (!res?.estimado || res.confianca === 'fraca') return { ok: false };
    const lim = res.estimado * (1 - Number(a.relPct) / 100);
    return { ok: Number(l.preco) <= lim, justo: res.estimado };
  }
  const meu = (l) => { const n = String(eu()?.nick ?? '').toLowerCase(); return !!n && String(l.vendedor ?? '').toLowerCase() === n; };

  function descrever(l, a) {
    const q = l.tipo === 'pokemon' ? `${l.ficha?.nome ?? a.nome} nv ${l.ficha?.level ?? '?'} P${l.ficha?.potencia ?? '?'} IV ${l.ficha?.ivTotal ?? '?'} N ${l.ficha?.nota ?? '?'}` : `${l.qtd}× ${l.ficha?.nome ?? a.nome}`;
    return `${q} a ${OC.mercado.preco(l.preco, l.moeda)}`;
  }

  async function checar(a) {
    let r;
    if (a.tipo === 'item') r = await pedir({ t: 'market.item', itemId: Number(a.itemId), moeda: a.moeda }, (m) => m.aba === 'item' && Number(m.itemId) === Number(a.itemId) && m.moeda === a.moeda);
    else { listouEm = Date.now(); r = await pedir(filtrosPokemon(a), (m) => m.aba === 'vitrine'); listouEm = Date.now(); }
    const agora = agoraSrv();
    for (const l of r.linhas ?? []) {
      if (!l || l.estado !== 'aberto' || l.moeda !== a.moeda || !(Number(l.preco) <= tetoDe(a))) continue;
      if (a.tipo === 'pokemon' && !pokemonServe(a, l.ficha)) continue;
      if (meu(l) || vistos.has(l.id)) continue;
      const rel = a.tipo === 'pokemon' ? await abaixoDoJusto(a, l) : { ok: true };
      if (!rel.ok) continue;
      vistos.set(l.id, { alvo: a.id, quando: Date.now() });
      const libera = Number(l.compravelEm) || 0;
      const em = libera > agora ? `libera em ${Math.ceil((libera - agora) / 1000)} s` : 'já liberado';
      const justo = rel.justo ? `, ${Math.round((1 - Number(l.preco) / rel.justo) * 100)}% abaixo do preço justo (${OC.mercado.preco(Math.round(rel.justo), a.moeda)})` : '';
      registrar(`achei ${descrever(l, a)}${justo} (${em})`);
      OC.avisos?.avisar?.(`mercado-${l.id}`, 'Mercado: oportunidade', `${descrever(l, a)}${justo}${Number(a.teto) > 0 ? `, teto ${OC.mercado.preco(a.teto, a.moeda)}` : ''} · ${em}`);
      if (a.modo === 'comprar') agendar(l, a);
    }
  }

  // A aba escondida há mais de 5 min faz o navegador acordar timers só 1× por minuto, o que
  // perderia o sorteio. Por isso a hora da compra é conferida também a cada mensagem do jogo (o
  // mapa da hunt chega a cada ~250 ms e não sofre esse freio); o timer fica só de reserva.
  function agendar(l, a) {
    if (agendados.has(l.id) || enviados.has(l.id)) return;
    const jitter = JANELA_MS[0] + Math.random() * (JANELA_MS[1] - JANELA_MS[0]);
    const quando = Math.max(Number(l.compravelEm) || 0, agoraSrv()) + jitter;
    const disparar = () => {
      const x = agendados.get(l.id);
      if (!x) return;
      clearTimeout(x.timer); agendados.delete(l.id);
      comprar(l, a).catch((e) => registrar(`erro na compra: ${e.message}`, 'erro'));
    };
    agendados.set(l.id, { quando, disparar, timer: setTimeout(disparar, Math.max(0, quando - agoraSrv())) });
  }
  function conferirAgenda() {
    if (!agendados.size) return;
    const agora = agoraSrv();
    for (const x of [...agendados.values()]) if (agora >= x.quando) x.disparar();
  }
  for (const ev of ['campo', 'estado', 'market', 'batalha.ev', 'campo.init']) OC.on(ev, conferirAgenda);

  async function comprar(l, a) {
    const p = prefs();
    const alvo = alvos().find((x) => x.id === a.id);
    if (!p.mercadoLigado || !alvo?.ativo || alvo.modo !== 'comprar' || enviados.has(l.id)) return;
    if (l.moeda === 'orb' && !p.mercadoGemas) return registrar('compra em Gemas desligada nos ajustes do Mercado', 'erro');
    // o alvo pode ter sido editado depois que o anúncio foi agendado: confere de novo com o alvo atual
    if (Number(l.preco) > tetoDe(alvo) || l.moeda !== alvo.moeda || (l.tipo === 'pokemon' && !pokemonServe(alvo, l.ficha))) {
      return registrar(`não comprei ${descrever(l, a)}: o alvo "${alvo.nome || 'qualquer pokémon'}" mudou e ele não serve mais`);
    }
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
    const atraso = (agoraSrv() - (Number(l.compravelEm) || 0)) / 1000;
    const quando = !l.compravelEm ? '' : atraso < 0 ? ` (${(-atraso).toFixed(1)} s antes de liberar: cedo demais)`
      : atraso <= 3 ? ` (${atraso.toFixed(1)} s depois de liberar, dentro do sorteio)` : ` (${atraso.toFixed(1)} s depois de liberar: fora do sorteio, só leva se sobrar)`;
    registrar(`pedi ${qtd}× ${l.ficha?.nome ?? a.nome} a ${OC.mercado.preco(preco, l.moeda)}${quando}`, atraso > 3 || atraso < 0 ? 'erro' : 'info');
    if (atraso > 3) OC.avisos?.avisar?.('mercado-atraso', 'Mercado: pedido atrasado', 'O pedido saiu depois do sorteio. Deixe a conta numa hunt (o relógio e o gatilho vêm das mensagens do mapa) e tire o pokeidle.io das guias em suspensão.', 600000);
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
    pedir, naTela: mercadoNaTela, shinyDe,
    aprendidas: () => aprendidas.slice(),
    meusAnuncios,
    diasDoJogo,
    anunciar,
    cancelarAnuncio,
    /** A mensagem de anunciar, se você já anunciou alguma vez pelo jogo com a extensão ligada. */
    anuncioAprendido: () => [...aprendidas].reverse().find((a) => /anunci|vender|venda|publicar|criar|postar|listar(?!$)/i.test(a.t.replace(/^market\./, '')) && !/cancel|remov|retir/i.test(a.t)) ?? null,
    /** Vitrine de uma espécie pedida pela extensão: marcada para o price check não tomar como a da tela. */
    listarVitrine: async ({ especieId, moeda, soShiny = false }) => {
      const msg = { ...filtrosPokemon({ moeda, especieId, filtros: { shiny: soShiny ? 'so' : 'qualquer' } }), ordem: 'baratos' };
      listouEm = Date.now();
      try { return await pedir(msg, (m) => m.aba === 'vitrine'); } finally { listouEm = Date.now(); }
    },
    /** Depois de editar um alvo: os anúncios que ele já tinha descartado voltam a ser olhados. */
    reolhar: (alvoId) => { for (const [id, v] of vistos) if (v.alvo === alvoId && !agendados.has(id)) vistos.delete(id); olhadoEm.delete(alvoId); }, listouAgora: () => Date.now() - listouEm < 8000,
    preco: (v, moeda) => (moeda === 'orb' ? `${Number(v).toLocaleString('pt-BR')} Gemas` : `${Number(v).toLocaleString('pt-BR')} Coins`),
    cancelarAgendados: () => { for (const x of agendados.values()) clearTimeout(x.timer); agendados.clear(); },
    relogioOk: () => OC.offsetServidor != null,
    _checar: checar, _comprar: comprar, _ciclo: ciclo, _agendarTeste: agendar, // para testes
  };
})(globalThis);
