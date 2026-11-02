// Onde Caçar — por quanto vender um pokémon seu.
// Junta o histórico de vendas (aba Preço), os anúncios abertos agora da mesma espécie, a comissão
// do Mercado e o valor no NPC, e sugere o preço de anúncio em Coins e em Gemas.
(function (root) {
  'use strict';
  const OC = root.__ondeCacar;
  if (!OC) return;

  // Wiki: comissão de 10% em Coins e 15% em Gemas; 1.000 Gemas sacam US$ 10
  const COMISSAO = { gold: 0.10, orb: 0.15 };
  const USD_POR_GEMA = 0.01;
  const NOTA_MIN = 3.5, NIVEL_MIN = 50;
  const bool = (x) => x === true || x === 1 || x === 'true';
  const soma = (o) => (o && typeof o === 'object' ? Object.values(o).reduce((s, v) => s + (Number(v) || 0), 0) : Number(o) || 0);

  /** Resolve A·x = b (A simétrica) por eliminação de Gauss; null se não tiver solução. */
  function resolver(A, b) {
    const n = b.length, M = A.map((l, i) => [...l, b[i]]);
    for (let c = 0; c < n; c++) {
      let piv = c;
      for (let l = c + 1; l < n; l++) if (Math.abs(M[l][c]) > Math.abs(M[piv][c])) piv = l;
      if (Math.abs(M[piv][c]) < 1e-12) return null;
      [M[c], M[piv]] = [M[piv], M[c]];
      for (let l = 0; l < n; l++) {
        if (l === c) continue;
        const f = M[l][c] / M[c][c];
        for (let k = c; k <= n; k++) M[l][k] -= f * M[c][k];
      }
    }
    return M.map((l, i) => l[n] / l[i]);
  }

  /**
   * Nota estimada pelas vendas da espécie quando o jogo não manda a nota do seu pokémon.
   * A nota mede a força do nascimento dentro da espécie (qualidade, IV, potência, refino; o nível
   * não entra), então uma regressão nas fichas vendidas reproduz a régua dela.
   */
  function estimarNota(r) {
    const todas = (OC.preco?.vendasDe(r.sp, r.sh) ?? []).filter((v) => v.n > 0 && v.q > 0 && v.iv > 0);
    const mesmaP = todas.filter((v) => v.p === r.p);
    const base = mesmaP.length >= 8 ? mesmaP : todas;
    if (base.length < 8) return { n: null, erro: null, amostra: base.length };
    const x = (v) => [1, Math.log(v.q), v.iv, v.p, v.rf || 0];
    const k = 5, A = Array.from({ length: k }, () => Array(k).fill(0)), b = Array(k).fill(0);
    for (const v of base) {
      const f = x(v);
      for (let i = 0; i < k; i++) { b[i] += f[i] * v.n; for (let j = 0; j < k; j++) A[i][j] += f[i] * f[j]; }
    }
    for (let i = 1; i < k; i++) A[i][i] += 1e-6 * base.length; // colunas constantes (todo mundo sem refino) não travam a conta
    const w = resolver(A, b);
    if (!w) return { n: null, erro: null, amostra: base.length };
    const prever = (v) => x(v).reduce((s, f, i) => s + f * w[i], 0);
    const erro = Math.sqrt(base.reduce((s, v) => s + (prever(v) - v.n) ** 2, 0) / base.length);
    const n = Math.max(0, Math.min(10, prever(r)));
    return { n: Math.round(n * 100) / 100, erro: Math.round(erro * 100) / 100, amostra: base.length };
  }

  /** O pokémon da conta no mesmo formato das fichas do Mercado (OC.preco.resumir). */
  function resumirMeu(pk, { notaManual } = {}) {
    if (!pk) return null;
    const esp = OC.ui?.interno?.()?.jogo?.especies?.get?.(Number(pk.speciesId));
    const r = {
      sp: Number(pk.speciesId), nome: esp?.name || pk.nome || '', apelido: pk.apelido || null, sh: bool(pk.shiny),
      p: Number(pk.potencia) || 1, lv: Number(pk.level) || 1, aoe: bool(pk.tmAoe), el: pk.tmElemental || null,
      rf: Number(pk.refinoTotal) || soma(pk.refino), iv: Number(pk.ivTotal) || soma(pk.ivs), q: Number(pk.quality ?? pk.qualidade) || 0,
      pid: pk.id, inicial: bool(pk.inicial) || bool(pk.starter), travado: bool(pk.travado) || bool(pk.locked) || bool(pk.lock),
      lendario: !!(esp?.legendary || esp?.lendario),
    };
    const doJogo = Number(pk.nota ?? pk.ficha?.nota);
    if (Number(notaManual) > 0) { r.n = Number(notaManual); r.origemNota = 'manual'; }
    else if (doJogo > 0) { r.n = doJogo; r.origemNota = 'jogo'; }
    else {
      const e = estimarNota(r);
      r.n = e.n; r.origemNota = e.n != null ? 'estimada' : 'sem'; r.notaErro = e.erro; r.notaAmostra = e.amostra;
    }
    return r;
  }

  /** Pode ir ao Mercado? (Wiki: nota 3,5+ e nível 50+, ou shiny ou P5; o inicial é protegido.) */
  function podeAnunciar(r) {
    if (r.inicial) return { ok: false, motivo: 'o pokémon inicial não pode ser vendido' };
    if (r.sh || r.p === 5) return { ok: true };
    if (r.lv < NIVEL_MIN) return { ok: false, motivo: `o Mercado pede nível ${NIVEL_MIN}+ (ele está no ${r.lv})` };
    if (r.n != null && r.n < NOTA_MIN) return { ok: false, motivo: `o Mercado pede nota ${String(NOTA_MIN).replace('.', ',')}+ (ele tem ${String(r.n).replace('.', ',')})` };
    return { ok: true };
  }

  /** Venda ao NPC (Wiki): valorBase × (1 + min(nível,100)/50) × qualidade × (shiny ? 10 : 1). */
  function valorNpc(r) {
    const esp = OC.ui?.interno?.()?.jogo?.especies?.get?.(r.sp);
    const bruto = esp ? (esp.priceNpc > 0 ? esp.priceNpc : esp.sellValue > 0 ? esp.sellValue : 0) : 0;
    if (!(bruto > 0) || !(r.q > 0)) return null;
    const base = Math.min(bruto, 64907);
    return Math.floor(base * (1 + Math.min(r.lv, 100) / 50) * r.q * (r.sh ? 10 : 1));
  }

  /** Igual ou melhor que o seu em tudo que pesa no preço. */
  const igualOuMelhor = (a, r) => a.p >= r.p && a.n >= r.n - 0.005 && a.lv >= r.lv && (a.aoe || !r.aoe) && (!!a.el || !r.el) && (a.rf || 0) >= (r.rf || 0);

  /** Anúncios abertos agora da espécie, numa moeda (sem acionar a gaveta do price check). */
  async function concorrencia(r, moeda) {
    if (!OC.mercado?.listarVitrine) return null;
    const m = await OC.mercado.listarVitrine({ especieId: r.sp, moeda, soShiny: r.sh });
    const linhas = (m?.linhas ?? []).filter((l) => l?.estado !== 'vendido' && l?.ficha && Number(l.ficha.speciesId) === r.sp && bool(l.ficha.shiny) === r.sh && l.moeda === moeda && String(l.ficha.id ?? '') !== String(r.pid ?? '-'));
    const an = linhas.map((l) => ({ preco: Number(l.preco), ...OC.preco.resumir(l.ficha) })).filter((a) => a.preco > 0).sort((a, b) => a.preco - b.preco);
    const melhores = an.filter((a) => igualOuMelhor(a, r));
    return { total: an.length, maisBarato: an[0] ?? null, melhorMaisBarato: melhores[0] ?? null, melhores: melhores.length };
  }

  /** Arredonda para um número "de anúncio" (3 algarismos significativos, para baixo). */
  function redondo(v) {
    if (!(v > 0)) return 0;
    const p = 10 ** Math.max(0, Math.floor(Math.log10(v)) - 2);
    return Math.floor(v / p) * p;
  }

  /**
   * Avalia a venda numa moeda: preço justo pelas vendas, teto pela concorrência e três sugestões
   * (vender rápido, preço justo, sem pressa), cada uma com o líquido depois da comissão.
   */
  function sugerir(r, moeda, conc) {
    const res = OC.preco.avaliar({ ...r, moeda, preco: 0 });
    const est = res?.estimado ?? null;
    const teto = conc?.melhorMaisBarato ? conc.melhorMaisBarato.preco : null; // acima disso, o comprador leva o outro
    const abaixo = (v) => (teto && v >= teto ? redondo(teto * 0.98) : redondo(v));
    let opcoes = null;
    if (est) {
      opcoes = {
        rapido: abaixo(Math.min(res.p25 ?? est * 0.85, est * 0.9)),
        justo: abaixo(est),
        paciente: abaixo(Math.max(res.p75 ?? 0, est * 1.1)),
      };
    } else if (teto) {
      opcoes = { rapido: redondo(teto * 0.9), justo: redondo(teto * 0.98), paciente: redondo(teto * 0.98) };
    }
    if (opcoes) {
      // com o teto da concorrência as três podem empatar: rápido fica um pouco abaixo, e "sem pressa"
      // some, porque esperar não adianta quando um igual ou melhor está mais barato
      if (opcoes.rapido >= opcoes.justo) opcoes.rapido = redondo(opcoes.justo * 0.95);
      if (!(opcoes.paciente > opcoes.justo)) opcoes.paciente = null;
    }
    const liquido = (v) => Math.floor(v * (1 - COMISSAO[moeda]));
    // percentil da nota entre os vendidos da espécie nesta moeda (quão bom ele é para quem compra)
    const vendidos = (OC.preco.vendasDe(r.sp, r.sh) ?? []).filter((v) => v.moeda === moeda && v.n > 0);
    const pct = vendidos.length >= 5 && r.n != null ? Math.round((vendidos.filter((v) => v.n < r.n).length / vendidos.length) * 100) : null;
    return { moeda, res, est, teto, conc, opcoes, liquido, comissao: COMISSAO[moeda], pctNota: pct, vendidos: vendidos.length };
  }

  /** Avaliação completa: lê as vendas, olha a vitrine e devolve as sugestões nas moedas que fazem sentido. */
  async function avaliarVenda(pk, { notaManual, forcar = false, aoProgredir } = {}) {
    const r = resumirMeu(pk, { notaManual });
    if (!r || !Number.isFinite(r.sp)) throw new Error('não reconheci a espécie desse pokémon');
    if (r.lendario) return { r, lendario: true, npc: valorNpc(r), pode: podeAnunciar(r) };
    aoProgredir?.('lendo as vendas da espécie…');
    await OC.preco.ler(r.sp, r.nome, r.sh, { forcar, aoProgredir: (n) => aoProgredir?.(`lendo as vendas: página ${n}`) });
    // com as vendas lidas, a estimativa da nota fica melhor
    if (r.origemNota !== 'jogo' && r.origemNota !== 'manual') Object.assign(r, resumirMeu(pk, { notaManual }));
    const moedas = r.sh ? ['orb'] : ['gold', 'orb']; // shiny só é vendido em Gemas
    const porMoeda = [];
    for (const moeda of moedas) {
      aoProgredir?.(`olhando os anúncios em ${moeda === 'orb' ? 'Gemas' : 'Coins'}…`);
      let conc = null;
      try { conc = await concorrencia(r, moeda); } catch { conc = null; }
      porMoeda.push(sugerir(r, moeda, conc));
    }
    return { r, porMoeda, npc: valorNpc(r), pode: podeAnunciar(r), em: Date.now() };
  }

  OC.venda = { resumirMeu, estimarNota, podeAnunciar, valorNpc, avaliarVenda, redondo, COMISSAO, USD_POR_GEMA };
})(globalThis);
