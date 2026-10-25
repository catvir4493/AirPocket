const { createTabShell } = require("../../../utils/tabShell");

const shell = createTabShell({
  titles: ["", "Find Bags", "My Bags"],
  initialTab: 2,
});

Page(shell);
