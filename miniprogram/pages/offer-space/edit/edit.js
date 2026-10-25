const {
  buildSpecialItemOptions,
  normalizeSpecialItems,
  toggleSpecialItem,
} = require("../../../utils/specialItems");

const today = () => {
  const date = new Date();
  const month = date.getMonth() + 1;
  const day = date.getDate();
  return `${date.getFullYear()}-${month < 10 ? `0${month}` : month}-${day < 10 ? `0${day}` : day}`;
};

const listToText = (value) => (Array.isArray(value) ? value.join(", ") : "");

const isPastDate = (value, minDate) => value && value < minDate;

Page({
  data: {
    bagId: "",
    loading: false,
    submitting: false,
    minDate: today(),
    specialItemOptions: buildSpecialItemOptions([]),
    form: {
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
    },
  },

  onLoad(options) {
    if (!options.id) {
      wx.showToast({
        title: "缺少 bag 信息",
        icon: "none",
      });
      return;
    }
    this.setData({ bagId: options.id });
    this.fetchBag(options.id);
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
      const spaceType = bag.spaceType === "fullCase" ? "fullCase" : "loose";
      const specialItemOptions = normalizeSpecialItems(bag.specialItemOptions);
      this.setData({
        specialItemOptions: buildSpecialItemOptions(specialItemOptions),
        form: {
          spaceType,
          fromCity: bag.fromCity || "",
          toCity: bag.toCity || "",
          departureDate: bag.departureDate || "",
          flightNo: bag.flightNo || "",
          carrierWechat: bag.carrierWechat || "",
          carrierReceiveAddress: bag.carrierReceiveAddress || "",
          totalWeight: spaceType === "fullCase" ? "" : `${bag.totalWeight || ""}`,
          caseCount: spaceType === "fullCase" ? `${bag.caseCount || 1}` : "1",
          availableVolume: bag.availableVolume || "",
          specialItemOptions,
          allowedItemsText: listToText(bag.allowedItems),
          restrictedItemsText: listToText(bag.restrictedItems),
          note: bag.note || "",
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

  onFieldInput(event) {
    const { field } = event.currentTarget.dataset;
    this.setData({
      [`form.${field}`]: event.detail.value,
    });
  },

  selectSpaceType(event) {
    const { type } = event.currentTarget.dataset;
    this.setData({
      "form.spaceType": type,
      "form.totalWeight": type === "fullCase" ? "" : this.data.form.totalWeight,
      "form.caseCount": type === "fullCase" ? this.data.form.caseCount || "1" : "1",
    });
  },

  onDateChange(event) {
    this.setData({
      "form.departureDate": event.detail.value,
    });
  },

  toggleSpecialItem(event) {
    const { value } = event.currentTarget.dataset;
    const specialItemOptions = toggleSpecialItem(this.data.form.specialItemOptions, value);
    this.setData({
      "form.specialItemOptions": specialItemOptions,
      specialItemOptions: buildSpecialItemOptions(specialItemOptions),
    });
  },

  validateForm() {
    const { form, minDate } = this.data;
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

    if (isPastDate(form.departureDate, minDate)) {
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

  confirmMultipleCases(caseCount) {
    if (this.data.form.spaceType !== "fullCase" || caseCount <= 1) {
      return Promise.resolve(true);
    }

    return new Promise((resolve) => {
      wx.showModal({
        title: "整箱数量超过 1 个",
        content: `您提交了 ${caseCount} 个整箱，每个整箱默认 23kg，是否确定保存？`,
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

  async submitBag() {
    if (this.data.submitting) {
      return;
    }

    const errorMessage = this.validateForm();
    if (errorMessage) {
      wx.showToast({
        title: errorMessage,
        icon: "none",
      });
      return;
    }

    const { bagId, form } = this.data;
    const specialItemOptions = normalizeSpecialItems(form.specialItemOptions);
    const caseCount = form.spaceType === "fullCase" ? Number(form.caseCount) : 0;
    const casesConfirmed = await this.confirmMultipleCases(caseCount);
    if (!casesConfirmed) {
      return;
    }

    this.setData({ submitting: true });
    try {
      const resp = await wx.cloud.callFunction({
        name: "updateBag",
        data: {
          bagId,
          ...form,
          specialItemOptions,
          caseCount,
          totalWeight: form.spaceType === "fullCase" ? caseCount * 23 : Number(form.totalWeight),
        },
      });
      const result = resp.result || {};
      if (!result.success) {
        throw new Error(result.errMsg || "更新失败");
      }
      wx.showToast({
        title: "已更新",
        icon: "success",
      });
      setTimeout(() => {
        wx.redirectTo({
          url: "/pages/offer-space/my/my",
        });
      }, 700);
    } catch (error) {
      wx.showToast({
        title: error.message || "更新失败",
        icon: "none",
      });
    } finally {
      this.setData({ submitting: false });
    }
  },
});
