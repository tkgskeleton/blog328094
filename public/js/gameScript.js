/**
 * CUSTOM NIGHT ULTIMATE
 * Core Game Logic
 */

// --- Audio System ---
class AudioController {
    constructor() {
        this.ctx = null;
        this.masterVolume = 0.5;
    }

    init() {
        if (!this.ctx) {
            this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        }
        if (this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
    }

    playTone(freq, type, duration, vol = 1.0) {
        if (!this.ctx) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = type;
        osc.frequency.setValueAtTime(freq, this.ctx.currentTime);

        gain.gain.setValueAtTime(vol * this.masterVolume, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + duration);

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start();
        osc.stop(this.ctx.currentTime + duration);
    }

    playAlarm() { this.playTone(880, 'square', 0.1, 0.5); }
    playClick() { this.playTone(400, 'sine', 0.05, 0.3); }
    playWin() {
        this.playTone(523.25, 'sine', 0.2, 0.5); // C5
        setTimeout(() => this.playTone(659.25, 'sine', 0.2, 0.5), 200); // E5
        setTimeout(() => this.playTone(783.99, 'sine', 0.4, 0.5), 400); // G5
    }
    playLose() {
        this.playTone(200, 'sawtooth', 0.5, 0.8);
        setTimeout(() => this.playTone(150, 'sawtooth', 0.5, 0.8), 300);
    }
}

// --- Base Module Class ---
class GameModule {
    constructor(id, name, config) {
        this.id = id;
        this.name = name;
        this.aiLevel = 0;
        this.config = config || {};
        this.element = null;
        this.active = false;
        this.failed = false;
        this.waiting = false;
        this.waitTimer = 0;
        this.startDelay = 0; // New: Random startup delay
    }

    // Called when game starts
    init(element, aiLevel, aggressiveMode) {
        this.element = element;
        this.aiLevel = aiLevel;
        this.aggressive = aggressiveMode;
        this.failed = false;
        this.waiting = false;
        this.active = (aiLevel > 0);

        // Random Start Delay (0-5s) to prevent sync
        this.startDelay = this.active ? Math.random() * 5 : 0;

        if (this.active) {
            this.element.classList.add('initializing', 'active-mod');
            setTimeout(() => this.element.classList.remove('initializing'), 1000);
            this.render(); // Individual module render
        } else {
            this.element.innerHTML = `<div class="inactive-overlay">DISABLED</div>`;
        }
    }

    render() {
        this.element.innerHTML = `
            <div class="module-header">${this.name} (AI ${this.aiLevel})</div>
            <div class="module-content"></div>
        `;
    }

    update(dt) {
        if (!this.active || this.failed) return;

        // Start Delay Phase
        if (this.startDelay > 0) {
            this.startDelay -= dt;
            if (this.startDelay <= 0) {
                this.startDelay = 0;
                this.onStart();
            }
            return;
        }

        if (this.waiting) {
            this.waitTimer -= dt;
            if (this.waitTimer <= 0) {
                this.waiting = false;
                this.element.querySelector('.module-content').style.opacity = '1';
                this.onStart();
            }
            return;
        }

        this.onUpdate(dt);
    }

    // To be implemented by subclasses
    onStart() { }
    onUpdate(dt) { }

    failGame() {
        if (this.failed) return;
        this.failed = true;

        // Remove global spam if exists
        const globalSpam = document.querySelectorAll('.spam-popup');
        globalSpam.forEach(el => el.remove());

        window.gameApp.triggerGameOver(this.name);
    }

    success() {
        window.gameApp.audio.playAlarm(); // Temp success sound

        // COIN LOGIC (Shop Mode)
        if (window.gameApp.shopMode) {
            window.gameApp.addCoin(1);
        }

        if (this.aggressive) {
            this.onStart(); // Instant restart
        } else {
            // Wait Logic (Increased: 3-6s)
            this.waiting = true;
            this.waitTimer = Math.random() * 3 + 3.0;
            this.element.querySelector('.module-content').style.opacity = '0.3';
        }
    }

    eliminate() {
        this.active = false;
        this.aiLevel = 0;
        this.element.querySelector('.module-content').innerHTML = `
            <div class="eliminated-overlay" style="color:var(--accent-red);">ELIMINATED</div>
        `;
        document.getElementById(`ai-${this.id}`).innerText = 0;
    }


}

// --- Module Group A ---

class SpamModule extends GameModule {
    constructor() { super('spam', 'Spam Blocker'); }

    onStart() {
        this.activeCount = 0;
        this.waveTotal = 5 + Math.ceil(this.aiLevel / 2); // 5 to 15
        this.spawned = 0;
        this.cleared = 0;
        this.spawnTimer = 0;
        // 4x Slower: Base 6.0s - AI factor
        this.spawnInterval = Math.max(0.8, 6.0 - (this.aiLevel * 0.2));
        this.render();
    }

    onUpdate(dt) {
        // Spawning
        if (this.spawned < this.waveTotal) {
            this.spawnTimer -= dt;
            if (this.spawnTimer <= 0) {
                this.spawnPopup();
                this.spawnTimer = this.spawnInterval;
            }
        } else {
            if (this.cleared >= this.waveTotal) {
                this.success();
            }
        }

        // Check Limit
        const currentActive = document.querySelectorAll('.spam-popup').length; // Global check
        if (currentActive > 5) {
            this.failGame();
        }

        // Update Counter
        const cnt = this.element.querySelector('.spam-counter');
        if (cnt) cnt.innerText = `${currentActive} / 5 (Remaining: ${this.waveTotal - this.cleared})`;
    }

    render() {
        this.element.innerHTML = `
            <div class="module-header">${this.name} (AI ${this.aiLevel})</div>
            <div class="module-content">
                <div style="height:100%; display:flex; justify-content:center; align-items:center; flex-direction:column;">
                    <div style="font-size:20px;">SPAM DEFENSE</div>
                    <div class="spam-counter" style="color:var(--accent-red);">0 / 5</div>
                </div>
            </div>
         `;
    }

    spawnPopup() {
        this.spawned++;
        const p = document.createElement('div');
        p.className = 'spam-popup';
        p.style.position = 'fixed'; // Global
        p.style.left = (Math.random() * 80 + 10) + '%';
        p.style.top = (Math.random() * 80 + 10) + '%';
        p.style.width = '150px'; // Larger
        p.style.height = '100px';
        p.style.background = '#eee';
        p.style.border = '2px solid white';
        p.style.boxShadow = '0 0 10px black';
        p.style.color = 'black';
        p.style.display = 'flex';
        p.style.flexDirection = 'column';
        p.style.zIndex = 3000 + this.spawned; // Above everything
        p.style.cursor = 'pointer'; // Clickable

        p.innerHTML = `
            <div style="background:blue; color:white; font-size:12px; padding:4px; display:flex; justify-content:space-between;">
                <span>ALERT</span>
                <span class="close-x">X</span>
            </div>
            <div style="flex:1; display:flex; justify-content:center; align-items:center; font-size:30px;">!</div>
        `;

        // Click anywhere to close
        p.onclick = (e) => {
            e.stopPropagation();
            p.remove();
            this.cleared++;
            window.gameApp.audio.playClick();
        };

        document.body.appendChild(p); // Append to body
    }
}

class PuppetModule extends GameModule {
    constructor() { super('puppet', 'Puppet Music Box'); }

