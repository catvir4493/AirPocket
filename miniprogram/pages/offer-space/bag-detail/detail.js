const { formatDateTime, formatWeight } = require("../../../utils/format");
const { formatSpecialItems } = require("../../../utils/specialItems");

const statusLabels = {
  active: "可绑定",
  locked: "已锁定",
  closed: "已关闭",
  expired: "已过期",
};

const bindingStatusLabels = {
  pending: "等待确认",
  locked: "已锁单",
  contacted: "已联系",
  picked_up: "已取货",
  packed: "已打包",
  delivered_to_carrier: "已送至带货者",
  completed: "已完成",
  cancelled: "已取消",
};

const toSafeNumber = (value, fallback = 0) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
};

const buildBagView = (bag) => {
  const isFullCase = bag.spaceType === "fullCase";
  const remainingWeight = toSafeNumber(bag.remainingWeight);
  const remainingCases = Number.isFinite(Number(bag.remainingCases))
    ? Number(bag.remainingCases)
    : Math.floor(remainingWeight / 23);
  const caseCount = Number.isFinite(Number(bag.caseCount))
    ? Number(bag.caseCount)
    : remainingCases || (isFullCase ? 1 : 0);

  return {
    ...bag,
    isFullCase,
    isLoose: !isFullCase,
    canEdit: !bag.bindingCount,
    spaceTypeText: isFullCase ? "整箱" : "散件",
    caseCountText: `${caseCount} 件`,
    remainingCasesText: `${remainingCases} 件`,
    totalWeightText: formatWeight(bag.totalWeight),
    remainingWeightText: formatWeight(bag.remainingWeight),
    boundWeightText: formatWeight(bag.boundWeight || 0),
    specialItemOptionsText: formatSpecialItems(bag.specialItemOptions),
    allowedItemsText: Array.isArray(bag.allowedItems) && bag.allowedItems.length
      ? bag.allowedItems.join(", ")
      : "-",
    restrictedItemsText: Array.isArray(bag.restrictedItems) && bag.restrictedItems.length
      ? bag.restrictedItems.join(", ")
      : "-",
    createdAtText: formatDateTime(bag.createdAt),
    updatedAtText: formatDateTime(bag.updatedAt),
    statusText: statusLabels[bag.status] || bag.status,
    bindings: (bag.bindings || []).map((binding) => {
      const bindingIsFullCase = binding.spaceType === "fullCase";
      return {
        ...binding,
        spaceTypeText: bindingIsFullCase ? "整箱" : "散件",
        requestedCasesText: `${Number(binding.requestedCases || (bindingIsFullCase ? 1 : 0))} 件`,
        requestedWeightText: formatWeight(binding.requestedWeight),
        requestedSpecialItemsText: formatSpecialItems(binding.requestedSpecialItems),
        createdAtText: formatDateTime(binding.createdAt),
        statusText: bindingStatusLabels[binding.status] || binding.status,
      };
    }),
  };
};

Page({
  data: {
    bagId: "",
    bag: null,
    loading: true,
  },

  onLoad(options) {
    if (!options.id) {
      wx.showToast({
        title: "缺少 bag 信息",
        icon: "none",
      });
      this.setData({ loading: false });
      return;
    }

    this.setData({ bagId: options.id });
    this.fetchBag(options.id);
  },

  onPullDownRefresh() {
    this.fetchBag(this.data.bagId).finally(() => wx.stopPullDownRefresh());
  },

  async fetchBag(bagId) {
    if (!bagId) {
      return;
    }

    this.setData({ loading: true });
    try {
      const resp = await wx.cloud.callFunction({
        name: "getMyCarrierBags",
      });
      const result = resp.result || {};
      if (!result.success) {
        throw new Error(result.errMsg || "加载失败");
      }

      const source = (result.data || []).find((item) => item._id === bagId);
      if (!source) {
        throw new Error("没有找到这条 bag");
      }

      this.setData({ bag: buildBagView(source) });
    } catch (error) {
      wx.showToast({
        title: error.message || "加载失败",
        icon: "none",
      });
    } finally {
      this.setData({ loading: false });
    }
  },

  editBag() {
    if (!this.data.bag || !this.data.bag.canEdit) {
      return;
    }

    wx.navigateTo({
      url: `/pages/offer-space/edit/edit?id=${this.data.bag._id}`,
    });
  },
});
