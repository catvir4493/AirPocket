Component({
  options: {
    styleIsolation: "apply-shared",
  },

  data: {
    scenePaused: false,
  },

  methods: {
    onPanelShow() {
      if (this.data.scenePaused) {
        this.setData({ scenePaused: false });
      }
    },

    onPanelHide() {
      this.setData({ scenePaused: true });
    },

    goReleaseBag() {
      wx.navigateTo({
        url: "/pages/offer-space/release/release",
      });
    },

    goMyBags() {
      this.triggerEvent("switchtab", { index: 2 });
    },
  },
});
