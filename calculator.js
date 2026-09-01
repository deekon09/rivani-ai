(() => {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const finite = (v) => Number.isFinite(v);
  const fmt = (v, digits = 10) => {
    if (!finite(v)) return 'Invalid result';
    const a = Math.abs(v);
    if (a !== 0 && (a >= 1e12 || a < 1e-7)) return v.toExponential(6);
    return Number(v.toFixed(digits)).toLocaleString('en-US', { maximumFractionDigits: digits });
  };
  const numberOf = (id) => Number($(id)?.value);
  const setText = (id, text) => { const el = $(id); if (el) el.textContent = text; };

  document.querySelectorAll('[data-calc-tab]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const key = btn.dataset.calcTab;
      document.querySelectorAll('[data-calc-tab]').forEach((b) => b.classList.toggle('active', b === btn));
      document.querySelectorAll('[data-calc-panel]').forEach((p) => p.classList.toggle('active', p.dataset.calcPanel === key));
    });
  });

  class Parser {
    constructor(input) { this.s = input.replace(/×/g, '*').replace(/÷/g, '/').replace(/−/g, '-'); this.i = 0; }
    skip() { while (/\s/.test(this.s[this.i] || '')) this.i++; }
    peek() { this.skip(); return this.s[this.i] || ''; }
    take(ch) { this.skip(); if (this.s.startsWith(ch, this.i)) { this.i += ch.length; return true; } return false; }
    parse() { const v = this.expr(); this.skip(); if (this.i !== this.s.length) throw new Error(`Unexpected input near “${this.s.slice(this.i, this.i + 12)}”`); return v; }
    expr() { let v = this.term(); for (;;) { if (this.take('+')) v += this.term(); else if (this.take('-')) v -= this.term(); else return v; } }
    term() { let v = this.power(); for (;;) { if (this.take('*')) v *= this.power(); else if (this.take('/')) { const d = this.power(); if (d === 0) throw new Error('Division by zero is undefined.'); v /= d; } else return v; } }
    power() { let v = this.unary(); if (this.take('^')) v = Math.pow(v, this.power()); return v; }
    unary() { if (this.take('+')) return this.unary(); if (this.take('-')) return -this.unary(); return this.primary(); }
    primary() {
      if (this.take('(')) { const v = this.expr(); if (!this.take(')')) throw new Error('Missing closing parenthesis.'); return v; }
      const rest = this.s.slice(this.i);
      const num = rest.match(/^(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?/i);
      if (num) { this.i += num[0].length; return Number(num[0]); }
      const id = rest.match(/^[A-Za-z]+/);
      if (id) {
        const name = id[0].toLowerCase(); this.i += id[0].length;
        if (name === 'pi') return Math.PI;
        if (name === 'e') return Math.E;
        if (!this.take('(')) throw new Error(`${name} needs parentheses.`);
        const arg = this.expr(); if (!this.take(')')) throw new Error(`Missing ) after ${name}.`);
        const deg = (x) => x * Math.PI / 180;
        const fns = { sqrt: Math.sqrt, abs: Math.abs, log: Math.log10, ln: Math.log, sin: (x) => Math.sin(deg(x)), cos: (x) => Math.cos(deg(x)), tan: (x) => Math.tan(deg(x)) };
        if (!fns[name]) throw new Error(`Unknown function “${name}”.`);
        const v = fns[name](arg); if (!finite(v)) throw new Error('That expression is outside the calculator range.'); return v;
      }
      throw new Error('Enter a valid number or expression.');
    }
  }

  const history = [];
  function evaluateScientific() {
    const input = $('calcExpression').value.trim();
    try {
      const result = new Parser(input).parse();
      if (!finite(result)) throw new Error('Result is not finite.');
      setText('calcScientificResult', fmt(result));
      setText('calcScientificSteps', `${input} = ${fmt(result)}`);
      history.unshift({ input, result: fmt(result) }); history.splice(8);
      renderHistory();
    } catch (e) { setText('calcScientificResult', 'Check expression'); setText('calcScientificSteps', e.message || 'Could not calculate.'); }
  }
  function renderHistory() {
    const box = $('calcHistory'); box.innerHTML = history.length ? history.map((h) => `<button type="button" data-history-expression="${h.input.replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;')}"><span>${h.input.replace(/</g,'&lt;')}</span><strong>${h.result}</strong></button>`).join('') : '<span>No history yet.</span>';
    box.querySelectorAll('button').forEach((b) => b.addEventListener('click', () => { $('calcExpression').value = b.dataset.historyExpression; evaluateScientific(); }));
  }
  $('calcEvaluate').addEventListener('click', evaluateScientific);
  $('calcExpression').addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); evaluateScientific(); } });
  $('calcKeypad').querySelectorAll('[data-key]').forEach((b) => b.addEventListener('click', () => { const i = $('calcExpression'); const start = i.selectionStart ?? i.value.length, end = i.selectionEnd ?? start, key = b.dataset.key; i.value = i.value.slice(0,start) + key + i.value.slice(end); i.focus(); i.setSelectionRange(start + key.length, start + key.length); }));
  $('calcBackspace').addEventListener('click', () => { const i = $('calcExpression'); i.value = i.value.slice(0,-1); i.focus(); });
  $('calcClearHistory').addEventListener('click', () => { history.length = 0; renderHistory(); });

  const gcd = (a,b) => { a = Math.abs(Math.trunc(a)); b = Math.abs(Math.trunc(b)); while (b) [a,b] = [b,a%b]; return a || 1; };
  $('fracCalculate').addEventListener('click', () => {
    const a=numberOf('fracA'), b=numberOf('fracB'), c=numberOf('fracC'), d=numberOf('fracD'), op=$('fracOp').value;
    if (![a,b,c,d].every(Number.isInteger) || b===0 || d===0) { setText('fracResult','Check values'); setText('fracSteps','Use whole-number numerators/denominators and non-zero denominators.'); return; }
    let n, den, step;
    if (op==='+') { n=a*d+c*b; den=b*d; step=`(${a}×${d} + ${c}×${b}) / (${b}×${d}) = ${n}/${den}`; }
    else if (op==='-') { n=a*d-c*b; den=b*d; step=`(${a}×${d} − ${c}×${b}) / (${b}×${d}) = ${n}/${den}`; }
    else if (op==='*') { n=a*c; den=b*d; step=`(${a}×${c}) / (${b}×${d}) = ${n}/${den}`; }
    else { if (c===0) { setText('fracResult','Undefined'); setText('fracSteps','Cannot divide by a zero fraction.'); return; } n=a*d; den=b*c; step=`(${a}×${d}) / (${b}×${c}) = ${n}/${den}`; }
    if (den < 0) { n=-n; den=-den; }
    const g=gcd(n,den), sn=n/g, sd=den/g;
    setText('fracResult', sd===1 ? String(sn) : `${sn}/${sd}`); setText('fracSteps', `${step}. Divide numerator and denominator by ${g} → ${sd===1?sn:`${sn}/${sd}`}.`);
  });

  $('pctOfBtn').addEventListener('click',()=>{ const r=numberOf('pctRate'),b=numberOf('pctBase'); setText('pctOfResult', finite(r)&&finite(b)?`${fmt(r*b/100)} (${r}% of ${fmt(b)})`:'Check values'); });
  $('pctChangeBtn').addEventListener('click',()=>{ const o=numberOf('pctOld'),n=numberOf('pctNew'); if(!finite(o)||!finite(n)||o===0){setText('pctChangeResult','Old value must be non-zero');return;} const p=(n-o)/Math.abs(o)*100; setText('pctChangeResult',`${fmt(p,4)}% ${p>=0?'increase':'decrease'}`); });
  $('discountBtn').addEventListener('click',()=>{ const p=numberOf('discountPrice'),r=numberOf('discountRate'); if(!finite(p)||!finite(r)){setText('discountResult','Check values');return;} const save=p*r/100; setText('discountResult',`${fmt(p-save)} final · save ${fmt(save)}`); });

  $('linearBtn').addEventListener('click',()=>{ const a=numberOf('linA'),b=numberOf('linB'),c=numberOf('linC'); if(!finite(a)||!finite(b)||!finite(c)||a===0){setText('linearResult','a must be non-zero');setText('linearSteps','A linear equation needs a non-zero x coefficient.');return;} const x=(c-b)/a; setText('linearResult',`x = ${fmt(x)}`); setText('linearSteps',`${a}x + ${b} = ${c} → ${a}x = ${fmt(c-b)} → x = ${fmt(c-b)} ÷ ${fmt(a)} = ${fmt(x)}.`); });
  $('quadBtn').addEventListener('click',()=>{ const a=numberOf('quadA'),b=numberOf('quadB'),c=numberOf('quadC'); if(!finite(a)||!finite(b)||!finite(c)||a===0){setText('quadResult','a must be non-zero');setText('quadSteps','Use the linear solver if a = 0.');return;} const disc=b*b-4*a*c; if(disc<0){const real=-b/(2*a),imag=Math.sqrt(-disc)/(2*Math.abs(a)); setText('quadResult',`x = ${fmt(real)} ± ${fmt(imag)}i`); setText('quadSteps',`Discriminant b²−4ac = ${fmt(disc)}. Negative discriminant gives two complex roots.`);return;} const s=Math.sqrt(disc),x1=(-b+s)/(2*a),x2=(-b-s)/(2*a); setText('quadResult',disc===0?`x = ${fmt(x1)}`:`x₁ = ${fmt(x1)}, x₂ = ${fmt(x2)}`); setText('quadSteps',`Discriminant = ${fmt(disc)}. x = (−b ± √${fmt(disc)}) / 2a.`); });

  $('statsBtn').addEventListener('click',()=>{ const vals=$('statsInput').value.split(/[\s,]+/).filter(Boolean).map(Number).filter(finite); const cards=$('statsResults').querySelectorAll('strong'); if(!vals.length){cards.forEach(c=>c.textContent='—');return;} const sorted=[...vals].sort((a,b)=>a-b),sum=vals.reduce((a,b)=>a+b,0),mean=sum/vals.length,mid=sorted.length>>1,median=sorted.length%2?sorted[mid]:(sorted[mid-1]+sorted[mid])/2; const counts=new Map(); vals.forEach(v=>counts.set(v,(counts.get(v)||0)+1)); let max=0,modes=[]; counts.forEach((n,v)=>{if(n>max){max=n;modes=[v];}else if(n===max)modes.push(v)}); const variance=vals.reduce((s,v)=>s+(v-mean)**2,0)/vals.length,std=Math.sqrt(variance); [vals.length,fmt(mean),fmt(median),max===1?'No repeated mode':modes.map(fmt).join(', '),fmt(sorted.at(-1)-sorted[0]),fmt(std)].forEach((v,i)=>cards[i].textContent=v); });

  const geoConfig={ circle:[['radius','Radius',5]], rectangle:[['length','Length',8],['width','Width',5]], triangle:[['base','Base',10],['height','Height',6]] };
  function renderGeo(){ const shape=$('geoShape').value; $('geoInputs').innerHTML=geoConfig[shape].map(([id,label,val])=>`<label class="calc-field"><span>${label}</span><input id="geo_${id}" type="number" value="${val}" min="0" step="any"/></label>`).join(''); }
  $('geoShape').addEventListener('change',renderGeo); renderGeo();
  $('geoBtn').addEventListener('click',()=>{ const s=$('geoShape').value; if(s==='circle'){const r=numberOf('geo_radius'); if(!(r>=0)){setText('geoResult','Check radius');return;} setText('geoResult',`Area ${fmt(Math.PI*r*r)} · Circumference ${fmt(2*Math.PI*r)}`);setText('geoSteps','Area = πr² · Circumference = 2πr.');} else if(s==='rectangle'){const l=numberOf('geo_length'),w=numberOf('geo_width'); if(!(l>=0&&w>=0)){setText('geoResult','Check dimensions');return;}setText('geoResult',`Area ${fmt(l*w)} · Perimeter ${fmt(2*(l+w))}`);setText('geoSteps','Area = length × width · Perimeter = 2(length + width).');} else {const b=numberOf('geo_base'),h=numberOf('geo_height'); if(!(b>=0&&h>=0)){setText('geoResult','Check dimensions');return;}setText('geoResult',`Area ${fmt(b*h/2)}`);setText('geoSteps','Triangle area = ½ × base × height.');} });

  const units={ length:{m:1,km:1000,cm:.01,mm:.001,in:.0254,ft:.3048,yd:.9144,mi:1609.344}, weight:{kg:1,g:.001,mg:.000001,lb:.45359237,oz:.028349523125}, data:{B:1,KB:1024,MB:1048576,GB:1073741824,TB:1099511627776} };
  const labels={m:'Metres',km:'Kilometres',cm:'Centimetres',mm:'Millimetres',in:'Inches',ft:'Feet',yd:'Yards',mi:'Miles',kg:'Kilograms',g:'Grams',mg:'Milligrams',lb:'Pounds',oz:'Ounces',B:'Bytes',KB:'KB',MB:'MB',GB:'GB',TB:'TB',C:'Celsius',F:'Fahrenheit',K:'Kelvin'};
  function renderUnits(){ const c=$('convCategory').value, keys=c==='temperature'?['C','F','K']:Object.keys(units[c]); const html=keys.map(k=>`<option value="${k}">${labels[k]}</option>`).join(''); $('convFrom').innerHTML=html;$('convTo').innerHTML=html;$('convTo').selectedIndex=Math.min(1,keys.length-1); }
  $('convCategory').addEventListener('change',renderUnits); renderUnits();
  $('convBtn').addEventListener('click',()=>{const cat=$('convCategory').value,v=numberOf('convValue'),from=$('convFrom').value,to=$('convTo').value;if(!finite(v)){setText('convResult','Check value');return;}let out;if(cat==='temperature'){const c=from==='C'?v:from==='F'?(v-32)*5/9:v-273.15;out=to==='C'?c:to==='F'?c*9/5+32:c+273.15;}else out=v*units[cat][from]/units[cat][to];setText('convResult',`${fmt(out)} ${to}`);setText('convSteps',`${fmt(v)} ${from} = ${fmt(out)} ${to}.`);});

  $('emiBtn').addEventListener('click',()=>{const p=numberOf('emiPrincipal'),annual=numberOf('emiRate'),n=Math.round(numberOf('emiMonths'));if(!(p>=0)||!(annual>=0)||!(n>0)){setText('emiResult','Check values');return;}const r=annual/1200;const emi=r===0?p/n:p*r*(1+r)**n/((1+r)**n-1);const total=emi*n;setText('emiResult',`${fmt(emi,2)} / month`);setText('emiSteps',`Estimated total payment ${fmt(total,2)} · estimated interest ${fmt(total-p,2)}.`);});
  $('ciBtn').addEventListener('click',()=>{const p=numberOf('ciPrincipal'),r=numberOf('ciRate'),y=numberOf('ciYears');if(!(p>=0)||!(r>=0)||!(y>=0)){setText('ciResult','Check values');return;}const amount=p*(1+r/100)**y;setText('ciResult',`${fmt(amount,2)} final amount`);setText('ciSteps',`A = P(1 + r)ᵗ → interest earned ${fmt(amount-p,2)}.`);});

  evaluateScientific(); $('statsBtn').click(); $('convBtn').click(); $('geoBtn').click();
})();
