// Animates a numeric data field from 0 to its target with a few setData steps.
// Only meant for first loads; later updates should set the value directly.
const STEPS = 8;
const STEP_MS = 50;

const easeOut = (t) => 1 - Math.pow(1 - t, 3);

const countUp = (page, values) => {
  const keys = Object.keys(values);
  clearTimeout(page._countUpTimer);
  let step = 0;
  const tick = () => {
    step += 1;
    const progress = easeOut(step / STEPS);
    const next = {};
    keys.forEach((key) => {
      const target = Number(values[key]) || 0;
      next[key] = step >= STEPS ? target : Math.round(target * progress);
    });
    page.setData(next);
    if (step < STEPS) {
      page._countUpTimer = setTimeout(tick, STEP_MS);
    }
  };
  tick();
};

module.exports = { countUp };
