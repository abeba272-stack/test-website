export const storage = {
  get(key, fallback){
    try{
      const v = localStorage.getItem(key);
      return v ? JSON.parse(v) : fallback;
    }catch(e){ return fallback; }
  },
  set(key, value){
    localStorage.setItem(key, JSON.stringify(value));
  }
};

export function uid(prefix='id'){
  return `${prefix}_${Math.random().toString(16).slice(2)}_${Date.now()}`;
}

export function fmtDate(d){
  const dd = new Date(d);
  return dd.toLocaleDateString('de-DE', { weekday:'short', year:'numeric', month:'2-digit', day:'2-digit' });
}
export function fmtTime(t){ return t; }

export function currency(eur){
  return new Intl.NumberFormat('de-DE', { style:'currency', currency:'EUR' }).format(eur);
}

export function formatMinutes(min){
  const h = Math.floor(min/60);
  const m = min % 60;
  if (h && m) return `${h} Std. ${m} Min.`;
  if (h) return `${h} Std.`;
  return `${m} Min.`;
}
