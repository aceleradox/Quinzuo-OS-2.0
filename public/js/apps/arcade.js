import { defineApp } from '../core/app-registry.js';
import { state, events } from '../core/state.js';
import { BackendFS } from '../core/fs.js';
import { HQAudio } from '../core/audio.js';
import { openApp } from '../core/window-manager.js';
import { parseQnz, buildQnzHtml } from '../core/qnz.js';

function escapeHtml(text) {
    return String(text ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

const MEMORY_GAME = {
    title: 'Jogo da Memória',
    html: `<div style="text-align:center">
        <h2 style="color:#22d3ee;margin:4px 0">🧠 Jogo da Memória</h2>
        <p style="color:#94a3b8;font-size:12px">Encontre os 8 pares. Movimentos: <b id="mem_moves" style="color:#f8fafc">0</b></p>
        <div id="mem_board" style="display:grid;grid-template-columns:repeat(4,64px);gap:8px;justify-content:center;margin:14px 0"></div>
        <div id="mem_msg" style="color:#4ade80;font-size:13px;font-weight:700"></div>
    </div>`,
    css: `.card{width:64px;height:64px;border-radius:10px;border:1px solid #475569;background:linear-gradient(145deg,#312e81,#0f172a);color:#f8fafc;font-size:26px;cursor:pointer;transition:transform .15s}
          .card:hover{transform:scale(1.05)}
          .card.open,.card.done{background:#1e293b;border-color:#22d3ee}
          .card.done{opacity:.65}`,
    js: `(function(){
        var icons=['🍒','⭐','🎈','⚡','🧠','💎','🚀','🌈'];
        var deck=icons.concat(icons).sort(function(){return Math.random()-0.5;});
        var board=document.getElementById('mem_board');
        var moves=0, first=null, lock=false, matched=0;
        deck.forEach(function(icon,i){
            var b=document.createElement('button');
            b.className='card'; b.textContent='?'; b.dataset.icon=icon; b.dataset.index=String(i);
            b.onclick=function(){
                if(lock||b.classList.contains('open')||b.classList.contains('done'))return;
                b.textContent=icon; b.classList.add('open');
                if(!first){first=b;return;}
                moves++; document.getElementById('mem_moves').textContent=String(moves);
                var a=first; first=null;
                if(a.dataset.icon===b.dataset.icon){
                    a.classList.add('done'); b.classList.add('done'); matched++;
                    if(matched===icons.length)document.getElementById('mem_msg').textContent='Você venceu em '+moves+' movimentos!';
                }else{
                    lock=true;
                    setTimeout(function(){a.textContent='?';b.textContent='?';a.classList.remove('open');b.classList.remove('open');lock=false;},620);
                }
            };
            board.appendChild(b);
        });
    })();`
};

const DICE_GAME = {
    title: 'Dado 3D-ish',
    html: `<div style="text-align:center">
        <h2 style="color:#f472b6;margin:4px 0">🎲 Dado 3D-ish</h2>
        <p style="color:#94a3b8;font-size:12px">Perspectiva, rotação e sombra. Clique para rolar.</p>
        <div style="perspective:500px;margin:24px 0">
            <div id="die" style="width:130px;height:130px;margin:auto;border-radius:24px;background:linear-gradient(145deg,#f8fafc,#94a3b8);box-shadow:12px 14px 0 #475569,0 20px 30px rgba(0,0,0,.45);display:flex;align-items:center;justify-content:center;font-size:74px;color:#0f172a;transition:transform .35s">⚀</div>
        </div>
        <button id="roll" style="background:#8b5cf6;color:white;border:0;border-radius:10px;padding:10px 18px;font-weight:700;cursor:pointer">Rolar dado</button>
        <p id="res" style="color:#22d3ee;font-size:13px">Aguardando...</p>
    </div>`,
    css: 'body{background:radial-gradient(circle at 50% 30%,#1e1b4b,#020617)}',
    js: `(function(){
        var faces=['⚀','⚁','⚂','⚃','⚄','⚅'];
        var die=document.getElementById('die');
        var res=document.getElementById('res');
        var spins=0;
        function roll(){
            var n=Math.floor(Math.random()*6)+1;
            spins+=1;
            die.textContent=faces[n-1];
            die.style.transform='rotateX('+(spins*137)+'deg) rotateY('+(spins*91)+'deg) scale(1.06)';
            setTimeout(function(){die.style.transform='rotateX('+(spins*137)+'deg) rotateY('+(spins*91)+'deg) scale(1)';},180);
            res.textContent='Resultado: '+n;
            try{parent.postMessage({type:'QZ_ARCADE_DICE',value:n},'*');}catch(e){}
        }
        document.getElementById('roll').onclick=roll;
        die.onclick=roll;
    })();`
};

const SNAKE_GAME = {
    title: 'Snake',
    html: `<div style="text-align:center">
        <h2 style="color:#4ade80;margin:4px 0">🐍 Snake</h2>
        <p style="color:#94a3b8;font-size:12px">Setas ou WASD para mover. Pontos: <b id="sn_score" style="color:#f8fafc">0</b></p>
        <canvas id="sn_canvas" width="300" height="240" tabindex="0" style="background:#020617;border:1px solid #334155;border-radius:8px"></canvas>
        <p style="color:#64748b;font-size:11px" id="sn_hint">Clique no tabuleiro para focar / reiniciar.</p>
    </div>`,
    css: 'body{background:#0f172a}',
    js: `(function(){
        var cv=document.getElementById('sn_canvas'), ctx=cv.getContext('2d');
        var size=20, cols=15, rows=12;
        var snake=[{x:6,y:6},{x:5,y:6},{x:4,y:6}], food={x:10,y:6}, dx=1, dy=0, score=0, timer=null, over=false;
        function placeFood(){
            do{food={x:Math.floor(Math.random()*cols),y:Math.floor(Math.random()*rows)};}
            while(snake.some(function(s){return s.x===food.x&&s.y===food.y;}));
        }
        function draw(){
            ctx.fillStyle='#020617'; ctx.fillRect(0,0,cv.width,cv.height);
            ctx.fillStyle='#f87171'; ctx.fillRect(food.x*size+3,food.y*size+3,size-6,size-6);
            snake.forEach(function(s,i){
                ctx.fillStyle=i===0?'#4ade80':'#22c55e';
                ctx.fillRect(s.x*size+2,s.y*size+2,size-4,size-4);
            });
            if(over){ctx.fillStyle='rgba(0,0,0,.65)';ctx.fillRect(0,0,cv.width,cv.height);ctx.fillStyle='#f8fafc';ctx.font='bold 20px sans-serif';ctx.textAlign='center';ctx.fillText('FIM DE JOGO',cv.width/2,cv.height/2);}
        }
        function step(){
            if(over)return;
            var head={x:snake[0].x+dx,y:snake[0].y+dy};
            if(head.x<0||head.y<0||head.x>=cols||head.y>=rows||snake.some(function(s){return s.x===head.x&&s.y===head.y;})){
                over=true; draw(); return;
            }
            snake.unshift(head);
            if(head.x===food.x&&head.y===food.y){score++;document.getElementById('sn_score').textContent=String(score);placeFood();}
            else snake.pop();
            draw();
        }
        function restart(){
            if(timer)clearInterval(timer);
            snake=[{x:6,y:6},{x:5,y:6},{x:4,y:6}]; dx=1; dy=0; score=0; over=false;
            document.getElementById('sn_score').textContent='0'; placeFood(); draw();
            timer=setInterval(step,140); cv.focus();
        }
        function turn(x,y){if(dx===-x&&dy===-y)return;dx=x;dy=y;}
        window.addEventListener('keydown',function(e){
            var k=e.key.toLowerCase();
            if(k==='arrowup'||k==='w'){e.preventDefault();turn(0,-1);}
            else if(k==='arrowdown'||k==='s'){e.preventDefault();turn(0,1);}
            else if(k==='arrowleft'||k==='a'){e.preventDefault();turn(-1,0);}
            else if(k==='arrowright'||k==='d'){e.preventDefault();turn(1,0);}
        });
        cv.addEventListener('click',restart);
        restart();
    })();`
};

const GAMES = [
    { id: 'memory', title: 'Jogo da Memória', icon: '🧠', desc: '8 pares, 16 cartas — treino cognitivo.', pkg: MEMORY_GAME },
    { id: 'dice', title: 'Dado 3D-ish', icon: '🎲', desc: 'Role o dado com rotação e perspectiva.', pkg: DICE_GAME },
    { id: 'snake', title: 'Snake', icon: '🐍', desc: 'Clássico dos clássicos, 15×12.', pkg: SNAKE_GAME }
];

defineApp('arcade', {
    render(containerId) {
        const el = document.getElementById(containerId);
        el.innerHTML = `
            <div class="app-root">
                <div class="app-toolbar">
                    <span class="qz-badge">🕹️ QUINZUO ARCADE</span>
                    <span id="arc_now" style="font-size:10px;color:#94a3b8">Selecione um jogo</span>
                    <div class="tool-sep"></div>
                    <button class="app-bar-btn" id="arc_reload">↻ Reiniciar jogo</button>
                </div>
                <div class="app-tabs">
                    <button data-tab="games" class="active">🎮 Jogos</button>
                    <button data-tab="qnz">📦 Jogos .QNZ no VHD</button>
                </div>
                <div class="app-split" id="arc_games_panel">
                    <div style="width:220px;overflow:auto;border-right:1px solid #334155;background:#0b1220" id="arc_cards"></div>
                    <div style="flex:1;display:flex;flex-direction:column;min-height:0">
                        <iframe id="arc_frame" data-qnz="1" class="qnz-preview-frame" sandbox="allow-scripts allow-modals"></iframe>
                    </div>
                </div>
                <div class="app-content" id="arc_qnz_panel" hidden>
                    <div class="icon-grid" id="arc_qnz_list"></div>
                </div>
                <div class="app-log" id="arc_status" style="max-height:52px">Arcade pronto.</div>
            </div>`;

        const $ = (id) => el.querySelector('#' + id);
        const frame = $('arc_frame');
        let selected = GAMES[0];

        function status(text) {
            $('arc_status').textContent = `[${new Date().toLocaleTimeString('pt-BR')}] ${text}`;
        }

        function paintCards() {
            $('arc_cards').innerHTML = GAMES.map((game) => `<div class="icon-card" data-game="${game.id}" style="margin:8px;border-color:${game.id === selected.id ? '#22d3ee' : '#334155'}">
                <span class="big">${game.icon}</span>
                <span class="lbl">${escapeHtml(game.title)}</span>
                <div style="font-size:9px;color:#64748b;margin-top:5px">${escapeHtml(game.desc)}</div>
            </div>`).join('');
        }

        function play(game) {
            selected = game;
            $('arc_now').textContent = game.title;
            frame.srcdoc = buildQnzHtml(game.pkg, { bridge: false });
            paintCards();
            status(`Jogo carregado: ${game.title}`);
        }

        function paintQnz() {
            const files = (state.files || []).filter((f) => /\.qnz$/i.test(String(f.name || '')));
            const matches = files.filter((f) => {
                try {
                    const pkg = parseQnz(f.content);
                    return /game|jogo|arcade/i.test(`${pkg.title} ${pkg.name} ${f.name}`);
                } catch (_) { return false; }
            });
            $('arc_qnz_list').innerHTML = matches.length
                ? matches.map((f) => {
                    const pkg = parseQnz(f.content);
                    return `<div class="icon-card" data-qnz-id="${escapeHtml(f.id)}">
                        <span class="big">${escapeHtml(pkg.icon || '🎮')}</span>
                        <span class="lbl">${escapeHtml(pkg.title || f.name)}</span>
                        <div style="font-size:9px;color:#64748b;margin-top:5px">${escapeHtml(f.name)}</div>
                    </div>`;
                }).join('')
                : '<div class="qz-card" style="margin:12px;font-size:11px;color:#94a3b8">Nenhum arquivo .qnz de jogo nesta partição.</div>';
        }

        function onQnzClick(event) {
            const card = event.target.closest('[data-qnz-id]');
            if (!card) return;
            const file = (state.files || []).find((f) => String(f.id) === card.dataset.qnzId);
            if (!file) return;
            HQAudio.uiClick();
            openApp('qnz-runner', file);
            status(`Abrindo ${file.name} no executor .QNZ.`);
        }

        function onFsChanged() {
            if (!document.body.contains(el)) {
                document.removeEventListener(events.FS_CHANGED, onFsChanged);
                return;
            }
            paintQnz();
        }

        $('arc_cards').addEventListener('click', (event) => {
            const card = event.target.closest('[data-game]');
            if (!card) return;
            const game = GAMES.find((g) => g.id === card.dataset.game);
            if (!game) return;
            HQAudio.uiClick();
            HQAudio.excitacao();
            play(game);
        });
        el.querySelectorAll('.app-tabs button').forEach((btn) => {
            btn.onclick = () => {
                HQAudio.uiClick();
                el.querySelectorAll('.app-tabs button').forEach((b) => b.classList.toggle('active', b === btn));
                const games = btn.dataset.tab === 'games';
                $('arc_games_panel').style.display = games ? 'flex' : 'none';
                $('arc_qnz_panel').style.display = games ? 'none' : 'block';
                if (!games) paintQnz();
            };
        });
        $('arc_reload').onclick = () => { HQAudio.uiClick(); play(selected); };
        $('arc_qnz_list').addEventListener('click', onQnzClick);
        document.addEventListener(events.FS_CHANGED, onFsChanged);

        paintCards();
        paintQnz();
        play(selected);
        BackendFS.fetchAll();
    }
});
