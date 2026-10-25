const { formatDateTime, formatWeight } = require("../../../utils/format");
const {
  buildSpecialItemOptions,
  formatSpecialItems,
  normalizeSpecialItems,
  toggleSpecialItem,
} = require("../../../utils/specialItems");

Page({
  data: {
    bagId: "",
    bag: null,
    loading: true,
    submitting: false,
    bindDone: false,
    focusedField: "",
    specialItemOptions: [],
    form: {
      requestedWeight: "",
      requestedSpecialItems: [],
      senderWechat: "",
      pickupAddress: "",
      receiverName: "",
      receiverPhone: "",
      deliveryAddress: "",
      itemDescription: "",
      senderNote: "",
    },
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

  onUnload() {
    clearTimeout(this.redirectTimer);
  },

  onFieldFocus(event) {
    this.setData({ focusedField: event.currentTarget.dataset.focus });
  },

  onFieldBlur(event) {
    if (this.data.focusedField === event.currentTarget.dataset.focus) {
      this.setData({ focusedField: "" });
    }
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
          createdAtText: formatDateTime(bag.createdAt),
          updatedAtText: formatDateTime(bag.updatedAt),
        },
      });
    } catch (error) {
      wx.showToast({
        title: error.message || "加载失败",
        icon: "none",
      });
    } finally {
      this.setData({ loading: false });
    }
  },

  onRequestedWeightInput(event) {
    const { bag } = this.data;
    const rawValue = `${event.detail.value || ""}`;

    if (!rawValue) {
      this.setData({
        "form.requestedWeight": "",
      });
      return "";
    }

    if (!bag) {
      this.setData({
        "form.requestedWeight": rawValue,
      });
      return rawValue;
    }

    const requestedWeight = Number(rawValue);
    const maxWeight = Number(bag.remainingWeight || 0);

    if (!Number.isFinite(requestedWeight)) {
      this.setData({
        "form.requestedWeight": "",
      });
      return "";
    }

    if (requestedWeight > maxWeight) {
      this.setData({
        "form.requestedWeight": `${maxWeight}`,
      });
      wx.showToast({
        title: `最多可绑定 ${formatWeight(maxWeight)}`,
        icon: "none",
      });
      return `${maxWeight}`;
    }

    this.setData({
      "form.requestedWeight": rawValue,
    });
    return rawValue;
  },

  onFieldInput(event) {
    const { field } = event.currentTarget.dataset;
    this.setData({
      [`form.${field}`]: event.detail.value,
    });
  },

  toggleSpecialItem(event) {
    const { bag, form } = this.data;
    const { value } = event.currentTarget.dataset;
    const availableSpecialItems = bag ? bag.availableSpecialItems : [];
    const requestedSpecialItems = toggleSpecialItem(
      form.requestedSpecialItems,
      value,
      availableSpecialItems
    );
    this.setData({
      "form.requestedSpecialItems": requestedSpecialItems,
      specialItemOptions: buildSpecialItemOptions(requestedSpecialItems, availableSpecialItems),
    });
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
    if (bag.isFullCase && Number(bag.remainingCases || 0) <= 0) {
      wx.showToast({
        title: "整箱已无剩余数量",
        icon: "none",
      });
      return;
    }
    if (!Number.isFinite(requestedWeight) || requestedWeight <= 0) {
      wx.showToast({
        title: "请输入大于 0 的重量",
        icon: "none",
      });
      return;
    }

    if (!bag.isFullCase && requestedWeight > Number(bag.remainingWeight)) {
      wx.showToast({
        title: `最多可绑定 ${bag.remainingWeightText}`,
        icon: "none",
      });
      return;
    }

    if (!form.itemDescription.trim()) {
      wx.showToast({
        title: "请填写物品描述",
        icon: "none",
      });
      return;
    }

    if (!form.senderWechat.trim()) {
      wx.showToast({
        title: "请填写微信号",
        icon: "none",
      });
      return;
    }

    if (!form.pickupAddress.trim()) {
      wx.showToast({
        title: "请填写取货地址",
        icon: "none",
      });
      return;
    }

    if (!form.receiverName.trim()) {
      wx.showToast({
        title: "请填写收件人姓名",
        icon: "none",
      });
      return;
    }

    if (!form.receiverPhone.trim()) {
      wx.showToast({
        title: "请填写收件人电话",
        icon: "none",
      });
      return;
    }

    if (!form.deliveryAddress.trim()) {
      wx.showToast({
        title: "请填写目的地快递地址",
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
      }, 900);
    } catch (error) {
      wx.showToast({
        title: error.message || "绑定失败",
        icon: "none",
      });
    } finally {
      this.setData({ submitting: false });
    }
  },
});
