const $=(selector)=>document.querySelector(selector);
const els={home:$('#home'),game:$('#game'),results:$('#results'),leaderboard:$('#leaderboard'),btc:$('#btc')};
const state={mode:'home',run:null,startedAt:0,events:[],tapIndex:0,combo:0,scorePreview:0,quizAnswered:false,clutchHit:false,tick:null,refreshTimer:null,lastBoard:null,busy:false};
const API='https://sjwyrtgyuwqhhkpcsbuj.supabase.co/functions/v1/glitch-raid-live';
const digits=(n)=>Math.max(0,Number(n)||0).toLocaleString('vi-VN');
const escapeText=(s)=>String(s).replace(/[&<>"']/g,(c)=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const navigate=(view)=>{if(!els[view])view='home';state.mode=view;Object.entries(els).forEach(([key,node])=>node.hidden=key!==view);document.querySelectorAll('.nav-links a').forEach(a=>a.setAttribute('aria-current',a.hash==='#'+view?'page':'false'));if(view==='leaderboard'||view==='btc')void fetchBoard();window.scrollTo({top:0,behavior:'instant'});};
const notice=(message)=>{const t=$('#toast');t.textContent=message;t.classList.add('visible');clearTimeout(notice.timer);notice.timer=setTimeout(()=>t.classList.remove('visible'),4500)};
const elapsed=()=>Math.max(0,Math.floor(performance.now()-state.startedAt));
const seededChoice=(seed,index)=>{let x=(seed^(Math.imul(index,0x9e3779b9)))>>>0;x^=x<<13;x^=x>>>17;x^=x<<5;return(x>>>0)%3};
const targetMs=(seed)=>28000+(seed%7000);

async function fetchBoard(){
 try{
  const response=await fetch(API+'?action=leaderboard',{cache:'no-store'});
  if(!response.ok)throw new Error('Không kết nối được bảng xếp hạng');
  const data=await response.json();state.lastBoard=data;updateBoard(data);$('#online-status').innerHTML='<span class="dot"></span> LIVE EVENT';
 }catch(e){$('#online-status').textContent='● CHƯA KẾT NỐI';if(state.mode==='leaderboard'&&!state.lastBoard)$('#leaderboard-body').innerHTML='<tr><td colspan="5" class="empty">Bảng xếp hạng chưa kết nối với máy chủ.</td></tr>'}
}
function updateBoard(data){
 for(const p of ['home','btc']){
  $('#'+p+'-hp').textContent=data.bossHP+'%';
  $('#'+p+'-meter').style.width=data.bossHP+'%';
  $('#'+p+'-dmg').textContent=digits(data.totalDamage);
  $('#'+p+'-players').textContent=digits(data.players);
 }
 $('#lb-updated').textContent=(data.eventStatus==='closed'?'ĐÃ CHỐT ĐIỂM · ':'ĐANG NHẬN ĐIỂM · ')+new Date().toLocaleTimeString('vi-VN');
 const rows=data.leaders||[];
 const body=$('#leaderboard-body');body.innerHTML=rows.length?rows.map(x=>`<tr><td class="rank-badge">#${x.rank}</td><td>@${escapeText(x.nickname)}</td><td>${x.device==='mobile'?'📱 MOBILE':'⌨ PC / BTC'}</td><td>${digits(x.damage)}</td><td><b>${digits(x.score)}</b></td></tr>`).join(''):'<tr><td colspan="5" class="empty">Chưa có kết quả hợp lệ. Hãy trở thành đặc vụ đầu tiên!</td></tr>';
 $('#btc-top-list').innerHTML=rows.length?rows.slice(0,5).map(x=>`<li>#${x.rank} @${escapeText(x.nickname)} <span>${digits(x.score)} PTS</span></li>`).join(''):'<li>Chưa có người chơi.</li>';
}

async function beginGame(ev){
 ev.preventDefault();if(state.busy)return;
 const nickname=$('#codename').value.trim();
 if(!/^[\p{L}\p{N}_ .-]{2,16}$/u.test(nickname)){notice('Nickname phải từ 2–16 ký tự hợp lệ.');return;}
 state.busy=true;const btn=$('#join-form button[type=submit]');btn.disabled=true;btn.textContent='ĐANG MỞ PHIÊN...';
 try{
  const response=await fetch(API,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'start',nickname,device:/Mobi|Android|iPhone/i.test(navigator.userAgent)?'mobile':'pc'})});
  const result=await response.json();if(!response.ok)throw new Error(result.error||'Máy chủ không phản hồi');
  state.run={...result,nickname};state.startedAt=performance.now();state.events=[];state.tapIndex=0;state.combo=0;state.scorePreview=0;state.quizAnswered=false;state.clutchHit=false;state.step=-1;
  $('#game-player').textContent='@'+nickname;$('#game-score').textContent='0';$('#game-combo').textContent='0';
  window.location.hash='game';navigate('game');gameTick();state.tick=setInterval(gameTick,60);
 }catch(e){notice('Chưa thể bắt đầu: '+e.message)}finally{state.busy=false;btn.disabled=false;btn.innerHTML='VÀO ĐẤU TRƯỜNG <span>↗</span>'}
}
function gameTick(){
 if(!state.run)return;
 const ms=elapsed();$('#game-timer').textContent=Math.max(0,Math.ceil((45000-ms)/1000));
 const step=ms<12000?0:ms<24000?1:ms<37000?2:3;
 if(state.step!==step){state.step=step;renderStage(step)}
 if(step===2){const target=targetMs(state.run.seed);const delta=Math.abs(ms-target);$('#clutch-needle')?.style.setProperty('transform',`rotate(${((ms-24000)/13000)*360}deg)`);const precision=$('#precision-label');if(precision)precision.textContent=delta<220?'PERFECT WINDOW!':delta<800?'GẦN CHUẨN...':'CHỜ THỜI CƠ';}
 if(ms>=45000){clearInterval(state.tick);state.tick=null;void completeRun();}
}
function renderStage(step){
 const c=$('#challenge'),h=$('#stage-hint'),title=$('#stage-title');
 if(step===0){title.textContent='STAGE 01 // FLAME TAP';c.innerHTML='<span class="eyebrow">12 GIÂY · REACTION TEST</span><h3>CHẠM NGỌN LỬA ĐÚNG</h3><p>Ba biểu tượng đổi vị trí mỗi lượt. Tìm ngọn lửa đỏ, tránh mục tiêu giả.</p><div class="tap-targets" id="targets"></div>';h.textContent='Chạm nhanh và chính xác để tăng combo!';renderTargets();return;}
 if(step===1){title.textContent='STAGE 02 // TROLL DETECTOR';const q=state.run.quiz;c.innerHTML='<span class="eyebrow">12 GIÂY · GAME IQ</span><h3>'+escapeText(q.q)+'</h3><p>Boss đang cố đánh lừa bạn. Chọn một câu trả lời!</p><div class="quiz-options">'+q.answers.map((a,i)=>'<button type="button" data-answer="'+i+'">'+escapeText(a)+'</button>').join('')+'</div>';h.textContent='Chọn đáp án trước khi hết thời gian';c.querySelectorAll('[data-answer]').forEach(b=>b.onclick=()=>answer(Number(b.dataset.answer)));return;}
 if(step===2){title.textContent='STAGE 03 // CLUTCH MOMENT';if(!state.quizAnswered){state.quizAnswered=true;state.events.push({type:'quiz',t:24000,choice:3})}c.innerHTML='<span class="eyebrow">13 GIÂY · PRECISION FINISHER</span><h3>CHỜ THỜI CƠ!</h3><p>Bấm CLUTCH đúng khoảnh khắc vòng năng lượng sáng lên để kết liễu Boss.</p><div id="clutch-needle" class="clutch-ring">✦</div><button id="clutch-btn" type="button" class="primary">⚡ CLUTCH NOW!</button><p id="precision-label">CHỜ THỜI CƠ</p>';h.textContent='Một lần duy nhất. Chính xác là tất cả.';$('#clutch-btn').onclick=clutch;return;}
 title.textContent='MISSION FINALIZING';if(!state.clutchHit){state.clutchHit=true;state.events.push({type:'clutch',t:37000});}c.innerHTML='<span class="eyebrow">RESULT SYNCHRONIZING</span><div class="result-symbol">✦</div><h3>HỆ THỐNG ĐANG XÁC NHẬN...</h3><p>Giữ trang mở để lưu điểm chính thức và cập nhật World Boss.</p>';h.textContent='Chỉ kết quả hợp lệ mới được tính';
}
function renderTargets(){
 const target=$('#targets');if(!target||state.step!==0)return;
 const good=seededChoice(state.run.seed,state.tapIndex);
 target.innerHTML=Array.from({length:3},(_,i)=>'<button type="button" aria-label="Mục tiêu '+(i+1)+'" class="'+(i===good?'active':'')+'" data-choice="'+i+'">'+(i===good?'✹':'✕')+'</button>').join('');
 target.querySelectorAll('[data-choice]').forEach(b=>b.onclick=()=>tap(Number(b.dataset.choice)));
}
function tap(choice){
 const ms=elapsed();if(state.step!==0||ms>=12000||ms<0||state.tapIndex>=38)return;
 const previous=state.events.filter(e=>e.type==='tap').at(-1);if(previous&&ms-previous.t<150)return;
 state.events.push({type:'tap',i:state.tapIndex,t:ms,choice});
 const right=seededChoice(state.run.seed,state.tapIndex)===choice;state.tapIndex++;
 if(right){state.combo++;state.scorePreview+=90+Math.min(state.combo,10)*6;}else state.combo=0;
 $('#game-combo').textContent=String(state.combo);$('#game-score').textContent=digits(state.scorePreview);
 renderTargets();
}
function answer(choice){
 if(state.step!==1||state.quizAnswered)return;
 state.quizAnswered=true;state.events.push({type:'quiz',t:elapsed(),choice});
 $('#challenge').querySelectorAll('[data-answer]').forEach(b=>b.disabled=true);
 $('#stage-hint').textContent='Đã khóa đáp án. Chuẩn bị đến Clutch Moment!';
}
function clutch(){
 if(state.step!==2||state.clutchHit)return;
 state.clutchHit=true;state.events.push({type:'clutch',t:elapsed()});
 $('#clutch-btn').disabled=true;$('#clutch-btn').textContent='CLUTCH LOCKED';
 $('#stage-hint').textContent='Đã ghi nhận khoảnh khắc. Chờ xác nhận điểm.';
}
async function completeRun(){
 if(!state.run)return;
 const run=state.run;state.run=null;
 $('#result-player').textContent='@'+run.nickname;
 $('#result-score').textContent=digits(state.scorePreview);
 $('#result-title').textContent='MISSION COMPLETE';
 $('#result-status').textContent='ĐANG XÁC NHẬN TRÊN MÁY CHỦ...';
 window.location.hash='results';navigate('results');
 try{
  const response=await fetch(API,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'finish',runId:run.runId,token:run.token,events:state.events})});
  const result=await response.json();
  if(!response.ok)throw new Error(result.error||'Không xác minh được lượt chơi');
  $('#result-score').textContent=digits(result.score);
  $('#result-status').textContent='✓ ĐIỂM ĐÃ ĐƯỢC MÁY CHỦ XÁC NHẬN';void fetchBoard();
 }catch(e){$('#result-score').textContent='—';$('#result-status').textContent='✕ LƯỢT CHƠI CHƯA ĐƯỢC GHI NHẬN';notice('Không thể gửi điểm: '+e.message)}
}
function leaveGame(){if(!state.run)return;if(!confirm('Rời trận? Kết quả hiện tại sẽ không được tính.'))return;clearInterval(state.tick);state.tick=null;state.run=null;window.location.hash='home';navigate('home')}
function boot(){
 $('#join-form').addEventListener('submit',beginGame);$('#leave-game').addEventListener('click',leaveGame);$('#play-again').addEventListener('click',()=>{window.location.hash='home';navigate('home')});
 $('#fullscreen').addEventListener('click',()=>{if(document.fullscreenElement)document.exitFullscreen();else $('#btc').requestFullscreen?.().catch(()=>notice('Trình duyệt không hỗ trợ toàn màn hình.'))});
 window.addEventListener('hashchange',()=>{const page=location.hash.slice(1)||'home';if(state.run&&page!=='game'){window.location.hash='game';return;}navigate(page)});
 navigate(location.hash.slice(1)||'home');void fetchBoard();
 state.refreshTimer=setInterval(()=>{if(!document.hidden)void fetchBoard()},4000);
}
boot();
