// Onde Caçar — 4/5: medição ao vivo da hunt em que você está.
//
// Abates: contados nos pacotes do mapa (um selvagem vivo que passa a morto). XP, ouro e
// consumo: o painel de sessão que o próprio jogo guarda no navegador, quando existe.
// Drops: a diferença do seu inventário desde o começo da medição — é o que responde
// "quantos abates por Feather Stone" de verdade. Nada disso é enviado a lugar nenhum.
(function (root) {
  'use strict';
  const OC = (root.__ondeCacar ??= {});
  const CHAVE = 'onde-cacar:medicao:v1';
  const COMPRAVEIS = new Set(['1', '2', '3', '4', '5', '200', '201', '202', '203', '204', '205', '206', '70070']);

  const ler = (k, p) => { try { return JSON.parse(localStorage.getItem(k)) ?? p; } catch { return p; } };
  const gravar = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* sem espaço */ } };

  let banco = ler(CHAVE, { atual: null, historico: [] });
  banco.calib ??= {};
  const VALIDADE_CALIB = 3 * 24 * 3.6e6; // 3 dias: o pokémon sobe de nível e o ritmo muda
  let eu = null;
  let slots = new Map();
  let timer = null;
  const salvar = () => { clearTimeout(timer); timer = setTimeout(() => gravar(CHAVE, banco), 1500); };

  /** Inventário como { id: quantidade }, aceite o jogo mandar objeto ou lista. */
  function inventario(e) {
    const out = {};
    const juntar = (fonte) => {
      if (!fonte) return;
      if (Array.isArray(fonte)) {
        for (const i of fonte) if (i && i.id != null) out[String(i.id)] = (out[String(i.id)] ?? 0) + (Number(i.qtd ?? i.quantidade ?? i.count) || 0);
      } else if (typeof fonte === 'object') {
        for (const [id, q] of Object.entries(fonte)) out[String(id)] = (out[String(id)] ?? 0) + (Number(typeof q === 'object' ? (q?.qtd ?? q?.count) : q) || 0);
      }
    };
    juntar(e?.items); juntar(e?.loot); juntar(e?.mochila);
    return out;
  }
  OC.inventario = inventario;
  OC.estoque = (e, tipo, id) => {
    const fonte = tipo === 'bola' ? e?.balls : e?.items;
    if (!fonte) return null;
    if (Array.isArray(fonte)) { const i = fonte.find((x) => String(x?.id) === String(id)); return i ? Number(i.qtd ?? i.quantidade ?? i.count) || 0 : 0; }
    const v = fonte[id] ?? fonte[String(id)];
    return Number(typeof v === 'object' ? (v?.qtd ?? v?.count) : v) || 0;
  };

  function sessaoDoJogo() {
    const nick = String(eu?.nick ?? document.querySelector('#tr-nick')?.textContent ?? '').trim().toLowerCase();
    if (!nick || nick === '—') return null;
    const s = ler(`sessao-hunt:${nick}`, null);
    return s && typeof s === 'object' && s.ms ? s : null;
  }
  const somaObj = (o) => (o && typeof o === 'object' ? Object.values(o).reduce((s, v) => s + (Number(v) || 0), 0) : 0);
  const fotoJogo = (s) => s ? {
    ms: s.ms, abates: Number(s.abates) || 0, capturas: Number(s.capturas) || 0, gold: Number(s.gold) || 0,
    xpTr: Number(s.xpTreinador) || 0, xpPk: Number(s.xpPokemon) || 0,
    bolas: { ...(s.bolas ?? {}) }, pocoes: { ...(s.pocoes ?? {}) }, revives: { ...(s.revives ?? {}) },
  } : null;

  function comecar(slug, nome) {
    if (banco.atual && banco.atual.abates > 0) {
      banco.historico = [resumo(banco.atual), ...banco.historico].slice(0, 10);
    }
    banco.atual = {
      slug, nome: nome ?? slug, inicio: Date.now(), abates: 0,
      inv: eu ? inventario(eu) : null, jogo: fotoJogo(sessaoDoJogo()), pkId: eu?.activeId ?? null,
    };
    salvar();
    OC.emit('sessao', null);
  }

  OC.on('estado', (e) => {
    eu = e;
    if (banco.atual && !banco.atual.inv) { banco.atual.inv = inventario(e); salvar(); }
    if (banco.atual && !banco.atual.jogo) { const j = fotoJogo(sessaoDoJogo()); if (j) { banco.atual.jogo = j; salvar(); } }
  });

  OC.on('campo.init', (m) => {
    slots = new Map();
    if (!m?.slug || m.centro || m.pvp || m.casa != null) return;
    const nome = (OC.ultimo('welcome')?.hunts ?? []).find((h) => h.slug === m.slug)?.nome;
    if (!banco.atual || banco.atual.slug !== m.slug) comecar(m.slug, nome);
    for (const x of m.mobs ?? []) if (!naoSelvagem(x)) slots.set(x.s, !x.x);
  });

  const naoSelvagem = (x) => x.bn || x.ti !== undefined || x.cura || x.tm || x.depot || x.tr;
  OC.on('campo', (m) => {
    if (!banco.atual) return;
    for (const x of m.mobs ?? []) {
      if (naoSelvagem(x)) continue;
      const vivo = slots.get(x.s);
      if (x.x) {
        if (vivo) { banco.atual.abates++; salvar(); }
        slots.set(x.s, false);
      } else if (!slots.has(x.s) || (vivo === false && x.x === false)) {
        slots.set(x.s, true);
      }
    }
    for (const s of m.fora ?? []) slots.delete(s);
  });

  /** A medição atual, com taxas por hora e os drops desde o começo. */
  function resumo(a) {
    if (!a) return null;
    const agora = Date.now();
    const horas = Math.max(1 / 60, (agora - a.inicio) / 3.6e6);
    const j1 = fotoJogo(sessaoDoJogo());
    if (!a.jogo && j1 && a === banco.atual) { a.jogo = j1; salvar(); } // o painel do jogo apareceu depois
    // O painel de sessão do jogo zera quando você troca de hunt. Se ele zerou depois que a
    // medição começou, o que ele mostra agora já é só desta hunt: a base passa a ser zero.
    if (a.jogo && j1 && j1.ms < a.jogo.ms && a === banco.atual) {
      a.jogo = { ms: 0, abates: 0, capturas: 0, gold: 0, xpTr: 0, xpPk: 0, bolas: {}, pocoes: {}, revives: {} };
      salvar();
    }
    const j0 = a.jogo;
    const jogoOk = j0 && j1 && j1.ms >= j0.ms;
    const d = (k) => (jogoOk ? Math.max(0, j1[k] - j0[k]) : null);
    const abatesJogo = d('abates');
    const abates = Math.max(a.abates, abatesJogo ?? 0);
    const inv = inventario(eu);
    const drops = [];
    if (a.inv) {
      for (const [id, q] of Object.entries(inv)) {
        if (COMPRAVEIS.has(id)) continue;
        const ganho = q - (a.inv[id] ?? 0);
        if (ganho > 0) drops.push({ id, qtd: ganho });
      }
    }
    // 15 min e 100 abates na mesma hunt viram calibração: o ranking passa a usar o ritmo real
    if (a === banco.atual && horas >= 0.25 && abates >= 100) {
      const c = banco.calib[a.slug];
      if (!c || Math.abs(c.kph - abates / horas) / c.kph > 0.02 || Date.now() - c.t > 600000) {
        banco.calib[a.slug] = { kph: abates / horas, t: Date.now(), min: Math.round(horas * 60), pkNivel: eu?.pokemons?.find((p) => p.id === eu.activeId)?.level ?? null };
        salvar();
      }
    }
    const consumo = jogoOk ? {
      bolas: somaObj(j1.bolas) - somaObj(j0.bolas),
      pocoes: somaObj(j1.pocoes) - somaObj(j0.pocoes),
      revives: somaObj(j1.revives) - somaObj(j0.revives),
    } : null;
    return {
      slug: a.slug, nome: a.nome, inicio: a.inicio, horas, minutos: Math.round(horas * 60),
      abates, abatesH: abates / horas,
      xpPk: d('xpPk'), xpTr: d('xpTr'), gold: d('gold'), capturas: d('capturas'),
      xpPkH: jogoOk ? d('xpPk') / horas : null, xpTrH: jogoOk ? d('xpTr') / horas : null,
      goldH: jogoOk ? d('gold') / horas : null, consumo, drops,
    };
  }

  OC.sessao = {
    atual: () => resumo(banco.atual),
    historico: () => banco.historico,
    zerar: () => { const a = banco.atual; comecar(a?.slug ?? null, a?.nome); },
    ativa: () => banco.atual?.slug ?? null,
    calibracao: () => {
      const agora = Date.now(), out = {};
      for (const [k, v] of Object.entries(banco.calib ?? {})) if (agora - v.t < VALIDADE_CALIB) out[k] = v;
      return out;
    },
    esquecerCalibracao: () => { banco.calib = {}; salvar(); },
  };
})(globalThis);
