// Light tap feedback for small selections (steppers, chips, segments, tabs).
// Throttled so a burst of quick taps doesn't turn into one long buzz.
let lastTap = 0;

const tap = () => {
  const now = Date.now();
  if (now - lastTap < 60 || !wx.vibrateShort) {
    return;
  }
  lastTap = now;
  wx.vibrateShort({ type: "light", fail() {} });
};

module.exports = { tap };