    onStart() {
        this.maxTime = Math.max(5, 35 - this.aiLevel); // Prevent 0 or negative
        this.timer = this.maxTime;
        this.rewinding = false;
        this.render();
    }

    onUpdate(dt) {
        if (this.rewinding) {
            this.timer = Math.min(this.maxTime, this.timer + (this.maxTime / 5) * dt); // 5 sec to full
            if (this.timer >= this.maxTime) this.rewinding = false;
        } else {
            this.timer -= dt;
            if (this.timer <= 0) {
                this.timer = 0;
                this.failGame();
            }
        }
        this.updateUI();
    }

    render() {
        this.element.innerHTML = `
            <div class="module-header">${this.name} (AI ${this.aiLevel})</div>
            <div class="module-content">
                <div style="text-align:center; height:100%; display:flex; flex-direction:column; justify-content:center; align-items:center;">
                    <div class="music-meter" style="width:80%; height:20px; background:#333; border:1px solid #555; overflow:hidden;">
                        <div id="puppet-bar" style="width:100%; height:100%; background:var(--accent-cyan);"></div>
                    </div>
                    <button id="puppet-wind" class="cyber-btn" style="margin-top:10px; font-size:0.8rem;">WIND UP</button>
                </div>
            </div>
        `;
        const btn = this.element.querySelector('#puppet-wind');
        btn.onmousedown = () => this.rewinding = true;
        btn.onmouseup = () => this.rewinding = false;
        btn.onmouseleave = () => this.rewinding = false;

        // Touch support
        btn.ontouchstart = (e) => { e.preventDefault(); this.rewinding = true; };
        btn.ontouchend = (e) => { e.preventDefault(); this.rewinding = false; };
    }

    updateUI() {
        const bar = this.element.querySelector('#puppet-bar');
        if (bar) {
            const pct = (this.timer / this.maxTime) * 100;
            bar.style.width = `${pct}%`;
            bar.style.background = pct < 20 ? 'red' : 'var(--accent-cyan)';
        }
    }
}

class MinesweeperModule extends GameModule {
    constructor() { super('minesweeper', 'Minesweeper'); }

    onStart() {
        this.timeLimit = Math.max(10, 50 - this.aiLevel);
        this.timer = this.timeLimit;
        this.cols = 5;
        this.rows = 5;
        this.bombCount = 4;
        this.grid = [];
        this.revealed = 0;
        this.generateGrid();
        this.render();
    }

    generateGrid() {
        // Init empty
        this.grid = Array(this.rows * this.cols).fill(0);
        // Place bombs
        let bombs = 0;
        while (bombs < this.bombCount) {
            let idx = Math.floor(Math.random() * this.grid.length);
            if (this.grid[idx] !== 'B') {
                this.grid[idx] = 'B';
                bombs++;
            }
        }
    }

    // Custom Generate with safe zone
    generateSafeGrid(safeIdx) {
        this.grid = Array(this.rows * this.cols).fill(0);
        let bombs = 0;
        const neighbors = this.getNeighbors(safeIdx).concat(safeIdx); // Safe zone radius 1

        while (bombs < this.bombCount) {
            let idx = Math.floor(Math.random() * this.grid.length);
            if (!neighbors.includes(idx) && this.grid[idx] !== 'B') {
                this.grid[idx] = 'B';
                bombs++;
            }
        }
        // Calc numbers
        for (let i = 0; i < this.grid.length; i++) {
            if (this.grid[i] === 'B') continue;
            let count = 0;
            this.getNeighbors(i).forEach(n => {
                if (this.grid[n] === 'B') count++;
            });
            this.grid[i] = count;
        }
    }

    getNeighbors(idx) {
        const r = Math.floor(idx / this.cols);
        const c = idx % this.cols;
        const ret = [];
        for (let dr = -1; dr <= 1; dr++) {
            for (let dc = -1; dc <= 1; dc++) {
                if (dr === 0 && dc === 0) continue;
                const nr = r + dr;
                const nc = c + dc;
                if (nr >= 0 && nr < this.rows && nc >= 0 && nc < this.cols) {
                    ret.push(nr * this.cols + nc);
                }
            }
        }
        return ret;
    }

    onUpdate(dt) {
        this.timer -= dt;
        if (this.timer <= 0) {
            this.timer = 0;
            this.failGame();
        }
        // Update timer UI
        const timeBar = this.element.querySelector('.mine-timer');
        if (timeBar) {
            timeBar.style.width = `${(this.timer / this.timeLimit) * 100}%`;
        }
    }

    render() {
        this.element.innerHTML = `
            <div class="module-header">${this.name} (AI ${this.aiLevel})</div>
            <div class="module-content">
                <div style="height:100%; display:flex; flex-direction:column;">
                    <div style="height:5px; background:#333; margin-bottom:5px;"><div class="mine-timer" style="height:100%; background:lime; width:100%;"></div></div>
                    <div style="font-size:10px; color:#aaa; margin-bottom:5px; text-align:center;">SCANNING FIELD...</div>
                    <div class="mine-grid" style="flex:1; display:grid; grid-template-columns:repeat(5,1fr); gap:2px; min-height:120px;">
                        ${Array(25).fill(0).map((_, i) => `<div class="cell hidden" data-idx="${i}" onclick="gameApp.handleMineClick(${i})"></div>`).join('')}
                    </div>
                </div>
            </div>
        `;

        // CSS for Minesweeper

        // CSS for Minesweeper
        if (!document.getElementById('mine-style')) {
            const s = document.createElement('style');
            s.id = 'mine-style';
            s.innerHTML = `
                .cell { background: #444; cursor: pointer; display:flex; justify-content:center; align-items:center; font-size:12px; }
                .cell.hidden:hover { background: #555; }
                .cell.revealed { background: #222; cursor: default; }
                .cell.boom { background: red; }
            `;
            document.head.appendChild(s);
        }

        // Hacky: Global handler binding
        window.gameApp.handleMineClick = (i) => this.handleClick(i);
        this.firstClick = true;
    }

    handleClick(idx) {
        if (this.failed || this.waiting) return;

        if (this.firstClick) {
            this.generateSafeGrid(idx);
            this.firstClick = false;
        }

        const cell = this.element.querySelectorAll('.cell')[idx];
        if (!cell.classList.contains('hidden')) return;

        const val = this.grid[idx];
        if (val === 'B') {
            cell.classList.add('boom');
            cell.innerText = 'X';
            this.failGame();
        } else {
            this.reveal(idx);
            this.checkWin();
        }
    }

    reveal(idx) {
        const cell = this.element.querySelectorAll('.cell')[idx];
        if (!cell.classList.contains('hidden')) return;

        cell.classList.remove('hidden');
        cell.classList.add('revealed');
        cell.innerText = this.grid[idx] === 0 ? '' : this.grid[idx];

        if (this.grid[idx] === 0) {
            this.getNeighbors(idx).forEach(n => this.reveal(n));
        }
    }

