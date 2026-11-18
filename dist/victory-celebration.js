const COLORS = ['#ffd438', '#0bb5c5', '#ff812c', '#8d6bdf', '#55ca72', '#ff6da5'];

// Velocities are viewport units per second; positive y points down the screen.
// Sampling this equation at equal times gives gravity its own acceleration,
// without applying one easing curve to both the upward and downward flight.
export function confettiTrajectory({ velocityX, velocityY, gravity, spin = 0 }, seconds) {
  return {
    x: velocityX * seconds,
    y: velocityY * seconds + .5 * gravity * seconds * seconds,
    rotation: spin * seconds
  };
}

function flightFrames(physics, duration) {
  return Array.from({ length: 65 }, (_, index) => {
    const offset = index / 64;
    const position = confettiTrajectory(physics, duration * offset);
    return {
      offset,
      transform: `translate3d(${position.x.toFixed(3)}vw,${position.y.toFixed(3)}vh,0) rotate(${position.rotation.toFixed(2)}deg) rotateY(${(position.rotation * .7).toFixed(2)}deg)`,
      opacity: Math.min(1, offset / .035, (1 - offset) / .10)
    };
  });
}

// The success dialog owns its decoration, keeping it in the browser's top layer.
// One bounded burst is enough; no animation loop runs after the celebration.
export function mountVictoryCelebration(host, {
  // The game's Motion switch owns this effect, including its explicit opt-in.
  reducedMotion = false,
  random = Math.random,
  timers = globalThis
} = {}) {
  if (!host?.ownerDocument) return () => {};
  const document = host.ownerDocument;
  const layer = document.createElement('div');
  const still = reducedMotion || typeof layer.animate !== 'function';
  layer.className = `victory-confetti${still ? ' is-still' : ''}`;
  layer.setAttribute('aria-hidden', 'true');
  const animations = [];
  const flights = [];
  const count = still ? 18 : 72;
  for (let index = 0; index < count; index++) {
    const piece = document.createElement('i');
    piece.className = 'victory-confetti-piece';
    const left = index % 2 === 0;
    const origin = left ? 5 + random() * 8 : 87 + random() * 8;
    piece.style.setProperty('--confetti-color', COLORS[index % COLORS.length]);
    piece.style.setProperty('--confetti-origin', `${origin.toFixed(2)}vw`);
    piece.style.setProperty('--confetti-spin', `${(random() * 1080 - 540).toFixed(0)}deg`);
    piece.style.setProperty('--confetti-size', `${(7 + random() * 5).toFixed(1)}px`);
    piece.style.setProperty('--confetti-still-x', `${(5 + random() * 90).toFixed(2)}%`);
    piece.style.setProperty('--confetti-still-y', `${(5 + random() * 90).toFixed(2)}%`);
    layer.append(piece);
    if (!still) {
      const physics = {
        velocityX: (left ? 1 : -1) * (9 + random() * 20),
        velocityY: -(112 + random() * 33),
        gravity: 120 + random() * 25,
        spin: random() * 500 - 250
      };
      // Solve for a final position 24vh below the launch point, offscreen.
      const duration = (-physics.velocityY + Math.sqrt(physics.velocityY ** 2 + 2 * physics.gravity * 24)) / physics.gravity;
      flights.push({ piece, physics, duration, delay: random() * 180 });
    }
  }
  host.append(layer);
  for (const { piece, physics, duration, delay } of flights) {
    animations.push(piece.animate(flightFrames(physics, duration), {
      duration: duration * 1000, delay, easing: 'linear', fill: 'both'
    }));
  }
  let disposed = false;
  let timer;
  const dispose = () => {
    if (disposed) return;
    disposed = true;
    timers.clearTimeout(timer);
    for (const animation of animations) animation.cancel();
    layer.remove();
  };
  timer = timers.setTimeout(dispose, still ? 1300 : 3500);
  return dispose;
}
