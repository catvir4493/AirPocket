// Shared page logic for the two-tab areas (Find Bags / My Bags, Offer Space / My Bags).
// Both tabs live in one page as panels, so switching never reloads a page.
const { getNavMetrics } = require("./navMetrics");

const createTabShell = ({ titles, eyebrows = [], initialTab }) => ({
  data: {
    titles,
    eyebrows,
    activeTab: initialTab,
    visited: titles.map((title, index) => index === initialTab),
    navCollapsed: false,
    refreshing: false,
  },

  onLoad() {
    this.scrollTops = {};
  },

  onReady() {
    const { navTotal } = getNavMetrics();
    this.titleObserver = this.createIntersectionObserver();
    this.titleObserver.relativeToViewport({ top: -navTotal }).observe(".large-title", (res) => {
      const navCollapsed = res.intersectionRatio <= 0;
      if (navCollapsed !== this.data.navCollapsed) {
        this.setData({ navCollapsed });
      }
    });
  },

  onShow() {
    const panel = this.getPanel(this.data.activeTab);
    if (panel) {
      panel.onPanelShow();
    }
  },

  onHide() {
    const panel = this.getPanel(this.data.activeTab);
    if (panel && panel.onPanelHide) {
      panel.onPanelHide();
    }
  },

  onUnload() {
    if (this.titleObserver) {
      this.titleObserver.disconnect();
    }
  },

  onPullDownRefresh() {
    const panel = this.getPanel(this.data.activeTab);
    this.setData({ refreshing: true });
    Promise.resolve(panel && panel.refresh ? panel.refresh() : null)
      .catch(() => {})
      .then(() => {
        this.setData({ refreshing: false });
        wx.stopPullDownRefresh();
      });
  },

  getPanel(index) {
    return this.selectComponent(`#panel-${index}`);
  },

  onTabChange(event) {
    this.switchTab(event.detail.index);
  },

  switchTab(index) {
    const previous = this.data.activeTab;
    if (index === previous || !this.data.titles[index]) {
      return;
    }

    wx.createSelectorQuery()
      .selectViewport()
      .scrollOffset((res) => {
        this.scrollTops[previous] = (res && res.scrollTop) || 0;
        const previousPanel = this.getPanel(previous);
        if (previousPanel && previousPanel.onPanelHide) {
          previousPanel.onPanelHide();
        }

        this.setData({ activeTab: index, [`visited[${index}]`]: true }, () => {
          wx.pageScrollTo({ scrollTop: this.scrollTops[index] || 0, duration: 0 });
          const panel = this.getPanel(index);
          if (panel) {
            panel.onPanelShow();
          }
        });
      })
      .exec();
  },
});

module.exports = { createTabShell };