    checkWin() {
        const hidden = this.element.querySelectorAll('.cell.hidden');
        if (hidden.length === this.bombCount) {
            this.success();
        }
    }
}

class SimonModule extends GameModule {
    constructor() { super('simon', 'Simon Says'); }

    onStart() {
        this.timeLimit = Math.max(5, 30 - this.aiLevel);
        this.timer = this.timeLimit;
        this.sequence = [];
        this.playerStep = 0;
        this.showing = true; // Phase: Showing vs Input
        this.colors = ['r', 'g', 'b', 'y'];

        // Generate Sequence (4 steps)
        for (let i = 0; i < 4; i++) {
            this.sequence.push(this.colors[Math.floor(Math.random() * 4)]);
        }

        this.render();
        this.playSequence();
    }

    render() {
        this.element.innerHTML = `
            <div class="module-header">${this.name} (AI ${this.aiLevel})</div>
            <div class="module-content">
                <div style="height:100%; display:flex; flex-direction:column; align-items:center;">
                    <div class="simon-timer" style="width:100%; height:5px; background:var(--accent-yellow); margin-bottom:5px;"></div>
                    <div style="display:grid; grid-template-columns:1fr 1fr; gap:5px; width:80%; flex:1;">
                        <div class="simon-btn r" style="background:#500;" onclick="gameApp.handleSimon('r')"></div>
                        <div class="simon-btn g" style="background:#050;" onclick="gameApp.handleSimon('g')"></div>
                        <div class="simon-btn b" style="background:#005;" onclick="gameApp.handleSimon('b')"></div>
                        <div class="simon-btn y" style="background:#550;" onclick="gameApp.handleSimon('y')"></div>
                    </div>
                </div>
            </div>
        `;
        window.gameApp.handleSimon = (c) => this.handleInput(c);
    }

    async playSequence() {
        this.showing = true;
        // Wait a bit then flash
        await new Promise(r => setTimeout(r, 1000));

        for (let c of this.sequence) {
            this.flash(c);
            window.gameApp.audio.playTone(400, 'sine', 0.1);
            await new Promise(r => setTimeout(r, 600));
        }
        this.showing = false;
        // Visual indicator?
    }

    flash(color) {
        const map = { r: 'red', g: 'lime', b: 'blue', y: 'yellow' };
        const btn = this.element.querySelector(`.simon-btn.${color}`);
        if (btn) {
            const old = btn.style.background;
            btn.style.background = map[color];
            setTimeout(() => btn.style.background = old, 300);
        }
    }

    handleInput(color) {
        if (this.showing || this.failed || this.waiting) return;

        this.flash(color);
        window.gameApp.audio.playClick();

        if (color === this.sequence[this.playerStep]) {
            this.playerStep++;
            if (this.playerStep >= this.sequence.length) {
                this.success();
            }
        } else {
            this.failGame();
        }
    }

    onUpdate(dt) {
        if (!this.showing) {
            this.timer -= dt;
            if (this.timer <= 0) {
                this.timer = 0;
                this.failGame();
            }
            const bar = this.element.querySelector('.simon-timer');
            if (bar) bar.style.width = `${(this.timer / this.timeLimit) * 100}%`;
        }
    }
}

class MemoryModule extends GameModule {
    constructor() { super('memory', 'Memory Matrix'); }

    onStart() {
        this.timeLimit = Math.max(10, 35 - this.aiLevel);
        this.timer = this.timeLimit + 5; // +5 for reveal phase
        this.phase = 'MEMORIZE'; // MEMORIZE, RECALL
        this.grid = [];
        this.playerGrid = [];

        // Generate Pattern (0=Off, 1=Green) - REMOVED RED per request
        this.grid = Array(16).fill(0).map(() => Math.random() < 0.5 ? 1 : 0);
        this.playerGrid = Array(16).fill(0);

        this.render();
        // Use a flag to prevent multiple timeouts if restarted quickly
        if (this.memorizeTimeout) clearTimeout(this.memorizeTimeout);
        this.memorizeTimeout = setTimeout(() => this.startRecall(), 5000);
    }

    startRecall() {
        if (this.failed || !this.active) return;
        this.phase = 'RECALL';
        this.render();
    }

    onUpdate(dt) {
        if (this.phase === 'RECALL') {
            this.timer -= dt;
            if (this.timer <= 0) {
                this.timer = 0;
                this.failGame();
            }
            this.updateUI();
        }
    }

    render() {
        let content = '';
        if (this.phase === 'MEMORIZE') {
            content = `<div style="color:var(--accent-cyan); text-align:center; font-size: 1.2rem;">MEMORIZE!</div>`;
            content += `<div class="mem-grid">
                ${this.grid.map(v => `
                    <div class="mem-cell" style="background:${v === 1 ? 'lime' : '#222'}"></div>
                `).join('')}
            </div>`;
        } else {
            content = `<div style="text-align:center; color:white; font-size: 1.2rem; margin-bottom: 5px;">RECALL!</div>`;
            content += `<div class="mem-grid">
                ${this.playerGrid.map((v, i) => `
                    <div class="mem-cell" style="background:${v === 1 ? 'lime' : '#222'}; cursor:pointer;" onclick="gameApp.handleMemory(${i})"></div>
                `).join('')}
            </div>`;
        }

        this.element.innerHTML = `
            <div class="module-header">${this.name} (AI ${this.aiLevel})</div>
            <div class="module-content">
                <style>
                    .mem-grid { display:grid; grid-template-columns:repeat(4,1fr); gap:2px; height:120px; aspect-ratio:1; margin:0 auto; }
                    .mem-cell { border:1px solid #444; }
                </style>
                <div style="height:5px; background:#333; margin-bottom:5px;"><div id="mem-timer" style="height:100%; background:var(--accent-cyan); width:100%;"></div></div>
                <div style="height:100%; display:flex; flex-direction:column; justify-content:center;">${content}</div>
            </div>
        `;
        window.gameApp.handleMemory = (i) => this.handleClick(i);
    }

    updateUI() {
        const bar = this.element.querySelector('#mem-timer');
        if (bar) {
            const pct = (this.timer / (this.phase === 'MEMORIZE' ? 5 : this.timeLimit)) * 100;
            bar.style.width = `${pct}%`;
        }
    }

    handleClick(idx) {
        if (this.phase !== 'RECALL' || this.failed) return;

        // Cycle: 0 -> 1 -> 0 (Black -> Green)
        this.playerGrid[idx] = (this.playerGrid[idx] + 1) % 2;

        // Optimistic render
        const cells = this.element.querySelectorAll('.mem-cell');
        const v = this.playerGrid[idx];
        cells[idx].style.background = v === 1 ? 'lime' : '#222';
        window.gameApp.audio.playClick();

        this.checkWin();
    }

    checkWin() {
        // Compare
        const str1 = JSON.stringify(this.grid);
        const str2 = JSON.stringify(this.playerGrid);
        if (str1 === str2) {
            this.success();
        }
    }
}

class ShufflerModule extends GameModule {
    constructor() { super('shuffler', 'Shuffler'); }

    onStart() {
        this.active = true;
        this.timer = 0;
        // Interval: 80s base - AI * 3.0. Min 20s.
        this.interval = Math.max(20, 80 - (this.aiLevel * 3.0));
        this.render();
    }

