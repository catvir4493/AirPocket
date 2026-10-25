Component({
  options: {
    styleIsolation: "apply-shared",
  },

  methods: {
    onPanelShow() {},

    goReleaseBag() {
      wx.navigateTo({
        url: "/pages/offer-space/release/release",
      });
    },

    goMyBags() {
      this.triggerEvent("switchtab", { index: 2 });
    },

    goCompliance() {
      wx.navigateTo({
        url: "/pages/prohibited/index",
      });
    },
  },
});
