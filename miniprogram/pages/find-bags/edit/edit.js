const { formatDateTime, formatWeight, toDate } = require("../../../utils/format");
const {
  buildSpecialItemOptions,
  formatSpecialItems,
  normalizeSpecialItems,
  toggleSpecialItem,
} = require("../../../utils/specialItems");

const isEditable = (binding) => {
  const lockDeadlineAt = toDate(binding.lockDeadlineAt);
  return (
    binding.status === "pending" &&
    lockDeadlineAt &&
    lockDeadlineAt.getTime() > Date.now()
  );
};

Page({
  data: {
    bindingId: "",
    binding: null,
    loading: false,
    submitting: false,
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
        title: "缺少 binding 信息",
        icon: "none",
      });
      return;
    }

    this.setData({ bindingId: options.id });
    this.fetchBinding(options.id);
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

  toggleSpecialItem(event) {
    const { binding, form } = this.data;
    const { value } = event.currentTarget.dataset;
    const availableSpecialItems = binding ? binding.availableSpecialItems : [];
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

  validateForm() {
    const { binding, form } = this.data;
    const requestedWeight = binding && binding.isFullCase ? 23 : Number(form.requestedWeight);
    if (!Number.isFinite(requestedWeight) || requestedWeight <= 0) {
      return "请输入大于 0 的重量";
    }
    if (!form.itemDescription.trim()) {
      return "请填写物品描述";
    }
    if (!form.senderWechat.trim()) {
      return "请填写微信号";
    }
    if (!form.pickupAddress.trim()) {
      return "请填写取货地址";
    }
    if (!form.receiverName.trim()) {
      return "请填写收件人姓名";
    }
    if (!form.receiverPhone.trim()) {
      return "请填写收件人电话";
    }
    if (!form.deliveryAddress.trim()) {
      return "请填写目的地快递地址";
    }
    return "";
  },

  async submitBinding() {
    const { binding, bindingId, form, submitting } = this.data;
    if (submitting || !binding) {
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

      wx.showToast({
        title: "已更新",
        icon: "success",
      });
      setTimeout(() => {
        wx.redirectTo({
          url: "/pages/find-bags/my/my",
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
