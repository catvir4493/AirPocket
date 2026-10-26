const { showToast } = require("../../utils/toast");
const { dayParts } = require("../../utils/date");
const { liftAndOpen } = require("../../utils/liftOpen");

Page({
  data: {
    isAdmin: false,
    summaryReady: false,
    availableCount: 0,
    nearestDate: "",
    // The next few departures, shown as small tickets under the Find Bags entry.
    upcoming: [],
    liftId: "",
  },

  onShow() {
    this.checkAdminAccess();
    this.loadSummary();
  },

  // Live numbers for the Find Bags entry card, from the same list Find Bags shows.
  loadSummary() {
    if (!wx.cloud) {
      return;
    }
    wx.cloud.callFunction({
      name: "getBags",
      success: (res) => {
        const result = res.result || {};
        if (!result.success) {
          return;
        }
        const today = new Date();
        const todayKey = `${today.getFullYear()}-${`${today.getMonth() + 1}`.padStart(2, "0")}-${`${today.getDate()}`.padStart(2, "0")}`;
        const bags = result.data || [];
        const soon = bags
          .filter((bag) => bag.departureDate && `${bag.departureDate}` >= todayKey)
          .sort((a, b) => `${a.departureDate}`.localeCompare(`${b.departureDate}`));
        const upcoming = soon.slice(0, 3).map((bag) => {
          const day = dayParts(bag.departureDate);
          const isFullCase = bag.spaceType === "fullCase";
          const weight = isFullCase
            ? Number(bag.remainingCases || 0) * 23
            : Number(bag.remainingWeight || 0);
          return {
            id: bag._id,
            from: bag.fromCity || "-",
            to: bag.toCity || "-",
            date: day.short,
            weekday: day.weekday,
            weight: Number.isFinite(weight) ? Math.round(weight * 10) / 10 : "-",
          };
        });
        this.setData({
          summaryReady: true,
          availableCount: bags.length,
          nearestDate: soon.length ? dayParts(soon[0].departureDate).short : "",
          upcoming,
        });
      },
    });
  },

  goFindBags() {
    wx.navigateTo({
      url: "/pages/find-bags/home/home",
    });
  },

  openUpcoming(event) {
    const { id } = event.currentTarget.dataset;
    liftAndOpen(this, id, `/pages/find-bags/detail/detail?id=${id}`);
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
      showToast({
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
              showToast({
                title: result.errMsg || "提交失败",
                icon: "none",
              });
              return;
            }
            showToast({
              title: "已提交申请",
              icon: "success",
            });
          },
          fail: (error) => {
            wx.hideLoading();
            showToast({
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
