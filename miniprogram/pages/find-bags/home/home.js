const { createTabShell } = require("../../../utils/tabShell");

const shell = createTabShell({
  titles: ["", "找行李额", "我的绑定"],
  eyebrows: ["", "Find Bags", "My Bags"],
  initialTab: 1,
});

Page(shell);
