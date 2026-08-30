const mobileMenuBtn = document.getElementById('mobileMenuBtn');
const mainNav = document.getElementById('mainNav');
mobileMenuBtn?.addEventListener('click', () => {
  const open = mainNav.classList.toggle('open');
  mobileMenuBtn.setAttribute('aria-expanded', String(open));
});
document.querySelectorAll('.main-nav a').forEach(a=>a.addEventListener('click',()=>mainNav.classList.remove('open')));

document.getElementById('year').textContent = new Date().getFullYear();

const reveals = document.querySelectorAll('.reveal');
const observer = new IntersectionObserver(entries => {
  entries.forEach(entry => { if (entry.isIntersecting) entry.target.classList.add('visible'); });
}, { threshold: .12 });
reveals.forEach(el => observer.observe(el));

const slides = [...document.querySelectorAll('.spotlight-slide')];
const dotsWrap = document.getElementById('sliderDots');
let currentSlide = 0;
let slideTimer;

slides.forEach((_, i) => {
  const dot = document.createElement('button');
  dot.setAttribute('aria-label', `Show tool ${i + 1}`);
  dot.addEventListener('click', () => showSlide(i));
  dotsWrap.appendChild(dot);
});
const dots = [...dotsWrap.children];

function showSlide(index){
  currentSlide = (index + slides.length) % slides.length;
  slides.forEach((s,i)=>s.classList.toggle('active',i===currentSlide));
  dots.forEach((d,i)=>d.classList.toggle('active',i===currentSlide));
  restartTimer();
}
function restartTimer(){
  clearInterval(slideTimer);
  slideTimer = setInterval(()=>showSlide(currentSlide+1), 4800);
}
document.getElementById('prevSlide').addEventListener('click',()=>showSlide(currentSlide-1));
document.getElementById('nextSlide').addEventListener('click',()=>showSlide(currentSlide+1));
showSlide(0);

const navLinks = [...document.querySelectorAll('.main-nav a')];
const sections = [...document.querySelectorAll('main section[id]')];
window.addEventListener('scroll', () => {
  const y = window.scrollY + 130;
  let active = 'home';
  sections.forEach(section => { if (section.offsetTop <= y) active = section.id; });
  navLinks.forEach(link => link.classList.toggle('active', link.getAttribute('href') === `#${active}`));
}, {passive:true});
