// Onde Caçar — 1/5: escuta o WebSocket do jogo.
//
// Roda no contexto da página antes do jogo abrir o socket. Só ACRESCENTA um ouvinte de
// mensagem; o único envio possível é o OC.enviar, usado pela automação quando você a liga. O que chega vira eventos no barramento
// `OC.on(tipo, fn)`, que o resto da extensão assina.
(function (root) {
  'use strict';
  const OC = (root.__ondeCacar ??= {});
  if (OC.hookPronto) return;
  OC.hookPronto = true;

  // ---- barramento ----------------------------------------------------------------------
  const ouvintes = new Map();
  const ultimo = new Map();
  const GUARDADOS = new Set(['welcome', 'estado', 'campo.init']);
  OC.on = (tipo, fn) => {
    if (!ouvintes.has(tipo)) ouvintes.set(tipo, new Set());
    ouvintes.get(tipo).add(fn);
    if (ultimo.has(tipo)) { try { fn(ultimo.get(tipo)); } catch (e) { console.error('[onde-cacar]', e); } }
    return () => ouvintes.get(tipo)?.delete(fn);
  };
  OC.emit = (tipo, dado) => {
    if (GUARDADOS.has(tipo)) ultimo.set(tipo, dado);
    for (const fn of ouvintes.get(tipo) ?? []) {
      try { fn(dado); } catch (e) { console.error('[onde-cacar]', e); }
    }
  };
  OC.ultimo = (tipo) => ultimo.get(tipo);

  // ---- o estado chega em pedaços -------------------------------------------------------
  // O jogo manda o quadro inteiro no welcome e depois só o que mudou. Para remontar usamos o
  // próprio módulo do jogo; se ele não carregar, uma mescla simples serve de reserva.
  let mesclar = null;
  let localReserva = null;
  const fila = [];
  const reserva = (p) => {
    if (p.cheio || !localReserva) localReserva = { ...p };
    else for (const [k, v] of Object.entries(p)) {
      localReserva[k] = (v && typeof v === 'object' && !Array.isArray(v) && localReserva[k] && typeof localReserva[k] === 'object')
        ? { ...localReserva[k], ...v } : v;
    }
    return localReserva;
  };
  const pronto = (fn) => { mesclar = fn; for (const p of fila.splice(0)) entregar(p); };
  import('https://pokeidle.io/shared/estado-delta.mjs')
    .then((m) => pronto(m.criarMescladorDeEstado?.() ?? reserva))
    .catch(() => pronto(reserva));

  function entregar(parcial) {
    if (!mesclar) { if (fila.length < 200) fila.push(parcial); return; }
    const eu = mesclar(parcial);
    if (eu) OC.emit('estado', eu);
  }

  const relogio = [];
  OC.agoraServidor = () => Date.now() + (OC.offsetServidor || 0);
  function aoReceber(ev) {
    if (typeof ev.data !== 'string') return;
    const cab = ev.data.slice(0, 48);
    let tipo = null;
    if (cab.includes('"t":"welcome"')) tipo = 'welcome';
    else if (cab.includes('"t":"estado"')) tipo = 'estado';
    else if (cab.includes('"t":"campo.init"')) tipo = 'campo.init';
    else if (cab.includes('"t":"campo"')) {
      tipo = 'campo';
      // relógio do servidor: o "ts" do campo chega um pouco depois de ser carimbado, então a
      // maior diferença recente é a melhor estimativa de quanto o servidor está à frente
      const ts = ev.data.slice(0, 120).match(/"ts"\s*:\s*(\d{13})/);
      if (ts) {
        const d = Number(ts[1]) - Date.now();
        relogio.push(d); if (relogio.length > 40) relogio.shift();
        OC.offsetServidor = Math.max(...relogio);
      }
    }
    else if (cab.includes('"t":"erro"')) tipo = 'erro';
    else if (cab.includes('"t":"market"')) tipo = 'market';
    else if (/"t":"[^"]*(sazon|clima|tipo_?do_?dia)/i.test(cab)) tipo = 'sazonal';
    else if (cab.includes('"t":"batalha"')) {
      OC.ultimoCombate = Date.now();
      // o próprio jogo avisa quando a troca de área fica livre
      const tl = ev.data.match(/"trocaLivreEm"\s*:\s*(\d+)/);
      if (tl) OC.trocaLivreEm = Number(tl[1]);
      // só abre o pacote quando ele traz o que interessa: captura, boss ou drop raro
      const d = ev.data;
      if (!(d.includes('"capturado"') || d.includes('"bossMorto"') || (d.includes('"drops"') && /Fragment|Token|Ticket|Piece|Fragmento/i.test(d)))) return;
      tipo = 'batalha';
    }
    if (!tipo) return;
    let m;
    try { m = JSON.parse(ev.data); } catch { return; }
    if (tipo === 'welcome') {
      OC.emit('welcome', m);
      if (m.estado) entregar({ ...m.estado, cheio: true });
    } else if (tipo === 'estado') {
      if (m.estado) entregar(m.estado);
    } else if (tipo === 'batalha') {
      for (const e of Array.isArray(m.ev) ? m.ev : []) OC.emit('batalha.ev', e);
    } else {
      if (/sazon|tipo_?do_?dia|clima/i.test(tipo)) OC.ultimoSazonal = { ...m, recebidoEm: Date.now() };
      OC.emit(tipo, m);
    }
  }
  OC._aoReceber = aoReceber; // para testes

  // Envio: só a automação (06-auto.js) usa, só quando você liga, e só com as mesmas mensagens
  // que os botões do próprio jogo mandam (comprar na loja do NPC e escolher hunt).
  OC.enviar = (obj) => {
    const ws = OC.socket;
    if (!ws || ws.readyState !== 1) return false;
    ws.send(JSON.stringify(obj));
    return true;
  };

  // ---- o que sai (só observado, para a automação aprender a mensagem de um botão) -----
  const enviarOriginal = root.WebSocket?.prototype?.send;
  if (enviarOriginal) {
    root.WebSocket.prototype.send = function (dado) {
      try { if (typeof dado === 'string' && dado.length < 2000) OC.emit('enviado', dado); } catch { /* segue */ }
      return enviarOriginal.apply(this, arguments);
    };
  }

  // ---- o socket ------------------------------------------------------------------------
  const Original = root.WebSocket;
  if (!Original) return;
  function SocketObservado(...args) {
    const ws = new Original(...args);
    try {
      const alvo = new URL(String(args[0]), location.href);
      if (alvo.hostname === location.hostname || alvo.hostname.endsWith('pokeidle.io')) {
        ws.addEventListener('message', aoReceber);
        OC.socket = ws;
      }
    } catch { /* não é o socket do jogo */ }
    return ws;
  }
  SocketObservado.prototype = Original.prototype;
  for (const k of ['CONNECTING', 'OPEN', 'CLOSING', 'CLOSED']) SocketObservado[k] = Original[k];
  root.WebSocket = SocketObservado;
})(globalThis);
