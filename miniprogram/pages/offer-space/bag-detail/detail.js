const { formatDateTime, formatWeight } = require("../../../utils/format");
const { formatSpecialItems } = require("../../../utils/specialItems");
const { showToast } = require("../../../utils/toast");
const { bagStatus, bindingStatus } = require("../../../utils/status");

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

  const status = bagStatus(bag.status);
  const specialItemOptionsText = formatSpecialItems(bag.specialItemOptions);

  return {
    ...bag,
    remainingWeight,
    remainingCases,
    isFullCase,
    isLoose: !isFullCase,
    canEdit: !bag.bindingCount,
    spaceTypeText: isFullCase ? "整箱" : "散件",
    caseCountText: `${caseCount} 件`,
    remainingCasesText: `${remainingCases} 件`,
    totalWeightText: formatWeight(bag.totalWeight),
    remainingWeightText: formatWeight(bag.remainingWeight),
    boundWeightText: formatWeight(bag.boundWeight || 0),
    specialItemOptionsText,
    passChips: [isFullCase ? "整箱 · 每箱 23kg" : "散件"].concat(
      specialItemOptionsText === "无" ? [] : specialItemOptionsText.split(", ").map((label) => `可带${label}`)
    ),
    allowedItemsText: Array.isArray(bag.allowedItems) && bag.allowedItems.length
      ? bag.allowedItems.join(", ")
      : "-",
    restrictedItemsText: Array.isArray(bag.restrictedItems) && bag.restrictedItems.length
      ? bag.restrictedItems.join(", ")
      : "-",
    createdAtText: formatDateTime(bag.createdAt),
    updatedAtText: formatDateTime(bag.updatedAt),
    statusText: status.text,
    statusTone: status.tone,
    bindings: (bag.bindings || []).map((binding) => {
      const bindingIsFullCase = binding.spaceType === "fullCase";
      const bindingState = bindingStatus(binding.status);
      return {
        ...binding,
        spaceTypeText: bindingIsFullCase ? "整箱" : "散件",
        requestedCases: Number(binding.requestedCases || (bindingIsFullCase ? 1 : 0)),
        requestedCasesText: `${Number(binding.requestedCases || (bindingIsFullCase ? 1 : 0))} 件`,
        requestedWeightText: formatWeight(binding.requestedWeight),
        requestedSpecialItemsText: formatSpecialItems(binding.requestedSpecialItems),
        createdAtText: formatDateTime(binding.createdAt),
        statusText: bindingState.text,
        statusTone: bindingState.tone,
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
      showToast({
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
      showToast({
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
