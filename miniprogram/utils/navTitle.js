// Helpers for pages that use the custom navbar (components/ap-navbar).
const { getNavMetrics } = require("./navMetrics");

// Collapses the navbar (small title + hairline) once half of `selector` has slid
// under it. Large-title pages watch ".large-title", so the large title shrinks
// away while the small one arrives; detail pages watch the ".nav-sentinel" at the
// top of the page and only use it for the hairline.
const watchNavTitle = (page, selector) => {
  const { navTotal } = getNavMetrics();
  unwatchNavTitle(page);
  page._navObserver = page.createIntersectionObserver({ thresholds: [0, 0.5, 1] });
  page._navObserver.relativeToViewport({ top: -navTotal }).observe(selector, (res) => {
    const navCollapsed = res.intersectionRatio < 0.5;
    if (navCollapsed !== page.data.navCollapsed) {
      page.setData({ navCollapsed });
    }
  });
};

function unwatchNavTitle(page) {
  if (page._navObserver) {
    page._navObserver.disconnect();
    page._navObserver = null;
  }
}

// Pull-down refresh that shows the navbar's plane for at least one pass,
// and lets the native indicator go as soon as the work is done.
const refreshWithPlane = (page, work) => {
  page.setData({ refreshing: true });
  const minFlight = new Promise((resolve) => setTimeout(resolve, 1100));
  const done = Promise.resolve()
    .then(work)
    .catch(() => {})
    .then(() => wx.stopPullDownRefresh());
  return Promise.all([done, minFlight]).then(() => {
    page.setData({ refreshing: false });
  });
};

module.exports = { watchNavTitle, unwatchNavTitle, refreshWithPlane };
