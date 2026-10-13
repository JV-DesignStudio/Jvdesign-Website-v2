// A605 untimed crown quiz - remove 20s timer
startGame = function(){state.qIdx=0;state.answers=[];state.view="game";state._scored=false;state.streak=0;state.bestStreak=0;state._timer=0;prepQ();};
prepQ = function(){const q=state.quizData.questions[state.qIdx];state.options=shuffle([{text:q.correct,isCorrect:true},{text:q.wrong1,isCorrect:false},{text:q.wrong2,isCorrect:false},{text:q.wrong3,isCorrect:false}]);state.selected=null;state.revealed=false;state._timer=0;render();};
timeUp = function(){};
window.__quizTest = { getState: ()=>state, getCorrect: ()=>state.quizData ? state.quizData.questions[state.qIdx].correct : null, getScore: ()=>state.answers.filter(a=>a.isCorrect).length };
(function(){ try{ if(new URLSearchParams(location.search).has("q")){ history.replaceState(null,"",location.pathname); state.view="setup"; state.quizData=null; render(); } }catch(e){} })();
