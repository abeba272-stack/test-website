import { services } from './data/services.js';

const yearEl = document.getElementById('year');
if (yearEl) yearEl.textContent = new Date().getFullYear();

function el(tag, attrs={}, children=[]) {
  const n = document.createElement(tag);
  Object.entries(attrs).forEach(([k,v]) => {
    if (k === 'class') n.className = v;
    else if (k.startsWith('on') && typeof v === 'function') n.addEventListener(k.slice(2), v);
    else n.setAttribute(k, v);
  });
  children.forEach(c => n.appendChild(typeof c === 'string' ? document.createTextNode(c) : c));
  return n;
}

function formatMinutes(min){
  if (!min) return '';
  const h = Math.floor(min/60);
  const m = min % 60;
  if (h && m) return `${h} Std. ${m} Min.`;
  if (h) return `${h} Std.`;
  return `${m} Min.`;
}

function currency(eur){
  return new Intl.NumberFormat('de-DE', { style:'currency', currency:'EUR' }).format(eur);
}

const grid = document.getElementById('servicesGrid');
const chips = document.querySelectorAll('.chip');

let activeFilter = 'all';

function matchesFilter(s){
  if (activeFilter === 'all') return true;
  return s.tags?.includes(activeFilter);
}

function render(){
  if (!grid) return;
  grid.innerHTML = '';
  services.filter(matchesFilter).forEach(s => {
    const imageSrc = s.image || 'assets/placeholder-editorial.jpg';
    const card = el('article', { class:'card' }, [
      el('img', { class:'service-thumb', src:imageSrc, alt:`${s.name} Beispielbild`, loading:'lazy' }),
      el('div', { class:'row between' }, [
        el('h3', {}, [s.name]),
        el('div', { class:'price' }, [s.priceFrom ? `ab ${currency(s.priceFrom)}` : 'Preis auf Anfrage'])
      ]),
      el('div', { class:'muted small' }, [s.category]),
      el('p', { class:'muted' }, [s.description]),
      el('div', { class:'row between' }, [
        el('div', { class:'tag' }, [`⏱ ${formatMinutes(s.durationMin)}`]),
        el('a', { class:'btn small', href:`booking.html?service=${encodeURIComponent(s.id)}` }, ['Buchen'])
      ])
    ]);
    grid.appendChild(card);
  });
}

chips?.forEach(btn => {
  btn.addEventListener('click', () => {
    chips.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    activeFilter = btn.dataset.filter;
    render();
  });
});

render();
