const { formatDateTime, formatWeight, toDate } = require("../../../utils/format");
const { formatSpecialItems } = require("../../../utils/specialItems");
const { showToast } = require("../../../utils/toast");
const { BINDING_FLOW, bindingStatus } = require("../../../utils/status");
const { watchNavTitle, unwatchNavTitle, refreshWithPlane } = require("../../../utils/navTitle");

// Progress timeline: steps before the current status are done, the current one pulses.
// Only submit, lock and the latest update carry real times.
const buildTimeline = (binding) => {
  const cancelled = binding.status === "cancelled";
  const currentIndex = cancelled ? -1 : Math.max(0, BINDING_FLOW.findIndex((step) => step.status === binding.status));
  const steps = BINDING_FLOW.map((step, index) => {
    let time = "";
    if (index === 0) {
      time = formatDateTime(binding.createdAt);
    } else if (step.status === "locked" && binding.lockedAt) {
      time = formatDateTime(binding.lockedAt);
    } else if (index === currentIndex && binding.updatedAt) {
      time = formatDateTime(binding.updatedAt);
    }
    return {
      ...step,
      state: index < currentIndex ? "done" : index === currentIndex ? "current" : "todo",
      time: index <= currentIndex || (cancelled && index === 0) ? time : "",
    };
  });
  if (cancelled) {
    steps[0].state = "done";
    return steps.slice(0, 1).concat({
      status: "cancelled",
      label: "已取消",
      state: "cancelled",
      time: formatDateTime(binding.updatedAt),
    });
  }
  return steps;
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
    navCollapsed: false,
    refreshing: false,
    loadError: "",
    bindingId: "",
    binding: null,
    loading: true,
    cancelling: false,
    tearing: false,
  },

  onReady() {
    watchNavTitle(this, ".nav-sentinel");
  },

  onLoad(options) {
    if (!options.id) {
      showToast({
        title: "缺少 binding 信息",
        icon: "none",
      });
      this.setData({ loading: false });
      return;
    }

    this.setData({ bindingId: options.id });
    this.fetchBinding(options.id);
  },

  onUnload() {
    unwatchNavTitle(this);
    clearTimeout(this.tearTimer);
  },

  onPullDownRefresh() {
    refreshWithPlane(this, () => this.fetchBinding(this.data.bindingId));
  },

  async fetchBinding(bindingId) {
    if (!bindingId) {
      return;
    }

    // Refreshes keep the current pass on screen instead of going back to the skeleton.
    if (!this.data.binding) {
      this.setData({ loading: true });
    }
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
        // Not found is not a load failure: fall through to the "没有找到" state.
        this.setData({ binding: null });
        return;
      }

      const isFullCase = source.spaceType === "fullCase";
      const status = bindingStatus(source.status);
      const requestedSpecialItemsText = formatSpecialItems(source.requestedSpecialItems);
      const binding = {
        ...source,
        ...getEditState(source),
        isFullCase,
        spaceTypeText: isFullCase ? "整箱" : "散件",
        requestedCasesText: `${Number(source.requestedCases || (isFullCase ? 1 : 0))} 件`,
        requestedWeightText: formatWeight(source.requestedWeight),
        requestedCases: Number(source.requestedCases || (isFullCase ? 1 : 0)),
        requestedSpecialItemsText,
        passChips: [isFullCase ? "整箱" : "散件"].concat(
          requestedSpecialItemsText === "无" ? [] : requestedSpecialItemsText.split(", ")
        ),
        createdAtText: formatDateTime(source.createdAt),
        lockDeadlineText: formatDateTime(source.lockDeadlineAt),
        lockedAtText: formatDateTime(source.lockedAt),
        statusText: status.text,
        statusTone: status.tone,
        timeline: buildTimeline(source),
      };

      this.setData({ binding });
    } catch (error) {
      // Nothing on screen yet: show the retry state. Otherwise keep the page and just say so.
      if (!this.data.binding) {
        this.setData({ loadError: error.message || "加载失败" });
      } else {
        showToast({
          title: error.message || "加载失败",
          icon: "none",
        });
      }
    } finally {
      this.setData({ loading: false });
    }
  },

  retryLoad() {
    this.setData({ loadError: "", loading: true });
    this.fetchBinding(this.data.bindingId);
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
          wx.hideLoading();
          wx.vibrateShort({ type: "medium" });
          this.setData({ tearing: true });
          this.tearTimer = setTimeout(() => {
            this.setData({ tearing: false });
            this.fetchBinding(binding._id);
          }, 1000);
        } catch (error) {
          showToast({
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
