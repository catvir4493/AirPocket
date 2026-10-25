const { createTabShell } = require("../../../utils/tabShell");

const shell = createTabShell({
  titles: ["", "Find Bags", "My Bags"],
  initialTab: 1,
});

Page(shell);
