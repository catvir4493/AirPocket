const { normalizeSpecialItems } = require("../../../utils/specialItems");
const { showToast } = require("../../../utils/toast");
const { bagFormMethods, createBagFormData, validateBagForm } = require("../../../utils/bagForm");
const { showFieldError, clearFieldError } = require("../../../utils/fieldError");

Page({
  ...bagFormMethods,

  readyText: "可以发布了",

  data: {
    ...createBagFormData("可以发布了"),
    submitting: false,
    releasedNo: "",
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
    clearFieldError(this);
  },

  async submitBag() {
    if (this.data.submitting) {
      return;
    }

    this.commitTagDrafts();

    const invalid = validateBagForm(this.data.form, this.data.minDate);
    if (invalid) {
      showFieldError(this, invalid);
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
      }, 1300);
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
