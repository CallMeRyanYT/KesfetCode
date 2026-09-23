// Four original quiet looping scores, synthesized locally without downloads.
export const AMBIENT_TRACKS = {
  menu: { beat:.72, root:48, chords:[0,5,9,7], melody:[12,19,16,24,19,16,14,19], wave:'sine' },
  forest: { beat:.48, root:60, chords:[0,7,5,0], melody:[0,4,7,12,7,4,2,7], wave:'triangle' },
  mars: { beat:.8, root:45, chords:[0,3,7,5], melody:[0,7,10,12,7,3,10,7], wave:'sine' },
  ice: { beat:.92, root:62, chords:[0,5,2,7], melody:[12,7,19,14,12,24,19,7], wave:'sine' }
};
export class AmbientMusic {
  constructor({createContext, onStatus=()=>{}}={}) {
    this.createContext=createContext||(()=>{const C=globalThis.AudioContext||globalThis.webkitAudioContext;return C?new C():null;});
    this.onStatus=onStatus;this.context=null;this.enabled=false;this.theme='menu';this.voices=new Set();this.timer=null;this.generation=0;
  }
  stop(){this.generation++;clearInterval(this.timer);this.timer=null;for(const v of this.voices){try{v.o.stop();}catch{}v.o.disconnect();v.g.disconnect();}this.voices.clear();this.onStatus(false);}
  setTheme(theme){if(!AMBIENT_TRACKS[theme]||theme===this.theme)return;this.theme=theme;this.stop();if(this.enabled)this.start();}
  async setEnabled(enabled){this.enabled=!!enabled;this.stop();if(this.enabled)return this.start();return false;}
  async start(){
    const id=this.generation;
    try{
      if(!this.context||this.context.state==='closed')this.context=this.createContext();
      if(!this.context)return false;
      if(this.context.state!=='running')await this.context.resume();
      if(id!==this.generation||!this.enabled||this.context.state!=='running')return false;
      let step=0,next=this.context.currentTime+.05;
      const track=AMBIENT_TRACKS[this.theme];
      const schedule=()=>{
        if(id!==this.generation)return;
        while(next<this.context.currentTime+.6){
          const chord=track.chords[Math.floor(step/8)%track.chords.length];
          this.note(track.root+chord+track.melody[step%8],next,track.beat*1.7,.045,track.wave);
          if(step%8===0)for(const n of [0,7,12])this.note(track.root-12+chord+n,next,track.beat*7.8,.022,'sine');
          step++;next+=track.beat;
        }
      };
      schedule();this.timer=setInterval(schedule,200);this.onStatus(true);return true;
    }catch{this.onStatus(false);return false;}
  }
  note(midi,at,duration,volume,wave){
    const o=this.context.createOscillator(),g=this.context.createGain();o.type=wave;o.frequency.setValueAtTime(440*2**((midi-69)/12),at);
    g.gain.setValueAtTime(.0001,at);g.gain.linearRampToValueAtTime(volume,at+.08);g.gain.exponentialRampToValueAtTime(.0001,at+duration);
    o.connect(g);g.connect(this.context.destination);const voice={o,g};this.voices.add(voice);o.onended=()=>{o.disconnect();g.disconnect();this.voices.delete(voice);};o.start(at);o.stop(at+duration+.02);
  }
}
