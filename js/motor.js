(() => {
  const KEY_ALARMAS = 'alerti.alarmas';
  const KEY_ESTADO = 'alerti.estado';
  const GRACIA_MS = 2 * 60 * 1000;
  const UNIDAD_MS = { minutos: 60000, horas: 3600000, dias: 86400000 };

  const TONOS = {
    campana: [[880, 0.0, 0.6], [1320, 0.15, 0.8]],
    beep: [[1000, 0.0, 0.15], [1000, 0.25, 0.15], [1000, 0.5, 0.15]],
    suave: [[523, 0.0, 0.5], [659, 0.3, 0.5], [784, 0.6, 0.7]],
    urgente: [[1200, 0.0, 0.12], [800, 0.15, 0.12], [1200, 0.3, 0.12], [800, 0.45, 0.12]],
  };

  let ctx = null;
  function audio() {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!ctx && Ctx) ctx = new Ctx();
    return ctx;
  }

  // Los navegadores bloquean el audio hasta que el usuario interactúa con la página.
  ['click', 'keydown', 'touchstart'].forEach((ev) =>
    document.addEventListener(ev, () => { const c = audio(); if (c && c.state === 'suspended') c.resume(); }, { passive: true })
  );

  function tocarTono(nombre) {
    const c = audio();
    if (!c) return false;
    if (c.state === 'suspended') c.resume();
    const t0 = c.currentTime;
    (TONOS[nombre] || TONOS.campana).forEach(([freq, inicio, dur]) => {
      const osc = c.createOscillator();
      const gain = c.createGain();
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.3, t0 + inicio);
      gain.gain.exponentialRampToValueAtTime(0.001, t0 + inicio + dur);
      osc.connect(gain).connect(c.destination);
      osc.start(t0 + inicio);
      osc.stop(t0 + inicio + dur);
    });
    return c.state === 'running';
  }

  window.Alerti = { tocarTono };

  const leerAlarmas = () => JSON.parse(localStorage.getItem(KEY_ALARMAS) || '[]');
  const leerEstado = () => JSON.parse(localStorage.getItem(KEY_ESTADO) || '{"disparadas":{},"pospuestas":{}}');
  const guardarEstado = (s) => localStorage.setItem(KEY_ESTADO, JSON.stringify(s));

  const aFecha = (iso, hora = '00:00') => {
    const [y, m, d] = iso.split('-').map(Number);
    const [hh, mm] = hora.split(':').map(Number);
    return new Date(y, m - 1, d, hh, mm, 0, 0);
  };

  // Última ocurrencia teórica de la alarma anterior o igual a "ahora" (ms) o null.
  function ultimaOcurrencia(a, ahora) {
    const inicio = aFecha(a.desde, a.hora);
    if (ahora < inicio) return null;
    const fin = a.hasta ? aFecha(a.hasta, '23:59').getTime() + 59999 : Infinity;

    if (a.frecuencia === 'una-vez') return inicio.getTime();

    if (a.frecuencia === 'intervalo') {
      const paso = a.intervalo.valor * UNIDAD_MS[a.intervalo.unidad];
      const k = Math.floor((ahora.getTime() - inicio.getTime()) / paso);
      const occ = inicio.getTime() + k * paso;
      return occ <= fin ? occ : null;
    }

    const hoy = aFecha(`${ahora.getFullYear()}-${String(ahora.getMonth() + 1).padStart(2, '0')}-${String(ahora.getDate()).padStart(2, '0')}`, a.hora);
    if (hoy > ahora || hoy.getTime() > fin) return null;

    if (a.frecuencia === 'semanal' && !a.diasSemana.includes(hoy.getDay())) return null;
    if (a.frecuencia === 'anual' && (hoy.getMonth() !== inicio.getMonth() || hoy.getDate() !== inicio.getDate())) return null;
    return hoy.getTime();
  }

  // --- Interfaz del aviso ---
  const activas = new Map(); // id -> elemento
  let overlay = null;
  let timerSonido = null;

  function asegurarOverlay() {
    if (overlay) return overlay;
    overlay = document.createElement('div');
    overlay.className = 'aviso-overlay';
    overlay.setAttribute('role', 'alertdialog');
    overlay.setAttribute('aria-live', 'assertive');
    document.body.append(overlay);
    return overlay;
  }

  function actualizarSonido() {
    const suena = [...activas.values()].filter((x) => x.alarma.sonido);
    if (!suena.length) {
      clearInterval(timerSonido);
      timerSonido = null;
      return;
    }
    if (timerSonido) return;
    const tocar = () => {
      const lista = [...activas.values()].filter((x) => x.alarma.sonido);
      if (lista.length) tocarTono(lista[0].alarma.tono);
    };
    tocar();
    timerSonido = setInterval(tocar, 2500);
  }

  function cerrar(id) {
    const item = activas.get(id);
    if (!item) return;
    item.el.remove();
    activas.delete(id);
    if (!activas.size && overlay) {
      overlay.remove();
      overlay = null;
      document.title = document.title.replace(/^🔔 /, '');
    }
    actualizarSonido();
  }

  function mostrar(a) {
    if (activas.has(a.id)) return;
    const cont = asegurarOverlay();

    const el = document.createElement('div');
    el.className = `aviso ${a.color}`;

    const hora = document.createElement('div');
    hora.className = 'aviso-hora';
    hora.textContent = a.hora;
    const titulo = document.createElement('h2');
    titulo.textContent = a.titulo;
    el.append(hora, titulo);

    if (a.texto) {
      const t = document.createElement('p');
      t.textContent = a.texto;
      el.append(t);
    }

    const acc = document.createElement('div');
    acc.className = 'aviso-acciones';

    if (a.posponerMin > 0) {
      const pos = document.createElement('button');
      pos.type = 'button';
      pos.className = 'btn-ghost';
      pos.textContent = `Posponer ${a.posponerMin} min`;
      pos.addEventListener('click', () => {
        const estado = leerEstado();
        estado.pospuestas[a.id] = Date.now() + a.posponerMin * 60000;
        guardarEstado(estado);
        cerrar(a.id);
      });
      acc.append(pos);
    }

    const ok = document.createElement('button');
    ok.type = 'button';
    ok.className = 'btn-primary';
    ok.textContent = 'Descartar';
    ok.addEventListener('click', () => cerrar(a.id));
    acc.append(ok);
    el.append(acc);

    cont.append(el);
    activas.set(a.id, { el, alarma: a });
    document.title = '🔔 ' + document.title.replace(/^🔔 /, '');
    ok.focus();
    actualizarSonido();
  }

  // --- Planificador ---
  function revisar() {
    const ahora = new Date();
    const estado = leerEstado();
    let cambiado = false;

    for (const a of leerAlarmas()) {
      if (!a.activa) continue;

      const pospuesta = estado.pospuestas[a.id];
      if (pospuesta && ahora.getTime() >= pospuesta) {
        delete estado.pospuestas[a.id];
        cambiado = true;
        mostrar(a);
        continue;
      }

      const occ = ultimaOcurrencia(a, ahora);
      if (occ === null || ahora.getTime() - occ > GRACIA_MS) continue;
      if (estado.disparadas[a.id] === occ) continue;

      estado.disparadas[a.id] = occ;
      cambiado = true;
      mostrar(a);
    }

    if (cambiado) guardarEstado(estado);
  }

  revisar();
  setInterval(revisar, 1000);
})();