    onUpdate(dt) {
        this.timer -= dt;
        if (this.timer <= 0) {
            this.shuffle();
            this.timer = this.interval;
        }
    }

    render() {
        this.element.innerHTML = `
            <div class="module-header">${this.name} (AI ${this.aiLevel})</div>
            <div class="module-content">
                <div style="height:100%; display:flex; flex-direction:column; justify-content:center; align-items:center; color:#888;">
                    <div style="font-size:1.2rem; margin-bottom: 5px;">SHUFFLER</div>
                    <div style="font-size:10px; color:var(--accent-purple);">PASSIVE EFFECT</div>
                </div>
            </div>
        `;
    }

    shuffle() {
        if (this.aiLevel === 0) return;

        // Play sound
        window.gameApp.audio.playTone(100, 'sawtooth', 0.1);
        window.gameApp.audio.playTone(50, 'square', 0.2);

        // Shuffle grid
        const grid = document.getElementById('dashboard-grid');
        if (!grid) return;

        const modules = Array.from(grid.children);
        // Randomize order
        for (let i = modules.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            grid.appendChild(modules[j]); // Move to end = shuffle? appendChild moves it.
        }

        // Visual Glitch overlay on body
        const glitch = document.createElement('div');
        glitch.style.position = 'fixed';
        glitch.style.top = '0'; glitch.style.left = '0';
        glitch.style.width = '100vw'; glitch.style.height = '100vh';
        glitch.style.background = 'rgba(255, 0, 255, 0.2)';
        glitch.style.zIndex = '9999';
        glitch.style.pointerEvents = 'none';
        document.body.appendChild(glitch);
        setTimeout(() => glitch.remove(), 100);
    }
}

class RabbitModule extends GameModule {
    constructor() { super('rabbit', 'Rabbit Trap'); }

    onStart() {
        this.timeLimit = Math.max(5, 40 - this.aiLevel);
        this.timer = this.timeLimit;
        this.pos = 50; // %
        this.dir = 1;
        this.speed = 30 + (this.aiLevel * 5); // % per sec
        this.render();
    }

    onUpdate(dt) {
        this.timer -= dt;
        if (this.timer <= 0) {
            this.timer = 0;
            this.failGame();
            return;
        }

        // Rabbit Movement (Ping Pong)
        this.pos += this.speed * this.dir * dt;
        if (this.pos > 90) { this.pos = 90; this.dir = -1; }
        if (this.pos < 10) { this.pos = 10; this.dir = 1; }

        this.updateUI();
    }

    render() {
        this.element.innerHTML = `
            <div class="module-header">${this.name} (AI ${this.aiLevel})</div>
            <div class="module-content">
                <div style="height:5px; background:#333; margin-bottom:5px;"><div id="rabbit-timer" style="height:100%; background:var(--accent-red); width:100%;"></div></div>
                <div style="height:100px; position:relative; overflow:hidden; background:#111; border:1px solid #333;">
                    <!-- Trap Zone -->
                    <div id="rabbit-trap-zone" style="position:absolute; left:50%; top:50%; transform:translate(-50%, -50%); width:60%; height:100%; border:2px solid var(--accent-red); background:rgba(255,0,0,0.1); cursor:pointer;"></div>
                    
                    <!-- Rabbit -->
                    <div id="rabbit" style="position:absolute; top:50%; left:50%; width:15px; height:15px; background:white; border-radius:50%; transform:translate(-50%, -50%); pointer-events:none; box-shadow: 0 0 10px white;"></div>
                </div>
            </div>
        `;

        this.element.querySelector('#rabbit-trap-zone').onclick = () => this.tryCatch();
    }

    updateUI() {
        const rab = this.element.querySelector('#rabbit');
        if (rab) rab.style.left = `${this.pos}%`;
        const bar = this.element.querySelector('#rabbit-timer');
        if (bar) bar.style.width = `${(this.timer / this.timeLimit) * 100}%`;
    }

    tryCatch() {
        if (this.failed || this.waiting) return;
        // Check overlap
        // 4x tolerance: +/- 40% (since width helps visual, checking logic needs to match)
        // Zone is center 50%, width 120px (relative to container?).
        // Container is ~200-300px? % based logic is safer.
        // If Rabbit is within 30% to 70%? (Center 50 +/- 20).
        // Original was +/- 10. Let's do +/- 30 to be safe/generous as requested.
        if (Math.abs(this.pos - 50) < 30) {
            window.gameApp.audio.playClick();
            this.success();
        } else {
            this.failGame();
        }
    }
}

// --- Module Group B ---

class MathModule extends GameModule {
    constructor() { super('math', 'Math Quiz'); }

    onStart() {
        this.timeLimit = Math.max(5, 20 - (this.aiLevel / 2));
        this.timer = this.timeLimit;

        // Generate Problem
        const op = Math.random() > 0.5 ? '+' : '-';
        const a = Math.floor(Math.random() * 50) + 10; // 10-60
        const b = Math.floor(Math.random() * 10) + 1; // 1-11

        this.answer = op === '+' ? a + b : a - b;
        this.problem = `${a} ${op} ${b}`;

        // Options
        this.options = [this.answer];
        while (this.options.length < 3) {
            let offset = Math.floor(Math.random() * 10) - 5;
            if (offset === 0) offset = 1;
            let fake = this.answer + offset;
            if (!this.options.includes(fake)) this.options.push(fake);
        }
        this.options.sort(() => Math.random() - 0.5);

        this.render();
    }

    onUpdate(dt) {
        this.timer -= dt;
        if (this.timer <= 0) {
            this.timer = 0;
            this.failGame();
        }
        const bar = this.element.querySelector('#math-timer');
        if (bar) bar.style.width = `${(this.timer / this.timeLimit) * 100}%`;
    }

    render() {
        this.element.innerHTML = `
            <div class="module-header">${this.name} (AI ${this.aiLevel})</div>
            <div class="module-content">
                <div style="height:5px; background:#333; margin-bottom:5px;"><div id="math-timer" style="height:100%; background:var(--accent-yellow); width:100%;"></div></div>
                <div style="height:100%; display:flex; flex-direction:column; justify-content:center; min-width:180px;">
                    <div style="font-size:20px; text-align:center; margin-bottom:10px; font-family:'Orbitron'; color:var(--accent-yellow);">${this.problem} = ?</div>
                    <div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:10px;">
                        ${this.options.map(opt => `<button class="math-btn cyber-btn" style="padding:15px 5px; font-size:1.4rem;" onclick="gameApp.handleMath(${opt})">${opt}</button>`).join('')}
                    </div>
                </div>
            </div>
        `;
        window.gameApp.handleMath = (n) => this.handleInput(n);
    }

    handleInput(n) {
        if (this.failed || this.waiting) return;
        if (n === this.answer) {
            window.gameApp.audio.playClick();
            this.success();
        } else {
            this.failGame();
        }
    }
}

class TypingModule extends GameModule {
    constructor() { super('typing', 'Typing'); }

