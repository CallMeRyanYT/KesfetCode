// The program runner and renderer share these timings so pickups happen on arrival.
export const MOVE_MS = 680;
export const TURN_MS = 400;
export const PICKUP_MS = 1250;
export const WIN_MS = 2100;
export const LAUNCH_MS = 4400;
export const COUNTDOWN_MS = 3000;
export const PRESS_MS = 820;
export const PRESS_LAND_MS = PRESS_MS * .65;
export const IMPACT_MS = 1400;
const clamp = value => Math.max(0, Math.min(1, value));
export const PICKUP_EVENTS = ['crystal', 'battery', 'key', 'component', 'fragment'];

/** Every action starts and ends in a neutral pose. Wheels stay on the floor. */
export function robotPose(kind, elapsed, idleTime = 0) {
  const pose = { y: 0, z: 0, rx: 0, rz: 0, sx: 1, sy: 1, armLift: 0, armSwing: 0, sparks: 0 };
  if (kind === 'still') return pose;
  if (kind === 'wave') {
    pose.wave = true;
    pose.armLift = .85;
    pose.armSwing = Math.sin(idleTime*5)*.45;
    pose.rz = Math.sin(idleTime*1.5)*.045;
  } else if (kind === 'move') {
    const t = clamp(elapsed / MOVE_MS), envelope = Math.sin(t * Math.PI);
    // Forward acceleration and braking, with suspension roll instead of hopping.
    pose.rx = Math.sin(t * Math.PI * 2) * .065;
    pose.rz = Math.sin(t * Math.PI * 4) * .012 * envelope;
    // Let both arms counter-swing with the chassis so the drive reads as a
    // continuous wheel-powered journey instead of a tile-to-tile teleport.
    pose.armSwing = envelope * -.28;
    pose.armLift = Math.sin(t * Math.PI) * .16;
  } else if (kind === 'turn') {
    const t = clamp(elapsed / TURN_MS), envelope = Math.sin(t * Math.PI);
    pose.rz = envelope * -.045;
    pose.armSwing = envelope * .16;
  } else if (PICKUP_EVENTS.includes(kind)) {
    const t = clamp(elapsed / PICKUP_MS), envelope = Math.sin(t * Math.PI);
    pose.armLift = envelope * .96;
    if (kind === 'battery') {
      pose.rx = -envelope * .055;
      pose.sy = 1 + envelope * .022;
      pose.armSwing = Math.sin(t * Math.PI * 2) * .06;
    } else {
      pose.y = kind === 'crystal' ? Math.abs(Math.sin(t * Math.PI * 2)) * .12 * envelope : 0;
      pose.rz = Math.sin(t * Math.PI * 2) * .09 * envelope;
      pose.armSwing = envelope * .42;
    }
  } else if (kind === 'press') {
    const t = clamp(elapsed / PRESS_MS);
    if (t < .15) {
      const crouch = Math.sin(t / .15 * Math.PI / 2);
      pose.sy = 1 - crouch * .18;
      pose.sx = 1 + crouch * .08;
      pose.armLift = crouch * .2;
    } else if (t < .65) {
      const jump = (t - .15) / .5;
      pose.y = Math.sin(jump * Math.PI) * .85;
      pose.sy = 1 + Math.sin(jump * Math.PI) * .07;
      pose.armLift = .25 + Math.sin(jump * Math.PI) * .65;
      pose.rz = Math.sin(jump * Math.PI * 2) * .04;
    } else {
      const landing = Math.sin((t - .65) / .35 * Math.PI);
      pose.sy = 1 - landing * .24;
      pose.sx = 1 + landing * .12;
      pose.armLift = .25 * (1 - (t - .65) / .35);
    }
  } else if (kind === 'impact') {
    const t = clamp(elapsed / IMPACT_MS);
    if (t < .2) {
      pose.z = Math.sin(t / .2 * Math.PI / 2) * .22;
      pose.rx = t / .2 * .28;
    } else {
      const recoil = (t - .2) / .8;
      pose.z = .22 * Math.exp(-recoil * 10) - Math.sin(recoil * Math.PI) * .14;
      // Tip onto the back of the treads, pause, then rock upright safely.
      const topple = Math.sin(Math.min(1, recoil / .65) * Math.PI / 2) * (recoil < .65 ? 1 : Math.cos((recoil - .65) / .35 * Math.PI / 2));
      pose.rx = -topple * 1.35;
      pose.y = topple * .16;
      pose.rz = Math.sin(recoil * Math.PI * 7) * .07 * (1 - recoil);
      pose.sy = 1 - Math.sin(recoil * Math.PI) * .13;
      pose.sx = 1 + Math.sin(recoil * Math.PI) * .10;
      pose.armLift = Math.sin(recoil * Math.PI) * .6;
      pose.armSwing = Math.sin(recoil * Math.PI * 5) * .18;
      pose.sparks = Math.sin(Math.min(1, recoil / .65) * Math.PI);
    }
  } else if (kind === 'win') {
    const t = clamp(elapsed / WIN_MS), envelope = Math.sin(t * Math.PI);
    pose.y = Math.abs(Math.sin(t * Math.PI * 4)) * .20 * envelope;
    pose.rz = Math.sin(t * Math.PI * 6) * .20 * envelope;
    pose.rx = Math.sin(t * Math.PI * 8) * .07 * envelope;
    pose.armLift = envelope * .98;
    pose.armSwing = Math.sin(t * Math.PI * 6) * .5 * envelope;
  } else if (kind === 'launch') {
    const t = clamp(elapsed / LAUNCH_MS), envelope = Math.sin(t * Math.PI);
    pose.armLift = envelope * .98;
    pose.armSwing = Math.sin(t * Math.PI * 10) * .10 * envelope;
  } else if (kind === 'tired') {
    pose.rx = .065 + Math.sin(idleTime * 1.5) * .012;
    pose.sy = .985;
    pose.armSwing = -.05;
  } else if (kind === 'sleep') {
    // Energy exhaustion settles into a standing nap: a slow head nod and
    // loose arms keep the robot visibly asleep while it remains on its tile.
    pose.rx = .12 + Math.sin(idleTime * 1.15) * .035;
    pose.rz = Math.sin(idleTime * .7) * .025;
    pose.sy = .97;
    pose.armSwing = -.09 + Math.sin(idleTime * 1.2) * .025;
  } else {
    pose.rz = Math.sin(idleTime * 1.2) * .012;
    pose.sy = 1 + Math.sin(idleTime * 1.8) * .008;
    pose.armSwing = Math.sin(idleTime * 1.6) * .055;
    if (kind === 'ready') pose.armLift = .2 + (Math.sin(idleTime * 3) + 1) * .15;
  }
  return pose;
}

/** A collected object remains visible until the robot has reached its square. */
export function pickupProgress(now, arrival, duration = PICKUP_MS) {
  const elapsed = now - arrival;
  // A timestamp produced as `arrival + duration` can subtract back to just
  // under `duration` because of floating point rounding. Treat that endpoint
  // as complete so a collected prop never lingers for an extra frame.
  if (elapsed >= duration - 1e-9) return 1;
  return clamp(elapsed / duration);
}

export function launchStage(elapsed) {
  if (elapsed < COUNTDOWN_MS) return String(3 - Math.floor(Math.max(0, elapsed) / 1000));
  return 'liftoff';
}
