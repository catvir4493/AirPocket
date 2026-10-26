const { normalizeSpecialItems } = require("../../../utils/specialItems");
const { showToast } = require("../../../utils/toast");
const { bagFormMethods, createBagFormData, validateBagForm } = require("../../../utils/bagForm");
const { showFieldError, clearFieldError } = require("../../../utils/fieldError");
const { drawShareCard } = require("../../../utils/shareCard");
const { watchNavTitle, unwatchNavTitle } = require("../../../utils/navTitle");

Page({
  ...bagFormMethods,

  readyText: "可以发布了",

  data: {
    navCollapsed: false,
    refreshing: false,
    ...createBagFormData("可以发布了"),
    submitting: false,
    releasedNo: "",
    releasedId: "",
    // After publishing: the stamp lands, then the "done" sheet with share / my releases.
    stampShow: false,
    doneSheet: false,
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

  onReady() {
    watchNavTitle(this, ".large-title");
  },

  onUnload() {
    unwatchNavTitle(this);
    clearTimeout(this.redirectTimer);
    clearFieldError(this);
  },

  goMyReleases() {
    wx.redirectTo({
      url: "/pages/offer-space/my/my",
    });
  },

  // Sharing after publishing opens the new bag's page; before that, the app's home.
  onShareAppMessage() {
    const { releasedId, preview, dateText } = this.data;
    if (!releasedId) {
      return { title: "AirPocket · 顺路帮带，行李空间共享", path: "/pages/index/index" };
    }
    const share = {
      title: `${preview.from} → ${preview.to} ${dateText}，还有 ${preview.weight}kg 行李额`,
      path: `/pages/find-bags/detail/detail?id=${releasedId}`,
    };
    return {
      ...share,
      promise: (this.sharePromise || Promise.resolve("")).then((imageUrl) =>
        imageUrl ? { ...share, imageUrl } : share
      ),
    };
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
      this.setData({
        releasedNo: result.data.bagNo || "Bag",
        releasedId: result.data._id || "",
        stampShow: true,
      });
      wx.vibrateShort({ type: "light" });
      // Draw the share image while the stamp is on screen.
      const { preview } = this.data;
      this.sharePromise = drawShareCard(this, "#share-canvas", {
        day: preview.day,
        month: preview.month,
        from: preview.from,
        to: preview.to,
        weight: preview.weight,
        chip: preview.chips[0],
      });
      this.redirectTimer = setTimeout(() => {
        this.setData({ stampShow: false, doneSheet: true });
      }, 1100);
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
