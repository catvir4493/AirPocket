// Animates numeric data fields from their current value to a target with a few setData steps.
// Keys may be paths ("summaryView.bagCount"). Equal values are set directly, so calling it
// on every refresh only animates the numbers that actually changed.
const STEPS = 12;
const STEP_MS = 34;

const easeOut = (t) => 1 - Math.pow(1 - t, 3);

const readPath = (data, path) =>
  path.split(".").reduce((value, key) => (value == null ? value : value[key]), data);

// Whole numbers stay whole; anything else keeps one decimal while it moves.
const roundLike = (value, target) =>
  Number.isInteger(target) ? Math.round(value) : Math.round(value * 10) / 10;

const countUp = (page, values) => {
  clearTimeout(page._countUpTimer);
  const runs = Object.keys(values).map((key) => {
    const to = Number(values[key]) || 0;
    const from = Number(readPath(page.data, key)) || 0;
    return { key, from, to };
  });
  const moving = runs.filter((run) => run.from !== run.to);
  if (!moving.length) {
    return;
  }
  let step = 0;
  const tick = () => {
    step += 1;
    const progress = easeOut(step / STEPS);
    const next = {};
    moving.forEach(({ key, from, to }) => {
      next[key] = step >= STEPS ? to : roundLike(from + (to - from) * progress, to);
    });
    page.setData(next);
    if (step < STEPS) {
      page._countUpTimer = setTimeout(tick, STEP_MS);
    }
  };
  tick();
};

module.exports = { countUp };
