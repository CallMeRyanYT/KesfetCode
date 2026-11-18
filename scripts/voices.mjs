// Generates the story voice lines (dist/assets/voice/<lang>/<id>.mp3) on Windows,
// offline, from dist/story-script.js. Only lines whose text changed are redone.
//
//   node scripts/voices.mjs          update changed lines
//   node scripts/voices.mjs --force  redo every line
//
// To use a real recording, record the line and save it over the generated file
// with the same name, then add its id to "recorded" in dist/assets/voice/voices.json
// so it is never regenerated.
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { LINES } from '../dist/story-script.js';

const OUT = 'dist/assets/voice';
const MANIFEST = join(OUT, 'voices.json');
// Each speaker: Windows voice, speaking rate, and the ffmpeg character filter.
const CAST = {
  kasif: {
    en: { voice: 'Mark', rate: '-5%' }, tr: { voice: 'Tolga', rate: '-5%' },
    // Higher, brighter and a little metallic: a small, friendly robot.
    filter: 'aresample=24000,asetrate=30000,aresample=44100,atempo=0.86,highpass=f=140,chorus=0.7:0.9:18:0.25:0.25:2.5,aecho=0.8:0.4:9:0.18,volume=1.5'
  },
  nova: {
    en: { voice: 'Zira', rate: '-8%' }, tr: { voice: 'Tolga', rate: '-8%', pitch: 1.12 },
    // Calm mission control over the lab's speakers.
    filter: 'aresample=24000,asetrate=PITCH,aresample=44100,atempo=TEMPO,highpass=f=110,aecho=0.8:0.6:55|110:0.22|0.12,volume=1.4'
  }
};
const LANG = { en: 'en-US', tr: 'tr-TR' };

const manifest = existsSync(MANIFEST) ? JSON.parse(readFileSync(MANIFEST, 'utf8')) : { lines: {}, recorded: [] };
const force = process.argv.includes('--force');
const work = join(tmpdir(), `kesfet-voices-${process.pid}`);
mkdirSync(work, { recursive: true });

const jobs = [];
for (const [id, line] of Object.entries(LINES)) {
  if (line.who === 'you') continue;
  for (const lang of ['en', 'tr']) {
    const key = `${lang}/${id}`;
    if (manifest.recorded?.includes(key) || manifest.recorded?.includes(id)) continue;
    const setup = CAST[line.who][lang];
    const text = line[lang];
    const signature = createHash('sha1').update(JSON.stringify([text, setup, CAST[line.who].filter])).digest('hex').slice(0, 12);
    const out = join(OUT, lang, `${id}.mp3`);
    if (!force && manifest.lines[key] === signature && existsSync(out)) continue;
    jobs.push({ id, lang, key, signature, text, who: line.who, setup, wav: join(work, `${lang}-${id}.wav`), out });
  }
}
if (!jobs.length) { console.log('All voice lines are up to date.'); process.exit(0); }

writeFileSync(join(work, 'jobs.json'), JSON.stringify(jobs.map(job => ({ text: job.text, voice: job.setup.voice, lang: LANG[job.lang], rate: job.setup.rate, out: job.wav }))), 'utf8');
console.log(`Speaking ${jobs.length} lines…`);
execFileSync('powershell', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', resolve('scripts/tts.ps1'), '-Jobs', join(work, 'jobs.json')], { stdio: 'inherit' });

for (const job of jobs) {
  mkdirSync(join(OUT, job.lang), { recursive: true });
  const pitch = job.setup.pitch || 1.06;
  const filter = CAST[job.who].filter.replace('PITCH', String(Math.round(24000 * pitch))).replace('TEMPO', (1 / pitch * 1.0).toFixed(3));
  // Trim the synthesiser's leading silence, add character, keep files small.
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', job.wav, '-af', `silenceremove=start_periods=1:start_threshold=-45dB,${filter},loudnorm=I=-16:TP=-1.5:LRA=11,apad=pad_dur=0.15`, '-ac', '1', '-ar', '44100', '-b:a', '64k', job.out]);
  manifest.lines[job.key] = job.signature;
}
writeFileSync(MANIFEST, JSON.stringify({ ...manifest, lines: Object.fromEntries(Object.entries(manifest.lines).sort()) }, null, 2));
rmSync(work, { recursive: true, force: true });
console.log(`Wrote ${jobs.length} voice files to ${OUT}.`);
