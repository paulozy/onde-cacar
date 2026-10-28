// Onde Caçar — 3/5: o motor. Simula o seu pokémon em cada hunt e monta o setup de itens.
//
// Combate: Poképedia do jogo (dano, STAB, efetividade ampliada na hunt, recargas, Investida,
// HP ×5 e dano ×1,8 do selvagem). Ritmo das ondas e caminhada: medições publicadas pelo guia
// HardToCapture. Quando o jogo expõe a fórmula num módulo, o módulo manda.
(function (root) {
  'use strict';
  const OC = (root.__ondeCacar ??= {});

  const R = {
    randMin: 0.85, randMax: 1, rand: 0.925, stab: 1.5,
    gapPkMs: 900, gapSelS: 1.4, invPoder: 30, invCdMs: 2000, pisoCdMs: 400, msPorIv: 10,
    hpMult: 12, hpMin: 24, ivSel: 16, poderMin: 15,
  };
  const M = {
    retarget: 1.0, cicloMin: 1.8, gapOnda: 2.8, msOnda: 2.6, velSel: 1.9, passo: 0.26, fBusca: 0.31,
    distPadrao: 20.6, spawnsPadrao: 15, maxSpawns: 16, slotSinnoh: 30, slotOutras: 65, nivelOnda: 150,
    respawn: 3, amostras: 32,
  };
  const POCOES = [
    { id: 200, nome: 'Small Potion', cura: 60, preco: 50 },
    { id: 201, nome: 'Great Potion', cura: 150, preco: 150 },
    { id: 202, nome: 'Ultra Potion', cura: 400, preco: 400 },
    { id: 203, nome: 'Hyper Potion', cura: 1000, preco: 800 },
    { id: 204, nome: 'Ultimate Potion', cura: 3000, preco: 1500 },
    { id: 70070, nome: 'Golden Potion', curaPct: 0.5, preco: 2500 },
  ];
  const BOLAS = [
    { id: 1, chave: 'poke', nome: 'Poké Ball', forca: 1, preco: 5 },
    { id: 2, chave: 'great', nome: 'Great Ball', forca: 2, preco: 20 },
    { id: 3, chave: 'super', nome: 'Super Ball', forca: 3, preco: 50 },
    { id: 4, chave: 'ultra', nome: 'Ultra Ball', forca: 4, preco: 130 },
    { id: 5, chave: 'beast', nome: 'Beast Ball', forca: 8, preco: 0, premium: true },
  ];
  const REVIVE = { id: 205, nome: 'Revive', preco: 600 };
  OC.POCOES = POCOES; OC.BOLAS = BOLAS; OC.REVIVE = REVIVE;

  const PEDRA = { NORMAL: 'Sun Stone', FIRE: 'Fire Stone', WATER: 'Water Stone', GRASS: 'Leaf Stone', ELECTRIC: 'Thunder Stone',
    ICE: 'Ice Stone', FIGHTING: 'Punch Stone', POISON: 'Venom Stone', GROUND: 'Earth Stone', FLYING: 'Feather Stone',
    PSYCHIC: 'Enigma Stone', BUG: 'Cocoon Stone', ROCK: 'Rock Stone', GHOST: 'Darkness Stone', DRAGON: 'Ancient Stone',
    DARK: 'Darkness Stone', STEEL: 'Metal Stone', FAIRY: 'Heart Stone' };
  OC.PEDRA = PEDRA;
  const tiposDe = (e) => [e.type1, e.type2].filter(Boolean);
  OC.tiposDe = tiposDe;
  const ivDe = (v) => Math.min(32, Math.max(1, Math.round(Number(v) || 1)));
  const cdPeloIv = (ms, iv) => Math.max(R.pisoCdMs, ms - ivDe(iv) * R.msPorIv);
  const EXPO_OURO = Math.log(6000 / 36) / Math.log(5000);

  function danoBase(nv, poder, atk, def, stab, ef) {
    return (((2 * nv / 5 + 2) * poder * Math.max(1, atk) / Math.max(1, def)) / 50 + 2) * (stab ? R.stab : 1) * ef;
  }
  const statSel = (esp, k, nv) => ((esp[k] ?? 0) + 2 * R.ivSel) * nv / 100;

  // ---- efetividade --------------------------------------------------------------------
  function criarEf(ctx) {
    const tab = ctx.welcome?.tabelaTipos ?? {};
    const fator = ctx.welcome?.ampliacaoHunt ?? 1.5;
    const cache = new Map();
    const base = (a, d1, d2) => {
      const linha = tab[String(a).toUpperCase()] ?? {};
      const contra = (d) => {
        if (!d) return 1;
        const D = String(d).toUpperCase();
        if (D === a) {
          if (linha[D] != null) return linha[D];
          if (a === 'GHOST' || a === 'DRAGON') return 2;
          if (a === 'NORMAL' || a === 'GROUND' || a === 'FLYING') return 1;
          return 0.5;
        }
        return linha[D] ?? 1;
      };
      let v = contra(d1);
      if (d2 && d2 !== d1) v *= contra(d2);
      return v;
    };
    const ampliar = (v) => (v <= 0 ? 0 : v === 1 ? 1 : v > 1 ? 1 + (v - 1) * fator : v / fator);
    return (a, d1, d2) => {
      const k = `${a}|${d1}|${d2}`;
      if (!cache.has(k)) {
        let v;
        try { v = ctx.mod?.analyser?.efetividadeHunt?.(a, d1, d2 ?? null, tab, fator); } catch { v = undefined; }
        cache.set(k, Number.isFinite(v) ? v : ampliar(base(String(a).toUpperCase(), d1, d2)));
      }
      return cache.get(k);
    };
  }

  // ---- bônus de XP (eles se multiplicam) -----------------------------------------------
  function bonusXp(eu, ctx, agora = Number(eu?.servidorAgora) || Date.now()) {
    const itens = [];
    const tipos = ctx.welcome?.tiposBoost ?? [];
    const l = eu?.loja ?? {};
    const boost = (ch) => (agora < (l.boosts?.[ch] ?? 0) ? (tipos.find((b) => b.chave === ch)?.mult ?? 1.5) : 1);
    let pk = 1, tr = 1;
    const somar = (nome, mult, quem) => {
      if (!(mult > 1.0001)) return;
      itens.push({ nome, mult, quem });
      if (quem !== 'tr') pk *= mult;
      if (quem !== 'pk') tr *= mult;
    };
    let baseOk = false;
    try {
      const bp = ctx.mod?.analyser?.multXpPokemon?.(eu ?? {}, agora, tipos);
      const bt = ctx.mod?.analyser?.multXpTreinador?.(eu ?? {}, agora, tipos);
      if (Number.isFinite(bp) && Number.isFinite(bt)) { pk = bp; tr = bt; baseOk = true; }
    } catch { /* reserva abaixo */ }
    const vip = agora < (l.vipAte ?? 0);
    if (baseOk) {
      let conhecido = 1;
      if (vip) { itens.push({ nome: 'VIP', mult: 1.5, quem: 'ambos' }); conhecido *= 1.5; }
      if (boost('xp') > 1) itens.push({ nome: 'XP Boost', mult: boost('xp'), quem: 'tr' });
      if (boost('pokexp') > 1) { itens.push({ nome: 'XP Boost Pokémon', mult: boost('pokexp'), quem: 'pk' }); conhecido *= boost('pokexp'); }
      if (Number(eu?.guildBonusPct) > 0) { itens.push({ nome: 'Guild', mult: 1 + eu.guildBonusPct / 100, quem: 'ambos' }); conhecido *= 1 + eu.guildBonusPct / 100; }
      if (pk / conhecido > 1.005) itens.push({ nome: 'Outros do jogo (Boost da Guild, Sacrifício, ranking…)', mult: pk / conhecido, quem: 'ambos' });
    } else {
      if (vip) somar('VIP', 1.5, 'ambos');
      somar('XP Boost', boost('xp'), 'tr');
      somar('XP Boost Pokémon', boost('pokexp'), 'pk');
      if (Number(eu?.guildBonusPct) > 0) somar('Guild', 1 + eu.guildBonusPct / 100, 'ambos');
      // Wiki: Boost do Sacrifício, +20% no treinador e no pokémon, resgatado no altar da Mochila
      for (const [ch, ate] of Object.entries(l.boosts ?? {})) if (/sacrif/i.test(ch) && agora < Number(ate)) somar('Sacrifício', tipos.find((b) => b.chave === ch)?.mult ?? 1.2, 'ambos');
      const sac = eu?.sacrificio ?? l.sacrificio;
      if (sac && agora < (Number(sac.ate ?? sac.boostAte ?? sac.expira) || 0) && !itens.some((i) => i.nome === 'Sacrifício')) somar('Sacrifício', 1.2, 'ambos');
    }
    const tw = eu?.twitch;
    if (tw?.assistindo && Number(tw.pctAtual) > 0) somar('Twitch', 1 + tw.pctAtual / 100, 'ambos');
    const kk = eu?.kick;
    if (agora < (Number(kk?.bonus?.xp) || 0) && Number(kk?.pct) > 0) somar('Kick', 1 + kk.pct / 100, 'ambos');
    const ev = eu?.evento;
    if (ev && agora < (ev.terminaEm ?? 0)) {
      somar('Evento', 1 + (Number(ev.xpPokemonPct) || 0) / 100, 'pk');
      somar('Evento (treinador)', 1 + (Number(ev.xpTreinadorPct) || 0) / 100, 'tr');
    }
    const at = l.atrasados;
    if (at && Number(at.mult) > 1 && (eu?.level ?? 0) < (Number(at.alvo) || 0)) somar('Atrasados', Number(at.mult), 'ambos');
    return { pk, tr, itens };
  }

  // ---- seu pokémon ----------------------------------------------------------------------
  function montarPokemon(pk, ctx) {
    const esp = ctx.especies.get(pk.speciesId);
    if (!esp) throw new Error(`a espécie de ${pk.nome ?? 'seu pokémon'} não está no catálogo`);
    const st = pk.stats;
    if (!st) throw new Error('o jogo ainda não mandou os stats deste pokémon');
    const nivel = pk.level ?? 1;
    const ivSpd = pk.ivs?.speed;
    const comSpeed = (cd) => {
      try {
        const v = ctx.mod?.cooldown?.cooldownGolpeComSpeed?.(cd, esp.baseSpeed, ivSpd);
        if (Number.isFinite(v)) return v;
      } catch { /* reserva */ }
      // Wiki: potencial = Speed/20 até 120; acima, 6 + (Speed−120)/40, teto 7%; vezes IV/32
      const sp = Number(esp.baseSpeed) || 0;
      const pot = Math.min(7, sp <= 120 ? sp / 20 : 6 + (sp - 120) / 40);
      return cd * (1 - pot * ivDe(ivSpd) / 32 / 100);
    };
    const golpes = (esp.attacks ?? []).filter((a) => (a.learnLevel ?? 1) <= nivel)
      .map((a) => ({ ...a, cdS: comSpeed(a.cooldownMs ?? 2000) / 1000 }));
    if (pk.tmElemental) {
      try {
        const tm = ctx.mod?.tm?.golpeTmElemental?.(pk.tmElemental);
        if (tm) golpes.push({ ...tm, cdS: comSpeed(tm.cooldownMs ?? 60000) / 1000 });
      } catch { /* sem TM */ }
    }
    return {
      bruto: pk, esp, nivel, tipos: pk.tipos?.length ? pk.tipos : tiposDe(esp), st, golpes,
      hp: pk.maxHp ?? Math.max(R.hpMin, Math.round(st.hp * R.hpMult)),
      gapS: cdPeloIv(R.gapPkMs, ivSpd) / 1000,
      cdInvS: cdPeloIv(R.invCdMs, ivSpd) / 1000,
      aoe: pk.tmAoe === true || pk.tmAoe === 'true' || pk.tmAoe === 1,
    };
  }

  /** Segundos de luta por abate: o golpe pronto de maior dano, senão a Investida. */
  function segundosPorAbate(golpes, inv, gapS, hps, mortoS) {
    const ordem = golpes.map((_, i) => i).filter((i) => golpes[i].d > 0).sort((a, b) => golpes[b].d - golpes[a].d);
    const pronto = golpes.map(() => 0);
    let pInv = 0, t = 0, luta = 0, umGolpe = 0;
    for (const hp of hps) {
      let feito = 0, ini = t, ult = t, n = 0;
      while (feito < hp) {
        if (++n > 4000) return { s: Infinity, umGolpe: 0 };
        let i = -1;
        for (const j of ordem) if (pronto[j] <= t) { i = j; break; }
        if (i >= 0) { feito += golpes[i].d; pronto[i] = t + golpes[i].cdS; ult = t; t += gapS; }
        else if (inv.d > 0 && pInv <= t) { feito += inv.d; pInv = t + inv.cdS; ult = t; t += gapS; }
        else {
          let prox = inv.d > 0 ? pInv : Infinity;
          for (const j of ordem) if (pronto[j] < prox) prox = pronto[j];
          if (!Number.isFinite(prox)) return { s: Infinity, umGolpe: 0 };
          t = Math.max(t, prox);
        }
      }
      if (n === 1) umGolpe++;
      luta += ult - ini;
      t = ult + mortoS;
    }
    return { s: luta / hps.length, umGolpe: umGolpe / hps.length };
  }

  // Dias Sazonais (Wiki): na hunt, quem é da tipagem do dia bate ×2 e apanha ×¼
  const fDia = (dia, atk, def) => (!dia ? 1 : (atk.includes(dia) ? 2 : 1) * (def.includes(dia) ? 0.25 : 1));
  OC.fDia = fDia;

  function ameaca(esp, nv, P, ef, ctx, dia) {
    const mult = (ctx.welcome?.multDanoSelvagem ?? 1.8) * fDia(dia, tiposDe(esp), P.tipos);
    const tE = tiposDe(esp);
    const danos = (esp.attacks ?? []).filter((a) => (a.learnLevel ?? 1) <= nv).map((a) => {
      const fis = a.category !== 'SPECIAL';
      return danoBase(nv, Math.max(R.poderMin, a.power ?? 0), statSel(esp, fis ? 'baseAtk' : 'baseSpAtk', nv),
        fis ? P.st.def : P.st.spDef, tE.includes(a.type), ef(a.type, P.tipos[0], P.tipos[1])) * R.rand;
    });
    const inv = danoBase(nv, R.invPoder, statSel(esp, 'baseAtk', nv), P.st.def, true, ef(tE[0], P.tipos[0], P.tipos[1])) * R.rand;
    const media = danos.length ? (danos.reduce((s, x) => s + x, 0) / danos.length) * 0.92 + inv * 0.08 : inv;
    return { dps: media * mult / R.gapSelS, hitMedio: media * mult, hitMax: Math.max(inv, ...danos) / R.rand * mult };
  }

  function abatesPorHora(n, cicloS, h, bike) {
    const passo = M.passo / (1 + bike);
    const dist = M.distPadrao;
    const caminho = dist * passo * M.fBusca;
    const enc = M.velSel * passo / (M.velSel + passo);
    // a fila de chegada: os spawns espalhados entre 40% e 160% da distância típica
    let t = 0;
    for (let i = 0; i < n; i++) t = Math.max(t + cicloS + caminho, dist * (0.4 + 1.2 * (i + 0.5) / n) * enc);
    const porOnda = n * 3600 / (t + M.gapOnda);
    let teto = Infinity;
    if ((h.nivel ?? 0) > M.nivelOnda) {
      const sinnoh = h.regiao === 'sinnoh' || String(h.slug).endsWith('_sinnoh');
      teto = n * 3600 / (sinnoh ? M.slotSinnoh : M.slotOutras);
    }
    return Math.min(3600 / cicloS, porOnda, teto);
  }

  // ---- captura e venda -----------------------------------------------------------------
  // ---- estágio de evolução: decide a chance de captura e o nível ao capturar ------------------
  // Wiki: 1º de uma cadeia de três → teto 20; o do meio, ou o 1º de uma de dois → 40;
  // a última evolução ou quem não evolui → 100. O jogo manda o fator de cada degrau em
  // welcome.captura.porDegrau; a cadeia sai do próprio catálogo de espécies.
  const CAMPOS_TETO = ['tetoCaptura', 'nivelCaptura', 'catchLevel', 'captureLevel', 'capLevel', 'levelCap', 'tc'];
  const CAMPOS_PARA = ['evolveTo', 'evolvesTo', 'evolutions', 'evolucoes', 'evolution', 'nextEvolution', 'evoluiPara'];
  const CAMPOS_DE = ['evolveFrom', 'evolvesFrom', 'preEvolution', 'preEvolucao', 'prevo', 'evoluiDe'];
  const idsDe = (v) => (Array.isArray(v) ? v : v != null ? [v] : []).map((x) => (typeof x === 'object' ? (x.pokeId ?? x.id ?? x.to ?? x.para) : x)).map(Number).filter((n) => n > 0);
  let grafo = null;
  function montarGrafo(ctx) {
    const para = new Map(), de = new Map();
    for (const e of ctx.especies.values()) {
      for (const c of CAMPOS_PARA) for (const id of idsDe(e[c])) { if (!para.has(e.pokeId)) para.set(e.pokeId, new Set()); para.get(e.pokeId).add(id); if (!de.has(id)) de.set(id, e.pokeId); }
      for (const c of CAMPOS_DE) for (const id of idsDe(e[c])) { if (!de.has(e.pokeId)) de.set(e.pokeId, id); if (!para.has(id)) para.set(id, new Set()); para.get(id).add(e.pokeId); }
    }
    return { para, de, vazio: para.size === 0 && de.size === 0, de_: ctx.especies };
  }
  function tetoDe(esp, ctx) {
    for (const c of CAMPOS_TETO) { const v = Number(esp[c]); if (v === 20 || v === 40 || v === 100) return v; }
    const id = Number(esp.pokeId);
    if (id >= 2001 && id < 3000) return 100; // variante de Outland: não evolui
    if (!grafo || grafo.de_ !== ctx.especies) grafo = montarGrafo(ctx);
    if (grafo.vazio) return null;
    let atras = 0;
    for (let x = id, i = 0; grafo.de.has(x) && i < 5; x = grafo.de.get(x), i++) atras++;
    const frente = (x, i = 0) => (i > 4 || !grafo.para.has(x) ? 0 : 1 + Math.max(...[...grafo.para.get(x)].map((y) => frente(y, i + 1))));
    const adiante = frente(id);
    const total = atras + 1 + adiante;
    if (adiante === 0 || total === 1) return 100;
    if (total >= 3 && atras === 0) return 20;
    return 40;
  }
  OC.tetoDe = tetoDe;
  function chanceCaptura(esp, forca, ctx) {
    const c = ctx.welcome?.captura ?? {};
    const base = c.base ?? 0.0075, piso = c.piso ?? 0.003, teto = c.teto ?? 0.1;
    const fatores = c.porDegrau ?? { 20: 2.8669, 40: 3.5745, 100: 4.4681 };
    const t = tetoDe(esp, ctx) ?? 100; // sem a cadeia, assume o estágio mais difícil (a menor chance)
    const fator = Number(fatores[t]) || 4.4681;
    return Math.max(piso, Math.min(teto, base * (forca / fator) * 1.4)); // corpo caído: HP 0 → ×1,4
  }
  OC.chanceCaptura = chanceCaptura;
  /** Próxima troca da tipagem do dia: 18:00 de Brasília = 21:00 UTC. */
  OC.proximaViradaSazonal = (agora = Date.now()) => {
    const d = new Date(agora); d.setUTCHours(21, 0, 0, 0);
    return d.getTime() <= agora ? d.getTime() + 864e5 : d.getTime();
  };
  // Wiki: o valorBase da venda ao NPC tem teto de 64.907 (a base de uma espécie da hunt nível 2.500)
  function tetoValorBase(ctx) {
    const e = ctx.welcome?.economia ?? {};
    for (const [k, v] of Object.entries(e)) if (/teto|max/i.test(k) && /valor|base|venda|npc/i.test(k) && Number(v) > 1000) return Number(v);
    return 64907;
  }

  // ---- Outland: drops raros por tier ------------------------------------------------------------
  // O valor que o jogo manda pode vir como fração, porcentagem ou "1 em N": fica a leitura mais
  // perto do número da Wiki, e a Wiki vale se nenhuma leitura chegar perto.
  function normalizarChance(v, esperado) {
    v = Number(v);
    if (!(v > 0)) return esperado;
    const cands = [v, v / 100, v / 100000, 1 / v];
    let melhor = esperado, dist = Infinity;
    for (const c of cands) { const d = Math.abs(Math.log(c / esperado)); if (d < dist) { dist = d; melhor = c; } }
    return dist < Math.log(10) ? melhor : esperado;
  }
  function chanceEm(obj, esperado) {
    if (obj == null) return esperado;
    if (typeof obj !== 'object') return normalizarChance(obj, esperado);
    for (const [k, v] of Object.entries(obj)) if (/chance|drop/i.test(k) && typeof v === 'number') return normalizarChance(v, esperado);
    return esperado;
  }
  OC.raros = (ctx) => ({
    token: chanceEm(ctx.welcome?.chanceBossToken, 0.0005),
    chave: chanceEm(ctx.welcome?.casas, 0.000005),
    shiny: chanceEm(ctx.welcome?.shinyStone, 0.000005),
    bike: chanceEm(ctx.welcome?.bicicletas, 0.000005),
  });
  OC.tiersOutland = (ctx) => {
    const t = Array.isArray(ctx.welcome?.outlandTiers) && ctx.welcome.outlandTiers.length ? ctx.welcome.outlandTiers
      : [[1, 150, 1], [2, 1000, 1.25], [3, 2000, 1.5], [4, 4000, 2], [5, 8000, 3], [6, 16000, 4], [7, 24000, 6], [8, 36000, 8]].map(([tier, nivel, mult]) => ({ tier, rotulo: `Outland ${tier}`, nivel, mult }));
    const L = Number(ctx.eu?.level) || 0;
    const liberadas = t.filter((x) => L >= x.nivel);
    const melhor = liberadas[liberadas.length - 1] ?? t[0];
    const atual = t.find((x) => x.tier === Number(ctx.eu?.outlandTier)) ?? t[0];
    return { todos: t, melhor, atual };
  };
  // Venda ao NPC (Wiki): valorBase × (1 + nível/50) × qualidade (média ~1,18); nível = o da hunt
  // até 100, acima disso o teto do estágio.
  function vendaCaptura(esp, nv, ctx) {
    const bruto = esp.priceNpc > 0 ? esp.priceNpc : (esp.sellValue > 0 ? esp.sellValue : 0);
    const base = Math.min(bruto, tetoValorBase(ctx));
    if (!(base > 0)) return 0;
    const nivel = nv <= 100 ? nv : (tetoDe(esp, ctx) ?? 100);
    return Math.floor(base * (1 + nivel / 50) * 1.18);
  }

  // ---- uma hunt --------------------------------------------------------------------------
  function simular(h, P, ef, ctx, op) {
    const lista = (h.especies ?? []).map((e) => ({ esp: ctx.especies.get(e.pokeId), pontos: Number(e.pontos) || 0 }))
      .filter((e) => e.esp && e.pontos > 0);
    const total = lista.reduce((s, e) => s + e.pontos, 0);
    if (!total) return null;
    const nv = h.nivel ?? 1;
    const n = Math.max(1, Math.min(M.maxSpawns, Math.round(total) || M.spawnsPadrao));
    const mortoS = M.msOnda / n + M.retarget;
    let ttk = 0, dps = 0, hitMax = 0, hitMedio = 0, xpK = 0, ouroK = 0, lootK = 0, efm = 0, umGolpe = 0;
    let melhor = null, melhorD = -1;
    // Wiki (28/10/2026): o pódio do ginásio do tipo bate mais forte na hunt e no boss, com o
    // pokémon inteiro (golpes e Investida): +25% o líder, +10% o 2º, +5% o 3º; não empilha
    const fGinasio = (op.ginasios ?? []).filter((g) => P.tipos.includes(g.tipo)).reduce((m, g) => Math.max(m, 1 + (({ 1: 0.25, 2: 0.10, 3: 0.05 })[g.pos] || 0)), 1);
    const loot = new Map();
    const cap = BOLAS.map(() => ({ ch: 0, venda: 0 }));
    for (const { esp, pontos } of lista) {
      const w = pontos / total;
      const tA = tiposDe(esp);
      const fd = fDia(op.tipoDia, P.tipos, tA) * fGinasio;
      const golpes = P.golpes.map((g) => {
        const fis = g.category !== 'SPECIAL';
        const e = ef(g.type, tA[0], tA[1]);
        return { d: danoBase(P.nivel, Math.max(R.poderMin, g.power ?? 0), fis ? P.st.atk : P.st.spAtk,
          statSel(esp, fis ? 'baseDef' : 'baseSpDef', nv), P.tipos.includes(g.type), e) * R.rand * fd, cdS: g.cdS, g, e };
      });
      let bl = null;
      for (const g of golpes) if (!bl || g.d > bl.d) bl = g;
      if (bl && bl.d * w > melhorD) { melhorD = bl.d * w; melhor = bl.g; }
      efm += w * (bl ? bl.e : 1);
      const tInv = ef(P.tipos[0], tA[0], tA[1]) === 0 && P.tipos[1] ? P.tipos[1] : P.tipos[0];
      const inv = { d: danoBase(P.nivel, R.invPoder, P.st.atk, statSel(esp, 'baseDef', nv), true, ef(tInv, tA[0], tA[1])) * R.rand * fd, cdS: P.cdInvS };
      const multHp = ctx.welcome?.multHpSelvagem ?? 5;
      const hps = [];
      for (let k = 0; k < M.amostras; k++) {
        const iv = 1 + Math.floor(k * 32 / M.amostras + 0.5);
        hps.push(Math.max(R.hpMin, Math.round(((esp.baseHp ?? 0) + 2 * iv) * nv / 100 * R.hpMult)) * multHp);
      }
      const r = segundosPorAbate(golpes, inv, P.gapS, hps, mortoS);
      if (!Number.isFinite(r.s)) return { h, nivel: nv, inviavel: true, liberada: (ctx.eu?.level ?? Infinity) >= nv };
      ttk += w * r.s; umGolpe += w * r.umGolpe;
      const a = ameaca(esp, nv, P, ef, ctx, op.tipoDia);
      dps += w * a.dps; hitMedio += w * a.hitMedio; hitMax = Math.max(hitMax, a.hitMax);
      let xp, ouro;
      try { xp = ctx.mod?.recompensa?.xpPorDerrota?.(h, nv, esp); } catch { xp = undefined; }
      try { ouro = ctx.mod?.recompensa?.ouroPorDerrotaHunt?.(h, nv, esp); } catch { ouro = undefined; }
      xpK += w * (Number.isFinite(xp) ? xp : nv * nv + 12);
      ouroK += w * (Number.isFinite(ouro) ? ouro : Math.round(36 * Math.min(nv, 25000) ** EXPO_OURO * 1.15));
      // Drops (Wiki, desde 15/10/2026): só a pedra de cada tipo da espécie, com a chance do estágio.
      // O loot antigo que ainda aparece no catálogo não cai mais e fica de fora.
      const teto = tetoDe(esp, ctx) ?? 100;
      const chPedra = teto === 20 ? 0.002 : teto === 40 ? 0.0035 : 0.005;
      for (const tipo of new Set(tA.map((t) => PEDRA[t]).filter(Boolean))) {
        const item = ctx.itens.porNome.get(tipo);
        const atual = loot.get(tipo) ?? { nome: tipo, id: item?.id ?? null, preco: 0, porAbate: 0, chance: 0 };
        atual.porAbate += w * chPedra; atual.chance += w * chPedra;
        loot.set(tipo, atual);
      }
      if (Number(esp.pokeId) >= 2001 && Number(esp.pokeId) < 3000) {
        const nome = 'Bronze Boss Token', item = ctx.itens.porNome.get(nome);
        const atual = loot.get(nome) ?? { nome, id: item?.id ?? null, preco: 0, porAbate: 0, chance: 0 };
        const c = (OC.raros?.(ctx).token ?? 0.0005) * (op.multLoot || 1) * (Number(op.degrauOutland) || 1);
        atual.porAbate += w * c; atual.chance += w * c;
        loot.set(nome, atual);
      }
      const vn = vendaCaptura(esp, nv, ctx);
      BOLAS.forEach((b, i) => { const c = Math.min(0.1, chanceCaptura(esp, b.forca, ctx) * (op.multCaptura || 1)); cap[i].ch += w * c; cap[i].venda += w * c * vn; });
    }
    const ciclo = Math.max(ttk + M.retarget, M.cicloMin);
    const kph = abatesPorHora(n, ciclo, h, op.bike);
    const hp = P.hp;
    const danoAbate = dps * ttk;
    const umHit = hitMax >= hp;
    const hitPct = hitMax / hp;
    const comPocao = op.pocao !== 'nenhuma';
    const abVida = comPocao ? (umHit ? hp / hitMax : 999) : hp / Math.max(1e-6, danoAbate);
    const tMorte = M.respawn + M.distPadrao * M.passo;
    const vida = abVida * (kph > 0 ? 3600 / kph : 0);
    const uptime = abVida >= 999 ? 1 : vida / (vida + tMorte);
    const mortesH = abVida >= 999 ? 0 : 3600 / (vida + tMorte);
    const cal = op.calib?.[h.slug];
    const kModelo = kph * uptime;
    const k = cal ? cal.kph : kModelo; // medido na aba Sessão: já inclui caminhada, respawn e desmaios
    const danoH = danoAbate * k;

    // poções: a cura liga no ponto mais baixo seguro (pior golpe + folga, nunca abaixo de 35%)
    // e o mais alto que evita desperdício; vence quem gasta menos ouro por HP de fato curado.
    const thrMin = Math.min(0.95, Math.max(op.hpMinimo, hitPct + 0.15));
    const pocoes = POCOES.map((p) => {
      const cura = p.curaPct ? p.curaPct * hp : p.cura;
      const thr = Math.max(thrMin, Math.min(0.95, 1 - (cura - hitMedio) / hp));
      const falta = (1 - thr) * hp + hitMedio;
      const ef2 = Math.max(1, Math.min(cura, falta, hp));
      const porH = danoH / ef2;
      return { ...p, thr, porH, custoH: porH * p.preco };
    }).sort((a, b) => a.custoH - b.custoH || a.porH - b.porH);
    let pocao = null;
    if (comPocao && !umHit) pocao = op.pocao === 'auto' ? pocoes[0] : (pocoes.find((p) => String(p.id) === String(op.pocao)) ?? pocoes[0]);

    // pokébolas: um arremesso por corpo; saldo = venda esperada das capturas − bolas
    const bolas = BOLAS.map((b, i) => {
      const preco = b.premium ? (Number(op.precoBeast) || 0) : b.preco;
      const capH = k * cap[i].ch, custoH = k * preco, vendaH = op.vender ? k * cap[i].venda : 0;
      return { ...b, preco, ch: cap[i].ch, capH, custoH, vendaH, saldo: vendaH - custoH };
    });
    const nenhuma = { id: 0, chave: 'nenhuma', nome: 'Não lançar', ch: 0, capH: 0, custoH: 0, vendaH: 0, saldo: 0 };
    const bolasOrd = [...bolas, nenhuma].sort((a, b) => b.saldo - a.saldo || b.capH - a.capH);
    const temBeast = (OC.estoque?.(ctx.eu, 'bola', 5) ?? 0) > 0;
    const bola = op.bola === 'auto' ? bolasOrd.find((b) => !b.premium || temBeast) : (op.bola === 'nenhuma' ? nenhuma : (bolas.find((b) => b.chave === op.bola) ?? bolasOrd[0]));

    const fLoot = (1 + 0.15 * (op.multLoot || 1)) / 1.15;
    const ouroH = k * (ouroK * fLoot + lootK);
    const potH = pocao ? pocao.custoH : 0;
    return {
      h, slug: h.slug, nome: h.nome ?? h.slug, nivel: nv, regiao: h.regiao ?? h.area ?? '',
      liberada: (ctx.eu?.level ?? Infinity) >= nv, inviavel: false,
      ttk, kph: k, kphModelo: kModelo, calibrada: !!cal, calib: cal || null, umGolpe, mortesH, umHit, hitPct, hitMedio, danoH,
      xpKill: xpK, xpPkH: k * xpK * op.mult.pk, xpTrH: k * xpK * op.mult.tr,
      ouroH, potH, pocoes, pocao, bolas: bolasOrd, bola,
      liq: ouroH + bola.vendaH - potH - bola.custoH,
      ef: efm, melhorGolpe: melhor ? { nome: melhor.name, tipo: melhor.type } : null,
      loot: [...loot.values()].sort((a, b) => b.porAbate - a.porAbate),
    };
  }

  const perigosa = (r) => r.umHit || r.mortesH >= 0.5 || r.hitPct >= 0.5;
  OC.perigosa = perigosa;

  /** A tipagem do Dia Sazonal. Wiki: sorteada todo dia às 18:00 de Brasília. Procura, do mais novo
   *  para o mais velho: a mensagem do jogo sobre o dia, o estado, o welcome e, por último, o ícone do
   *  dia na tela da hunt (pelo nome do dia). */
  const TIPOS18 = new Set(Object.keys(PEDRA));
  OC.TIPOS18 = Object.keys(PEDRA);
  const NOMES_DIA = [['Céu Limpo', 'NORMAL'], ['Escaldante', 'FIRE'], ['Chuvoso', 'WATER'], ['Florido', 'GRASS'], ['de Tempestade', 'ELECTRIC'],
    ['de Nevasca', 'ICE'], ['de Treino', 'FIGHTING'], ['Tóxico', 'POISON'], ['de Terremoto', 'GROUND'], ['de Ventania', 'FLYING'], ['Telepático', 'PSYCHIC'],
    ['do Enxame', 'BUG'], ['de Avalanche', 'ROCK'], ['Assombrado', 'GHOST'], ['do Dragão', 'DRAGON'], ['Noite Eterna', 'DARK'], ['da Forja', 'STEEL'], ['Encantado', 'FAIRY']];
  let domCache = { em: 0, tipo: null };
  function tipoDoDiaNaTela() {
    if (typeof document === 'undefined') return null;
    if (Date.now() - domCache.em < 60000) return domCache.tipo;
    let tipo = null;
    try {
      for (const el of document.querySelectorAll('[title],[alt],[aria-label],[data-tip],[data-tooltip]')) {
        if (el.closest?.('.oc-painel')) continue;
        const txt = [el.getAttribute('title'), el.getAttribute('alt'), el.getAttribute('aria-label'), el.getAttribute('data-tip'), el.getAttribute('data-tooltip')].join(' ');
        if (!/\bDia\b|Noite Eterna/.test(txt)) continue;
        const achou = NOMES_DIA.find(([n]) => txt.includes(n.startsWith('d') ? `Dia ${n}` : n));
        if (achou) { tipo = achou[1]; break; }
      }
    } catch { /* tela sem o ícone */ }
    domCache = { em: Date.now(), tipo };
    return tipo;
  }
  OC.tipoDoDia = (ctx) => {
    const busca = (o, prof = 0) => {
      if (!o || typeof o !== 'object' || prof > 2) return null;
      for (const [k, v] of Object.entries(o)) {
        if (/sazon|tipoDo?Dia|diaTipo|tipagemDia/i.test(k)) {
          const t = String(typeof v === 'object' ? (v?.tipo ?? v?.tipagem ?? v?.type ?? '') : v).toUpperCase();
          if (TIPOS18.has(t)) return t;
        }
        if (v && typeof v === 'object' && !Array.isArray(v)) { const r = busca(v, prof + 1); if (r) return r; }
      }
      return null;
    };
    return busca({ sazonal: OC.ultimoSazonal }) ?? busca(OC.ultimoSazonal) ?? busca(ctx.eu) ?? busca(ctx.welcome) ?? tipoDoDiaNaTela();
  };

  /** Analisa todas as hunts para o pokémon em campo. */
  OC.analisar = function (pkBruto, ctx, opcoes = {}) {
    const op = { pocao: 'auto', bola: 'auto', vender: true, bike: 0, hpMinimo: 0.35, ordem: 'xp', ...opcoes };
    const P = montarPokemon(pkBruto, ctx);
    const ef = criarEf(ctx);
    op.mult = bonusXp(ctx.eu, ctx);
    const agora = Number(ctx.eu?.servidorAgora) || Date.now();
    const boostCap = agora < (Number(ctx.eu?.loja?.boosts?.captura) || 0) ? ((ctx.welcome?.tiposBoost ?? []).find((b) => b.chave === 'captura')?.mult ?? 2) : 1;
    const kickCap = agora < (Number(ctx.eu?.kick?.bonus?.captura) || 0) ? 1 + (Number(ctx.eu?.kick?.pct) || 15) / 100 : 1;
    op.multCaptura = boostCap * kickCap;
    const boostLoot = agora < (Number(ctx.eu?.loja?.boosts?.loot) || 0) ? ((ctx.welcome?.tiposBoost ?? []).find((b) => b.chave === 'loot')?.mult ?? 1.4) : 1;
    op.multLoot = boostLoot * (1 + (Number(ctx.eu?.guildBonusPct) || 0) / 100);
    op.calib = OC.sessao?.calibracao?.() ?? {};
    const tiers = OC.tiersOutland(ctx);
    op.degrauOutland = tiers.atual.mult;
    const raros = OC.raros(ctx);
    if (op.tipoDiaManualAte && Date.now() > op.tipoDiaManualAte) op.tipoDiaManual = 'auto'; // o dia virou às 18:00
    op.tipoDia = (op.tipoDiaManual && op.tipoDiaManual !== 'auto') ? (op.tipoDiaManual === 'nenhum' ? null : op.tipoDiaManual) : (OC.tipoDoDia?.(ctx) ?? null);
    const t0 = performance.now();
    const linhas = [];
    for (const h of ctx.hunts ?? []) { const r = simular(h, P, ef, ctx, op); if (r) linhas.push(r); }
    const liq = 0.85; // a venda no Mercado em Coins paga 85% (15% de comissão)
    for (const r of linhas) {
      r.outland = (r.h?.area ?? r.h?.regiao) === 'outland';
      if (!r.outland || r.inviavel) continue;
      const m = r.kph * (op.multLoot || 1) * tiers.melhor.mult;
      r.tierAlvo = tiers.melhor.tier;
      r.raros = { token: m * raros.token, chave: m * raros.chave, shiny: m * raros.shiny, bike: m * raros.bike };
      r.rarosValorH = liq * (r.raros.token * (Number(op.precoToken) || 0) + r.raros.chave * (Number(op.precoFragChave) || 0)
        + r.raros.shiny * (Number(op.precoFragShiny) || 0) + r.raros.bike * (Number(op.precoFragBike) || 0));
      r.valorOutH = r.liq + r.rarosValorH;
    }
    const chave = op.ordem === 'ouro' ? 'liq' : op.ordem === 'abates' ? 'kph' : op.ordem === 'outland' ? 'valorOutH' : 'xpPkH';
    linhas.sort((a, b) => (a.inviavel - b.inviavel) || ((b[chave] ?? 0) - (a[chave] ?? 0)));
    // melhor: a primeira da ordem escolhida entre as liberadas, seguras e com lucro.
    // Se outra rende quase o mesmo XP (até 5% a menos) e bem mais ouro, ela vira a alternativa.
    const boas = linhas.filter((r) => !r.inviavel && r.liberada && !perigosa(r) && (op.ordem === 'outland' ? r.outland : r.liq >= 0));
    const melhor = boas[0] ?? null;
    let alternativa = null;
    if (melhor && op.ordem === 'xp') {
      alternativa = boas.slice(1).filter((r) => r.xpPkH >= melhor.xpPkH * 0.95 && r.liq >= melhor.liq * 1.3 + 100000)
        .sort((a, b) => b.liq - a.liq)[0] ?? null;
    }
    const empate = [];
    return { P, linhas, melhor, empate, alternativa, bonus: op.mult, ms: Math.round(performance.now() - t0), op, tiers, raros };
  };

  OC._interno = { danoBase, segundosPorAbate, abatesPorHora, chanceCaptura, bonusXp, montarPokemon, criarEf };
})(globalThis);
