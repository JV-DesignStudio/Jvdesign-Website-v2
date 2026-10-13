/* -- Course step navigation -- */
function setStep(step) {
  document.querySelectorAll('.step-panel').forEach(p => p.classList.toggle('active', +p.dataset.step === step));
  document.querySelectorAll('.step-btn').forEach((b,i) => b.classList.toggle('active', i === step));
}
document.querySelectorAll('.step-btn').forEach((btn,i) => btn.addEventListener('click', () => setStep(i)));
document.querySelectorAll('.btn-step-next').forEach(btn => {
  btn.addEventListener('click', () => { if(btn.dataset.next !== undefined) setStep(+btn.dataset.next); });
});
document.querySelectorAll('.btn-step-prev').forEach(btn => {
  btn.addEventListener('click', () => { if(btn.dataset.prev !== undefined) setStep(+btn.dataset.prev); });
});

/* -- Scroll reveal -- */
const obs = new IntersectionObserver(entries => {
  entries.forEach(e => {
    if(e.isIntersecting){
      const sibs = [...e.target.parentElement.querySelectorAll('.reveal')];
      setTimeout(() => e.target.classList.add('visible'), Math.min(sibs.indexOf(e.target)*80, 240));
      obs.unobserve(e.target);
    }
  });
},{threshold:0.07});
document.querySelectorAll('.reveal').forEach(el => obs.observe(el));

/* -- QUIZ & PROGRESS SYSTEM -- */
const STORAGE_KEY='jvds-space-invaders-v2';
const TOTAL_STEPS=11;
let xp=0,level=1,streak=0,bestStreak=0,totalQuizzes=0,correctFirst=0;
const XP_PER_LEVEL=100,XP_QUIZ=15,XP_STREAK_BONUS=5;
let completedSteps=new Set();

function saveProgress(){
  try{
    localStorage.setItem(STORAGE_KEY,JSON.stringify({completed:[...completedSteps],total:TOTAL_STEPS,
      completedSteps:[...completedSteps],xp,level,streak,bestStreak,totalQuizzes,correctFirst,
      quizzesPassed:[...document.querySelectorAll('.quiz-gate.passed')].map(q=>q.id)
    }));
  }catch(e){}
}

function loadProgress(){
  try{
    const data=JSON.parse(localStorage.getItem(STORAGE_KEY)||'null');
    if(!data)return;
    if(data.xp){xp=data.xp;level=data.level||1;streak=data.streak||0;bestStreak=data.bestStreak||0;totalQuizzes=data.totalQuizzes||0;correctFirst=data.correctFirst||0;}
    if(data.completedSteps)data.completedSteps.forEach(s=>completedSteps.add(s));
    if(data.quizzesPassed)data.quizzesPassed.forEach(id=>{
      const q=document.getElementById(id);
      if(q){q.classList.add('passed');const nb=q.querySelector('.quiz-next-btn');if(nb)nb.classList.add('show');const sb=q.querySelector('.quiz-submit');if(sb)sb.style.display='none';q.querySelectorAll('.quiz-opt').forEach(o=>o.classList.add('disabled'));}
    });
  }catch(e){}
}

function selectQuizOpt(el){
  const gate=el.closest('.quiz-gate');
  if(!gate||gate.classList.contains('passed'))return;
  gate.querySelectorAll('.quiz-opt').forEach(o=>o.classList.remove('selected'));
  el.classList.add('selected');
  const sb=gate.querySelector('.quiz-submit');
  if(sb)sb.classList.add('show');
}

function checkQuiz(btn){
  const gate=btn.closest('.quiz-gate');
  const selected=gate.querySelector('.quiz-opt.selected');
  if(!selected)return;
  const correct=parseInt(gate.dataset.correct);
  const chosen=parseInt(selected.dataset.idx);
  const fb=gate.querySelector('.quiz-feedback');
  totalQuizzes++;
  if(chosen===correct){
    selected.classList.add('correct');
    fb.className='quiz-feedback correct show';
    fb.innerHTML='<span class="fb-icon">&#10003;</span> Correct! Well done.';
    gate.classList.add('passed');
    btn.style.display='none';
    gate.querySelector('.quiz-next-btn').classList.add('show');
    gate.querySelectorAll('.quiz-opt').forEach(o=>{if(!o.classList.contains('correct'))o.classList.add('disabled');});
    streak++;if(streak>bestStreak)bestStreak=streak;
    correctFirst++;
    xp+=XP_QUIZ+(streak>=3?XP_STREAK_BONUS:0);
    level=Math.floor(xp/XP_PER_LEVEL)+1;
  }else{
    selected.classList.add('wrong');
    fb.className='quiz-feedback wrong show';
    fb.innerHTML='<span class="fb-icon">&#10007;</span> Not quite, try again!';
    streak=0;
    setTimeout(()=>{selected.classList.remove('wrong','selected');fb.classList.remove('show');},1500);
  }
  saveProgress();
}

function completeStep(nextStep){
  if(nextStep>=0&&nextStep<TOTAL_STEPS)setStep(nextStep);
  saveProgress();
}

loadProgress();
