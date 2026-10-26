const { formatDateTime, formatWeight } = require("../../../utils/format");
const {
  SPECIAL_ITEM_OPTIONS,
  buildSpecialItemOptions,
  formatSpecialItems,
  normalizeSpecialItems,
} = require("../../../utils/specialItems");
const { showToast } = require("../../../utils/toast");
const { bagStatus } = require("../../../utils/status");
const {
  bindFormMethods,
  buildQuickWeights,
  createBindFormData,
  validateBindForm,
} = require("../../../utils/bindForm");

const specialLabel = (value) =>
  (SPECIAL_ITEM_OPTIONS.find((item) => item.value === value) || { label: value }).label;

Page({
  ...bindFormMethods,

  readyText: "可以绑定了",

  data: {
    ...createBindFormData(),
    bagId: "",
    bag: null,
    loading: true,
    submitting: false,
    bindDone: false,
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

  onUnload() {
    clearTimeout(this.redirectTimer);
  },

  async fetchBag(bagId) {
    this.setData({ loading: true });
    try {
      const resp = await wx.cloud.callFunction({
        name: "getBagDetail",
        data: { bagId },
      });
      const result = resp.result || {};
      if (!result.success) {
        throw new Error(result.errMsg || "加载失败");
      }
      const bag = result.data;
      const isFullCase = bag.spaceType === "fullCase";
      const remainingWeight = Number(bag.remainingWeight || 0);
      const remainingCases = Number.isFinite(Number(bag.remainingCases))
        ? Number(bag.remainingCases)
        : isFullCase
          ? Math.floor(remainingWeight / 23)
          : 0;
      const caseCount = Number.isFinite(Number(bag.caseCount))
        ? Number(bag.caseCount)
        : remainingCases || (isFullCase ? 1 : 0);
      const availableSpecialItems = normalizeSpecialItems(bag.specialItemOptions);
      const status = bagStatus(bag.status || "active");
      this.setData({
        specialItemOptions: buildSpecialItemOptions([], availableSpecialItems),
        "form.requestedSpecialItems": [],
        bag: {
          ...bag,
          isFullCase,
          remainingWeight,
          caseCount,
          remainingCases,
          spaceTypeText: isFullCase ? "整箱" : "散件",
          totalWeightText: formatWeight(bag.totalWeight),
          remainingWeightText: formatWeight(remainingWeight),
          caseCountText: `${caseCount} 件`,
          remainingCasesText: `${remainingCases} 件`,
          specialItemOptionsText: formatSpecialItems(availableSpecialItems),
          availableSpecialItems,
          statusText: status.text,
          statusTone: status.tone,
          passChips: [isFullCase ? "整箱 · 每箱 23kg" : "散件"].concat(
            availableSpecialItems.map((value) => `可带${specialLabel(value)}`)
          ),
          createdAtText: formatDateTime(bag.createdAt),
          updatedAtText: formatDateTime(bag.updatedAt),
        },
        formInfo: {
          isFullCase,
          fromCity: bag.fromCity,
          toCity: bag.toCity,
          maxWeight: remainingWeight,
          maxText: formatWeight(remainingWeight),
          casesText: `当前剩余 ${remainingCases} 件`,
          availableSpecialItems,
        },
        quickWeights: isFullCase ? [] : buildQuickWeights(remainingWeight),
      });
      this.refreshSummary();
    } catch (error) {
      showToast({
        title: error.message || "加载失败",
        icon: "none",
      });
    } finally {
      this.setData({ loading: false });
    }
  },

  async submitBinding() {
    const { bagId, bag, form, submitting } = this.data;
    if (submitting || !bag) {
      return;
    }

    const requestedWeight = bag.isFullCase ? 23 : Number(form.requestedWeight);
    const requestedSpecialItems = normalizeSpecialItems(
      form.requestedSpecialItems,
      bag.availableSpecialItems
    );
    const errorMessage = validateBindForm(this.data.formInfo, form);
    if (errorMessage) {
      showToast({
        title: errorMessage,
        icon: "none",
      });
      return;
    }

    if (bag.isFullCase && Number(bag.remainingCases || 0) <= 0) {
      showToast({
        title: "整箱已无剩余数量",
        icon: "none",
      });
      return;
    }
    if (!bag.isFullCase && requestedWeight > Number(bag.remainingWeight)) {
      showToast({
        title: `最多可绑定 ${bag.remainingWeightText}`,
        icon: "none",
      });
      return;
    }

    this.setData({ submitting: true });
    try {
      const resp = await wx.cloud.callFunction({
        name: "bindBag",
        data: {
          bagId,
          requestedWeight,
          requestedSpecialItems,
          senderWechat: form.senderWechat.trim(),
          pickupAddress: form.pickupAddress.trim(),
          receiverName: form.receiverName.trim(),
          receiverPhone: form.receiverPhone.trim(),
          deliveryAddress: form.deliveryAddress.trim(),
          itemDescription: form.itemDescription.trim(),
          senderNote: form.senderNote.trim(),
        },
      });
      const result = resp.result || {};
      if (!result.success) {
        throw new Error(result.errMsg || "绑定失败");
      }
      this.setData({ bindDone: true });
      wx.vibrateShort({ type: "light" });
      this.redirectTimer = setTimeout(() => {
        wx.redirectTo({
          url: "/pages/find-bags/my/my",
        });
      }, 1300);
    } catch (error) {
      showToast({
        title: error.message || "绑定失败",
        icon: "none",
      });
    } finally {
      this.setData({ submitting: false });
    }
  },
});
