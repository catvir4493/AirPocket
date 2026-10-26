// Shared page logic for the two-tab areas (Find Bags / My Bags, Offer Space / My Bags).
// Both tabs live in one page as panels, so switching never reloads a page.
const { tap } = require("./haptic");
const { watchNavTitle, unwatchNavTitle, refreshWithPlane } = require("./navTitle");

const createTabShell = ({ titles, eyebrows = [], initialTab }) => ({
  data: {
    titles,
    eyebrows,
    activeTab: initialTab,
    // "fwd" or "back": which way the last tab switch went, for the slide-in direction.
    tabDir: "",
    visited: titles.map((title, index) => index === initialTab),
    navCollapsed: false,
    refreshing: false,
  },

  onLoad() {
    this.scrollTops = {};
  },

  onReady() {
    watchNavTitle(this, ".large-title");
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
    unwatchNavTitle(this);
  },

  onPullDownRefresh() {
    const panel = this.getPanel(this.data.activeTab);
    refreshWithPlane(this, () => (panel && panel.refresh ? panel.refresh() : null));
  },

  getPanel(index) {
    return this.selectComponent(`#panel-${index}`);
  },

  // Back from the "My ..." tab returns to the area's main tab instead of leaving the page.
  onNavBack() {
    this.switchTab(1);
  },

  onTabChange(event) {
    this.switchTab(event.detail.index);
  },

  switchTab(index) {
    const previous = this.data.activeTab;
    if (index === previous || !this.data.titles[index]) {
      return;
    }
    tap();

    wx.createSelectorQuery()
      .selectViewport()
      .scrollOffset((res) => {
        this.scrollTops[previous] = (res && res.scrollTop) || 0;
        const previousPanel = this.getPanel(previous);
        if (previousPanel && previousPanel.onPanelHide) {
          previousPanel.onPanelHide();
        }

        const tabDir = index > previous ? "fwd" : "back";
        this.setData({ activeTab: index, tabDir, [`visited[${index}]`]: true }, () => {
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
