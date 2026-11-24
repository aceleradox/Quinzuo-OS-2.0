import { getSettings } from './settings.js';

export const HQAudio = {
    ctx: null,
    init() {
        if (getSettings().audio === false) return;
        try {
            if (!this.ctx) this.ctx = new (window.AudioContext || window.webkitAudioContext)();
            if (this.ctx.state === 'suspended') this.ctx.resume();
        } catch (_) { this.ctx = null; }
    },
    playTone(freq, type, duration, vol = 0.1, sweep = 0, startTimeOffset = 0) {
        if (getSettings().audio === false) return;
        this.init();
        if (!this.ctx) return;
        try {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            const startTime = this.ctx.currentTime + startTimeOffset;
            osc.type = type;
            osc.frequency.setValueAtTime(freq, startTime);
            if (sweep !== 0) osc.frequency.exponentialRampToValueAtTime(Math.max(1, freq + sweep), startTime + duration);
            gain.gain.setValueAtTime(vol, startTime);
            gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
            osc.connect(gain);
            gain.connect(this.ctx.destination);
            osc.start(startTime);
            osc.stop(startTime + duration);
        } catch (_) {}
    },
    boot() {
        this.init();
        [261.63, 329.63, 392.00, 523.25].forEach((f, i) => {
            setTimeout(() => {
                this.playTone(f, 'sine', 3.5, 0.15);
                this.playTone(f / 2, 'triangle', 4, 0.1);
            }, i * 150);
        });
    },
    uiClick() { this.playTone(1200, 'sine', 0.05, 0.05, -500); },
    appOpen() { this.playTone(300, 'sine', 0.2, 0.08, 400); },
    appClose() { this.playTone(600, 'sine', 0.15, 0.08, -300); },
    traumaAlert() {
        for (let i = 0; i < 3; i++) {
            this.playTone(800, 'square', 0.15, 0.2, 0, i * 0.4);
            this.playTone(400, 'square', 0.15, 0.2, 0, (i * 0.4) + 0.15);
        }
        this.playTone(800, 'sawtooth', 1.0, 0.3, -200, 1.2);
        this.playTone(200, 'sawtooth', 1.5, 0.3, -100, 2.2);
    },
    excitacao() { this.playTone(800, 'sine', 0.5, 0.1, 800); }
};
