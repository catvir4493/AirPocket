const { formatDateTime, formatWeight } = require("../../../utils/format");
const {
  SPECIAL_ITEM_OPTIONS,
  buildSpecialItemOptions,
  formatSpecialItems,
  normalizeSpecialItems,
  toggleSpecialItem,
} = require("../../../utils/specialItems");
const { showToast } = require("../../../utils/toast");
const { bagStatus } = require("../../../utils/status");

const trimNumber = (value) => `${Math.round(value * 10) / 10}`;

// Quick picks for loose weight: small round amounts under the limit, then "all".
const buildQuickWeights = (max) => {
  const picks = [1, 2, 5, 10].filter((value) => value < max).slice(-3);
  return max > 0 ? picks.map((value) => ({ value, label: `${value}kg` })).concat({ value: max, label: `全部 ${trimNumber(max)}kg` }) : [];
};

// Route line and missing-field count shown next to the bind button.
const buildSummary = (bag, form) => {
  if (!bag) {
    return { route: "", detail: "", ready: false };
  }
  const weight = bag.isFullCase ? 23 : Number(form.requestedWeight) || 0;
  const missing = [
    weight > 0,
    form.itemDescription,
    form.senderWechat,
    form.pickupAddress,
    form.receiverName,
    form.receiverPhone,
    form.deliveryAddress,
  ].filter((value) => value === false || !`${value || ""}`.trim()).length;
  return {
    route: `${bag.fromCity || "-"} → ${bag.toCity || "-"}`,
    detail: [
      bag.isFullCase ? "整箱 1 箱 · 23kg" : `占用 ${weight ? trimNumber(weight) : 0}kg`,
      missing ? `还差 ${missing} 项` : "可以绑定了",
    ].join(" · "),
    ready: missing === 0,
  };
};

const specialLabel = (value) =>
  (SPECIAL_ITEM_OPTIONS.find((item) => item.value === value) || { label: value }).label;

Page({
  data: {
    bagId: "",
    bag: null,
    loading: true,
    submitting: false,
    bindDone: false,
    focusedField: "",
    specialItemOptions: [],
    quickWeights: [],
    summary: buildSummary(null),
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

  refreshSummary() {
    this.setData({ summary: buildSummary(this.data.bag, this.data.form) });
  },

  onRequestedWeightInput(event) {
    const value = this.applyRequestedWeight(event);
    this.refreshSummary();
    return value;
  },

  stepWeight(event) {
    const { bag, form } = this.data;
    if (!bag) {
      return;
    }
    const max = Number(bag.remainingWeight || 0);
    const next = Math.min(max, Math.max(0, (Number(form.requestedWeight) || 0) + Number(event.currentTarget.dataset.delta)));
    this.setData({ "form.requestedWeight": next ? trimNumber(next) : "" });
    this.refreshSummary();
  },

  pickQuickWeight(event) {
    this.setData({ "form.requestedWeight": trimNumber(Number(event.currentTarget.dataset.value)) });
    this.refreshSummary();
  },

  applyRequestedWeight(event) {
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
      showToast({
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
    this.refreshSummary();
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
      showToast({
        title: "整箱已无剩余数量",
        icon: "none",
      });
      return;
    }
    if (!Number.isFinite(requestedWeight) || requestedWeight <= 0) {
      showToast({
        title: "请输入大于 0 的重量",
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

    if (!form.itemDescription.trim()) {
      showToast({
        title: "请填写物品描述",
        icon: "none",
      });
      return;
    }

    if (!form.senderWechat.trim()) {
      showToast({
        title: "请填写微信号",
        icon: "none",
      });
      return;
    }

    if (!form.pickupAddress.trim()) {
      showToast({
        title: "请填写取货地址",
        icon: "none",
      });
      return;
    }

    if (!form.receiverName.trim()) {
      showToast({
        title: "请填写收件人姓名",
        icon: "none",
      });
      return;
    }

    if (!form.receiverPhone.trim()) {
      showToast({
        title: "请填写收件人电话",
        icon: "none",
      });
      return;
    }

    if (!form.deliveryAddress.trim()) {
      showToast({
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
      showToast({
        title: error.message || "绑定失败",
        icon: "none",
      });
    } finally {
      this.setData({ submitting: false });
    }
  },
});
