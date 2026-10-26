const {
  buildSpecialItemOptions,
  normalizeSpecialItems,
  toggleSpecialItem,
} = require("../../../utils/specialItems");
const { showToast } = require("../../../utils/toast");
const { dayParts } = require("../../../utils/date");
const { SPECIAL_ITEM_OPTIONS } = require("../../../utils/specialItems");

const CASE_WEIGHT = 23;
const QUICK_WEIGHTS = [5, 10, 15, 20];

const splitTags = (text) =>
  `${text || ""}`
    .split(/[,，、\n]/)
    .map((item) => item.trim())
    .filter(Boolean);

const trimNumber = (value) => `${Math.round(value * 10) / 10}`;

// Everything on screen that is derived from the form: the ticket date, tag lists,
// the live preview card and the summary next to the publish button.
const deriveView = (form) => {
  const isFullCase = form.spaceType === "fullCase";
  const day = dayParts(form.departureDate);
  const caseCount = Number(form.caseCount) || 0;
  const weight = isFullCase ? caseCount * CASE_WEIGHT : Number(form.totalWeight) || 0;
  const labelMap = SPECIAL_ITEM_OPTIONS.reduce((map, item) => {
    map[item.value] = item.label;
    return map;
  }, {});
  const missing = [
    form.fromCity,
    form.toCity,
    form.departureDate,
    isFullCase ? caseCount > 0 : weight > 0,
    form.carrierWechat,
    form.carrierReceiveAddress,
  ].filter((value) => !`${value || ""}`.trim() || value === false).length;
  const from = form.fromCity.trim();
  const to = form.toCity.trim();
  const spaceText = isFullCase ? `整箱 ${caseCount || 0} 箱` : `散件 ${weight ? trimNumber(weight) : 0}kg`;

  return {
    dateText: form.departureDate ? `${day.short} ${day.weekday}` : "",
    allowedTags: splitTags(form.allowedItemsText),
    restrictedTags: splitTags(form.restrictedItemsText),
    caseWeightText: `${caseCount || 0} × ${CASE_WEIGHT} = ${caseCount * CASE_WEIGHT}kg`,
    preview: {
      day: form.departureDate ? day.day : "--",
      month: form.departureDate ? day.month : "DATE",
      from: from || "出发",
      to: to || "到达",
      chips: [isFullCase ? "整箱" : "散件"].concat(
        (form.specialItemOptions || []).map((value) => labelMap[value] || value)
      ),
      weight: weight ? trimNumber(weight) : "--",
    },
    summary: {
      route: from || to ? `${from || "出发"} → ${to || "到达"}` : "填写航程",
      detail: [form.departureDate ? day.short : "", spaceText, missing ? `还差 ${missing} 项` : "可以发布了"]
        .filter(Boolean)
        .join(" · "),
      ready: missing === 0,
    },
  };
};

const today = () => {
  const date = new Date();
  const month = date.getMonth() + 1;
  const day = date.getDate();
  return `${date.getFullYear()}-${month < 10 ? `0${month}` : month}-${day < 10 ? `0${day}` : day}`;
};

const isPastDate = (value, minDate) => value && value < minDate;

const INITIAL_FORM = {
  spaceType: "loose",
  fromCity: "",
  toCity: "",
  departureDate: "",
  flightNo: "",
  carrierWechat: "",
  carrierReceiveAddress: "",
  totalWeight: "",
  caseCount: "1",
  availableVolume: "",
  specialItemOptions: [],
  allowedItemsText: "",
  restrictedItemsText: "",
  note: "",
};