    onStart() {
        this.timeLimit = Math.max(5, 20 - (this.aiLevel / 2)); // Relaxed from 15
        this.timer = this.timeLimit;

        // Random String
        const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
        this.target = "";
        for (let i = 0; i < 4; i++) this.target += chars.charAt(Math.floor(Math.random() * chars.length));

        this.current = "";

        this.render();

        // Register Key Listener (Singleton)
        if (!window._typingKeyListener) {
            window._typingKeyListener = (e) => {
                // Find the active TypingModule instance
                const typingMod = window.gameApp.modules.find(m => m instanceof TypingModule && m.active && !m.failed && !m.waiting);
                if (!typingMod) return;

                if (e.key.length === 1) {
                    const char = e.key.toUpperCase();
                    if (typingMod.target[typingMod.current.length] === char) {
                        typingMod.current += char;
                        typingMod.render();
                        if (typingMod.current === typingMod.target) {
                            window.gameApp.audio.playClick();
                            typingMod.success();
                        }
                    }
                }
            };
            window.addEventListener('keydown', window._typingKeyListener);
        }
    }

    onUpdate(dt) {
        this.timer -= dt;
        if (this.timer <= 0) {
            this.timer = 0;
            this.failGame();
        }
        const bar = this.element.querySelector('#type-timer');
        if (bar) bar.style.width = `${(this.timer / this.timeLimit) * 100}%`;
    }

    render() {
        // Highlight matched part
        let html = '';
        for (let i = 0; i < this.target.length; i++) {
            if (i < this.current.length) {
                html += `<span style="color:var(--accent-green); text-shadow:0 0 5px var(--accent-green);">${this.target[i]}</span>`;
            } else {
                html += `<span style="color:#333;">${this.target[i]}</span>`;
            }
        }

        this.element.innerHTML = `
            <div class="module-header">${this.name} (AI ${this.aiLevel})</div>
            <div class="module-content">
                <div style="height:5px; background:#333; margin-bottom:5px;"><div id="type-timer" style="height:100%; background:white; width:100%;"></div></div>
                <div style="height:100%; display:flex; flex-direction:column; justify-content:center; align-items:center;">
                    <div style="font-size:10px; color:#555; margin-bottom: 5px;">TYPE THE CODE</div>
                    <div style="font-size:2.5rem; letter-spacing:8px; font-weight:bold; font-family:'Orbitron';">${html}</div>
                </div>
            </div>
        `;
    }
}

class VentInvaderModule extends GameModule {
    constructor() { super('vent', 'Vent Invader'); }

    onStart() {
        this.timeLimit = Math.max(15, 60 - this.aiLevel * 2);
        this.timer = this.timeLimit;

        // 5x5 Grid
        this.rows = 5;
        this.cols = 5;
        this.map = Array(25).fill(0); // 0=Empty, 1=Blocked

        // Blockages: Vertical Wall in Col 2 (Indices 7, 12, 17)
        [7, 12, 17].forEach(i => this.map[i] = 1);

        this.playerPos = 22; // (4, 2) Bottom Center
        this.enemyPos = 2;   // (0, 2) Top Center
        this.lurePos = -1;

        // Enemy Move Interval: scales with AI level
        this.moveInterval = Math.max(0.8, 2.0 - (this.aiLevel * 0.1));
        this.moveTimer = this.moveInterval;
        this.teleportCooldown = 0;

        this.render();
    }

    render() {
        this.element.innerHTML = `
            <div class="module-header">${this.name} (AI ${this.aiLevel})</div>
            <div class="module-content" style="padding:0; overflow:hidden; display:flex; flex-direction:column;">
                <div style="height:4px; background:#222;"><div id="vent-timer" style="height:100%; background:var(--accent-red); width:100%;"></div></div>
                <div class="vent-grid" style="display:grid; grid-template-columns:repeat(5, 1fr); gap:1px; flex:1; background:#111;">
                    ${this.map.map((v, i) => `
                        <div class="v-cell ${v === 1 ? 'blocked' : ''}" onclick="gameApp.setLure(${i})" data-idx="${i}" style="position:relative; background:${v === 1 ? '#333' : '#0a0a0a'}; border:1px solid #1a1a1a;"></div>
                    `).join('')}
                </div>
            </div>
        `;

        if (!document.getElementById('vent-style')) {
            const s = document.createElement('style');
            s.id = 'vent-style';
            s.innerHTML = `
                .v-lure, .v-player, .v-enemy { position:absolute; top:0; left:0; right:0; bottom:0; margin:auto; transition: 0.2s ease; }
                .v-lure { background:cyan; opacity:0.3; width:100%; height:100%; border:1px solid cyan; }
                .v-player { background:lime; width:60%; height:60%; border-radius:50%; box-shadow: 0 0 10px lime; z-index:2; }
                .v-enemy { background:red; width:80%; height:80%; border-radius:20%; box-shadow: 0 0 10px red; z-index:3; }
                .v-cell:hover:not(.blocked) { background:#151515 !important; cursor:pointer; }
             `;
            document.head.appendChild(s);
        }

        window.gameApp.setLure = (i) => this.setLure(i);
        this.updateBoard();
    }

    updateBoard() {
        const cells = this.element.querySelectorAll('.v-cell');
        cells.forEach((c, i) => {
            c.innerHTML = '';
            // Lure
            if (i === this.lurePos) c.innerHTML += `<div class="v-lure"></div>`;
            // Player
            if (i === this.playerPos) c.innerHTML += `<div class="v-player"></div>`;
            // Enemy
            if (i === this.enemyPos) c.innerHTML += `<div class="v-enemy"></div>`;
        });
    }

    onUpdate(dt) {
        this.moveTimer -= dt;
        if (this.moveTimer <= 0) {
            this.moveEnemy();
            this.moveTimer = this.moveInterval;
        }

        // Update UI every frame
        this.updateBoard();
    }

    setLure(i) {
        if (this.map[i] === 1 || this.failed || this.waiting) return;
        this.lurePos = i;
        window.gameApp.audio.playClick();
        this.updateBoard();
        // Lure stays active until a new lure is placed
    }

    moveEnemy() {
        if (this.failed) return;

        // Teleport Logic (Periodic)
        this.teleportCooldown -= 1; // Decrement on each move
        if (this.teleportCooldown <= 0 && Math.random() < 0.15) { // 15% chance if ready
            // Teleport to random empty cell not player and not spawn
            let candidates = [];
            this.map.forEach((v, i) => {
                if (v === 0 && i !== this.playerPos && i !== 2) candidates.push(i);
            });
            if (candidates.length > 0) {
                this.enemyPos = candidates[Math.floor(Math.random() * candidates.length)];
                this.teleportCooldown = 5; // Reset cooldown
                window.gameApp.audio.playTone(300, 'sawtooth', 0.5); // Teleport sound
                this.updateBoard();
                return;
            }
        }

        // Standard Move (BFS for shortest path to Player)
        let target = this.playerPos;

        // Lure Logic: If lure is set and within 3-cell range (close proximity)
        if (this.lurePos !== -1 && this.lurePos !== this.playerPos) {
            const dist = this.getDist(this.enemyPos, this.lurePos);
            // If within close range (3 cells), lure has 85% chance to attract
            if (dist <= 3) {
                if (Math.random() < 0.85) target = this.lurePos;
            }
        }

        // Strict BFS Pathfinding
        const next = this.getNextStep(this.enemyPos, target);

        // Verify Next Step Validity (Double Check)
        if (next !== -1 && this.map[next] === 0) {
            this.enemyPos = next;
            this.updateBoard();

            // Check Kill
            if (this.enemyPos === this.playerPos) {
                this.failGame();
            }
        }
    }

