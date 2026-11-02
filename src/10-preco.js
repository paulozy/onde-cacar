// Onde Caçar — Mercado da Comunidade: preço justo de um pokémon (price check).
//
// De onde vêm os números (mensagens gravadas em 02/11/2026):
// - market.historicoGlobal { tipo:'pokemon', busca, soShiny, ordem, pagina, seq } devolve 30 vendas por
//   página, cada uma com o preço (bruto), a moeda, a data (em) e a ficha inteira do pokémon vendido;
// - a busca é por trecho do nome e pega outras espécies ("charizard" traz Brave Charizard e as Megas),
//   então a espécie é filtrada aqui, pelo speciesId.
// Como a conta funciona:
// - compara só com vendas da mesma espécie, mesma moeda e mesmo brilho, e P5 só com P5;
// - cada venda é "puxada" para a nota do anúncio por uma curva preço × nota medida nas vendas da
//   própria espécie (a nota é o que mais mexe no preço dentro de um grupo);
// - as vendas mais parecidas (potência, nível, TM AoE, TM elemental, refino) e mais recentes pesam mais;
// - o preço justo é a mediana ponderada; a faixa normal vai do 25º ao 75º percentil.
(function (root) {
  'use strict';
  const OC = root.__ondeCacar;
  if (!OC || OC.preco) return;

  const DIA = 864e5;
  const JANELA = 30 * DIA;          // a Tabela de preços do jogo também mostra 30 dias
  const MEIA_VIDA = 10 * DIA;       // uma venda de 10 dias atrás pesa metade de uma de hoje
  const CACHE_MS = 10 * 60e3;       // a mesma espécie não é pedida de novo antes de 10 min
  const MAX_PAG = 6;                // até 180 vendas por espécie a cada leitura
  const GUARDAR = 4000;             // vendas guardadas neste navegador
  const CHAVE = 'oc-vendas-pokemon';
  const MULT_P = { 1: 1, 2: 1.05, 3: 1.1, 4: 1.25, 5: 2 };

  // ---- o que já se sabe de vendas: lido do jogo e guardado neste navegador ----------------------
  const vendas = new Map(); // id da venda → venda compacta
  try { for (const v of JSON.parse(localStorage.getItem(CHAVE) || '[]')) if (v?.id != null) vendas.set(v.id, v); } catch { /* nada guardado */ }
  let salvarEm = null;
  function salvar() {
    clearTimeout(salvarEm);
    salvarEm = setTimeout(() => {
      const lim = Date.now() - JANELA;
      const lista = [...vendas.values()].filter((v) => v.em >= lim).sort((a, b) => b.em - a.em).slice(0, GUARDAR);
      try { localStorage.setItem(CHAVE, JSON.stringify(lista)); } catch { /* cheio */ }
    }, 1500);
  }

  const bool = (x) => x === true || x === 1 || x === 'true';
  /** Uma ficha do jogo (de venda ou de anúncio) no formato da conta. */
  function resumir(f) {
    if (!f) return null;
    return {
      sp: Number(f.speciesId), nome: f.nome ?? '', sh: bool(f.shiny), p: Number(f.potencia) || 1,
      n: Number(f.nota) || 0, lv: Number(f.level) || 1, aoe: bool(f.tmAoe), el: f.tmElemental || null,
      rf: Number(f.refinoTotal) || 0, iv: Number(f.ivTotal) || 0, q: Number(f.quality) || 0, pid: f.id ?? null,
    };
  }
  function absorver(linhas) {
    let novas = 0;
    for (const l of linhas ?? []) {
      if (l?.tipo !== 'pokemon' || !l.ficha || l.id == null || !(Number(l.bruto) > 0)) continue;
      if (vendas.has(l.id)) continue;
      const r = resumir(l.ficha);
      if (!Number.isFinite(r.sp)) continue;
      vendas.set(l.id, { id: l.id, ...r, moeda: l.moeda, preco: Number(l.bruto), em: Number(l.em) || Date.now() });
      novas++;
    }
    if (novas) salvar();
    return novas;
  }

  // ---- ouvir o jogo ---------------------------------------------------------------------------------
  let vitrine = null; // a última lista de anúncios que o Mercado do jogo mostrou
  OC.on('market', (m) => {
    if (!m || typeof m !== 'object') return;
    // a Tabela de preços aberta pelo próprio jogo também ensina (seq baixo = pedido do jogo)
    if (m.aba === 'historicoGlobal' && !(Number(m.seq) >= 900000)) absorver(m.linhas);
    // os anúncios que você está vendo na tela: com o Mercado do jogo aberto o sniper não pede nada,
    // e fora dele só conta a vitrine que não foi o sniper que pediu
    if (m.aba === 'vitrine' && Array.isArray(m.linhas) && (OC.mercado?.naTela?.() || !OC.mercado?.listouAgora?.())) {
      const linhas = m.linhas.filter((l) => l?.ficha?.speciesId != null && l.tipo !== 'item');
      if (linhas.length) { vitrine = { t: Date.now(), linhas }; OC.emit('preco', { tipo: 'vitrine' }); }
    }
  });

  // ---- pedir o histórico ----------------------------------------------------------------------------
  let seq = 900000 + Math.floor(Math.random() * 90000) * 10;
  const lidoEm = new Map(); // "espécie:shiny" → quando foi lido
  const lendo = new Map();  // "espécie:shiny" → promessa em andamento

  async function pagina(busca, shiny, pag) {
    const s = ++seq;
    const msg = { t: 'market.historicoGlobal', pagina: pag, seq: s, tipo: 'pokemon', busca, ...(shiny ? { soShiny: 1 } : {}) };
    return OC.mercado.pedir(msg, (m) => m.aba === 'historicoGlobal' && Number(m.seq) === s);
  }

  /** Lê (ou relê) as vendas de uma espécie. Devolve quantas páginas leu. */
  function ler(sp, nome, shiny, { forcar = false, aoProgredir } = {}) {
    const chave = `${sp}:${shiny ? 1 : 0}`;
    if (!forcar && Date.now() - (lidoEm.get(chave) ?? 0) < CACHE_MS) return Promise.resolve(0);
    if (lendo.has(chave)) return lendo.get(chave);
    if (!OC.mercado?.pedir) return Promise.reject(new Error('o módulo do Mercado não carregou'));
    const busca = String(nome || '').trim().toLowerCase();
    if (!busca) return Promise.reject(new Error('sem nome para buscar'));
    const p = (async () => {
      const lim = Date.now() - JANELA;
      let pag = 0;
      for (; pag < MAX_PAG; pag++) {
        const r = await pagina(busca, shiny, pag);
        absorver(r.linhas);
        aoProgredir?.(pag + 1);
        const datas = (r.linhas ?? []).map((l) => Number(l.em)).filter(Boolean);
        if (!r.temMais || !datas.length || Math.min(...datas) < lim) { pag++; break; }
      }
      lidoEm.set(chave, Date.now());
      return pag;
    })().finally(() => lendo.delete(chave));
    lendo.set(chave, p);
    return p;
  }

  // ---- a conta --------------------------------------------------------------------------------------
  const lnP = (p) => Math.log(MULT_P[p] ?? 1);
  function distancia(a, v) {
    let d = 0;
    d += Math.abs(lnP(a.p) - lnP(v.p)) / 0.06;                       // P1→P2 ≈ 0,8; P3→P4 ≈ 2,1
    d += Math.abs(Math.log(Math.max(1, a.lv) / Math.max(1, v.lv))) / Math.LN2 * 0.6; // dobrar o nível ≈ 0,6
    if (a.aoe !== v.aoe) d += 1.5;
    if (!!a.el !== !!v.el) d += 0.8;
    d += Math.abs(a.rf - v.rf) * 0.12;
    return d;
  }

  /** Mediana e quartis com pesos. */
  function quantil(pares, q) {
    const s = pares.slice().sort((a, b) => a.v - b.v);
    const tot = s.reduce((t, x) => t + x.w, 0);
    let acc = 0;
    for (const x of s) { acc += x.w; if (acc >= q * tot) return x.v; }
    return s.at(-1)?.v ?? NaN;
  }

  /** Quanto o preço sobe por ponto de nota, em log (medido nas vendas do grupo). */
  function inclinacao(grupo, agora) {
    const pts = grupo.map((v) => ({ x: v.n, y: Math.log(v.preco), w: Math.pow(0.5, (agora - v.em) / MEIA_VIDA) }));
    const W = pts.reduce((t, p) => t + p.w, 0);
    if (pts.length < 6 || !W) return { b: 1, medida: false };
    const mx = pts.reduce((t, p) => t + p.w * p.x, 0) / W, my = pts.reduce((t, p) => t + p.w * p.y, 0) / W;
    const sxx = pts.reduce((t, p) => t + p.w * (p.x - mx) ** 2, 0), sxy = pts.reduce((t, p) => t + p.w * (p.x - mx) * (p.y - my), 0);
    if (sxx / W < 0.01) return { b: 1, medida: false }; // notas quase iguais: não dá para medir
    return { b: Math.min(2.5, Math.max(0, sxy / sxx)), medida: true };
  }

  /**
   * Preço justo para um pokémon (alvo = resumo da ficha + moeda + preço pedido, se houver).
   * Devolve null quando não há venda nenhuma do mesmo grupo.
   */
  function avaliar(alvo, { agora = Date.now() } = {}) {
    const lim = agora - JANELA;
    const grupo = [...vendas.values()].filter((v) => v.sp === alvo.sp && v.sh === alvo.sh && v.moeda === alvo.moeda
      && (v.p === 5) === (alvo.p === 5) && v.em >= lim && v.preco > 0);
    if (!grupo.length) return null;
    const { b, medida } = inclinacao(grupo, agora);
    const viz = grupo.map((v) => {
      const d = distancia(alvo, v), dn = Math.abs(alvo.n - v.n);
      const rec = Math.pow(0.5, (agora - v.em) / MEIA_VIDA);
      const w = Math.exp(-(d * d) / 2) * Math.exp(-dn / 0.6) * rec; // nota longe pesa menos, mesmo ajustada
      return { ...v, d, w, ajustado: v.preco * Math.exp(b * (alvo.n - v.n)) };
    }).filter((v) => v.w > 0.002).sort((x, y) => y.w - x.w).slice(0, 15);
    if (!viz.length) return { grupo: grupo.length, semParecidos: true };
    const pares = viz.map((v) => ({ v: v.ajustado, w: v.w }));
    const somaW = viz.reduce((t, v) => t + v.w, 0), somaW2 = viz.reduce((t, v) => t + v.w * v.w, 0);
    const nEf = somaW * somaW / somaW2;
    const dMedia = viz.reduce((t, v) => t + v.w * v.d, 0) / somaW;
    const est = quantil(pares, 0.5), p25 = quantil(pares, 0.25), p75 = quantil(pares, 0.75);
    const confianca = nEf >= 5 && dMedia < 1.2 ? 'boa' : nEf >= 2.5 && dMedia < 2 ? 'média' : 'fraca';
    const res = { estimado: est, p25, p75, nEf, dMedia, confianca, vizinhos: viz, grupo: grupo.length, b, bMedida: medida };
    if (Number(alvo.preco) > 0) {
      res.delta = alvo.preco / est - 1;
      res.veredito = alvo.preco <= p25 * 0.92 || res.delta <= -0.2 ? 'barato'
        : res.delta <= 0.1 ? 'justo' : res.delta <= 0.35 ? 'caro' : 'muito caro';
    }
    return res;
  }

  /** O anúncio mais barato da mesma vitrine que é igual ou melhor em tudo. */
  function melhorPorMenos(l, linhas) {
    const a = resumir(l.ficha);
    let melhor = null;
    for (const o of linhas) {
      if (o === l || o.id === l.id || o.moeda !== l.moeda || !(Number(o.preco) < Number(l.preco))) continue;
      const b = resumir(o.ficha);
      if (!b || b.sp !== a.sp || b.sh !== a.sh) continue;
      if (b.p < a.p || b.n < a.n - 0.0005 || b.lv < a.lv || (a.aoe && !b.aoe) || (a.el && !b.el) || b.rf < a.rf) continue;
      if (!melhor || Number(o.preco) < Number(melhor.preco)) melhor = o;
    }
    return melhor;
  }

  OC.preco = {
    resumir, avaliar, ler, melhorPorMenos,
    vitrine: () => vitrine,
    vendasDe: (sp, sh) => [...vendas.values()].filter((v) => v.sp === sp && (sh == null || v.sh === sh)),
    total: () => vendas.size,
    esquecer: () => { vendas.clear(); lidoEm.clear(); try { localStorage.removeItem(CHAVE); } catch { /* */ } },
    _absorver: absorver, // para testes
  };
})(globalThis);
