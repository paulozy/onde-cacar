// Onde Caçar — 8/8: diagnóstico. Junta o que a extensão lê do jogo e o que ela calcula, para
// conferir as contas. Tira nick, e-mail, carteira e afins antes de copiar. Nada é enviado.
(function (root) {
  'use strict';
  const OC = (root.__ondeCacar ??= {});

  const OCULTAR = /^(nick|nome_?treinador|caughtBy|capturadoPor|vendedor|vendedorId|comprador|compradorId|email|e-?mail|senha|password|token|auth|cpf|carteira|wallet|endereco|address|ip|telefone|phone|referral|codigo|code|chave_?pix)$/i;
  /** Cópia segura: tira dados pessoais, corta listas e textos longos, limita a profundidade. */
  function limpar(v, prof = 0) {
    if (v == null || typeof v === 'number' || typeof v === 'boolean') return v;
    if (typeof v === 'string') return v.length > 300 ? `${v.slice(0, 300)}…` : v;
    if (typeof v === 'function') return '[função]';
    if (prof > 6) return '[…]';
    if (Array.isArray(v)) {
      const a = v.slice(0, 30).map((x) => limpar(x, prof + 1));
      if (v.length > 30) a.push(`[+${v.length - 30} itens]`);
      return a;
    }
    if (typeof v === 'object') {
      const o = {};
      for (const [k, x] of Object.entries(v)) o[k] = OCULTAR.test(k) ? '[oculto]' : limpar(x, prof + 1);
      return o;
    }
    return String(v);
  }
  const resumoLinha = (l) => l && {
    slug: l.slug, nome: l.nome, nivel: l.nivel, regiao: l.regiao, liberada: l.liberada, inviavel: l.inviavel,
    ttk_s: +l.ttk?.toFixed(2), abates_h: Math.round(l.kph), xp_por_abate: Math.round(l.xpKill),
    xp_pk_h: Math.round(l.xpPkH), xp_tr_h: Math.round(l.xpTrH), ouro_h: Math.round(l.ouroH), liquido_h: Math.round(l.liq),
    calibrada: l.calibrada, abates_h_modelo: Math.round(l.kphModelo ?? l.kph), pior_golpe_pct_hp: +(l.hitPct * 100).toFixed(1), efetividade: +l.ef?.toFixed(2), melhor_golpe: l.melhorGolpe,
    pocao: l.pocao && { nome: l.pocao.nome, cura_em: l.pocao.thr, por_h: Math.round(l.pocao.porH) },
    bola: l.bola && { nome: l.bola.nome, chance: l.bola.ch, capturas_h: +l.bola.capH?.toFixed(1) },
  };

  async function coletar() {
    const I = OC.ui?.interno?.() ?? {};
    let { welcome, eu, jogo, analise } = I;
    try { jogo ??= await OC.carregarJogo(); } catch (e) { jogo = { erro: String(e?.message ?? e) }; }
    try { analise = (await OC.ui?.analiseFresca?.()) ?? analise; } catch { /* segue */ }
    const L = eu?.level ?? null;
    const pk = eu?.pokemons?.find((p) => p.id === eu.activeId) ?? null;
    const esp = pk && jogo?.especies?.get?.(pk.speciesId);
    const hunts = welcome?.hunts ?? [];
    const huntAtual = hunts.find((h) => h.slug === eu?.huntSlug) ?? null;
    const perto = hunts.filter((h) => L && h.nivel <= L && h.nivel >= L * 0.6).slice(-12);
    const atual = analise?.linhas?.find((l) => l.slug === eu?.huntSlug);

    // a curva da Wiki contra o que o jogo mostra
    const curva = L && OC.xpTotal ? { xpTotal_L: OC.xpTotal(L), xpTotal_L1: OC.xpTotal(L + 1), xp_do_jogo: eu?.xp ?? null, xp_que_a_extensao_usa: I.xpDoTreinador } : null;
    // XP e ouro por abate: o módulo do jogo contra a regra de reserva
    let recompensa = null;
    if (huntAtual && jogo?.mod) {
      const e0 = jogo.especies?.get?.(huntAtual.especies?.[0]?.pokeId);
      const tenta = (f) => { try { return f(); } catch (e) { return `erro: ${e?.message ?? e}`; } };
      recompensa = {
        nivel: huntAtual.nivel,
        xp_modulo: tenta(() => jogo.mod.recompensa?.xpPorDerrota?.(huntAtual, huntAtual.nivel, e0) ?? 'sem módulo'),
        xp_reserva: huntAtual.nivel ** 2 + 12,
        ouro_modulo: tenta(() => jogo.mod.recompensa?.ouroPorDerrotaHunt?.(huntAtual, huntAtual.nivel, e0) ?? 'sem módulo'),
      };
    }
    const s = OC.sessao?.atual?.();
    const nick = String(eu?.nick ?? '').trim().toLowerCase();
    let sessaoJogo = null;
    try { sessaoJogo = nick ? JSON.parse(localStorage.getItem(`sessao-hunt:${nick}`)) : null; } catch { /* sem */ }

    return limpar({
      gerado_em: new Date().toISOString(),
      extensao: '2.4.0',
      jogo_versao: jogo?.versao ?? null,
      navegador: navigator.userAgent,
      modulos: jogo?.mod ? Object.fromEntries(Object.entries(jogo.mod).map(([k, m]) => [k, Object.keys(m ?? {}).length ? Object.keys(m).slice(0, 12) : 'NÃO CARREGOU'])) : jogo,
      especies_no_catalogo: jogo?.especies?.size ?? null,
      welcome: welcome && {
        chaves: Object.keys(welcome),
        n_hunts: hunts.length,
        regioes: [...new Set(hunts.map((h) => h.regiao ?? h.area))],
        ampliacaoHunt: welcome.ampliacaoHunt, multHpSelvagem: welcome.multHpSelvagem, multDanoSelvagem: welcome.multDanoSelvagem,
        tiposBoost: welcome.tiposBoost, captura: welcome.captura, catalogoBolas: welcome.catalogoBolas,
        itensCompraveis: welcome.itensCompraveis, hunts_perto_do_seu_nivel: perto,
      },
      estado: eu && {
        chaves: Object.keys(eu),
        level: eu.level, xp: eu.xp, xpProximo: eu.xpProximo, gold: eu.gold, huntSlug: eu.huntSlug, noCentro: eu.noCentro,
        loja: eu.loja, guildBonusPct: eu.guildBonusPct, evento: eu.evento, twitch: eu.twitch, kick: eu.kick,
        n_pokemons_na_equipe: eu.pokemons?.length, balls: eu.balls, n_itens: eu.items ? Object.keys(eu.items).length : null,
        outros_numeros: Object.fromEntries(Object.entries(eu).filter(([, v]) => typeof v === 'number')),
      },
      pokemon_ativo: pk,
      dia_sazonal: { do_jogo: OC.tipoDoDia?.({ welcome, eu }) ?? null, mensagem_do_jogo: OC.ultimoSazonal ?? null, proxima_virada: OC.proximaViradaSazonal ? new Date(OC.proximaViradaSazonal()).toISOString() : null, ajuste: OC.ui?.prefs?.tipoDiaManual ?? 'auto',
        chaves_welcome_parecidas: Object.keys(welcome ?? {}).filter((k) => /sazon|dia|tipo/i.test(k)) },
      saida_forcada: { modo: OC.ui?.prefs?.autoForcar ?? 'nao', rope: (() => { try { return JSON.parse(OC.ui?.prefs?.saida_rope)?.t ?? null; } catch { return null; } })(),
        desistir: (() => { try { return JSON.parse(OC.ui?.prefs?.saida_desistir)?.t ?? null; } catch { return null; } })() },
      mercado: OC.mercado ? { status: OC.mercado.status(), alvos: (OC.ui?.prefs?.mercadoAlvos ?? []).map((a) => ({ tipo: a.tipo, nome: a.nome, teto: a.teto, moeda: a.moeda, modo: a.modo, ativo: a.ativo, comprados: a.comprados })), registro: OC.mercado.registro().slice(0, 15), depois_da_compra: OC.mercado.posCompra() } : null,
      troca: { relogio_servidor_ms: OC.offsetServidor ?? null, troca_livre_em: OC.trocaLivreEm ?? null, livre_agora: OC.livreParaTrocar?.() ?? null,
        sabe_trocar_pokemon: OC.ui?.prefs?.ativar ? { t: OC.ui.prefs.ativar.t, campo: OC.ui.prefs.ativar.caminho } : null, simulando: OC.ui?.prefs?.pkUpar ?? null },
      outland: { tier_atual: eu?.outlandTier ?? null, tiers_do_jogo: welcome?.outlandTiers ?? null, chance_token_do_jogo: welcome?.chanceBossToken ?? null, raros_usados: analise?.raros ?? null },
      catalogo_campos: (() => {
        // para conferir de onde sai o estágio de evolução (chance de captura e nível ao capturar)
        const amostra = [1, 2, 3, 129, 130].map((id) => jogo?.especies?.get?.(id)).filter(Boolean);
        return amostra.map((e) => ({ pokeId: e.pokeId, name: e.name, chaves: Object.keys(e), teto_calculado: OC.tetoDe?.(e, { especies: jogo.especies }) ?? null,
          evolucao: Object.fromEntries(Object.entries(e).filter(([k]) => /evol|prevo|teto|captur|catch|cap/i.test(k))) }));
      })(),
      especie_ativa: esp && { pokeId: esp.pokeId, name: esp.name, tipos: [esp.type1, esp.type2], base: [esp.baseHp, esp.baseAtk, esp.baseDef, esp.baseSpAtk, esp.baseSpDef, esp.baseSpeed], golpes: esp.attacks },
      calculos: {
        curva_de_xp: curva,
        ritmo_do_treinador: I.ritmo,
        bonus_de_xp: analise?.bonus,
        pokemon_montado: analise?.P && { nivel: analise.P.nivel, hp_combate: analise.P.hp, gap_s: analise.P.gapS, investida_s: analise.P.cdInvS, golpes: analise.P.golpes?.map((g) => ({ nome: g.name, tipo: g.type, cat: g.category, poder: g.power, recarga_s: +g.cdS?.toFixed(2) })) },
        recompensa_hunt_atual: recompensa,
        hunt_atual: resumoLinha(atual),
        melhor: resumoLinha(analise?.melhor),
        top5: analise?.linhas?.filter((l) => !l.inviavel).slice(0, 5).map(resumoLinha),
      },
      hunt_atual_no_jogo: huntAtual,
      sessao_extensao: s,
      calibracao: OC.sessao?.calibracao?.(),
      captura: analise?.op && { mult_captura: analise.op.multCaptura },
      sessao_do_jogo: sessaoJogo,
      ajustes: OC.ui?.prefs,
    });
  }

  OC.debug = {
    coletar,
    async copiar() {
      const txt = JSON.stringify(await coletar(), null, 1);
      console.log('[onde-cacar] diagnóstico', txt);
      await navigator.clipboard.writeText(txt);
      return { tamanho: txt.length };
    },
    async baixar() {
      const txt = JSON.stringify(await coletar(), null, 1);
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([txt], { type: 'application/json' }));
      a.download = `onde-cacar-diagnostico-${new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-')}.json`;
      document.body.append(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    },
  };
})(globalThis);
