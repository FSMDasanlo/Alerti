(() => {
  const STORAGE_KEY = 'alerti.alarmas';
  const $ = (id) => document.getElementById(id);

  const form = $('form-alarma');
  const frecuencia = $('frecuencia');
  const error = $('error');

  const hoy = () => {
    const d = new Date();
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().slice(0, 10);
  };

  $('desde').value = hoy();
  $('desde').min = hoy();

  function actualizarFrecuencia() {
    const f = frecuencia.value;
    $('bloque-semanal').hidden = f !== 'semanal';
    $('bloque-intervalo').hidden = f !== 'intervalo';
    $('bloque-hasta').hidden = f === 'una-vez';
    $('lbl-desde').textContent = f === 'una-vez' ? 'Fecha' : 'Desde';
  }

  function actualizarSonido() {
    const conSonido = form.elements.sonido.value === 'si';
    $('bloque-tono').hidden = !conSonido;
  }

  frecuencia.addEventListener('change', actualizarFrecuencia);
  form.elements.sonido.forEach((r) => r.addEventListener('change', actualizarSonido));
  actualizarFrecuencia();
  actualizarSonido();

  const editId = new URLSearchParams(location.search).get('id');
  const existente = editId
    ? JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]').find((a) => a.id === editId)
    : null;

  if (existente) {
    document.title = 'Editar alarma · Alerti';
    document.querySelector('.topbar h1').textContent = 'Editar alarma';
    form.querySelector('.btn-primary').textContent = 'Guardar cambios';
    $('desde').removeAttribute('min');
    $('titulo').value = existente.titulo;
    $('hora').value = existente.hora;
    frecuencia.value = existente.frecuencia;
    document.querySelectorAll('#dias-semana input').forEach((c) => {
      c.checked = existente.diasSemana.includes(Number(c.value));
    });
    if (existente.intervalo) {
      $('intervalo-valor').value = existente.intervalo.valor;
      $('intervalo-unidad').value = existente.intervalo.unidad;
    }
    $('texto').value = existente.texto;
    form.elements.sonido.value = existente.sonido ? 'si' : 'no';
    if (existente.tono) $('tono').value = existente.tono;
    $('desde').value = existente.desde;
    $('hasta').value = existente.hasta || '';
    $('posponer').value = String(existente.posponerMin);
    form.elements.color.value = existente.color;
    actualizarFrecuencia();
    actualizarSonido();
  }

  $('probar-tono').addEventListener('click', () => window.Alerti.tocarTono($('tono').value));

  function mostrarError(msg) {
    error.textContent = msg;
    error.hidden = false;
    error.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    error.hidden = true;

    const f = frecuencia.value;
    const dias = [...document.querySelectorAll('#dias-semana input:checked')].map((c) => Number(c.value));
    const intervaloValor = Number($('intervalo-valor').value);
    const desde = $('desde').value;
    const hasta = f === 'una-vez' ? '' : $('hasta').value;

    if (!$('hora').value) return mostrarError('Indica la hora de inicio.');
    if (!desde) return mostrarError('Indica la fecha de comienzo.');
    if (f === 'semanal' && dias.length === 0) return mostrarError('Elige al menos un día de la semana.');
    if (f === 'intervalo' && !(intervaloValor >= 1)) return mostrarError('Indica cada cuánto se repite.');
    if (hasta && hasta < desde) return mostrarError('La fecha final no puede ser anterior a la de comienzo.');

    const sonido = form.elements.sonido.value === 'si';
    const alarma = {
      id: existente ? existente.id : (crypto.randomUUID ? crypto.randomUUID() : String(Date.now())),
      titulo: $('titulo').value.trim() || 'Alarma',
      hora: $('hora').value,
      frecuencia: f,
      diasSemana: f === 'semanal' ? dias : [],
      intervalo: f === 'intervalo' ? { valor: intervaloValor, unidad: $('intervalo-unidad').value } : null,
      texto: $('texto').value.trim(),
      sonido,
      tono: sonido ? $('tono').value : null,
      desde,
      hasta: hasta || null,
      posponerMin: Number($('posponer').value),
      color: form.elements.color.value,
      activa: existente ? existente.activa : true,
      creada: existente ? existente.creada : new Date().toISOString(),
    };

    const alarmas = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    const idx = alarmas.findIndex((a) => a.id === alarma.id);
    if (idx >= 0) alarmas[idx] = alarma;
    else alarmas.push(alarma);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(alarmas));

    $('toast').hidden = false;
    setTimeout(() => { window.location.href = 'alarmas.html'; }, 900);
  });
})();
