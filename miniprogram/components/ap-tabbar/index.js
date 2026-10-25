const PRESETS = {
  landing: [
    { text: "Airpocket", url: "/pages/index/index", type: "reLaunch" },
    { text: "Find Bags", url: "/pages/find-bags/home/home", type: "navigateTo" },
    { text: "Offer Space", url: "/pages/offer-space/home/home", type: "navigateTo" },
  ],
  find: [
    { text: "Home", url: "/pages/index/index", type: "reLaunch" },
    { text: "Find Bags", url: "/pages/find-bags/home/home", type: "redirectTo" },
    { text: "My Bags", url: "/pages/find-bags/my/my", type: "redirectTo" },
  ],
  offer: [
    { text: "Airpocket", url: "/pages/index/index", type: "reLaunch" },
    { text: "Offer Space", url: "/pages/offer-space/home/home", type: "redirectTo" },
    { text: "My Bags", url: "/pages/offer-space/my/my", type: "redirectTo" },
  ],
};

// Let the indicator start sliding before the page is replaced.
const SWITCH_DELAY = 160;

Component({
  properties: {
    preset: {
      type: String,
      value: "find",
    },
    current: {
      type: Number,
      value: 0,
    },
  },

  data: {
    items: [],
    activeIndex: 0,
  },

  observers: {
    "preset, current"(preset, current) {
      this.syncItems(preset, current);
    },
  },

  lifetimes: {
    attached() {
      this.syncItems(this.data.preset, this.data.current);
    },
    detached() {
      clearTimeout(this.switchTimer);
    },
  },

  pageLifetimes: {
    show() {
      // Coming back via navigateBack: put the indicator back on this page's tab.
      this.switching = false;
      if (this.data.activeIndex !== this.data.current) {
        this.setData({ activeIndex: this.data.current });
      }
    },
  },

  methods: {
    syncItems(preset, current) {
      this.setData({
        items: PRESETS[preset] || [],
        activeIndex: current,
      });
    },

    onTap(event) {
      const index = Number(event.currentTarget.dataset.index);
      const item = this.data.items[index];
      if (!item || index === this.data.current || this.switching) {
        return;
      }

      this.switching = true;
      this.setData({ activeIndex: index });
      this.switchTimer = setTimeout(() => {
        wx[item.type]({
          url: item.url,
          fail: () => {
            this.switching = false;
            this.setData({ activeIndex: this.data.current });
          },
        });
      }, SWITCH_DELAY);
    },
  },
});
