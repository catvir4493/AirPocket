const {
  buildSpecialItemOptions,
  normalizeSpecialItems,
} = require("../../../utils/specialItems");
const { showToast } = require("../../../utils/toast");
const { bagFormMethods, createBagFormData, validateBagForm } = require("../../../utils/bagForm");
const { showFieldError, clearFieldError } = require("../../../utils/fieldError");
const { watchNavTitle, unwatchNavTitle } = require("../../../utils/navTitle");

const listToText = (value) => (Array.isArray(value) ? value.join(", ") : "");

Page({
  ...bagFormMethods,

  readyText: "可以保存了",

  data: {
    navCollapsed: false,
    refreshing: false,
    ...createBagFormData("可以保存了"),
    bagId: "",
    loading: false,
    submitting: false,
    saved: false,
  },

  onReady() {
    watchNavTitle(this, ".large-title");
  },

  onLoad(options) {
    if (!options.id) {
      showToast({
        title: "缺少 bag 信息",
        icon: "none",
      });
      return;
    }
    this.setData({ bagId: options.id });
    this.fetchBag(options.id);
  },

  onUnload() {
    unwatchNavTitle(this);
    clearTimeout(this.redirectTimer);
    clearFieldError(this);
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
      this.updateForm(
        {
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
        { specialItemOptions: buildSpecialItemOptions(specialItemOptions) }
      );
      // Loading the saved values is not an edit: no preview flashes.
      this.setData({ pulse: { date: 0, route: 0, chips: 0, weight: 0 } });
    } catch (error) {
      showToast({
        title: error.message || "加载失败",
        icon: "none",
      });
    } finally {
      this.setData({ loading: false });
    }
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

    this.commitTagDrafts();

    const invalid = validateBagForm(this.data.form, this.data.minDate);
    if (invalid) {
      showFieldError(this, invalid);
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
      this.setData({ saved: true });
      wx.vibrateShort({ type: "light" });
      this.redirectTimer = setTimeout(() => {
        wx.redirectTo({
          url: "/pages/offer-space/my/my",
        });
      }, 1300);
    } catch (error) {
      showToast({
        title: error.message || "更新失败",
        icon: "none",
      });
    } finally {
      this.setData({ submitting: false });
    }
  },
});
