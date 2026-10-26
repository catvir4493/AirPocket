const { formatDateTime, formatWeight } = require("../../../utils/format");
const { formatSpecialItems } = require("../../../utils/specialItems");
const { showToast } = require("../../../utils/toast");
const { bagStatus, bindingStatus } = require("../../../utils/status");
const { watchNavTitle, unwatchNavTitle, refreshWithPlane } = require("../../../utils/navTitle");

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
  // Capacity bar: one dark block per live binding over the bag's total space.
  const capacity = {
    total: isFullCase ? caseCount * 23 : toSafeNumber(bag.totalWeight),
    segments: (bag.bindings || [])
      .filter((binding) => binding.status !== "cancelled")
      .map((binding) => ({
        value:
          binding.spaceType === "fullCase"
            ? Number(binding.requestedCases || 1) * 23
            : toSafeNumber(binding.requestedWeight),
        tone: "bound",
        label: "已绑定",
      })),
  };

  return {
    ...bag,
    remainingWeight,
    remainingCases,
    isFullCase,
    isLoose: !isFullCase,
    capacity,
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
    navCollapsed: false,
    refreshing: false,
    loadError: "",
    bagId: "",
    bag: null,
    loading: true,
  },

  onUnload() {
    unwatchNavTitle(this);
  },

  onReady() {
    watchNavTitle(this, ".nav-sentinel");
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
    refreshWithPlane(this, () => this.fetchBag(this.data.bagId));
  },

  async fetchBag(bagId) {
    if (!bagId) {
      return;
    }

    // Refreshes keep the current pass on screen instead of going back to the skeleton.
    if (!this.data.bag) {
      this.setData({ loading: true });
    }
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
        // Not found is not a load failure: fall through to the "没有找到" state.
        this.setData({ bag: null });
        return;
      }

      this.setData({ bag: buildBagView(source) });
    } catch (error) {
      // Nothing on screen yet: show the retry state. Otherwise keep the page and just say so.
      if (!this.data.bag) {
        this.setData({ loadError: error.message || "加载失败" });
      } else {
        showToast({
          title: error.message || "加载失败",
          icon: "none",
        });
      }
    } finally {
      this.setData({ loading: false });
    }
  },

  retryLoad() {
    this.setData({ loadError: "", loading: true });
    this.fetchBag(this.data.bagId);
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