    getDist(i1, i2) {
        const r1 = Math.floor(i1 / 5);
        const c1 = i1 % 5;
        const r2 = Math.floor(i2 / 5);
        const c2 = i2 % 5;
        return Math.abs(r1 - r2) + Math.abs(c1 - c2);
    }

    getNeighbors(idx) {
        const r = Math.floor(idx / 5);
        const c = idx % 5;
        const res = [];
        const dirs = [[-1, 0], [1, 0], [0, -1], [0, 1]];
        dirs.forEach(d => {
            const nr = r + d[0];
            const nc = c + d[1];
            if (nr >= 0 && nr < 5 && nc >= 0 && nc < 5) {
                const nIdx = nr * 5 + nc;
                if (this.map[nIdx] === 0) res.push(nIdx);
            }
        });
        return res;
    }

    getNextStep(start, end) {
        // BFS
        const queue = [[start]];
        const visited = new Set([start]);

        while (queue.length > 0) {
            const path = queue.shift();
            const curr = path[path.length - 1];

            if (curr === end) {
                // Return second node in path (first step)
                return path.length > 1 ? path[1] : start;
            }

            const nbs = this.getNeighbors(curr);
            // Randomize neighbors for unpredictable movement when multiple paths exist?
            // User said: "Random (slightly higher chance to approach player)".
            // My BFS is deterministic "Shortest Path".
            // To add randomness: shuffle neighbors.
            nbs.sort(() => Math.random() - 0.5);

            for (let n of nbs) {
                if (!visited.has(n)) {
                    visited.add(n);
                    let newPath = [...path, n];
                    queue.push(newPath);
                }
            }
        }
        return -1;
    }
}

class VoltageModule extends GameModule {
    constructor() { super('voltage', 'Voltage'); }

    onStart() {
        this.value = 50; // 0 to 100
        this.target = 50;
        this.noise = 0;
        this.instability = 10 + this.aiLevel * 2;
        this.render();
    }

    onUpdate(dt) {
        // Random drift
        this.noise += (Math.random() - 0.5) * this.instability * dt * 5;
        this.noise = Math.max(-20, Math.min(20, this.noise));
        this.value += this.noise * dt;

        // Limit
        if (this.value < 0 || this.value > 100) {
            this.failGame();
        }
        this.updateUI();
    }

    render() {
        this.element.innerHTML = `
            <div class="module-header">${this.name} (AI ${this.aiLevel})</div>
            <div class="module-content">
                <div style="margin-top:5px; font-size:10px; color:#888; text-align:center;">STABILIZE VOLTAGE</div>
                <div style="height:30px; background:#111; margin-top:10px; position:relative; overflow:hidden; border:2px solid #555; box-shadow: inset 0 0 10px #000;">
                    <div id="volt-meter" style="position:absolute; left:50%; width:15%; height:100%; background:rgba(0, 243, 255, 0.2); transform:translateX(-50%); border-left:2px solid var(--accent-cyan); border-right:2px solid var(--accent-cyan);"></div>
                    <div id="volt-pointer" style="position:absolute; left:50%; width:6px; height:100%; background:white; transform:translateX(-50%); box-shadow: 0 0 10px white; z-index:5;"></div>
                </div>
                <div style="text-align:center;">
                    <button class="cyber-btn" id="volt-btn" style="padding:10px 20px; font-size:1.1rem; margin-top:15px; width:80%;">SHOCK</button>
                </div>
            </div>
        `;

        const btn = this.element.querySelector('#volt-btn');
        btn.onclick = () => {
            if (this.waiting || this.failed) return;
            if (this.value > 50) this.value -= 10;
            else this.value += 10;
            this.noise = 0; // Reset momentum
            window.gameApp.audio.playTone(100, 'sawtooth', 0.1);
        };
    }

    updateUI() {
        const ptr = this.element.querySelector('#volt-pointer');
        if (ptr) ptr.style.left = `${this.value}%`;
    }
}

class TrojanModule extends GameModule {
    constructor() { super('trojan', 'Trojan Horse'); }

    onStart() {
        this.progress = 0;
        this.active = true;
        this.trapZoneStart = 70 + Math.random() * 10; // 70-80%
        this.trapZoneEnd = this.trapZoneStart + 10; // 10% width
        this.speed = 2 + (this.aiLevel); // % per sec approx
        this.moving = false;
        this.moveTimer = 0;

        // Anti-stall timer
        this.idleTimer = 15; // 15 seconds to catch

        this.render();
    }

    onUpdate(dt) {
        // Stall check
        this.idleTimer -= dt;
        if (this.idleTimer <= 0) {
            this.failGame(); // Took too long
            return;
        }

        // Intermittent movement
        if (this.moveTimer <= 0) {
            // Pick new state
            this.moving = !this.moving;
            if (this.moving) {
                this.moveTimer = 1 + Math.random(); // Move for 1-2s
                // Audio cue
                window.gameApp.audio.playTone(50, 'square', 0.1, 0.2); // Low step sound
            } else {
                this.moveTimer = 1 + Math.random() * 2; // Wait for 1-3s
            }
        }

        this.moveTimer -= dt;

        if (this.moving) {
            this.progress += this.speed * dt * 2; // Move faster when moving
            if (this.progress >= 100) {
                this.progress = 100;
                this.failGame();
            }
        }

        this.updateUI();
    }

    render() {
        this.element.innerHTML = `
            <div class="module-header">${this.name} (AI ${this.aiLevel})</div>
            <div class="module-content">
                <div style="height:5px; background:#333; margin-bottom:5px;"><div id="trojan-timer" style="height:100%; background:var(--accent-red); width:100%;"></div></div>
                <div style="position:relative; width:100%; height:30px; background:#000; border:1px solid #333; margin-top:10px;">
                    <!-- Trap Zone Highlight -->
                    <div style="position:absolute; left:${this.trapZoneStart}%; width:${this.trapZoneEnd - this.trapZoneStart}%; height:100%; background:rgba(255, 0, 85, 0.2); border-left:2px solid var(--accent-red); border-right:2px solid var(--accent-red);"></div>
                    <div id="trojan-progress" style="width:0%; height:100%; background:rgba(0, 243, 255, 0.2); border-right:2px solid var(--accent-cyan);"></div>
                </div>
                 <div style="display:flex; justify-content:center; margin-top:15px;">
                    <button class="cyber-btn" id="trojan-btn" style="padding:5px 15px; font-size:1rem;">QUARANTINE</button>
                </div>
            </div>
        `;

        this.element.querySelector('#trojan-btn').onclick = () => this.tryCatch();
    }

    updateUI() {
        const bar = this.element.querySelector('#trojan-progress');
        if (bar) bar.style.width = `${this.progress}%`;

        const tbar = this.element.querySelector('#trojan-timer');
        if (tbar) tbar.style.width = `${(this.idleTimer / 15) * 100}%`;
    }

