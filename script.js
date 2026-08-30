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

// LUKI — intentionally limited to RIVANI AI tool/help questions.
const lukiLauncher = document.getElementById('lukiLauncher');
const lukiPanel = document.getElementById('lukiPanel');
const lukiClose = document.getElementById('lukiClose');
const lukiForm = document.getElementById('lukiForm');
const lukiInput = document.getElementById('lukiInput');
const lukiMessages = document.getElementById('lukiMessages');
const lukiQuick = document.getElementById('lukiQuick');

const lukiTools = {
  audio: 'AI Audio Repair is RIVANI AI’s flagship tool. It is planned to clean recording problems such as background noise, echo, clicks and uneven voice quality, with a simple before/after workflow.',
  image: 'Image Enhancer is planned to improve image clarity and resolution. It is listed as a planned RIVANI AI tool, so detailed controls will be added as that tool is built.',
  background: 'Background Remover is planned to isolate the main subject and remove an image background quickly. It is currently listed as a planned tool.',
  subtitle: 'Video Subtitle Generator is planned to create captions/subtitles for video. It is currently listed as a planned RIVANI AI tool.',
  pdf: 'PDF Assistant is planned for document-focused tasks. Its exact V1 features will be defined before release, so LUKI will not invent capabilities that are not on the site yet.',
  text: 'Text Tools are planned for common tasks such as rewriting, cleaning, translating and formatting text. They are not marked live yet.'
};

function lukiAddMessage(text, who = 'bot') {
  if (!lukiMessages) return;
  const row = document.createElement('div');
  row.className = `luki-message ${who}`;
  const bubble = document.createElement('div');
  bubble.className = 'luki-bubble';
  bubble.textContent = text;
  row.appendChild(bubble);
  lukiMessages.appendChild(row);
  lukiMessages.scrollTop = lukiMessages.scrollHeight;
}

function lukiReply(rawQuestion) {
  const q = rawQuestion.toLowerCase().trim();
  if (!q) return 'Ask me about any RIVANI AI tool.';

  if (/(audio|voice|noise|echo|recording|sound|podcast)/.test(q)) return lukiTools.audio;
  if (/(background|remove bg|cutout)/.test(q)) return lukiTools.background;
  if (/(image|photo|picture|upscale|enhance photo)/.test(q)) return lukiTools.image;
  if (/(subtitle|caption|video)/.test(q)) return lukiTools.subtitle;
  if (/(pdf|document|doc)/.test(q)) return lukiTools.pdf;
  if (/(text|rewrite|translate|grammar|writing)/.test(q)) return lukiTools.text;
  if (/(all tool|which tool|tools available|what tools|tool list)/.test(q)) {
    return 'RIVANI AI currently showcases AI Audio Repair, Image Enhancer, Background Remover, Video Subtitle Generator, PDF Assistant and Text Tools. Audio Repair is the flagship focus; the others are currently shown as planned.';
  }
  if (/(privacy|file|upload|data|secure|security)/.test(q)) {
    return 'RIVANI AI has a Trust & Policies area for privacy, terms, acceptable use and file-handling information. The production policy will state clearly whether each tool processes files locally or uploads them. I will not claim a file stays on-device unless that specific tool is built that way.';
  }
  if (/(free|price|pricing|paid|cost)/.test(q)) {
    return 'The current RIVANI AI website does not make a final pricing promise. Pricing or limits should be checked on the site once a pricing plan is published.';
  }
  if (/(live|available|coming|planned|ready)/.test(q)) {
    return 'The site currently presents AI Audio Repair as the flagship focus, while several other tools are marked Planned. Check each tool card for its current status.';
  }
  if (/(rivani|about|platform|website)/.test(q)) {
    return 'RIVANI AI is a platform for focused AI utilities across audio, image, video, PDF and text. The goal is to make each tool simple, transparent and useful.';
  }

  return 'I’m LUKI, the RIVANI AI tool guide. I only answer questions about RIVANI AI tools, features, availability and file-handling. Try asking “What does Audio Repair do?” or “Which tools are available?”';
}

function openLuki() {
  if (!lukiPanel || !lukiLauncher) return;
  lukiPanel.classList.add('open');
  lukiPanel.setAttribute('aria-hidden', 'false');
  lukiLauncher.setAttribute('aria-expanded', 'true');
  setTimeout(() => lukiInput?.focus(), 120);
}
function closeLuki() {
  if (!lukiPanel || !lukiLauncher) return;
  lukiPanel.classList.remove('open');
  lukiPanel.setAttribute('aria-hidden', 'true');
  lukiLauncher.setAttribute('aria-expanded', 'false');
}

lukiLauncher?.addEventListener('click', () => lukiPanel?.classList.contains('open') ? closeLuki() : openLuki());
lukiClose?.addEventListener('click', closeLuki);
lukiForm?.addEventListener('submit', (event) => {
  event.preventDefault();
  const question = lukiInput.value.trim();
  if (!question) return;
  lukiAddMessage(question, 'user');
  lukiInput.value = '';
  const reply = lukiReply(question);
  setTimeout(() => lukiAddMessage(reply, 'bot'), 180);
});
lukiQuick?.addEventListener('click', (event) => {
  const button = event.target.closest('button[data-question]');
  if (!button) return;
  openLuki();
  const question = button.dataset.question;
  lukiAddMessage(question, 'user');
  setTimeout(() => lukiAddMessage(lukiReply(question), 'bot'), 160);
});
document.addEventListener('keydown', (event) => { if (event.key === 'Escape') closeLuki(); });
