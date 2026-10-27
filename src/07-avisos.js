// Onde Caçar — 7/7: avisos. Notificação do navegador (e um bip, se você quiser) quando algo
// importa: captura boa, drop raro, hunt nova melhor, estoque acabando, equipe caída e automação
// parada. Cada aviso liga e desliga em Ajustes; nada sai do seu computador.
(function (root) {
  'use strict';
  const OC = (root.__ondeCacar ??= {});
  if (!OC.on) return;

  const historico = [];
  const ultimoPor = new Map();
  let eu = null, nivelVisto = null, estavaNaHunt = false, melhorVisto = null;
  const prefs = () => OC.ui?.prefs ?? {};

  let audio = null;
  function bip() {
    try {
      audio ??= new (root.AudioContext || root.webkitAudioContext)();
      const o = audio.createOscillator(), g = audio.createGain();
      o.frequency.value = 880; g.gain.value = 0.08;
      o.connect(g); g.connect(audio.destination);
      o.start(); o.stop(audio.currentTime + 0.18);
    } catch { /* sem som */ }
  }

  /** Dispara um aviso; o mesmo assunto não repete antes do intervalo. */
  function avisar(chave, titulo, texto, intervaloMs = 0) {
    const p = prefs();
    if (p[`aviso_${chave}`] === false) return;
    const agora = Date.now();
    if (intervaloMs && agora - (ultimoPor.get(chave) ?? 0) < intervaloMs) return;
    ultimoPor.set(chave, agora);
    historico.unshift({ t: agora, titulo, texto });
    historico.length = Math.min(historico.length, 30);
    if (p.avisoSom) bip();
    try {
      if (root.Notification?.permission === 'granted') new Notification(`PokeIdle — ${titulo}`, { body: texto, tag: `oc-${chave}`, icon: '/favicon.ico' });
    } catch { /* o navegador recusou */ }
    OC.emit('aviso', null);
  }

  OC.avisos = {
    avisar,
    historico: () => historico,
    permissao: () => root.Notification?.permission ?? 'indisponível',
    pedir: async () => { try { return await root.Notification?.requestPermission(); } catch { return 'denied'; } },
    testar: () => avisar('teste', 'Teste', 'Os avisos do Onde Caçar estão funcionando.'),
  };

  // ---- captura boa e drop raro ---------------------------------------------------------
  OC.on('batalha.ev', (e) => {
    if (e?.k === 'capturado' && e.pokemon) {
      const pk = e.pokemon, p = prefs();
      const pot = Number(pk.potencia) || 1;
      const q = Number(pk.quality ?? pk.qualidade) || 0;
      const ivs = pk.ivs ? Object.values(pk.ivs).reduce((s, v) => s + (Number(v) || 0), 0) : 0;
      const motivos = [];
      if (pk.shiny) motivos.push('SHINY');
      if (pot >= (Number(p.avisoPotMin) || 3)) motivos.push(`P${pot}`);
      if (q >= (Number(p.avisoQualMin) || 1.5)) motivos.push(`qualidade ${q.toFixed(3).replace('.', ',')}`);
      if (ivs >= (Number(p.avisoIvMin) || 150)) motivos.push(`IV ${ivs}`);
      if (motivos.length) avisar('captura', `${pk.shiny ? '✨ ' : ''}Captura boa: ${pk.nome ?? 'pokémon'}`, `${motivos.join(', ')} · Nv ${pk.level ?? '?'}${e.paraDepot ? ' (foi para o Depot)' : ''}`);
    }
    if (e?.k === 'bossMorto') avisar('boss', 'Boss derrotado', e.nome ? String(e.nome) : 'vitória no boss');
    for (const d of Array.isArray(e?.drops) ? e.drops : []) {
      const nome = String(d?.nome ?? '');
      if (/Fragment|Token|Ticket|Piece|Fragmento/i.test(nome)) avisar('drop', 'Drop raro', `${nome} ×${Number(d.qtd) || 1}`);
    }
  });

  // ---- equipe caída e hunt nova ---------------------------------------------------------
  OC.on('estado', (e) => {
    eu = e;
    const naHunt = !!e.huntSlug && !e.noCentro;
    if (estavaNaHunt && e.noCentro) avisar('equipe', 'A equipe inteira caiu', 'Você está no Centro Pokémon. Sem o Boost dos Atrasados, isso custa 10% do XP do nível.', 60000);
    estavaNaHunt = naHunt;
    if (nivelVisto != null && e.level > nivelVisto) setTimeout(checarHuntNova, 3000);
    nivelVisto = e.level;
  });

  async function checarHuntNova() {
    const a = await OC.ui?.analiseFresca?.();
    if (!a?.melhor || !eu) return;
    const aqui = a.linhas.find((l) => l.slug === eu.huntSlug && !l.inviavel);
    if (a.melhor.slug === melhorVisto) return;
    melhorVisto = a.melhor.slug;
    if (aqui && a.melhor.slug !== aqui.slug && a.melhor.xpPkH >= aqui.xpPkH * 1.1) {
      avisar('hunt', `Hunt melhor liberada: ${a.melhor.nome}`, `Rende ${Math.round((a.melhor.xpPkH / aqui.xpPkH - 1) * 100)}% mais XP que ${aqui.nome}.`);
    }
  }

  // ---- estoque acabando (a cada 2 min; aviso no máximo 1 vez por hora) ------------------
  setInterval(async () => {
    const p = prefs();
    if (!eu?.huntSlug || eu.noCentro || p.autoRepor) return; // com a reposição ligada, ela cuida
    const a = await OC.ui?.analiseFresca?.();
    const aqui = a?.linhas.find((l) => l.slug === eu.huntSlug && !l.inviavel);
    if (!aqui || !OC.mochila) return;
    const baixo = OC.mochila(aqui, 0.5).filter((i) => i.falta > 0 && !i.premium);
    if (baixo.length) avisar('estoque', 'Estoque acabando', `${baixo.map((i) => `${i.nome}: ${i.tem ?? 0}`).join(', ')} — dura menos de 30 min.`, 3600000);
  }, 120000);

  // ---- automação parada -------------------------------------------------------------------------
  OC.on('auto', () => {
    const l = OC.auto?.log?.()[0];
    if (l && l.tipo === 'erro' && Date.now() - l.t < 5000) avisar('auto', 'A automação parou', l.txt, 300000);
  });
})(globalThis);
