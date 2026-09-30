class SoundManager {
  constructor() {
    this.audioCtx = null;
    this.synth = window.speechSynthesis || null;
  }

  init() {
    if (!this.audioCtx) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      this.audioCtx = new AudioContext();
    }
    if (this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }
  }

  playBeep(freq = 880, type = 'sine', duration = 0.2, count = 1) {
    this.init();
    if (!this.audioCtx) return;

    for (let i = 0; i < count; i++) {
      setTimeout(() => {
        try {
          const osc = this.audioCtx.createOscillator();
          const gain = this.audioCtx.createGain();
          osc.type = type;
          osc.frequency.setValueAtTime(freq, this.audioCtx.currentTime);
          
          gain.gain.setValueAtTime(0.3, this.audioCtx.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.01, this.audioCtx.currentTime + duration);

          osc.connect(gain);
          gain.connect(this.audioCtx.destination);

          osc.start();
          osc.stop(this.audioCtx.currentTime + duration);
        } catch (e) {
          console.error("Audio error", e);
        }
      }, i * (duration * 1000 + 100));
    }
  }

  // Level alerts
  playLevelAlert(levelNum) {
    if (levelNum === 2) {
      // Soft chime warning
      this.playBeep(523.25, 'triangle', 0.25, 1);
    } else if (levelNum === 3) {
      // Danger alert double beep
      this.playBeep(784, 'square', 0.2, 2);
    } else if (levelNum === 4) {
      // Critical SOS siren alarm
      this.playBeep(1046.5, 'sawtooth', 0.15, 4);
    }
  }

  speak(text) {
    if (!this.synth) return;
    try {
      this.synth.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'vi-VN';
      utterance.rate = 1.05;
      utterance.pitch = 1.0;
      this.synth.speak(utterance);
    } catch (e) {
      console.warn("Speech synthesis error", e);
    }
  }
}

export const soundManager = new SoundManager();
