const { formatDateTime, formatWeight, toDate } = require("../../../utils/format");
const {
  buildSpecialItemOptions,
  formatSpecialItems,
  normalizeSpecialItems,
} = require("../../../utils/specialItems");
const { showToast } = require("../../../utils/toast");
const {
  bindFormMethods,
  buildQuickWeights,
  createBindFormData,
  validateBindForm,
} = require("../../../utils/bindForm");

const isEditable = (binding) => {
  const lockDeadlineAt = toDate(binding.lockDeadlineAt);
  return (
    binding.status === "pending" &&
    lockDeadlineAt &&
    lockDeadlineAt.getTime() > Date.now()
  );
};

Page({
  ...bindFormMethods,

  readyText: "可以保存了",

  data: {
    ...createBindFormData(),
    bindingId: "",
    binding: null,
    loading: false,
    submitting: false,
    saved: false,
  },

  onLoad(options) {
    if (!options.id) {
      showToast({
        title: "缺少 binding 信息",
        icon: "none",
      });
      return;
    }

    this.setData({ bindingId: options.id });
    this.fetchBinding(options.id);
  },

  onUnload() {
    clearTimeout(this.redirectTimer);
  },

  async fetchBinding(bindingId) {
    this.setData({ loading: true });
    try {
      const resp = await wx.cloud.callFunction({
        name: "getMySenderBindings",
      });
      const result = resp.result || {};
      if (!result.success) {
        throw new Error(result.errMsg || "加载失败");
      }

      const binding = (result.data || []).find((item) => item._id === bindingId);
      if (!binding) {
        throw new Error("没有找到这条绑定");
      }
      if (!isEditable(binding)) {
        throw new Error("这条绑定已锁单，不能编辑");
      }

      const isFullCase = binding.spaceType === "fullCase";
      let availableSpecialItems = normalizeSpecialItems(binding.bagSpecialItemOptions);
      if (binding.bagId) {
        try {
          const bagResp = await wx.cloud.callFunction({
            name: "getBagDetail",
            data: {
              bagId: binding.bagId,
            },
          });
          const bagResult = bagResp.result || {};
          if (bagResult.success && bagResult.data) {
            availableSpecialItems = normalizeSpecialItems(bagResult.data.specialItemOptions);
          }
        } catch (error) {
          // Editing can continue without the latest bag detail; backend still validates.
        }
      }
      const requestedSpecialItems = normalizeSpecialItems(
        binding.requestedSpecialItems,
        availableSpecialItems
      );
      this.setData({
        specialItemOptions: buildSpecialItemOptions(requestedSpecialItems, availableSpecialItems),
        binding: {
          ...binding,
          isFullCase,
          availableSpecialItems,
          specialItemOptionsText: formatSpecialItems(availableSpecialItems),
          spaceTypeText: isFullCase ? "整箱" : "散件",
          requestedWeightText: formatWeight(binding.requestedWeight),
          lockDeadlineText: formatDateTime(binding.lockDeadlineAt),
        },
        formInfo: {
          isFullCase,
          fromCity: binding.fromCity,
          toCity: binding.toCity,
          maxWeight: 0,
          maxText: "",
          casesText: "固定 1 个整箱",
          availableSpecialItems,
        },
        quickWeights: isFullCase ? [] : buildQuickWeights(0),
        form: {
          requestedWeight: isFullCase ? "23" : `${binding.requestedWeight || ""}`,
          requestedSpecialItems,
          senderWechat: binding.senderWechat || "",
          pickupAddress: binding.pickupAddress || "",
          receiverName: binding.receiverName || "",
          receiverPhone: binding.receiverPhone || "",
          deliveryAddress: binding.deliveryAddress || "",
          itemDescription: binding.itemDescription || "",
          senderNote: binding.senderNote || "",
        },
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
    const { binding, bindingId, form, submitting } = this.data;
    if (submitting || !binding) {
      return;
    }

    const errorMessage = validateBindForm(this.data.formInfo, form);
    if (errorMessage) {
      showToast({
        title: errorMessage,
        icon: "none",
      });
      return;
    }

    const requestedWeight = binding.isFullCase ? 23 : Number(form.requestedWeight);
    const requestedSpecialItems = normalizeSpecialItems(
      form.requestedSpecialItems,
      binding.availableSpecialItems
    );
    this.setData({ submitting: true });
    try {
      const resp = await wx.cloud.callFunction({
        name: "updateBinding",
        data: {
          bindingId,
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
        throw new Error(result.errMsg || "更新失败");
      }

      this.setData({ saved: true });
      wx.vibrateShort({ type: "light" });
      this.redirectTimer = setTimeout(() => {
        wx.redirectTo({
          url: "/pages/find-bags/my/my",
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
