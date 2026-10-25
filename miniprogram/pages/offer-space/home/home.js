Page({
  goAppHome() {
    wx.reLaunch({
      url: "/pages/index/index",
    });
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
