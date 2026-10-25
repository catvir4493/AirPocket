const { formatDateTime, formatWeight, toDate } = require("../../../utils/format");
const { formatSpecialItems } = require("../../../utils/specialItems");

const statusLabels = {
  pending: "等待确认",
  locked: "已锁单",
  contacted: "已联系",
  picked_up: "已取货",
  packed: "已打包",
  delivered_to_carrier: "已送至带货者",
  completed: "已完成",
  cancelled: "已取消",
};

const getEditState = (binding) => {
  const lockDeadlineAt = toDate(binding.lockDeadlineAt);
  const now = new Date();
  const canEdit =
    binding.status === "pending" && lockDeadlineAt && lockDeadlineAt.getTime() > now.getTime();

  if (canEdit) {
    const remainingMinutes = Math.max(
      1,
      Math.ceil((lockDeadlineAt.getTime() - now.getTime()) / 60000)
    );
    return {
      canEdit: true,
      lockText: `可编辑，剩余 ${remainingMinutes} 分钟`,
    };
  }

  if (binding.status === "cancelled") {
    return {
      canEdit: false,
      lockText: "已取消",
    };
  }

  return {
    canEdit: false,
    lockText: binding.status === "pending" ? "锁单信息待同步" : "已锁单，需联系平台修改",
  };
};

Page({
  data: {
    bindingId: "",
    binding: null,
    loading: true,
    cancelling: false,
  },

  onLoad(options) {
    if (!options.id) {
      wx.showToast({
        title: "缺少 binding 信息",
        icon: "none",
      });
      this.setData({ loading: false });
      return;
    }

    this.setData({ bindingId: options.id });
    this.fetchBinding(options.id);
  },

  onPullDownRefresh() {
    this.fetchBinding(this.data.bindingId).finally(() => wx.stopPullDownRefresh());
  },

  async fetchBinding(bindingId) {
    if (!bindingId) {
      return;
    }

    this.setData({ loading: true });
    try {
      const resp = await wx.cloud.callFunction({
        name: "getMySenderBindings",
      });
      const result = resp.result || {};
      if (!result.success) {
        throw new Error(result.errMsg || "加载失败");
      }

      const source = (result.data || []).find((item) => item._id === bindingId);
      if (!source) {
        throw new Error("没有找到这条绑定");
      }

      const isFullCase = source.spaceType === "fullCase";
      const binding = {
        ...source,
        ...getEditState(source),
        isFullCase,
        spaceTypeText: isFullCase ? "整箱" : "散件",
        requestedCasesText: `${Number(source.requestedCases || (isFullCase ? 1 : 0))} 件`,
        requestedWeightText: formatWeight(source.requestedWeight),
        requestedSpecialItemsText: formatSpecialItems(source.requestedSpecialItems),
        createdAtText: formatDateTime(source.createdAt),
        lockDeadlineText: formatDateTime(source.lockDeadlineAt),
        lockedAtText: formatDateTime(source.lockedAt),
        statusText: statusLabels[source.status] || source.status,
      };

      this.setData({ binding });
    } catch (error) {
      wx.showToast({
        title: error.message || "加载失败",
        icon: "none",
      });
    } finally {
      this.setData({ loading: false });
    }
  },

  goEditBinding() {
    if (!this.data.binding) {
      return;
    }
    wx.navigateTo({
      url: `/pages/find-bags/edit/edit?id=${this.data.binding._id}`,
    });
  },

  cancelBinding() {
    const { binding, cancelling } = this.data;
    if (!binding || cancelling) {
      return;
    }

    wx.showModal({
      title: "取消绑定",
      content: "取消后会释放已占用重量，确认取消这条绑定吗？",
      confirmText: "取消绑定",
      cancelText: "再想想",
      success: async (modalRes) => {
        if (!modalRes.confirm) {
          return;
        }

        this.setData({ cancelling: true });
        wx.showLoading({
          title: "取消中",
          mask: true,
        });

        try {
          const resp = await wx.cloud.callFunction({
            name: "cancelBinding",
            data: {
              bindingId: binding._id,
            },
          });
          const result = resp.result || {};
          if (!result.success) {
            throw new Error(result.errMsg || "取消失败");
          }
          wx.showToast({
            title: "已取消",
            icon: "success",
          });
          this.fetchBinding(binding._id);
        } catch (error) {
          wx.showToast({
            title: error.message || "取消失败",
            icon: "none",
          });
        } finally {
          wx.hideLoading();
          this.setData({ cancelling: false });
        }
      },
    });
  },
});
