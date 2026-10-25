Page({
  data: {
    isAdmin: false,
  },

  onShow() {
    this.checkAdminAccess();
  },

  goFindBags() {
    wx.navigateTo({
      url: "/pages/find-bags/home/home",
    });
  },

  goOfferSpace() {
    wx.navigateTo({
      url: "/pages/offer-space/home/home",
    });
  },

  showBusinessCooperation() {
    wx.showModal({
      title: "商务合作",
      content: "微信：待填写\n电话：待填写",
      showCancel: false,
      confirmText: "知道了",
    });
  },

  showCustomerService() {
    wx.showModal({
      title: "联系客服",
      content: "微信：待填写\n电话：待填写",
      showCancel: false,
      confirmText: "知道了",
    });
  },

  goProhibitedItems() {
    wx.navigateTo({
      url: "/pages/prohibited/index",
    });
  },

  goAdmin() {
    wx.navigateTo({
      url: "/pages/admin/index",
    });
  },

  requestAdminAccess() {
    if (!wx.cloud) {
      wx.showToast({
        title: "云能力不可用",
        icon: "none",
      });
      return;
    }

    wx.showModal({
      title: "申请后台权限",
      content: "是否提交当前微信账号的后台权限申请？",
      confirmText: "提交",
      success: (modalRes) => {
        if (!modalRes.confirm) {
          return;
        }

        wx.showLoading({
          title: "提交中",
          mask: true,
        });

        wx.cloud.callFunction({
          name: "adminRequestAccess",
          success: (res) => {
            const result = res.result || {};
            wx.hideLoading();
            if (!result.success) {
              wx.showToast({
                title: result.errMsg || "提交失败",
                icon: "none",
              });
              return;
            }
            wx.showToast({
              title: "已提交申请",
              icon: "success",
            });
          },
          fail: (error) => {
            wx.hideLoading();
            wx.showToast({
              title: error.errMsg || "提交失败",
              icon: "none",
            });
          },
        });
      },
    });
  },

  checkAdminAccess() {
    if (!wx.cloud) {
      return;
    }

    wx.cloud.callFunction({
      name: "adminCheckAccess",
      success: (res) => {
        const result = res.result || {};
        const data = result.data || {};
        this.setData({
          isAdmin: Boolean(data.isAdmin),
        });
      },
      fail: () => {
        this.setData({
          isAdmin: false,
        });
      },
    });
  },
});
