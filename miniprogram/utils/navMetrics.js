// Sizes for the custom navigation bar, aligned with the WeChat capsule button.
let cached = null;

const getNavMetrics = () => {
  if (cached) {
    return cached;
  }

  const windowInfo = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync();
  const statusBarHeight = windowInfo.statusBarHeight || 20;
  const windowWidth = windowInfo.windowWidth || 375;
  let navHeight = 44;
  let sideSpace = 96;

  try {
    const rect = wx.getMenuButtonBoundingClientRect();
    if (rect && rect.height) {
      navHeight = (rect.top - statusBarHeight) * 2 + rect.height;
      sideSpace = windowWidth - rect.left;
    }
  } catch (error) {
    // Fall back to the defaults above.
  }

  cached = {
    statusBarHeight,
    navHeight,
    navTotal: statusBarHeight + navHeight,
    sideSpace,
  };
  return cached;
};

module.exports = { getNavMetrics };
