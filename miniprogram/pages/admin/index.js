const { formatDateTime, formatWeight, toDate } = require("../../utils/format");
const { formatSpecialItems } = require("../../utils/specialItems");

const bagStatusLabels = {
  active: "可绑定",
  locked: "已锁定",
  closed: "已关闭",
  expired: "已过期",
};

const bindingStatusLabels = {
  pending: "待联系",
  locked: "已锁单",
  contacted: "已联系",
  picked_up: "已取货",
  packed: "已打包",
  delivered_to_carrier: "已送至带货者",
  completed: "已完成",
  cancelled: "已取消",
};

const workBindingStatuses = [
  "pending",
  "locked",
  "contacted",
  "picked_up",
  "packed",
  "delivered_to_carrier",
];

const bagStatuses = [
  { value: "active", label: "可绑定" },
  { value: "locked", label: "已锁定" },
  { value: "closed", label: "已关闭" },
  { value: "expired", label: "已过期" },
];

const bindingStatuses = [
  { value: "pending", label: "待联系" },
  { value: "locked", label: "锁单" },
  { value: "contacted", label: "已联系" },
  { value: "picked_up", label: "已取货" },
  { value: "packed", label: "已打包" },
  { value: "delivered_to_carrier", label: "已送达" },
  { value: "completed", label: "完成" },
  { value: "cancelled", label: "取消" },
];

const bindingFilterOptions = [
  { value: "work", label: "待处理" },
  { value: "all", label: "全部绑定" },
  ...bindingStatuses.map((item) => ({
    value: item.value,
    label: bindingStatusLabels[item.value] || item.label,
  })),
];

const bagFilterOptions = [
  { value: "all", label: "全部 Bag" },
  ...bagStatuses.map((item) => ({
    value: item.value,
    label: bagStatusLabels[item.value] || item.label,
  })),
];

const getAmountText = (record) => {
  if (record.spaceType === "fullCase") {
    return `${Number(record.requestedCases || 1)} 件`;
  }
  return formatWeight(record.requestedWeight);
};

const getBagSpaceText = (bag) => {
  if (bag.spaceType === "fullCase") {
    const remainingCases = Number.isFinite(Number(bag.remainingCases))
      ? Number(bag.remainingCases)
      : Math.floor(Number(bag.remainingWeight || 0) / 23);
    return `剩余 ${remainingCases} 件`;
  }
  return `剩余 ${formatWeight(bag.remainingWeight)}`;
};

const dateKey = (date) => {
  if (!date) {
    return "";
  }
  const month = date.getMonth() + 1;
  const day = date.getDate();
  return `${date.getFullYear()}-${month < 10 ? `0${month}` : month}-${day < 10 ? `0${day}` : day}`;
};

const includesKeyword = (item, keyword, fields) => {
  if (!keyword) {
    return true;
  }
  return fields.some((field) => `${item[field] || ""}`.toLowerCase().includes(keyword));
};

const mapAuditLog = (log) => {
  const beforeStatus = log.before && log.before.status ? log.before.status : "";
  const afterStatus = log.after && log.after.status ? log.after.status : "";
  const targetLabel = log.targetType === "binding" ? "Binding" : "Bag";
  const beforeLabel =
    log.targetType === "binding"
      ? bindingStatusLabels[beforeStatus] || beforeStatus
      : bagStatusLabels[beforeStatus] || beforeStatus;
  const afterLabel =
    log.targetType === "binding"
      ? bindingStatusLabels[afterStatus] || afterStatus
      : bagStatusLabels[afterStatus] || afterStatus;

  return {
    ...log,
    timeText: formatDateTime(log.createdAt),
    targetLabel,
    statusText: `${beforeLabel || "-"} → ${afterLabel || "-"}`,
  };
};

const getStatusLabel = (targetType, status) => {
  if (targetType === "binding") {
    return bindingStatusLabels[status] || status || "-";
  }
  return bagStatusLabels[status] || status || "-";
};

