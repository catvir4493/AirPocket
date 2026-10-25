Page({
  data: {
    scenePaused: false,
  },

  onShow() {
    if (this.data.scenePaused) {
      this.setData({ scenePaused: false });
    }
  },

  onHide() {
    this.setData({ scenePaused: true });
  },

  goReleaseBag() {
    wx.navigateTo({
      url: "/pages/offer-space/release/release",
    });
  },

  goMyBags() {
    wx.navigateTo({
      url: "/pages/offer-space/my/my",
    });
  },
});
