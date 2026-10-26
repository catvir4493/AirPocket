// Points at a form field that failed validation: a toast, the field scrolled into view,
// then a short shake with a red label. The field's view carries id "ff-<field>" and the
// class from the template ("field-error shake-0|1", alternating so a repeat replays).
const { showToast } = require("./toast");
const { getNavMetrics } = require("./navMetrics");

const SCROLL_MS = 280;
const HOLD_MS = 1600;

const flagField = (page, field) => {
  clearTimeout(page._fieldErrorTimer);
  page.setData({ errorField: field, errorTick: (page.data.errorTick || 0) + 1 });
  page._fieldErrorTimer = setTimeout(() => page.setData({ errorField: "" }), HOLD_MS);
};

const showFieldError = (page, error) => {
  showToast({ title: error.message, icon: "none" });
  wx.createSelectorQuery()
    .select(`#ff-${error.field}`)
    .boundingClientRect()
    .selectViewport()
    .scrollOffset()
    .exec(([rect, viewport]) => {
      if (!rect || !viewport) {
        flagField(page, error.field);
        return;
      }
      const info = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync();
      // Leave room for the custom navbar on top and the fixed action bar at the bottom.
      const topBar = getNavMetrics().navTotal + 12;
      const bottomBar = (info.windowWidth / 750) * 220;
      const visible = rect.top >= topBar && rect.bottom <= info.windowHeight - bottomBar;
      if (visible) {
        flagField(page, error.field);
        return;
      }
      wx.pageScrollTo({
        scrollTop: Math.max(0, viewport.scrollTop + rect.top - info.windowHeight * 0.28),
        duration: SCROLL_MS,
      });
      clearTimeout(page._fieldErrorTimer);
      page._fieldErrorTimer = setTimeout(() => flagField(page, error.field), SCROLL_MS);
    });
};

const clearFieldError = (page) => {
  clearTimeout(page._fieldErrorTimer);
};

module.exports = { showFieldError, clearFieldError };
