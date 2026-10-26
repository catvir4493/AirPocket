// Shows the page's <ap-toast id="ap-toast" />, falling back to wx.showToast
// on pages that do not have one.
const showToast = (options = {}) => {
  const pages = getCurrentPages();
  const page = pages[pages.length - 1];
  const toast = page && page.selectComponent ? page.selectComponent("#ap-toast") : null;
  if (toast) {
    toast.show(options);
    return;
  }
  wx.showToast(options);
};

module.exports = { showToast };