Page({
  data: {
    ...deriveView(INITIAL_FORM),
    quickWeights: QUICK_WEIGHTS,
    tagDraft: { allowed: "", restricted: "" },
    submitting: false,
    releasedNo: "",
    focusedField: "",
    minDate: today(),
    specialItemOptions: buildSpecialItemOptions([]),
    form: INITIAL_FORM,
  },

  // Sets form fields and refreshes everything derived from them in one setData.
  updateForm(changes, extra) {
    const form = { ...this.data.form, ...changes };
    const data = { ...deriveView(form), ...(extra || {}) };
    Object.keys(changes).forEach((key) => {
      data[`form.${key}`] = changes[key];
    });
    this.setData(data);
  },

  onFieldInput(event) {
    const { field } = event.currentTarget.dataset;
    this.updateForm({ [field]: event.detail.value });
  },

  selectSpaceType(event) {
    const { type } = event.currentTarget.dataset;
    if (type === this.data.form.spaceType) {
      return;
    }
    this.updateForm({
      spaceType: type,
      totalWeight: type === "fullCase" ? "" : this.data.form.totalWeight,
      caseCount: type === "fullCase" ? this.data.form.caseCount || "1" : "1",
    });
  },

  swapCities() {
    const { fromCity, toCity } = this.data.form;
    if (!fromCity && !toCity) {
      return;
    }
    this.updateForm({ fromCity: toCity, toCity: fromCity });
  },

  onDateChange(event) {
    this.updateForm({ departureDate: event.detail.value });
  },

  stepAmount(event) {
    const delta = Number(event.currentTarget.dataset.delta);
    if (this.data.form.spaceType === "fullCase") {
      const caseCount = Math.max(1, (Number(this.data.form.caseCount) || 0) + delta);
      this.updateForm({ caseCount: `${caseCount}` });
      return;
    }
    const weight = Math.max(0, (Number(this.data.form.totalWeight) || 0) + delta);
    this.updateForm({ totalWeight: weight ? trimNumber(weight) : "" });
  },

  pickQuickWeight(event) {
    this.updateForm({ totalWeight: `${event.currentTarget.dataset.value}` });
  },

  toggleSpecialItem(event) {
    const { value } = event.currentTarget.dataset;
    const specialItemOptions = toggleSpecialItem(this.data.form.specialItemOptions, value);
    this.updateForm({ specialItemOptions }, { specialItemOptions: buildSpecialItemOptions(specialItemOptions) });
  },

  onTagDraftInput(event) {
    this.setData({ [`tagDraft.${event.currentTarget.dataset.list}`]: event.detail.value });
  },

  // "allowed" and "restricted" tags are stored as the comma text the cloud function expects.
  addTag(event) {
    const { list } = event.currentTarget.dataset;
    const field = list === "allowed" ? "allowedItemsText" : "restrictedItemsText";
    const added = splitTags(this.data.tagDraft[list]);
    if (!added.length) {
      return;
    }
    const tags = splitTags(this.data.form[field]);
    added.forEach((tag) => {
      if (!tags.includes(tag)) {
        tags.push(tag);
      }
    });
    this.updateForm({ [field]: tags.join(", ") }, { [`tagDraft.${list}`]: "" });
  },

  removeTag(event) {
    const { list, index } = event.currentTarget.dataset;
    const field = list === "allowed" ? "allowedItemsText" : "restrictedItemsText";
    const tags = splitTags(this.data.form[field]);
    tags.splice(Number(index), 1);
    this.updateForm({ [field]: tags.join(", ") });
  },

  validateForm() {
    const { form } = this.data;
    const required = [
      ["fromCity", "请填写出发城市"],
      ["toCity", "请填写到达城市"],
      ["carrierWechat", "请填写微信号"],
      ["carrierReceiveAddress", "请填写收货地址"],
      ["departureDate", "请选择出发日期"],
    ];
    for (let i = 0; i < required.length; i += 1) {
      const [field, message] = required[i];
      if (!`${form[field]}`.trim()) {
        return message;
      }
    }

    if (isPastDate(form.departureDate, this.data.minDate)) {
      return "出发日期不能早于今天";
    }

    if (form.spaceType === "fullCase") {
      const caseCount = Number(form.caseCount);
      if (!Number.isInteger(caseCount) || caseCount <= 0) {
        return "整箱数量必须是大于 0 的整数";
      }
      return "";
    }

    if (!`${form.totalWeight}`.trim()) {
      return "请填写可用重量";
    }

    const totalWeight = Number(form.totalWeight);
    if (!Number.isFinite(totalWeight) || totalWeight <= 0) {
      return "可用重量必须大于 0";
    }
    return "";
  },

  confirmOverSingleBagWeight(totalWeight) {
    if (this.data.form.spaceType !== "loose" || totalWeight <= 23) {
      return Promise.resolve(true);
    }

    return new Promise((resolve) => {
      wx.showModal({
        title: "重量超过 23kg",
        content: "您提交的重量已超过单个行李额 23kg 重量，是否确定提交填写重量？",
        confirmText: "是",
        cancelText: "否",
        success: (res) => {
          resolve(Boolean(res.confirm));
        },
        fail: () => {
          resolve(false);
        },
      });
    });
  },

  confirmMultipleCases(caseCount) {
    if (this.data.form.spaceType !== "fullCase" || caseCount <= 1) {
      return Promise.resolve(true);
    }

    return new Promise((resolve) => {
      wx.showModal({
        title: "整箱数量超过 1 个",
        content: `您提交了 ${caseCount} 个整箱，每个整箱默认 23kg，是否确定提交？`,
        confirmText: "是",
        cancelText: "否",
        success: (res) => {
          resolve(Boolean(res.confirm));
        },
        fail: () => {
          resolve(false);
        },
      });
    });
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

  async submitBag() {
    if (this.data.submitting) {
      return;
    }

    ["allowed", "restricted"].forEach((list) => {
      if (this.data.tagDraft[list].trim()) {
        this.addTag({ currentTarget: { dataset: { list } } });
      }
    });

    const errorMessage = this.validateForm();
    if (errorMessage) {
      showToast({
        title: errorMessage,
        icon: "none",
      });
      return;
    }

    const { form } = this.data;
    const specialItemOptions = normalizeSpecialItems(form.specialItemOptions);
    const caseCount = form.spaceType === "fullCase" ? Number(form.caseCount) : 0;
    const totalWeight = form.spaceType === "fullCase" ? caseCount * 23 : Number(form.totalWeight);
    const confirmed = await this.confirmOverSingleBagWeight(totalWeight);
    if (!confirmed) {
      return;
    }
    const casesConfirmed = await this.confirmMultipleCases(caseCount);
    if (!casesConfirmed) {
      return;
    }

    this.setData({ submitting: true });
    try {
      const resp = await wx.cloud.callFunction({
        name: "createBag",
        data: {
          ...form,
          specialItemOptions,
          caseCount,
          totalWeight,
        },
      });
      const result = resp.result || {};
      if (!result.success) {
        throw new Error(result.errMsg || "发布失败");
      }
      this.setData({ releasedNo: result.data.bagNo || "Bag" });
      wx.vibrateShort({ type: "light" });
      this.redirectTimer = setTimeout(() => {
        wx.redirectTo({
          url: "/pages/offer-space/my/my",
        });
      }, 800);
    } catch (error) {
      showToast({
        title: error.message || "发布失败",
        icon: "none",
      });
    } finally {
      this.setData({ submitting: false });
    }
  },
});
