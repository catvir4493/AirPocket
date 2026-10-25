const {
  buildSpecialItemOptions,
  normalizeSpecialItems,
  toggleSpecialItem,
} = require("../../../utils/specialItems");
const { showToast } = require("../../../utils/toast");

const today = () => {
  const date = new Date();
  const month = date.getMonth() + 1;
  const day = date.getDate();
  return `${date.getFullYear()}-${month < 10 ? `0${month}` : month}-${day < 10 ? `0${day}` : day}`;
};

const isPastDate = (value, minDate) => value && value < minDate;

Page({
  data: {
    submitting: false,
    releasedNo: "",
    focusedField: "",
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
