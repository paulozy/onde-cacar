// Onde Caçar — 6/6: automação. DESLIGADA por padrão; cada parte liga separada em Ajustes.
//
// Faz só o que os botões do jogo fazem: comprar poção e pokébola na loja do NPC e escolher a
// hunt no Mapa. Os Termos do PokeIdle permitem automação (Wiki → Automações → "Automação de
// fora do jogo"); mesmo assim ela anda devagar, uma ação a cada poucos segundos, respeita a
// trava de combate da troca de área e nunca gasta abaixo da reserva de ouro que você definir.
(function (root) {
  'use strict';
  const OC = (root.__ondeCacar ??= {});
  if (!OC.on || !OC.enviar) return;

  const ESPACO_MS = 2500;       // entre duas ações nossas
  const RESPOSTA_MS = 8000;     // quanto esperar o estoque mudar depois de uma compra
  const MAX_POR_COMPRA = 9999;  // teto do Market por compra
  const log = [];
  let eu = null, welcome = null, ultimaAcao = 0, ocupado = false, ultimaHunt = null;
  let campoInitEm = 0, gastos = [], status = 'parada';

  const registrar = (txt, tipo = 'info') => {
    log.unshift({ t: Date.now(), txt, tipo });
    log.length = Math.min(log.length, 30);
    status = txt;
    OC.emit('auto', null);
  };
  const dormir = (ms) => new Promise((r) => setTimeout(r, ms));
  const prefs = () => OC.ui?.prefs ?? {};

  OC.on('welcome', (m) => { welcome = m; });
  OC.on('estado', (e) => { eu = e; });
  OC.on('campo.init', () => { campoInitEm = Date.now(); });
  OC.on('erro', (m) => { if (ocupado) registrar(`o jogo recusou: ${m?.msg ?? m?.chave ?? 'erro'}`, 'erro'); });

  // ---- preços que o servidor cobra ------------------------------------------------------
  function precoItem(id) {
    const s = (welcome?.itensCompraveis ?? []).find((x) => Number(x.itemId) === Number(id));
    return Number(s?.preco) || (OC.POCOES.find((p) => p.id === Number(id))?.preco ?? (Number(id) === OC.REVIVE.id ? OC.REVIVE.preco : 0));
  }
  function precoBola(id) {
    const b = (welcome?.catalogoBolas ?? []).find((x) => Number(x.id) === Number(id));
    if (b) return b.compravel === false ? 0 : Number(b.priceGold) || 0;
    return OC.BOLAS.find((x) => x.id === Number(id) && !x.premium)?.preco ?? 0;
  }

  // ---- onde eu estou -----------------------------------------------------------------------
  const emArena = () => !eu || eu.casa?.dentro || eu.boss?.arena || eu.mistico || eu.safari;
  function livreParaTrocar() {
    if (emArena()) return { ok: false, motivo: 'fora de hunt (arena, casa ou boss)' };
    if (Date.now() - campoInitEm < 11000) return { ok: false, motivo: 'esperando os 10 s da última troca' };
    if (!eu.huntSlug || eu.noCentro) return { ok: true };
    const btn = document.getElementById('ir-centro');
    if (!document.hidden && btn && btn.disabled) return { ok: false, motivo: 'em combate' };
    if (Date.now() < (Number(OC.trocaLivreEm) || 0) || Date.now() < (Number(eu.centroLivreEm) || 0) || Date.now() - (OC.ultimoCombate || 0) < 3500) return { ok: false, motivo: 'em combate' };
    return { ok: true };
  }

  // ---- compras -------------------------------------------------------------------------------
  const gastoHora = () => { const a = Date.now(); gastos = gastos.filter((g) => a - g.t < 3.6e6); return gastos.reduce((s, g) => s + g.v, 0); };

  /** Uma compra: manda, espera o estoque subir, devolve se deu certo. */
  async function comprar(tipo, id, qtd, nome) {
    const preco = tipo === 'bola' ? precoBola(id) : precoItem(id);
    if (!preco) { registrar(`${nome} não se compra com ouro`, 'erro'); return false; }
    const p = prefs();
    let resto = qtd;
    while (resto > 0) {
      const lote = Math.min(resto, MAX_POR_COMPRA);
      const custo = lote * preco;
      const reserva = Number(p.autoReserva) || 0;
      if ((Number(eu?.gold) || 0) - custo < reserva) { registrar(`parei: comprar ${lote} ${nome} deixaria o ouro abaixo da reserva`, 'erro'); return false; }
      if (p.autoTetoHora > 0 && gastoHora() + custo > p.autoTetoHora) { registrar(`parei: passaria do gasto máximo por hora`, 'erro'); return false; }
      const espera = ultimaAcao + ESPACO_MS - Date.now();
      if (espera > 0) await dormir(espera);
      const antes = OC.estoque(eu, tipo, id) ?? 0;
      if (!OC.enviar({ t: 'shop.buy', kind: tipo === 'bola' ? 'ball' : 'item', id: Number(id), qty: lote })) { registrar('sem conexão com o jogo', 'erro'); return false; }
      ultimaAcao = Date.now();
      const ate = Date.now() + RESPOSTA_MS;
      while (Date.now() < ate && (OC.estoque(eu, tipo, id) ?? 0) < antes + lote) await dormir(300);
      if ((OC.estoque(eu, tipo, id) ?? 0) < antes + lote) { registrar(`o jogo não confirmou a compra de ${lote} ${nome}`, 'erro'); return false; }
      gastos.push({ t: Date.now(), v: custo });
      registrar(`comprei ${lote.toLocaleString('pt-BR')} ${nome} por ${custo.toLocaleString('pt-BR')} de ouro`);
      resto -= lote;
    }
    return true;
  }

  /** Compra tudo o que falta para a lista da mochila. */
  async function reabastecer(lista) {
    for (const i of lista) {
      if (!(i.falta > 0) || i.premium) continue;
      if (!(await comprar(i.tipo, i.id, i.falta, i.nome))) return false;
    }
    return true;
  }

  // ---- saída forçada: Escape Rope ou Desistir do combate, gravados de um clique seu ----------
  // A extensão não conhece essas mensagens: você aperta o botão do jogo uma vez com o gravador
  // ligado e ela guarda exatamente o que o jogo mandou.
  let gravando = null;
  const ALVO_SAIDA = /desist|escape|corda|rope|fugir|abandonar/i;
  document.addEventListener('click', (ev) => {
    if (!gravando || !ev.isTrusted) return;
    const b = ev.target.closest?.('button, [role="button"], a') || ev.target;
    const txt = `${b.textContent ?? ''} ${b.getAttribute?.('title') ?? ''} ${b.getAttribute?.('aria-label') ?? ''}`;
    if (!ALVO_SAIDA.test(txt)) return;
    gravando.clicouEm = Date.now();
  }, true);
  OC.on('enviado', (raw) => {
    if (!gravando?.clicouEm || Date.now() - gravando.clicouEm > 1500) return;
    let t = null; try { t = JSON.parse(raw)?.t; } catch { return; }
    if (!t || /^(ping|pong|campo|mov|andar|hunt\.select|shop\.)/i.test(t)) return;
    const p = prefs(); p[`saida_${gravando.tipo}`] = raw; OC.ui?.salvarPrefs?.();
    registrar(`gravei a saída por ${gravando.tipo === 'rope' ? 'Escape Rope' : 'desistência'} (${t})`);
    gravando = null;
  });

  async function forcarSaida() {
    const p = prefs(), modo = p.autoForcar;
    const raw = modo === 'rope' ? p.saida_rope : modo === 'desistir' ? p.saida_desistir : null;
    if (!raw) return false;
    registrar(modo === 'rope' ? 'usando uma Escape Rope para sair do combate' : 'desistindo do combate (custa 10% do XP do nível, se não houver Atrasados)');
    try { OC.socket?.send(raw); } catch { return false; }
    ultimaAcao = Date.now();
    const fim = Date.now() + 10000;
    while (Date.now() < fim && !(eu?.noCentro || !eu?.huntSlug)) await dormir(300);
    return !!(eu?.noCentro || !eu?.huntSlug);
  }

  /** Vai para a hunt assim que estiver fora de combate; se não liberar, força a saída (se você permitiu). */
  async function irPara(slug, nome) {
    if (eu?.huntSlug === slug && !eu?.noCentro) return true;
    const p = prefs();
    const limiteForcar = Date.now() + Math.max(0.5, Number(p.autoForcarApos) || 2) * 60000;
    const ate = Date.now() + 8 * 60000;
    let avisou = false, forcou = false;
    while (Date.now() < ate) {
      const livre = livreParaTrocar();
      if (livre.ok) {
        const espera = ultimaAcao + ESPACO_MS - Date.now();
        if (espera > 0) await dormir(espera);
        OC.enviar({ t: 'hunt.select', slug });
        ultimaAcao = Date.now();
        const fim = Date.now() + 6000;
        while (Date.now() < fim && eu?.huntSlug !== slug) await dormir(300);
        if (eu?.huntSlug === slug) { registrar(`agora caçando em ${nome}`); ultimaHunt = Date.now(); return true; }
      } else {
        if (!avisou) { registrar(`esperando para ir a ${nome}: ${livre.motivo}`); avisou = true; }
        if (!forcou && livre.motivo === 'em combate' && p.autoForcar && p.autoForcar !== 'nao' && Date.now() > limiteForcar) {
          forcou = true;
          if (!(await forcarSaida())) registrar('a saída forçada não funcionou: grave o botão de novo em Ajustes', 'erro');
        }
      }
      await dormir(1500);
    }
    registrar(`não consegui ir para ${nome}`, 'erro');
    return false;
  }

  /** O botão “Preparar e caçar”: compra o que falta e entra na hunt. Você confirma antes. */
  OC.auto = {
    log: () => log,
    status: () => status,
    ocupado: () => ocupado,
    precoItem, precoBola, irPara,
    gravarSaida: (tipo) => { gravando = { tipo }; registrar(`gravando: clique agora no botão ${tipo === 'rope' ? 'da Escape Rope' : 'Desistir do combate'} do jogo`); },
    cancelarGravacao: () => { gravando = null; },
    gravando: () => gravando?.tipo ?? null,
    async preparar(r, lista) {
      if (ocupado) return;
      ocupado = true;
      try {
        registrar(`preparando ${r.nome}`);
        if (!(await reabastecer(lista))) return;
        await irPara(r.slug, r.nome);
      } finally { ocupado = false; OC.emit('auto', null); }
    },
  };

  // ---- o modo automático (cada parte só roda se você ligou) ---------------------------
  async function ciclo() {
    const p = prefs();
    if (ocupado || !eu || !welcome || emArena() || !(p.autoRepor || p.autoTrocar)) return;
    const a = await OC.ui?.analiseFresca?.();
    if (!a) return;
    const aqui = a.linhas.find((l) => l.slug === eu.huntSlug && !l.inviavel);
    ocupado = true;
    try {
      // trocar de hunt: só se a recomendada render 10% mais XP/h e você estiver há 15 min na atual
      if (p.autoTrocar && a.melhor && a.melhor.slug !== eu.huntSlug) {
        const ganho = aqui ? a.melhor.xpPkH / Math.max(1, aqui.xpPkH) : Infinity;
        const tempo = Date.now() - Math.max(ultimaHunt ?? 0, campoInitEm);
        if (ganho >= 1.1 && (tempo > 15 * 60000 || !eu.huntSlug || eu.noCentro)) {
          registrar(`${a.melhor.nome} rende ${Math.round((ganho - 1) * 100)}% mais XP: trocando`);
          if (p.autoRepor) await reabastecer(OC.mochila(a.melhor, Number(p.horas) || 4));
          await irPara(a.melhor.slug, a.melhor.nome);
          return;
        }
      }
      // repor: quando o estoque cobre menos que o mínimo, compra para a duração da sessão
      if (p.autoRepor && aqui) {
        const minimo = OC.mochila(aqui, Number(p.autoMinHoras) || 1).filter((i) => i.falta > 0 && !i.premium);
        if (minimo.length) {
          registrar(`estoque baixo de ${minimo.map((i) => i.nome).join(' e ')}: repondo`);
          await reabastecer(OC.mochila(aqui, Number(p.horas) || 4));
        }
      }
    } finally { ocupado = false; OC.emit('auto', null); }
  }
  setInterval(() => { ciclo().catch((e) => registrar(`erro na automação: ${e?.message ?? e}`, 'erro')); }, 30000);
})(globalThis);
