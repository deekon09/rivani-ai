(() => {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const finite = Number.isFinite;
  const EPS = 1e-9;
  let explainMode = 'full';

  const fmt = (v, digits = 10) => {
    if (!finite(v)) return 'Invalid result';
    if (Object.is(v, -0)) v = 0;
    const a = Math.abs(v);
    if (a !== 0 && (a >= 1e12 || a < 1e-7)) return v.toExponential(Math.min(6, digits));
    return Number(v.toFixed(digits)).toLocaleString('en-US', { maximumFractionDigits: digits });
  };
  const num = (id) => Number($(id)?.value);
  const text = (id, value) => { const el = $(id); if (el) el.textContent = value; };
  const esc = (s) => String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');

  async function requireAuth(tool='RIVANI Student Calculator') {
    for (let i=0;i<40 && typeof window.RIVANI_REQUIRE_AUTH!=='function';i++) await new Promise(r=>setTimeout(r,50));
    if (typeof window.RIVANI_REQUIRE_AUTH !== 'function') {
      alert('RIVANI account check is still loading. Please try again.');
      return false;
    }
    return await window.RIVANI_REQUIRE_AUTH({tool});
  }
  function bindRun(id, fn, tool='RIVANI Student Calculator') {
    const el=$(id); if(!el) return;
    el.addEventListener('click', async () => { if(await requireAuth(tool)) fn(); });
  }

  document.querySelectorAll('[data-explain-mode]').forEach(btn=>btn.addEventListener('click',()=>{
    explainMode=btn.dataset.explainMode;
    document.querySelectorAll('[data-explain-mode]').forEach(b=>b.classList.toggle('active',b===btn));
  }));
  document.querySelectorAll('[data-calc-tab]').forEach(btn=>btn.addEventListener('click',()=>{
    const key=btn.dataset.calcTab;
    document.querySelectorAll('[data-calc-tab]').forEach(b=>b.classList.toggle('active',b===btn));
    document.querySelectorAll('[data-calc-panel]').forEach(p=>p.classList.toggle('active',p.dataset.calcPanel===key));
  }));

  function normalizeExpression(raw){
    return String(raw||'').replace(/×/g,'*').replace(/÷/g,'/').replace(/[−–—]/g,'-').replace(/π/gi,'pi').trim();
  }
  class ScalarParser {
    constructor(input, scope={}) { this.s=normalizeExpression(input); this.i=0; this.scope=scope; }
    skip(){ while(/\s/.test(this.s[this.i]||'')) this.i++; }
    take(ch){ this.skip(); if(this.s.startsWith(ch,this.i)){this.i+=ch.length;return true;} return false; }
    parse(){ const v=this.expr(); this.skip(); if(this.i!==this.s.length) throw new Error(`Unexpected input near “${this.s.slice(this.i,this.i+12)}”`); return v; }
    expr(){ let v=this.term(); for(;;){ if(this.take('+'))v+=this.term(); else if(this.take('-'))v-=this.term(); else return v; } }
    term(){ let v=this.power(); for(;;){ if(this.take('*'))v*=this.power(); else if(this.take('/')){const d=this.power();if(Math.abs(d)<EPS)throw new Error('Division by zero is undefined.');v/=d;} else return v; } }
    power(){ let v=this.unary(); if(this.take('^'))v=Math.pow(v,this.power()); return v; }
    unary(){ if(this.take('+'))return this.unary(); if(this.take('-'))return -this.unary(); return this.primary(); }
    primary(){
      if(this.take('(')){const v=this.expr();if(!this.take(')'))throw new Error('Missing closing parenthesis.');return v;}
      const rest=this.s.slice(this.i);
      const m=rest.match(/^(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?/i);
      if(m){this.i+=m[0].length;return Number(m[0]);}
      const id=rest.match(/^[A-Za-z]+/);
      if(id){
        const name=id[0].toLowerCase();this.i+=id[0].length;
        if(Object.prototype.hasOwnProperty.call(this.scope,name)) return Number(this.scope[name]);
        if(name==='pi')return Math.PI;if(name==='e')return Math.E;
        if(!this.take('('))throw new Error(`${name} needs parentheses.`);
        const arg=this.expr();if(!this.take(')'))throw new Error(`Missing ) after ${name}.`);
        const rad=x=>x*Math.PI/180, deg=x=>x*180/Math.PI;
        const fns={sqrt:Math.sqrt,abs:Math.abs,log:Math.log10,ln:Math.log,exp:Math.exp,sin:x=>Math.sin(rad(x)),cos:x=>Math.cos(rad(x)),tan:x=>Math.tan(rad(x)),asin:x=>deg(Math.asin(x)),acos:x=>deg(Math.acos(x)),atan:x=>deg(Math.atan(x)),floor:Math.floor,ceil:Math.ceil,round:Math.round};
        if(!fns[name])throw new Error(`Unknown function “${name}”.`);
        const v=fns[name](arg);if(!finite(v))throw new Error('That expression is outside the calculator range.');return v;
      }
      throw new Error('Enter a valid number or expression.');
    }
  }
  const evaluate=(expr,scope={})=>new ScalarParser(expr,scope).parse();

  // Polynomial parser: deterministic algebra support for x, +, -, *, / constant and integer powers.
  const pTrim=(p)=>{const out=p.slice();while(out.length>1&&Math.abs(out[out.length-1])<EPS)out.pop();return out.map(v=>Math.abs(v)<EPS?0:v);};
  const pAdd=(a,b)=>pTrim(Array.from({length:Math.max(a.length,b.length)},(_,i)=>(a[i]||0)+(b[i]||0)));
  const pScale=(a,k)=>pTrim(a.map(v=>v*k));
  const pMul=(a,b)=>{const out=Array(a.length+b.length-1).fill(0);for(let i=0;i<a.length;i++)for(let j=0;j<b.length;j++)out[i+j]+=a[i]*b[j];if(out.length>7)throw new Error('Polynomial degree above 6 is not supported.');return pTrim(out);};
  const pPow=(a,n)=>{if(!Number.isInteger(n)||n<0||n>6)throw new Error('Use an integer power from 0 to 6.');let out=[1];for(let i=0;i<n;i++)out=pMul(out,a);return out;};
  function implicitMultiply(raw){
    return normalizeExpression(raw)
      .replace(/(\d|x|\))\s*(?=x|\()/gi,'$1*')
      .replace(/x\s*(?=\d)/gi,'x*');
  }
  class PolyParser{
    constructor(input){this.s=implicitMultiply(input);this.i=0;}
    skip(){while(/\s/.test(this.s[this.i]||''))this.i++;}
    take(ch){this.skip();if(this.s.startsWith(ch,this.i)){this.i+=ch.length;return true;}return false;}
    parse(){const p=this.expr();this.skip();if(this.i!==this.s.length)throw new Error(`Unsupported algebra near “${this.s.slice(this.i,this.i+10)}”`);return pTrim(p);}
    expr(){let p=this.term();for(;;){if(this.take('+'))p=pAdd(p,this.term());else if(this.take('-'))p=pAdd(p,pScale(this.term(),-1));else return p;}}
    term(){let p=this.power();for(;;){if(this.take('*'))p=pMul(p,this.power());else if(this.take('/')){const d=this.power();if(d.length!==1||Math.abs(d[0])<EPS)throw new Error('Polynomial division is supported only by a non-zero constant.');p=pScale(p,1/d[0]);}else return p;}}
    power(){let p=this.unary();if(this.take('^')){const rest=this.s.slice(this.i);const m=rest.match(/^\d+/);if(!m)throw new Error('Power must be a whole number.');this.i+=m[0].length;p=pPow(p,Number(m[0]));}return p;}
    unary(){if(this.take('+'))return this.unary();if(this.take('-'))return pScale(this.unary(),-1);return this.primary();}
    primary(){if(this.take('(')){const p=this.expr();if(!this.take(')'))throw new Error('Missing closing parenthesis.');return p;}const rest=this.s.slice(this.i);const m=rest.match(/^(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?/i);if(m){this.i+=m[0].length;return[Number(m[0])];}if(/^x/i.test(rest)){this.i++;return[0,1];}throw new Error('Only numbers, x, parentheses and basic operators are supported here.');}
  }
  const parsePoly=(s)=>new PolyParser(s).parse();
  function equationPoly(line){const parts=String(line).split('=');if(parts.length!==2)throw new Error('Each equation needs exactly one = sign.');return pAdd(parsePoly(parts[0]),pScale(parsePoly(parts[1]),-1));}
  function proportional(a,b){a=pTrim(a);b=pTrim(b);const n=Math.max(a.length,b.length);let ratio=null;for(let i=0;i<n;i++){const x=a[i]||0,y=b[i]||0;if(Math.abs(x)<EPS&&Math.abs(y)<EPS)continue;if(Math.abs(x)<EPS||Math.abs(y)<EPS)return false;const r=x/y;if(ratio===null)ratio=r;else if(Math.abs(r-ratio)>1e-7*Math.max(1,Math.abs(ratio)))return false;}return ratio!==null||a.every(v=>Math.abs(v)<EPS)&&b.every(v=>Math.abs(v)<EPS);}
  function polynomialRoots(p){p=pTrim(p);if(p.length===1)return Math.abs(p[0])<EPS?{type:'all',roots:[]}:{type:'none',roots:[]};if(p.length===2)return{type:'finite',roots:[-p[0]/p[1]]};if(p.length===3){const [c,b,a]=p,d=b*b-4*a*c;if(d>=-EPS){const sd=Math.sqrt(Math.max(0,d));return{type:'finite',roots:[(-b+sd)/(2*a),(-b-sd)/(2*a)].filter((v,i,arr)=>i===0||Math.abs(v-arr[0])>1e-8)};}return{type:'complex',roots:[]};}return{type:'higher',roots:[]};}
  function rootsLabel(p){const r=polynomialRoots(p);if(r.type==='all')return'all real x';if(r.type==='none')return'no solution';if(r.type==='complex')return'complex roots';if(r.type==='higher')return'a higher-degree solution set';return r.roots.map(v=>`x = ${fmt(v,6)}`).join(', ');}
  function polyToString(p){p=pTrim(p);const parts=[];for(let i=p.length-1;i>=0;i--){let c=p[i];if(Math.abs(c)<EPS)continue;const sign=c<0?'-':'+';c=Math.abs(c);let term='';if(i===0)term=fmt(c,8);else if(i===1)term=`${Math.abs(c-1)<EPS?'':fmt(c,8)}x`;else term=`${Math.abs(c-1)<EPS?'':fmt(c,8)}x^${i}`;parts.push({sign,term});}if(!parts.length)return'0';return parts.map((p,i)=>`${i===0?(p.sign==='-'?'-':''):p.sign==='-'?' - ':' + '}${p.term}`).join('');}

  const history=[];
  function renderHistory(){const box=$('calcHistory');if(!box)return;box.innerHTML=history.length?history.map(h=>`<button type="button" data-history-expression="${esc(h.input)}"><span>${esc(h.input)}</span><strong>${esc(h.result)}</strong></button>`).join(''):'<span>No history yet.</span>';box.querySelectorAll('button').forEach(b=>b.addEventListener('click',()=>{$('calcExpression').value=b.dataset.historyExpression;}));}
  function scientific(){const input=$('calcExpression').value.trim();try{const result=evaluate(input);if(!finite(result))throw new Error('Result is not finite.');const out=fmt(result);text('calcScientificResult',out);text('calcScientificSteps',explainMode==='hinglish'?`${input} ko order of operations ke hisaab se solve kiya → ${out}.`:explainMode==='exam'?`${input}\n∴ Answer = ${out}`:`Expression evaluated using standard order of operations.\n${input} = ${out}`);history.unshift({input,result:out});history.splice(8);renderHistory();}catch(e){text('calcScientificResult','Check expression');text('calcScientificSteps',e.message||'Could not calculate.');}}
  bindRun('calcEvaluate',scientific);
  $('calcExpression')?.addEventListener('keydown',async e=>{if(e.key==='Enter'){e.preventDefault();if(await requireAuth())scientific();}});
  $('calcKeypad')?.querySelectorAll('[data-key]').forEach(b=>b.addEventListener('click',()=>{const i=$('calcExpression'),start=i.selectionStart??i.value.length,end=i.selectionEnd??start,key=b.dataset.key;i.value=i.value.slice(0,start)+key+i.value.slice(end);i.focus();i.setSelectionRange(start+key.length,start+key.length);}));
  $('calcBackspace')?.addEventListener('click',()=>{const i=$('calcExpression');const s=i.selectionStart??i.value.length,e=i.selectionEnd??s;if(s!==e)i.value=i.value.slice(0,s)+i.value.slice(e);else if(s>0)i.value=i.value.slice(0,s-1)+i.value.slice(e);i.focus();});
  $('calcClear')?.addEventListener('click',()=>{$('calcExpression').value='';text('calcScientificResult','—');text('calcScientificSteps','Run a calculation to see the reasoning.');});
  $('calcClearHistory')?.addEventListener('click',()=>{history.length=0;renderHistory();});

  const gcd=(a,b)=>{a=Math.abs(Math.trunc(a));b=Math.abs(Math.trunc(b));while(b)[a,b]=[b,a%b];return a||1;};
  function fraction(){const a=num('fracA'),b=num('fracB'),c=num('fracC'),d=num('fracD'),op=$('fracOp').value;if(![a,b,c,d].every(Number.isInteger)||b===0||d===0){text('fracResult','Check values');text('fracSteps','Use whole-number numerators/denominators and non-zero denominators.');return;}let n,den,raw;if(op==='+'){n=a*d+c*b;den=b*d;raw=`(${a}×${d} + ${c}×${b}) / (${b}×${d})`;}else if(op==='-'){n=a*d-c*b;den=b*d;raw=`(${a}×${d} − ${c}×${b}) / (${b}×${d})`;}else if(op==='*'){n=a*c;den=b*d;raw=`(${a}×${c}) / (${b}×${d})`;}else{if(c===0){text('fracResult','Undefined');text('fracSteps','Cannot divide by a zero fraction.');return;}n=a*d;den=b*c;raw=`(${a}×${d}) / (${b}×${c})`;}if(den<0){n=-n;den=-den;}const g=gcd(n,den),sn=n/g,sd=den/g,ans=sd===1?String(sn):`${sn}/${sd}`;text('fracResult',ans);text('fracSteps',explainMode==='hinglish'?`Pehle fraction operation karo: ${raw} = ${n}/${den}. Phir numerator aur denominator ko ${g} se divide karke ${ans}.`:explainMode==='exam'?`${raw} = ${n}/${den}\nHCF = ${g}\n∴ ${ans}`:`${raw} = ${n}/${den}. Divide numerator and denominator by their HCF ${g} → ${ans}.`);}
  bindRun('fracCalculate',fraction);

  function linear(){const a=num('linA'),b=num('linB'),c=num('linC');if(!finite(a)||!finite(b)||!finite(c)||Math.abs(a)<EPS){text('linearResult','a must be non-zero');text('linearSteps','A linear equation needs a non-zero x coefficient.');return;}const rhs=c-b,x=rhs/a;text('linearResult',`x = ${fmt(x)}`);if(explainMode==='hinglish')text('linearSteps',`${a}x + ${b} = ${c}\nDono side se ${b} minus karo → ${a}x = ${fmt(rhs)}.\nAb ${a} se divide karo → x = ${fmt(x)}.`);else if(explainMode==='exam')text('linearSteps',`${a}x + ${b} = ${c}\n${a}x = ${c} − ${b} = ${fmt(rhs)}\nx = ${fmt(rhs)}/${fmt(a)}\n∴ x = ${fmt(x)}`);else text('linearSteps',`Subtract ${b} from both sides to isolate the x-term: ${a}x = ${fmt(rhs)}.\nDivide both sides by ${a}: x = ${fmt(x)}.\nWhy: doing the same operation to both sides preserves the equation.`);}
  function quadratic(){const a=num('quadA'),b=num('quadB'),c=num('quadC');if(!finite(a)||!finite(b)||!finite(c)||Math.abs(a)<EPS){text('quadResult','a must be non-zero');text('quadSteps','Use the linear solver if a = 0.');return;}const d=b*b-4*a*c;if(d<0){const real=-b/(2*a),imag=Math.sqrt(-d)/(2*Math.abs(a));text('quadResult',`x = ${fmt(real)} ± ${fmt(imag)}i`);text('quadSteps',explainMode==='hinglish'?`Discriminant b²−4ac = ${fmt(d)} negative hai, isliye real roots nahi hain; complex roots milte hain.`:`Discriminant b²−4ac = ${fmt(d)}. A negative discriminant gives two complex-conjugate roots.`);return;}const s=Math.sqrt(d),x1=(-b+s)/(2*a),x2=(-b-s)/(2*a);text('quadResult',Math.abs(d)<EPS?`x = ${fmt(x1)}`:`x₁ = ${fmt(x1)}, x₂ = ${fmt(x2)}`);const base=`D = b² − 4ac = ${fmt(d)}. x = (−b ± √D) / 2a.`;text('quadSteps',explainMode==='hinglish'?`${base}\nD ki value formula me daalo aur dono ± cases solve karo.`:explainMode==='exam'?`${base}\n∴ ${Math.abs(d)<EPS?`x = ${fmt(x1)}`:`x₁ = ${fmt(x1)}, x₂ = ${fmt(x2)}`}`:`${base}\nThe discriminant tells us how many real roots exist before substitution.`);}
  bindRun('linearBtn',linear);bindRun('quadBtn',quadratic);

  function stats(){const vals=$('statsInput').value.split(/[\s,]+/).filter(Boolean).map(Number);if(!vals.length||vals.some(v=>!finite(v))){$('statsResults').querySelectorAll('strong').forEach(c=>c.textContent='—');return;}const sorted=[...vals].sort((a,b)=>a-b),sum=vals.reduce((a,b)=>a+b,0),mean=sum/vals.length,mid=sorted.length>>1,median=sorted.length%2?sorted[mid]:(sorted[mid-1]+sorted[mid])/2;const counts=new Map();vals.forEach(v=>counts.set(v,(counts.get(v)||0)+1));let max=0,modes=[];counts.forEach((n,v)=>{if(n>max){max=n;modes=[v];}else if(n===max)modes.push(v);});const variance=vals.reduce((s,v)=>s+(v-mean)**2,0)/vals.length,std=Math.sqrt(variance);const out=[vals.length,fmt(mean),fmt(median),max===1?'No repeated mode':modes.map(v=>fmt(v)).join(', '),fmt(sorted.at(-1)-sorted[0]),fmt(std)];$('statsResults').querySelectorAll('strong').forEach((c,i)=>c.textContent=out[i]);}
  bindRun('statsBtn',stats);

  function functionValue(expr,x){return evaluate(implicitMultiply(expr),{x});}
  function derivative(){const expr=$('calcFunction').value.trim(),x=num('derivativeX');try{const p=parsePoly(expr);const dp=p.slice(1).map((v,i)=>v*(i+1));const value=dp.reduce((s,c,i)=>s+c*Math.pow(x,i),0),symbolic=polyToString(dp);text('calculusResult',`f′(${fmt(x)}) = ${fmt(value)}`);text('calculusSteps',`Polynomial derivative: f′(x) = ${symbolic}.\nSubstitute x = ${fmt(x)} → ${fmt(value)}.`);}catch(_){try{const h=Math.max(1e-5,Math.abs(x)*1e-5),v=(functionValue(expr,x+h)-functionValue(expr,x-h))/(2*h);text('calculusResult',`f′(${fmt(x)}) ≈ ${fmt(v)}`);text('calculusSteps','This expression was differentiated numerically using a central-difference estimate.');}catch(e){text('calculusResult','Check function');text('calculusSteps',e.message);}}}
  function integral(){const expr=$('calcFunction').value.trim(),a=num('integralA'),b=num('integralB');if(!finite(a)||!finite(b)){text('calculusResult','Check limits');return;}try{const n=800,h=(b-a)/n;let sum=functionValue(expr,a)+functionValue(expr,b);for(let i=1;i<n;i++)sum+=(i%2?4:2)*functionValue(expr,a+i*h);const v=sum*h/3;text('calculusResult',`∫ ≈ ${fmt(v)}`);text('calculusSteps',`Definite integral from ${fmt(a)} to ${fmt(b)} estimated with Simpson’s rule (${n} intervals).`);}catch(e){text('calculusResult','Check function');text('calculusSteps',e.message);}}
  bindRun('derivativeBtn',derivative);bindRun('integralBtn',integral);

  function comb(n,r,perm=false){n=Math.trunc(n);r=Math.trunc(r);if(n<0||r<0||r>n||n>170)return null;if(perm){let v=1;for(let i=0;i<r;i++)v*=n-i;return v;}r=Math.min(r,n-r);let v=1;for(let i=1;i<=r;i++)v=v*(n-r+i)/i;return v;}
  function probability(perm){const n=num('probN'),r=num('probR'),v=comb(n,r,perm);if(v===null||!finite(v)){text('probResult','Check n and r');text('probSteps','Use whole numbers with 0 ≤ r ≤ n ≤ 170.');return;}text('probResult',fmt(v));text('probSteps',perm?`nPr = n!/(n−r)! = ${fmt(v)}.`:`nCr = n!/[r!(n−r)!] = ${fmt(v)}.`);}
  bindRun('ncrBtn',()=>probability(false));bindRun('nprBtn',()=>probability(true));

  let learnSteps=[],learnIndex=-1;
  function renderLearn(){const total=learnSteps.length,shown=Math.max(0,learnIndex+1);text('learnCounter',`${shown} / ${total}`);$('learnProgressBar').style.width=total?`${shown/total*100}%`:'0%';$('learnPrev').disabled=learnIndex<=0;$('learnNext').disabled=!total||learnIndex>=total-1;if(learnIndex<0){$('learnCard').innerHTML='<span>Start a supported problem to reveal hints.</span>';return;}const s=learnSteps[learnIndex];$('learnCard').innerHTML=`<b>${esc(s.title)}</b><p>${esc(s.body)}</p>`;}
  function buildLearn(){const topic=$('learnTopic').value,raw=$('learnProblem').value.trim();learnSteps=[];learnIndex=-1;try{if(topic==='linear'){const p=equationPoly(raw);if(p.length!==2||Math.abs(p[1])<EPS)throw new Error('Enter a linear equation such as 2x + 7 = 19.');const c=p[0],a=p[1],x=-c/a;learnSteps=explainMode==='hinglish'?[{title:'Hint 1',body:'x wale terms ko ek side aur numbers ko doosri side rakhna hai.'},{title:'Hint 2',body:`Equation ko ${fmt(a)}x = ${fmt(-c)} ke form me lao.`},{title:'Why?',body:'Dono sides par same operation karne se equality valid rehti hai.'},{title:'Finish',body:`Ab ${fmt(a)} se divide karo → x = ${fmt(x)}.`}]:[{title:'Hint 1',body:'Isolate the term containing x by moving constant terms to the other side.'},{title:'Hint 2',body:`A simplified equivalent form is ${fmt(a)}x = ${fmt(-c)}.`},{title:'Why?',body:'Applying the same inverse operation to both sides preserves the solution set.'},{title:'Finish',body:`Divide by ${fmt(a)} → x = ${fmt(x)}.`}];}
      else if(topic==='quadratic'){const p=equationPoly(raw);if(p.length!==3)throw new Error('Enter a quadratic equation such as x^2 - 5x + 6 = 0.');const [c,b,a]=p,d=b*b-4*a*c;learnSteps=[{title:'Hint 1',body:`Identify a = ${fmt(a)}, b = ${fmt(b)}, c = ${fmt(c)}.`},{title:'Hint 2',body:`Compute D = b² − 4ac = ${fmt(d)}.`},{title:'Why?',body:d>0?'D > 0 means two real roots.':Math.abs(d)<EPS?'D = 0 means one repeated real root.':'D < 0 means the roots are complex.'},{title:'Finish',body:'Use x = (−b ± √D)/(2a) and simplify both ± cases.'}];}
      else {const m=raw.match(/(-?\d+(?:\.\d+)?)\s*%\s*(?:of)?\s*(-?\d+(?:\.\d+)?)/i);if(!m)throw new Error('Enter a percentage problem such as 18% of 2500.');const r=Number(m[1]),base=Number(m[2]),ans=r*base/100;learnSteps=[{title:'Hint 1',body:`Convert ${r}% to ${r}/100.`},{title:'Hint 2',body:`Multiply ${fmt(base)} × ${r}/100.`},{title:'Why?',body:'Percent means “per hundred”, so dividing by 100 converts the rate to a multiplier.'},{title:'Finish',body:`Answer = ${fmt(ans)}.`}];}
      learnIndex=0;renderLearn();
    }catch(e){learnSteps=[{title:'Supported input needed',body:e.message}];learnIndex=0;renderLearn();}}
  bindRun('learnStart',buildLearn,'RIVANI Calculator Learn Mode');
  $('learnNext')?.addEventListener('click',()=>{if(learnIndex<learnSteps.length-1){learnIndex++;renderLearn();}});$('learnPrev')?.addEventListener('click',()=>{if(learnIndex>0){learnIndex--;renderLearn();}});

  function checkMySteps(){const original=$('checkOriginal').value.trim(),lines=$('checkSteps').value.split(/\n+/).map(s=>s.trim()).filter(Boolean);const report=$('checkReport');report.innerHTML='';if(!lines.length){text('checkHeadline','Add your steps');report.innerHTML='<div class="step-empty">Enter one equation per line.</div>';return;}let base;try{base=equationPoly(original);if(base.length>3)throw new Error('Check My Steps currently supports linear and quadratic equations only.');}catch(e){text('checkHeadline','Original equation not supported');report.innerHTML=`<div class="step-report-item bad"><b>Could not read original</b><span>${esc(e.message)}</span></div>`;return;}let firstBad=-1;for(let i=0;i<lines.length;i++){if(firstBad>=0){report.insertAdjacentHTML('beforeend',`<div class="step-report-item"><b>Step ${i+1} · Not checked</b><span>${esc(lines[i])}</span></div>`);continue;}try{const p=equationPoly(lines[i]);if(p.length>3)throw new Error('This step goes beyond quadratic form.');if(proportional(base,p)){report.insertAdjacentHTML('beforeend',`<div class="step-report-item ok"><b>Step ${i+1} ✓ Equivalent</b><span>${esc(lines[i])}</span></div>`);}else{firstBad=i;report.insertAdjacentHTML('beforeend',`<div class="step-report-item bad"><b>Step ${i+1} ✕ First mismatch</b><span>${esc(lines[i])}</span></div>`);text('checkHeadline',`First issue: Step ${i+1}`);text('checkAdvice',`The original keeps ${rootsLabel(base)}, but Step ${i+1} changes the solution set to ${rootsLabel(p)}. Recheck the arithmetic or operation between the previous line and this line.`);}}
      catch(e){firstBad=i;report.insertAdjacentHTML('beforeend',`<div class="step-report-item bad"><b>Step ${i+1} · Unsupported / invalid</b><span>${esc(e.message)}</span></div>`);text('checkHeadline',`Could not verify Step ${i+1}`);text('checkAdvice','Rewrite that line as a standard equation using numbers, x, parentheses and basic operators.');}}
    if(firstBad<0){text('checkHeadline','All entered steps preserve the solution ✓');text('checkAdvice',`Your entered equations stay equivalent to the original (${rootsLabel(base)}). This checks algebraic equivalence, not presentation quality.`);}}
  bindRun('checkStepsBtn',checkMySteps,'RIVANI Check My Steps');

  function drawGraph(){const expr=$('graphExpression').value.trim(),xmin=num('graphMin'),xmax=num('graphMax'),canvas=$('graphCanvas'),ctx=canvas.getContext('2d');if(!finite(xmin)||!finite(xmax)||xmin>=xmax){text('graphRoots','Check range');return;}const samples=[];let ymin=Infinity,ymax=-Infinity;try{for(let i=0;i<=500;i++){const x=xmin+(xmax-xmin)*i/500,y=functionValue(expr,x);if(finite(y)&&Math.abs(y)<1e8){samples.push({x,y});ymin=Math.min(ymin,y);ymax=Math.max(ymax,y);}else samples.push({x,y:null});}}catch(e){text('graphRoots','Check function');text('graphSummary',e.message);return;}if(!finite(ymin)||!finite(ymax)){text('graphRoots','No plottable values');return;}if(Math.abs(ymax-ymin)<EPS){ymin-=1;ymax+=1;}const pad=(ymax-ymin)*.08;ymin-=pad;ymax+=pad;const W=canvas.width,H=canvas.height,X=x=>(x-xmin)/(xmax-xmin)*W,Y=y=>H-(y-ymin)/(ymax-ymin)*H;ctx.clearRect(0,0,W,H);ctx.fillStyle='rgba(3,8,22,.96)';ctx.fillRect(0,0,W,H);ctx.strokeStyle='rgba(132,159,220,.18)';ctx.lineWidth=1;for(let i=0;i<=10;i++){const x=i*W/10;ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,H);ctx.stroke();}for(let i=0;i<=8;i++){const y=i*H/8;ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(W,y);ctx.stroke();}ctx.strokeStyle='rgba(210,224,255,.52)';ctx.lineWidth=1.5;if(xmin<=0&&xmax>=0){ctx.beginPath();ctx.moveTo(X(0),0);ctx.lineTo(X(0),H);ctx.stroke();}if(ymin<=0&&ymax>=0){ctx.beginPath();ctx.moveTo(0,Y(0));ctx.lineTo(W,Y(0));ctx.stroke();}ctx.strokeStyle='rgba(84,231,255,.95)';ctx.lineWidth=3;ctx.beginPath();let started=false;samples.forEach(p=>{if(p.y===null){started=false;return;}const xx=X(p.x),yy=Y(p.y);if(!started){ctx.moveTo(xx,yy);started=true;}else ctx.lineTo(xx,yy);});ctx.stroke();
    const roots=[];let prev=null;for(const p of samples){if(p.y===null){prev=null;continue;}if(Math.abs(p.y)<1e-5)roots.push(p.x);if(prev&&prev.y*p.y<0){let lo=prev.x,hi=p.x,flo=prev.y;for(let k=0;k<35;k++){const mid=(lo+hi)/2,fm=functionValue(expr,mid);if(flo*fm<=0)hi=mid;else{lo=mid;flo=fm;}}roots.push((lo+hi)/2);}prev=p;}const unique=[];roots.forEach(r=>{if(!unique.some(u=>Math.abs(u-r)<(xmax-xmin)/500))unique.push(r);});text('graphRoots',unique.length?unique.slice(0,8).map(r=>fmt(r,5)).join(', '):'No roots detected in range');text('graphSummary',`x range ${fmt(xmin)} to ${fmt(xmax)} · y range approx ${fmt(ymin,4)} to ${fmt(ymax,4)}.`);const tbody=$('graphTable');tbody.innerHTML='';for(let i=0;i<9;i++){const x=xmin+(xmax-xmin)*i/8;let y;try{y=functionValue(expr,x);}catch(_){y=NaN;}tbody.insertAdjacentHTML('beforeend',`<tr><td>${esc(fmt(x,5))}</td><td>${finite(y)?esc(fmt(y,6)):'—'}</td></tr>`);}}
  bindRun('graphBtn',drawGraph,'RIVANI Calculator Graph');

  const units={
    m:{dim:'L',factor:1,label:'m'},cm:{dim:'L',factor:.01,label:'cm'},km:{dim:'L',factor:1000,label:'km'},
    s:{dim:'T',factor:1,label:'s'},min:{dim:'T',factor:60,label:'min'},h:{dim:'T',factor:3600,label:'h'},
    kg:{dim:'M',factor:1,label:'kg'},g:{dim:'M',factor:.001,label:'g'},N:{dim:'MLT-2',factor:1,label:'N'}
  };
  function unitGuard(){const av=num('unitAValue'),bv=num('unitBValue'),au=units[$('unitA').value],bu=units[$('unitB').value],op=$('unitOp').value;if(!finite(av)||!finite(bv)){text('unitGuardResult','Check values');return;}const aSI=av*au.factor,bSI=bv*bu.factor;if(op==='+'||op==='-'){if(au.dim!==bu.dim){text('unitGuardResult','⚠ Unit mismatch');text('unitGuardSteps',`${au.label} measures ${au.dim}, while ${bu.label} measures ${bu.dim}. Unlike dimensions cannot be ${op==='+'?'added':'subtracted'}.`);return;}const resultSI=op==='+'?aSI+bSI:aSI-bSI,result=resultSI/au.factor;text('unitGuardResult',`${fmt(result)} ${au.label}`);text('unitGuardSteps',`${fmt(av)} ${au.label} ${op} ${fmt(bv)} ${bu.label} = ${fmt(result)} ${au.label}. SI value: ${fmt(resultSI)} in the base unit.`);return;}if(op==='/'&&Math.abs(bSI)<EPS){text('unitGuardResult','Undefined');text('unitGuardSteps','Cannot divide by zero.');return;}const result=op==='*'?aSI*bSI:aSI/bSI;let label=`SI (${au.dim}${op==='*'?'·':'/'}${bu.dim})`;if(op==='/'&&au.dim==='L'&&bu.dim==='T')label='m/s';else if(op==='*'&&au.dim==='M'&&bu.dim==='L')label='kg·m';text('unitGuardResult',`${fmt(result)} ${label}`);text('unitGuardSteps',`Converted to SI first: ${fmt(aSI)} ${au.dim} ${op} ${fmt(bSI)} ${bu.dim}.`);}
  bindRun('unitGuardBtn',unitGuard,'RIVANI Unit Guard');

  const convUnits={length:{m:1,km:1000,cm:.01,mm:.001,in:.0254,ft:.3048,yd:.9144,mi:1609.344},weight:{kg:1,g:.001,mg:.000001,lb:.45359237,oz:.028349523125},data:{B:1,KB:1024,MB:1048576,GB:1073741824,TB:1099511627776}};
  const labels={m:'Metres',km:'Kilometres',cm:'Centimetres',mm:'Millimetres',in:'Inches',ft:'Feet',yd:'Yards',mi:'Miles',kg:'Kilograms',g:'Grams',mg:'Milligrams',lb:'Pounds',oz:'Ounces',B:'Bytes',KB:'KB',MB:'MB',GB:'GB',TB:'TB',C:'Celsius',F:'Fahrenheit',K:'Kelvin'};
  function renderUnits(){const c=$('convCategory').value,keys=c==='temperature'?['C','F','K']:Object.keys(convUnits[c]);const html=keys.map(k=>`<option value="${k}">${labels[k]}</option>`).join('');$('convFrom').innerHTML=html;$('convTo').innerHTML=html;$('convTo').selectedIndex=Math.min(1,keys.length-1);}
  $('convCategory')?.addEventListener('change',renderUnits);renderUnits();
  function convert(){const cat=$('convCategory').value,v=num('convValue'),from=$('convFrom').value,to=$('convTo').value;if(!finite(v)){text('convResult','Check value');return;}let out;if(cat==='temperature'){const c=from==='C'?v:from==='F'?(v-32)*5/9:v-273.15;out=to==='C'?c:to==='F'?c*9/5+32:c+273.15;}else out=v*convUnits[cat][from]/convUnits[cat][to];text('convResult',`${fmt(out)} ${to}`);text('convSteps',`${fmt(v)} ${from} = ${fmt(out)} ${to}.`);}
  bindRun('convBtn',convert);

  function matrixDet(){const a=num('m11'),b=num('m12'),c=num('m21'),d=num('m22'),det=a*d-b*c;text('matrixResult',`det = ${fmt(det)}`);text('matrixSteps',`det = ad − bc = (${fmt(a)}×${fmt(d)}) − (${fmt(b)}×${fmt(c)}) = ${fmt(det)}.`);}
  function matrixInv(){const a=num('m11'),b=num('m12'),c=num('m21'),d=num('m22'),det=a*d-b*c;if(Math.abs(det)<EPS){text('matrixResult','No inverse');text('matrixSteps','Determinant is 0, so this matrix is singular.');return;}const inv=[d/det,-b/det,-c/det,a/det];text('matrixResult',`[ ${fmt(inv[0],5)}  ${fmt(inv[1],5)} ; ${fmt(inv[2],5)}  ${fmt(inv[3],5)} ]`);text('matrixSteps',`A⁻¹ = (1/det)[d −b; −c a], with det = ${fmt(det)}.`);}
  bindRun('matrixDetBtn',matrixDet);bindRun('matrixInvBtn',matrixInv);
  function vectors(){const A=[num('va1'),num('va2'),num('va3')],B=[num('vb1'),num('vb2'),num('vb3')];if([...A,...B].some(v=>!finite(v))){text('vectorResult','Check values');return;}const ma=Math.hypot(...A),mb=Math.hypot(...B),dot=A.reduce((s,v,i)=>s+v*B[i],0);text('vectorResult',`|A|=${fmt(ma)} · |B|=${fmt(mb)} · A·B=${fmt(dot)}`);text('vectorSteps',`Magnitude uses √(x²+y²+z²). Dot product uses a₁b₁+a₂b₂+a₃b₃.`);}
  bindRun('vectorBtn',vectors);
  function sigfig(){const raw=$('sigValue').value.trim(),v=Number(raw),n=Math.trunc(num('sigCount'));if(!finite(v)||n<1||n>12){text('sigResult','Check values');return;}if(v===0){text('sigResult','0');text('sigSteps',`${n} significant figures requested. Zero remains zero.`);return;}const rounded=Number(v.toPrecision(n));text('sigResult',String(rounded));text('sigSteps',`${raw} rounded to ${n} significant figures = ${rounded}. Scientific notation: ${rounded.toExponential(n-1)}.`);}
  bindRun('sigBtn',sigfig);

  function pctOf(){const r=num('pctRate'),b=num('pctBase');text('pctOfResult',finite(r)&&finite(b)?`${fmt(r*b/100)} (${fmt(r)}% of ${fmt(b)})`:'Check values');}
  function pctChange(){const o=num('pctOld'),n=num('pctNew');if(!finite(o)||!finite(n)||Math.abs(o)<EPS){text('pctChangeResult','Old value must be non-zero');return;}const p=(n-o)/Math.abs(o)*100;text('pctChangeResult',`${fmt(Math.abs(p),4)}% ${p>=0?'increase':'decrease'}`);}
  function discount(){const p=num('discountPrice'),r=num('discountRate');if(!finite(p)||!finite(r)){text('discountResult','Check values');return;}const save=p*r/100;text('discountResult',`${fmt(p-save)} final · save ${fmt(save)}`);}
  bindRun('pctOfBtn',pctOf);bindRun('pctChangeBtn',pctChange);bindRun('discountBtn',discount);

  const geoConfig={circle:[['radius','Radius',5]],rectangle:[['length','Length',8],['width','Width',5]],triangle:[['base','Base',10],['height','Height',6]]};
  function renderGeo(){const shape=$('geoShape').value;$('geoInputs').innerHTML=geoConfig[shape].map(([id,label,val])=>`<label><span>${label}</span><input id="geo_${id}" type="number" value="${val}" min="0" step="any"/></label>`).join('');}
  $('geoShape')?.addEventListener('change',renderGeo);renderGeo();
  function geometry(){const s=$('geoShape').value;if(s==='circle'){const r=num('geo_radius');if(!(r>=0)){text('geoResult','Check radius');return;}text('geoResult',`Area ${fmt(Math.PI*r*r)} · Circumference ${fmt(2*Math.PI*r)}`);text('geoSteps','Area = πr² · Circumference = 2πr.');}else if(s==='rectangle'){const l=num('geo_length'),w=num('geo_width');if(!(l>=0&&w>=0)){text('geoResult','Check dimensions');return;}text('geoResult',`Area ${fmt(l*w)} · Perimeter ${fmt(2*(l+w))}`);text('geoSteps','Area = length × width · Perimeter = 2(length + width).');}else{const b=num('geo_base'),h=num('geo_height');if(!(b>=0&&h>=0)){text('geoResult','Check dimensions');return;}text('geoResult',`Area ${fmt(b*h/2)}`);text('geoSteps','Triangle area = ½ × base × height.');}}
  bindRun('geoBtn',geometry);
  function emi(){const p=num('emiPrincipal'),annual=num('emiRate'),n=Math.round(num('emiMonths'));if(!(p>=0)||!(annual>=0)||!(n>0)){text('emiResult','Check values');return;}const r=annual/1200,emi=r===0?p/n:p*r*(1+r)**n/((1+r)**n-1),total=emi*n;text('emiResult',`${fmt(emi,2)} / month`);text('emiSteps',`Estimated total payment ${fmt(total,2)} · estimated interest ${fmt(total-p,2)}.`);}
  function ci(){const p=num('ciPrincipal'),r=num('ciRate'),y=num('ciYears');if(!(p>=0)||!(r>=0)||!(y>=0)){text('ciResult','Check values');return;}const amount=p*(1+r/100)**y;text('ciResult',`${fmt(amount,2)} final amount`);text('ciSteps',`A = P(1 + r)ᵗ → interest earned ${fmt(amount-p,2)}.`);}
  bindRun('emiBtn',emi);bindRun('ciBtn',ci);

  renderHistory();renderLearn();
})();
