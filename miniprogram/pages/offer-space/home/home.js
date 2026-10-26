const { createTabShell } = require("../../../utils/tabShell");

const shell = createTabShell({
  titles: ["", "发布行李额", "我的发布"],
  eyebrows: ["", "Offer Space", "My Bags"],
  initialTab: 1,
});

Page({
  ...shell,

  onPanelSwitch(event) {
    this.switchTab(event.detail.index);
  },
});
