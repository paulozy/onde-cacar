// Onde Caçar — 2/5: carrega as regras e o catálogo do próprio jogo, na versão que está no ar.
//
// As fórmulas vêm dos módulos `shared/` do pokeidle.io e as espécies dos mesmos JSONs que o
// cliente oficial usa. Quando o jogo muda um golpe, uma recarga ou uma curva de XP, a extensão
// muda junto no próximo F5. Cada passo é opcional: se um módulo sumir, entra a regra de reserva.
(function (root) {
  'use strict';
  const OC = (root.__ondeCacar ??= {});

  // Endereços por extenso: a extensão só roda em https://pokeidle.io, e assim fica claro
  // para quem revisar que ela só carrega os módulos do próprio jogo, da mesma origem.
  const MODULOS = {
    cooldown: () => import('https://pokeidle.io/shared/cooldown-golpes.mjs'),
    especiais: () => import('https://pokeidle.io/shared/golpes-especiais.mjs'),
    planilhas: () => import('https://pokeidle.io/shared/golpes-planilhas.mjs'),
    outland: () => import('https://pokeidle.io/shared/outland.mjs'),
    baseOutland: () => import('https://pokeidle.io/shared/herdar-base-outland.mjs'),
    golpesOrre: () => import('https://pokeidle.io/shared/herdar-golpes-orre.mjs'),
    megas: () => import('https://pokeidle.io/shared/megas.mjs'),
    evolucoes: () => import('https://pokeidle.io/shared/evolucoes-cruzadas.mjs'),
    alias: () => import('https://pokeidle.io/shared/alias-item.mjs'),
    tm: () => import('https://pokeidle.io/shared/tm-elemental.mjs'),
    recompensa: () => import('https://pokeidle.io/shared/recompensa-hunt.mjs'),
    analyser: () => import('https://pokeidle.io/hunt-analyser.mjs'),
    ajustes: () => import('https://pokeidle.io/shared/ajustes-especie-espelho.mjs'),
  };
  const CATALOGOS = {
    cr: 'assets/creatures.json',
    novos: 'assets/creatures-novos.json',
    outlandNovos: 'assets/creatures-outland-novos.json',
    overrides: 'assets/creatures-audit-overrides.json',
    itens: 'assets/items.json',
  };

  const url = (c) => `${location.origin}/${c}`;
  const json = (c) => fetch(url(c), { cache: 'no-cache' }).then((r) => (r.ok ? r.json() : null)).catch(() => null);
  const passo = (nome, fn) => { try { fn(); } catch (e) { console.warn(`[onde-cacar] passo "${nome}" pulado:`, e?.message ?? e); } };

  async function carregarModulos() {
    const pares = await Promise.all(Object.entries(MODULOS).map(async ([k, carregar]) => {
      try { return [k, await carregar()]; } catch { return [k, {}]; }
    }));
    return Object.fromEntries(pares);
  }

  /** As espécies como o cliente monta: stats-base, tipos, golpes e loot. */
  function montarEspecies(mod, f) {
    const lista = [...(f.cr?.creatures ?? [])];
    if (f.novos?.creatures?.length) lista.push(...f.novos.creatures);
    if (f.outlandNovos?.creatures?.length) lista.push(...f.outlandNovos.creatures);
    passo('outland', () => mod.outland.aplicarRemapOutlandLista?.(lista));
    passo('overrides', () => {
      for (const o of f.overrides?.overrides ?? []) {
        const c = lista.find((x) => x.pokeId === o.pokeId);
        if (!c) continue;
        for (const k of ['baseHp', 'baseAtk', 'baseDef', 'baseSpAtk', 'baseSpDef', 'baseSpeed']) if (typeof o[k] === 'number') c[k] = o[k];
        if (Array.isArray(o.attacks)) c.attacks = o.attacks.map((a) => ({ ...a }));
      }
    });
    passo('planilhas', () => mod.planilhas.aplicarGolpesDasPlanilhas?.((id) => lista.filter((c) => c.pokeId === id)));
    passo('baseOutland', () => mod.baseOutland.herdarBaseOutland?.(lista));
    passo('cadeias', () => mod.evolucoes.aplicarCadeiasTruncadas?.(lista));
    passo('ultimates', () => mod.evolucoes.normalizarEvolveLevel600?.(lista));
    passo('ajustes', () => mod.ajustes.aplicarAjustesHuntLevel?.((id) => lista.find((c) => c.pokeId === id)));

    const especies = new Map();
    for (const c of lista) {
      if (mod.outland.isEspelhoFantasmaPokeId?.(c.pokeId)) continue;
      passo('alias', () => { for (const l of c.loot ?? []) l.name = mod.alias.resolverNomeItem?.(l.name) ?? l.name; });
      passo('especiais', () => mod.especiais.injetarGolpesEspeciais?.(c));
      especies.set(c.pokeId, c);
    }
    passo('golpesOrre', () => mod.golpesOrre.herdarGolpesOrre?.(lista));
    passo('megas', () => { for (const m of mod.megas.criarEspeciesMega?.(lista) ?? []) especies.set(m.pokeId, m); });
    return especies;
  }

  function montarItens(itens, welcome) {
    const porNome = new Map();
    const porId = new Map();
    const add = (i) => {
      if (!i) return;
      const preco = Number(i.npcPrice) || 0;
      const reg = { id: i.id, nome: i.name, preco };
      if (i.name) porNome.set(i.name, reg);
      if (i.id != null) porId.set(String(i.id), reg);
    };
    for (const i of itens?.items ?? (Array.isArray(itens) ? itens : [])) add(i);
    for (const i of welcome?.itensNossos ?? []) if (Number(i?.npcPrice) > 0 || !porId.has(String(i?.id))) add(i);
    return { porNome, porId };
  }

  let promessa = null;
  /** Carrega uma vez por página. */
  OC.carregarJogo = () => (promessa ??= (async () => {
    const t0 = performance.now();
    const [mod, cr, novos, outlandNovos, overrides, itens] = await Promise.all([
      carregarModulos(), json(CATALOGOS.cr), json(CATALOGOS.novos), json(CATALOGOS.outlandNovos),
      json(CATALOGOS.overrides), json(CATALOGOS.itens),
    ]);
    if (!cr?.creatures?.length) throw new Error('não consegui ler o catálogo de espécies do jogo');
    const especies = montarEspecies(mod, { cr, novos, outlandNovos, overrides });
    const link = document.querySelector('link[href*="estilo.css?v="]');
    return {
      mod, especies,
      itensBrutos: itens,
      versao: link?.getAttribute('href')?.split('v=')[1] ?? null,
      ms: Math.round(performance.now() - t0),
    };
  })().catch((e) => { promessa = null; throw e; }));

  OC.montarItens = montarItens;
})(globalThis);
