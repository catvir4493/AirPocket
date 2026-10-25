const { createTabShell } = require("../../../utils/tabShell");

const shell = createTabShell({
  titles: ["", "Offer Space", "My Bags"],
  initialTab: 2,
});

Page({
  ...shell,

  onPanelSwitch(event) {
    this.switchTab(event.detail.index);
  },
});
