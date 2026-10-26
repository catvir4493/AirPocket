const { getNavMetrics } = require("../../utils/navMetrics");

Component({
  properties: {
    title: {
      type: String,
      value: "",
    },
    // Shows the small title once the page's large title has scrolled under the bar.
    collapsed: {
      type: Boolean,
      value: false,
    },
    loading: {
      type: Boolean,
      value: false,
    },
    // Detail pages without a large title: the small title is always shown,
    // "collapsed" then only adds the hairline.
    compact: {
      type: Boolean,
      value: false,
    },
    // When set, the back button fires a "back" event for the page to handle
    // (the tab shells use it to go from "My ..." back to their main tab).
    interceptBack: {
      type: Boolean,
      value: false,
    },
  },

  data: {
    statusBarHeight: 20,
    navHeight: 44,
    navTotal: 64,
    sideSpace: 96,
    canGoBack: false,
  },

  lifetimes: {
    attached() {
      this.setData({
        ...getNavMetrics(),
        canGoBack: getCurrentPages().length > 1,
      });
    },
  },

  methods: {
    onBack() {
      if (this.data.interceptBack) {
        this.triggerEvent("back");
        return;
      }
      if (getCurrentPages().length > 1) {
        wx.navigateBack();
        return;
      }
      wx.reLaunch({
        url: "/pages/index/index",
      });
    },
  },
});