    tryCatch() {
        if (this.failed || this.waiting) return;

        // Check if in zone
        if (this.progress >= this.trapZoneStart && this.progress <= this.trapZoneEnd) {
            window.gameApp.audio.playClick();
            this.success(); // Reset
        } else {
            this.progress = 0;
            window.gameApp.audio.playTone(100, 'sawtooth', 0.5); // Error sound
        }
    }
}

// --- Main Application ---
class GameApp {
    constructor() {
        this.modules = [
            new PuppetModule(), new MinesweeperModule(), new SimonModule(), new MemoryModule(),
            new ShufflerModule(), new RabbitModule(), new MathModule(), new TypingModule(),
            new SpamModule(), new VentInvaderModule(), new VoltageModule(), new TrojanModule()
        ];

        this.audio = new AudioController();
        this.state = 'MENU'; // MENU, PLAYING, RESULT
        this.duration = 180; // Seconds
        this.timer = 0;
        this.aggressive = false;
        this.lastTime = 0;

        // Bindings
        this.hudTime = document.getElementById('time-display');
        this.initAudioBtn = document.getElementById('init-audio-btn');

        this.setupMenu();
        this.setupAudio();

        requestAnimationFrame((t) => this.loop(t));
    }

    setupAudio() {
        this.initAudioBtn.addEventListener('click', () => {
            this.audio.init();
            document.getElementById('audio-init-overlay').classList.remove('active');
        });
    }

    setupMenu() {
        const grid = document.getElementById('character-grid');
        const presetList = document.getElementById('preset-list');
        const startBtn = document.getElementById('start-btn');
        const totalScoreEl = document.getElementById('total-score');

        // Ensure global reference exists early so inline onclicks can use it without race
        window.gameApp = this;

        // Render Module Selectors
        this.modules.forEach(mod => {
            const card = document.createElement('div');
            card.className = 'char-card';
            card.innerHTML = `
                <h4>${mod.name}</h4>
                <div class="ai-control">
                    <button class="arrow-btn" onclick="gameApp.adjustAI('${mod.id}', -1)">&#9664;</button>
                    <div class="ai-val" id="ai-${mod.id}">0</div>
                    <button class="arrow-btn" onclick="gameApp.adjustAI('${mod.id}', 1)">&#9654;</button>
                </div>
            `;
            grid.appendChild(card);
        });

        // Event for AI Adjustment
        window.gameApp = this; // Global ref for inline onclicks

        // Presets
        const presets = [
            { name: "ALL 20", levels: Array(12).fill(20) },
            { name: "ALL 5", levels: Array(12).fill(5) },
            { name: "Split Attention", levels: [15, 0, 0, 0, 0, 15, 0, 0, 10, 0, 0, 10] },
            { name: "Cold Logic", levels: [0, 0, 15, 10, 0, 0, 15, 0, 0, 0, 10, 0] },
            { name: "Hands Busy", levels: [15, 0, 0, 0, 0, 10, 0, 15, 5, 0, 15, 0] },
            { name: "One Mistake", levels: [15, 0, 0, 0, 0, 0, 0, 0, 5, 20, 0, 10] },
            { name: "False Calm", levels: [0, 0, 0, 15, 0, 10, 10, 0, 5, 0, 15, 0] },
            { name: "Tunnel Vision Killer", levels: [15, 20, 0, 0, 0, 10, 0, 0, 5, 0, 0, 0] },
            { name: "The Juggler", levels: [15, 0, 15, 0, 0, 0, 0, 0, 5, 0, 15, 10] },
            { name: "Predator", levels: [15, 0, 0, 0, 0, 0, 0, 0, 0, 20, 0, 15] },
            { name: "Memory Leak", levels: [0, 0, 15, 20, 0, 0, 15, 0, 5, 0, 10, 0] },
            { name: "No Safe Zone", levels: [15, 0, 0, 0, 0, 10, 0, 0, 5, 15, 15, 10] },
            { name: "Precision Hell", levels: [0, 0, 0, 0, 0, 20, 0, 0, 5, 0, 10, 20] },
            { name: "Cognitive Overload", levels: [10, 15, 15, 15, 0, 0, 10, 0, 5, 0, 0, 0] },
            { name: "Relentless", levels: [20, 0, 0, 0, 0, 10, 0, 0, 0, 15, 15, 10] },
            { name: "Elite Four", levels: [20, 0, 0, 20, 0, 20, 0, 0, 0, 20, 0, 0] },
            { name: "ALL 20 – Broken Night", levels: [20, 20, 20, 0, 0, 0, 0, 0, 0, 20, 20, 20] }
        ];

        // Clear existing buttons first
        presetList.innerHTML = '';
        presets.forEach(p => {
            const btn = document.createElement('div');
            btn.className = 'preset-btn';
            btn.innerText = p.name;
            btn.onclick = () => this.loadPreset(p.levels);
            presetList.appendChild(btn);
        });

        startBtn.onclick = () => this.startGame();
    }

    adjustAI(id, delta) {
        this.audio.playClick();
        const mod = this.modules.find(m => m.id === id);
        if (!mod) return;
        mod.aiLevel = Math.max(0, Math.min(20, mod.aiLevel + delta));
        document.getElementById(`ai-${id}`).innerText = mod.aiLevel;
        this.updateTotalScore();
    }

    loadPreset(levels) {
        this.audio.playClick();
        this.modules.forEach((mod, i) => {
            mod.aiLevel = levels[i] || 0;
            document.getElementById(`ai-${mod.id}`).innerText = mod.aiLevel;
        });
        this.updateTotalScore();
    }

    updateTotalScore() {
        const score = this.modules.reduce((acc, m) => acc + (m.aiLevel * 10), 0);
        document.getElementById('total-score').innerText = score;
    }

    startGame() {
        this.audio.playClick();
        this.state = 'PLAYING';
        this.timer = 0;

        // Get Settings
        const durationInput = document.querySelector('input[name="duration"]:checked');
        this.duration = parseInt(durationInput ? durationInput.value : 180);
        this.aggressive = document.getElementById('aggressive-mode').checked;
        this.chaosMode = document.getElementById('chaos-mode').checked;
        this.blackoutMode = document.getElementById('blackout-mode').checked;
        this.shopMode = document.getElementById('shop-mode').checked;
        this.randomMode = document.getElementById('random-mode').checked;

        // Mode Timers
        this.chaosTimer = 30;
        this.blackoutTimer = 15;
        this.randomTimer = 30; // Random Mode
        this.isBlackout = false;

        // Shop Init
        this.coins = 0;
        this.hasDeathCoin = false;
        document.getElementById('game-coins').innerText = '0';
        document.getElementById('coin-hud').style.display = this.shopMode ? 'block' : 'none';
        document.getElementById('death-coin-container').style.display = this.shopMode ? 'block' : 'none';

        const dcBtn = document.getElementById('buy-death-coin');
        dcBtn.onclick = () => this.buyDeathCoin();
        this.updateDeathCoinBtn();

        // UI Switch
        document.getElementById('menu-screen').classList.remove('active');
        document.getElementById('game-screen').classList.add('active');

        // Init Modules (protect per-module init so one failing module doesn't stop the rest)
        const grid = document.getElementById('dashboard-grid');
        grid.innerHTML = '';
        this.modules.forEach(mod => {
            const el = document.createElement('div');
            el.className = 'module';
            el.id = `module-${mod.id}`; // Always set ID for targeting
            grid.appendChild(el);
            try {
                mod.init(el, mod.aiLevel, this.aggressive);
                // Clear any previous transient error marker
                el.classList.remove('module-init-error');
            } catch (err) {
                // Log for developer; do not inject visible UI error to avoid confusing users.
                console.error('Module init error:', mod.id, err);
                el.classList.add('module-init-error');
            }
        });
    }

