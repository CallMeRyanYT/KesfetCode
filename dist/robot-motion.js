// Shared timing keeps the robot, switch, door and sound on the same beat.
export const MOVE_MS = 500;
export const PRESS_MS = 820;
export const PRESS_LAND_MS = PRESS_MS * .65;
export const IMPACT_MS = 850;
const clamp = value => Math.max(0, Math.min(1, value));

export function robotPose(kind, elapsed, idleTime = 0) {
  const pose = { y: 0, z: 0, rx: 0, rz: 0, sx: 1, sy: 1, armLift: 0, armSwing: 0, sparks: 0 };
  if (kind === 'move') {
    const t = clamp(elapsed / MOVE_MS), envelope = Math.sin(t * Math.PI);
    pose.y = envelope * .16 + Math.abs(Math.sin(t * Math.PI * 4)) * .025;
    pose.rx = envelope * .12;
    pose.rz = Math.sin(t * Math.PI * 4) * .09;
    pose.sy = 1 + envelope * .035;
    pose.armSwing = Math.sin(t * Math.PI * 4) * .3;
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
      pose.rx = t / .2 * .18;
    } else {
      const recoil = (t - .2) / .8;
      pose.z = .22 * Math.exp(-recoil * 10) - Math.sin(recoil * Math.PI) * .14;
      pose.rx = -Math.sin(recoil * Math.PI) * .32;
      pose.rz = Math.sin(recoil * Math.PI * 7) * .10 * (1 - recoil);
      pose.sy = 1 - Math.sin(recoil * Math.PI) * .13;
      pose.sx = 1 + Math.sin(recoil * Math.PI) * .10;
      pose.armLift = Math.sin(recoil * Math.PI) * .6;
      pose.sparks = Math.sin(Math.min(1, recoil / .65) * Math.PI);
    }
  } else if (kind === 'win') {
    const t = clamp(elapsed / 1900), envelope = Math.sin(t * Math.PI);
    pose.y = Math.abs(Math.sin(t * Math.PI * 5)) * .32 * envelope;
    pose.rz = Math.sin(t * Math.PI * 5) * .13 * envelope;
    pose.armLift = envelope * .95;
  } else {
    pose.y = Math.sin(idleTime * 1.8) * .013;
    pose.rz = Math.sin(idleTime * 1.2) * .018;
    pose.sy = 1 + Math.sin(idleTime * 1.8) * .012;
    pose.armSwing = Math.sin(idleTime * 1.6) * .07;
  }
  return pose;
}
