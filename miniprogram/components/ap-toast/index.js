const { getNavMetrics } = require("../../utils/navMetrics");

// Ink capsule that slides down from under the navigation bar. Pages place one
// <ap-toast id="ap-toast" /> and call utils/toast.js instead of wx.showToast.
const ICONS = {
  success: "check",
  error: "alert",
  none: "info",
};

const LEAVE_MS = 220;

Component({
  properties: {
    // Set on pages with navigationStyle "custom" so the toast clears the navbar.
    customNav: {
      type: Boolean,
      value: false,
    },
  },

  data: {
    top: 12,
    visible: false,
    leaving: false,
    title: "",
    icon: "info",
    seq: 0,
  },

  lifetimes: {
    attached() {
      if (this.data.customNav) {
        this.setData({ top: getNavMetrics().navTotal + 12 });
      }
    },
    detached() {
      clearTimeout(this.hideTimer);
      clearTimeout(this.leaveTimer);
    },
  },

  methods: {
    show({ title = "", icon = "none", duration = 1800 } = {}) {
      clearTimeout(this.hideTimer);
      clearTimeout(this.leaveTimer);
      this.setData({
        visible: true,
        leaving: false,
        title,
        icon: ICONS[icon] || ICONS.none,
        // A new key restarts the enter animation when toasts follow each other.
        seq: this.data.seq + 1,
      });
      this.hideTimer = setTimeout(() => this.hide(), duration);
    },

    hide() {
      if (!this.data.visible) {
        return;
      }
      this.setData({ leaving: true });
      this.leaveTimer = setTimeout(() => {
        this.setData({ visible: false, leaving: false });
      }, LEAVE_MS);
    },
  },
});
