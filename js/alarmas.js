(() => {
  const STORAGE_KEY = 'alerti.alarmas';
  const lista = document.getElementById('lista');
  const vacio = document.getElementById('vacio');

  const DIAS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
  const UNIDADES = { minutos: 'min', horas: 'h', dias: 'días' };

  const leer = () => JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  const guardar = (a) => localStorage.setItem(STORAGE_KEY, JSON.stringify(a));

  const fecha = (iso) => iso.split('-').reverse().join('/');

  function describirFrecuencia(a) {
    switch (a.frecuencia) {
      case 'una-vez': return `Una vez · ${fecha(a.desde)}`;
      case 'diaria': return 'Cada día';
      case 'semanal': return 'Semanal · ' + [...a.diasSemana].sort((x, y) => ((x + 6) % 7) - ((y + 6) % 7)).map((d) => DIAS[d]).join(', ');
      case 'anual': return 'Cada año';
      case 'intervalo': return `Cada ${a.intervalo.valor} ${UNIDADES[a.intervalo.unidad]}`;
      default: return '';
    }
  }

  function describirRango(a) {
    if (a.frecuencia === 'una-vez') return '';
    return a.hasta ? `Del ${fecha(a.desde)} al ${fecha(a.hasta)}` : `Desde el ${fecha(a.desde)}`;
  }

  function crear(a) {
    const li = document.createElement('li');
    li.className = `alarma ${a.color}${a.activa ? '' : ' inactiva'}`;
    li.dataset.id = a.id;

    const cab = document.createElement('div');
    cab.className = 'alarma-cab';

    const info = document.createElement('div');
    info.className = 'info';
    const hora = document.createElement('div');
    hora.className = 'hora';
    hora.textContent = a.hora;
    const titulo = document.createElement('div');
    titulo.className = 'titulo';
    titulo.textContent = a.titulo;
    const detalle = document.createElement('div');
    detalle.className = 'detalle';
    detalle.textContent = [describirFrecuencia(a), describirRango(a), a.sonido ? '🔔' : '🔕']
      .filter(Boolean).join(' · ');
    info.append(hora, titulo, detalle);

    const sw = document.createElement('label');
    sw.className = 'switch';
    sw.title = 'Activar o desactivar';
    const chk = document.createElement('input');
    chk.type = 'checkbox';
    chk.checked = a.activa;
    chk.setAttribute('aria-label', `Activar ${a.titulo}`);
    chk.dataset.accion = 'toggle';
    sw.append(chk, document.createElement('span'));

    cab.append(info, sw);
    li.append(cab);

    if (a.texto) {
      const t = document.createElement('p');
      t.className = 'texto';
      t.textContent = a.texto;
      li.append(t);
    }

    const acc = document.createElement('div');
    acc.className = 'acciones';
    const editar = document.createElement('a');
    editar.href = `nueva-alarma.html?id=${encodeURIComponent(a.id)}`;
    editar.textContent = 'Editar';
    const eliminar = document.createElement('button');
    eliminar.type = 'button';
    eliminar.className = 'eliminar';
    eliminar.dataset.accion = 'eliminar';
    eliminar.textContent = 'Eliminar';
    acc.append(editar, eliminar);
    li.append(acc);

    return li;
  }

  function pintar() {
    const alarmas = leer().sort((x, y) => x.hora.localeCompare(y.hora));
    lista.replaceChildren(...alarmas.map(crear));
    vacio.hidden = alarmas.length > 0;
  }

  lista.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-accion="eliminar"]');
    if (!btn) return;
    const id = btn.closest('.alarma').dataset.id;
    const a = leer().find((x) => x.id === id);
    if (!a || !confirm(`¿Eliminar la alarma "${a.titulo}"?`)) return;
    guardar(leer().filter((x) => x.id !== id));
    pintar();
  });

  lista.addEventListener('change', (e) => {
    if (e.target.dataset.accion !== 'toggle') return;
    const id = e.target.closest('.alarma').dataset.id;
    const alarmas = leer();
    const a = alarmas.find((x) => x.id === id);
    if (!a) return;
    a.activa = e.target.checked;
    guardar(alarmas);
    pintar();
  });

  pintar();
})();