    loop(timestamp) {
        const dt = (timestamp - this.lastTime) / 1000;
        this.lastTime = timestamp;

        if (this.state === 'PLAYING') {
            this.timer += dt;

            // Timer Display
            let remaining = Math.max(0, this.duration - this.timer);
            let mins = Math.floor(remaining / 60);
            let secs = Math.floor(remaining % 60);
            this.hudTime.innerText = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;

            // Win Condition
            if (remaining <= 0) {
                this.triggerWin();
            }

            // Game Modes Logic
            if (this.chaosMode) {
                this.chaosTimer -= dt;
                if (this.chaosTimer <= 0) {
                    this.chaosTimer = 30;
                    this.triggerChaos();
                }
            }

            if (this.randomMode) {
                this.randomTimer -= dt;
                if (this.randomTimer <= 0) {
                    this.randomTimer = 30;
                    this.triggerRandomEvent();
                }
            }

            if (this.blackoutMode) {
                this.blackoutTimer -= dt;
                if (this.blackoutTimer <= 0) {
                    if (this.isBlackout) {
                        // End Blackout
                        this.isBlackout = false;
                        this.blackoutTimer = 15 + Math.random() * 10;
                        document.getElementById('blackout-overlay')?.remove();
                    } else {
                        // Start Blackout
                        this.isBlackout = true;
                        this.blackoutTimer = 4; // Lasts 4 seconds
                        const ov = document.createElement('div');
                        ov.id = 'blackout-overlay';
                        ov.style.cssText = "position:fixed; top:0; left:0; width:100vw; height:100vh; background:black; z-index:9999; pointer-events:none;";
                        document.body.appendChild(ov);
                        window.gameApp.audio.playTone(50, 'sine', 1.0); // Hum
                    }
                }
            }

            // Update Modules
            this.modules.forEach(m => m.update(dt));
        }

        requestAnimationFrame((t) => this.loop(t));
    }

    triggerGameOver(reason) {
        if (this.state !== 'PLAYING') return;
        this.state = 'RESULT';
        this.audio.playLose();

        document.getElementById('result-message').innerText = `Failed Module: ${reason}`;
        document.getElementById('result-title').innerText = "GAME OVER";
        document.getElementById('result-title').style.color = "var(--accent-red)";

        this.showResult();
    }

    triggerWin() {
        if (this.state !== 'PLAYING') return;
        this.state = 'RESULT';
        this.audio.playWin();

        document.getElementById('result-message').innerText = `Survived until 6AM`;
        document.getElementById('result-title').innerText = "YOU WON";
        document.getElementById('result-title').style.color = "var(--accent-green)";

        this.showResult();
    }

    showResult() {
        document.getElementById('result-screen').classList.add('active');
        document.getElementById('retry-btn').onclick = () => {
            location.reload(); // Simple reload for now
        };
    }

    triggerChaos() {
        // Randomize AI levels +/- 5
        this.modules.forEach(m => {
            if (m.aiLevel > 0) {
                let change = Math.floor(Math.random() * 11) - 5; // -5 to +5
                m.aiLevel = Math.max(1, Math.min(20, m.aiLevel + change));
                // Update specific module instance if needed (most read aiLevel property directly)
                // Shuffler: interval depends on AI. Update parameter.
                if (m.id === 'shuffler') m.interval = Math.max(20, 80 - (m.aiLevel * 3.0));
                if (m.id === 'vent') m.moveInterval = Math.max(1.0, 5.0 - (m.aiLevel * 0.2));
            }
        });

        // Notify
        this.showNotification("CHAOS: AI LEVELS SHIFTED", "var(--accent-purple)");
        window.gameApp.audio.playTone(400, 'sawtooth', 0.5);
    }

    // New: Shop & Random Logic
    addCoin(amount) {
        this.coins += amount;
        document.getElementById('game-coins').innerText = this.coins;
        this.updateDeathCoinBtn();
    }

    updateDeathCoinBtn() {
        const btn = document.getElementById('buy-death-coin');
        if (this.coins >= 10 && !this.hasDeathCoin) {
            btn.disabled = false;
        } else {
            btn.disabled = true;
        }
    }

    buyDeathCoin() {
        if (this.coins >= 10 && !this.hasDeathCoin) {
            this.coins -= 10;
            this.hasDeathCoin = true;
            document.getElementById('game-coins').innerText = this.coins;
            this.audio.playWin(); // Sound
            this.toggleDeathCoinOverlay(true);
            this.updateDeathCoinBtn(); // Core fix: ensure button state is updated immediately
        }
    }

    toggleDeathCoinOverlay(active) {
        this.modules.forEach(m => {
            if (active && m.aiLevel > 0) {
                // Add overlay if not exists
                if (!m.element.querySelector('.death-coin-overlay')) {
                    const ov = document.createElement('div');
                    ov.className = 'death-coin-overlay';
                    ov.innerText = "ELIMINATE";
                    ov.onclick = (e) => {
                        e.stopPropagation();
                        this.useDeathCoin(m);
                    };
                    m.element.appendChild(ov);
                }
            } else {
                const ov = m.element.querySelector('.death-coin-overlay');
                if (ov) ov.remove();
            }
        });
    }

    useDeathCoin(module) {
        module.eliminate();
        this.hasDeathCoin = false;
        this.toggleDeathCoinOverlay(false);
        this.audio.playLose(); // Crunch sound
        this.showNotification("TARGET ELIMINATED", "var(--accent-red)");
        this.updateDeathCoinBtn();
    }

    triggerRandomEvent() {
        // Activate a random 0-AI module
        const inactive = this.modules.filter(m => m.aiLevel === 0);
        if (inactive.length > 0) {
            const m = inactive[Math.floor(Math.random() * inactive.length)];
            m.aiLevel = Math.floor(Math.random() * 10) + 5; // 5-15
            m.init(m.element, m.aiLevel, this.aggressive);
            this.showNotification(`NEW CHALLENGER: ${m.name}`, "white");
            this.audio.playAlarm();
        }
    }

    showNotification(text, color) {
        const msg = document.createElement('div');
        msg.innerText = text;
        msg.style.cssText = `position:fixed; top:10%; left:50%; transform:translate(-50%, -50%); color:${color}; font-size:20px; font-weight:bold; z-index:5000; text-shadow:0 0 10px ${color}; pointer-events:none;`;
        document.body.appendChild(msg);
        setTimeout(() => msg.remove(), 2000);
    }
}

// Start
window.addEventListener('load', () => {
    new GameApp();
});