Page({
  data: {
    loading: false,
    errorMessage: "",
    searchKeyword: "",
    bindingFilterIndex: 0,
    bagFilterIndex: 0,
    bindingFilterLabel: bindingFilterOptions[0].label,
    bagFilterLabel: bagFilterOptions[0].label,
    bindingFilterOptions,
    bagFilterOptions,
    bagStatuses,
    bindingStatuses,
    summary: {
      bagCount: 0,
      bindingCount: 0,
      pendingCount: 0,
      todayNewCount: 0,
      auditLogCount: 0,
    },
    allBags: [],
    allBindings: [],
    bags: [],
    visibleBindings: [],
    auditLogs: [],
  },

  onShow() {
    this.fetchDashboard();
  },

  onPullDownRefresh() {
    this.fetchDashboard().finally(() => wx.stopPullDownRefresh());
  },

  async fetchDashboard() {
    this.setData({
      loading: true,
      errorMessage: "",
    });
    try {
      const resp = await wx.cloud.callFunction({
        name: "adminGetDashboard",
      });
      const result = resp.result || {};
      if (!result.success) {
        throw new Error(result.errMsg || "加载失败");
      }

      const mapped = this.mapDashboard(result);
      this.setData(mapped, () => this.applyFilters());
    } catch (error) {
      this.setData({
        errorMessage: error.message || "加载失败",
      });
      wx.showToast({
        title: error.message || "加载失败",
        icon: "none",
      });
    } finally {
      this.setData({ loading: false });
    }
  },

  mapDashboard(result) {
    const todayText = dateKey(new Date());
    const allBindings = [];
    const allBags = (result.data || []).map((bag) => {
      const isFullCase = bag.spaceType === "fullCase";
      const remainingCases = Number.isFinite(Number(bag.remainingCases))
        ? Number(bag.remainingCases)
        : Math.floor(Number(bag.remainingWeight || 0) / 23);
      const caseCount = Number.isFinite(Number(bag.caseCount))
        ? Number(bag.caseCount)
        : remainingCases || (isFullCase ? 1 : 0);
      const mappedBag = {
        ...bag,
        spaceTypeText: isFullCase ? "整箱" : "散件",
        isFullCase,
        caseCountText: `${caseCount} 件`,
        remainingCasesText: `${remainingCases} 件`,
        totalWeightText: formatWeight(bag.totalWeight),
        remainingWeightText: formatWeight(bag.remainingWeight),
        boundWeightText: formatWeight(bag.boundWeight || 0),
        specialItemOptionsText: formatSpecialItems(bag.specialItemOptions),
        statusText: bagStatusLabels[bag.status] || bag.status,
        createdAtText: formatDateTime(bag.createdAt),
        updatedAtText: formatDateTime(bag.updatedAt),
        spaceSummaryText: getBagSpaceText(bag),
      };

      mappedBag.bindings = (bag.bindings || []).map((binding) => {
        const mappedBinding = {
          ...binding,
          bagNo: bag.bagNo,
          fromCity: bag.fromCity,
          toCity: bag.toCity,
          departureDate: bag.departureDate,
          carrierWechat: bag.carrierWechat,
          carrierReceiveAddress: bag.carrierReceiveAddress,
          spaceTypeText: binding.spaceType === "fullCase" ? "整箱" : "散件",
          amountText: getAmountText(binding),
          requestedSpecialItemsText: formatSpecialItems(binding.requestedSpecialItems),
          statusText: bindingStatusLabels[binding.status] || binding.status,
          createdAtText: formatDateTime(binding.createdAt),
          lockDeadlineText: formatDateTime(binding.lockDeadlineAt),
          lockedAtText: formatDateTime(binding.lockedAt),
          updatedAtText: formatDateTime(binding.updatedAt),
        };
        allBindings.push(mappedBinding);
        return mappedBinding;
      });

      return mappedBag;
    });

    const pendingCount = allBindings.filter((binding) =>
      workBindingStatuses.includes(binding.status)
    ).length;
    const todayNewCount = allBindings.filter(
      (binding) => dateKey(toDate(binding.createdAt)) === todayText
    ).length;
    const auditLogs = (result.auditLogs || []).map(mapAuditLog);

    return {
      allBags,
      allBindings,
      auditLogs,
      summary: {
        bagCount: allBags.length,
        bindingCount: allBindings.length,
        pendingCount,
        todayNewCount,
        auditLogCount: auditLogs.length,
      },
    };
  },

  applyFilters() {
    const keyword = `${this.data.searchKeyword || ""}`.trim().toLowerCase();
    const bindingFilter = this.data.bindingFilterOptions[this.data.bindingFilterIndex].value;
    const bagFilter = this.data.bagFilterOptions[this.data.bagFilterIndex].value;

    const visibleBindings = this.data.allBindings.filter((binding) => {
      const statusMatched =
        bindingFilter === "all" ||
        (bindingFilter === "work" && workBindingStatuses.includes(binding.status)) ||
        binding.status === bindingFilter;
      const keywordMatched = includesKeyword(binding, keyword, [
        "bagNo",
        "fromCity",
        "toCity",
        "senderWechat",
        "pickupAddress",
        "receiverName",
        "receiverPhone",
        "deliveryAddress",
        "itemDescription",
        "carrierWechat",
        "carrierReceiveAddress",
      ]);
      return statusMatched && keywordMatched;
    });

    const bags = this.data.allBags.filter((bag) => {
      const statusMatched = bagFilter === "all" || bag.status === bagFilter;
      const keywordMatched = includesKeyword(bag, keyword, [
        "bagNo",
        "fromCity",
        "toCity",
        "carrierWechat",
        "carrierReceiveAddress",
        "flightNo",
      ]);
      return statusMatched && keywordMatched;
    });

    this.setData({
      visibleBindings,
      bags,
    });
  },

  onSearchInput(event) {
    this.setData(
      {
        searchKeyword: event.detail.value,
      },
      () => this.applyFilters()
    );
  },

  onBindingFilterChange(event) {
    const bindingFilterIndex = Number(event.detail.value);
    this.setData(
      {
        bindingFilterIndex,
        bindingFilterLabel: this.data.bindingFilterOptions[bindingFilterIndex].label,
      },
      () => this.applyFilters()
    );
  },

  onBagFilterChange(event) {
    const bagFilterIndex = Number(event.detail.value);
    this.setData(
      {
        bagFilterIndex,
        bagFilterLabel: this.data.bagFilterOptions[bagFilterIndex].label,
      },
      () => this.applyFilters()
    );
  },

  resetFilters() {
    this.setData(
      {
        searchKeyword: "",
        bindingFilterIndex: 0,
        bagFilterIndex: 0,
        bindingFilterLabel: this.data.bindingFilterOptions[0].label,
        bagFilterLabel: this.data.bagFilterOptions[0].label,
      },
      () => this.applyFilters()
    );
  },

  findBagById(id) {
    return this.data.allBags.find((bag) => bag._id === id) || null;
  },

  findBindingById(id) {
    return this.data.allBindings.find((binding) => binding._id === id) || null;
  },

  confirmStatusChange({ targetType, targetCode, currentStatus, nextStatus }) {
    if (currentStatus === nextStatus) {
      wx.showToast({
        title: "状态没有变化",
        icon: "none",
      });
      return Promise.resolve(null);
    }

    const currentLabel = getStatusLabel(targetType, currentStatus);
    const nextLabel = getStatusLabel(targetType, nextStatus);
    const targetLabel = targetType === "binding" ? "Binding" : "Bag";

    return new Promise((resolve) => {
      wx.showModal({
        title: `更新 ${targetLabel} 状态`,
        content: `${targetCode || targetLabel}\n${currentLabel} → ${nextLabel}\n备注会写入操作日志，可留空。`,
        editable: true,
        placeholderText: "填写备注，可留空",
        confirmText: "确认更新",
        cancelText: "取消",
        success: (res) => {
          if (!res.confirm) {
            resolve(null);
            return;
          }
          resolve({
            note: `${res.content || ""}`.trim(),
          });
        },
        fail: () => {
          resolve(null);
        },
      });
    });
  },

  async updateBagStatus(event) {
    const { id, status } = event.currentTarget.dataset;
    const bag = this.findBagById(id);
    const confirmed = await this.confirmStatusChange({
      targetType: "bag",
      targetCode: bag ? bag.bagNo : id,
      currentStatus: bag ? bag.status : "",
      nextStatus: status,
    });
    if (!confirmed) {
      return;
    }

    wx.showLoading({ title: "更新中..." });
    try {
      const resp = await wx.cloud.callFunction({
        name: "adminUpdateBagStatus",
        data: {
          bagId: id,
          status,
          note: confirmed.note,
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
      this.fetchDashboard();
    } catch (error) {
      wx.showToast({
        title: error.message || "更新失败",
        icon: "none",
      });
    } finally {
      wx.hideLoading();
    }
  },

  async updateBindingStatus(event) {
    const { id, status } = event.currentTarget.dataset;
    const binding = this.findBindingById(id);
    const confirmed = await this.confirmStatusChange({
      targetType: "binding",
      targetCode: binding ? `${binding.bagNo} · ${binding.amountText}` : id,
      currentStatus: binding ? binding.status : "",
      nextStatus: status,
    });
    if (!confirmed) {
      return;
    }

    wx.showLoading({ title: "更新中..." });
    try {
      const resp = await wx.cloud.callFunction({
        name: "adminUpdateBindingStatus",
        data: {
          bindingId: id,
          status,
          note: confirmed.note,
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
      this.fetchDashboard();
    } catch (error) {
      wx.showToast({
        title: error.message || "更新失败",
        icon: "none",
      });
    } finally {
      wx.hideLoading();
    }
  },
});
