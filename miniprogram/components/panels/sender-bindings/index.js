const { formatDateTime, formatWeight, toDate } = require("../../../utils/format");
const { formatSpecialItems } = require("../../../utils/specialItems");
const { countUp } = require("../../../utils/countUp");
const { bindingStatus, isBindingOngoing } = require("../../../utils/status");
const { dayParts } = require("../../../utils/date");
const { showToast } = require("../../../utils/toast");

const defaultEmptyMessage = "还没有绑定记录。去「找行李额」选一个顺路的行李箱，绑定后会出现在这里。";
const noSearchResultMessage = "没有符合条件的绑定记录。";

const SEGMENTS = [
  { value: "all", label: "全部" },
  { value: "ongoing", label: "进行中" },
  { value: "done", label: "已完成" },
];

const matchesSegment = (binding, segment) => {
  if (segment === "ongoing") {
    return binding.isOngoing;
  }
  if (segment === "done") {
    return binding.status === "completed";
  }
  return true;
};
const defaultBagOption = { label: "全部编号", value: "" };

const includesText = (source, keyword) =>
  !keyword || `${source || ""}`.toLowerCase().includes(keyword.toLowerCase());

const buildBagOptions = (items) => {
  const seen = {};
  const options = [defaultBagOption];
  (items || []).forEach((item) => {
    const bagNo = `${item.bagNo || ""}`.trim();
    if (bagNo && !seen[bagNo]) {
      seen[bagNo] = true;
      options.push({ label: bagNo, value: bagNo });
    }
  });
  return options;
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

Component({
  options: {
    styleIsolation: "apply-shared",
  },

  data: {
    loading: true,
    allBindings: [],
    bindings: [],
    searchPanelOpen: false,
    searchPanelClosing: false,
    statOngoing: 0,
    statDone: 0,
    statWeight: 0,
    segments: SEGMENTS,
    segment: "all",
    segmentIndex: 0,
    listKey: 0,
    hasSearchFilters: false,
    bagOptions: [defaultBagOption],
    bagIndex: 0,
    searchFilters: {
      departureDate: "",
      fromCity: "",
      toCity: "",
      bagNo: "",
    },
    emptyMessage: defaultEmptyMessage,
  },

  lifetimes: {
    detached() {
      this.cleanup();
    },
  },

  methods: {
    onPanelShow() {
      this.fetchBindings();
    },

    refresh() {
      return this.fetchBindings();
    },

    cleanup() {
      clearTimeout(this.closeSearchTimer);
      clearTimeout(this._countUpTimer);
    },

    async fetchBindings() {
      // After the first load, refresh silently so the list does not flash on return.
      if (!this.hasLoaded) {
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
        const bindings = (result.data || []).map((binding) => {
          const isFullCase = binding.spaceType === "fullCase";
          const status = bindingStatus(binding.status);
          return {
            ...binding,
            isFullCase,
            isOngoing: isBindingOngoing(binding.status),
            statusTone: status.tone,
            day: dayParts(binding.departureDate),
            routeText: `${binding.fromCity || "-"} → ${binding.toCity || "-"}`,
            metricValue: isFullCase
              ? Number(binding.requestedCases || 1)
              : Number(binding.requestedWeight || 0),
            metricUnit: isFullCase ? "件" : "kg",
            ...getEditState(binding),
            spaceTypeText: binding.spaceType === "fullCase" ? "整箱" : "散件",
            requestedCasesText: `${Number(binding.requestedCases || (binding.spaceType === "fullCase" ? 1 : 0))} 件`,
            requestedWeightText: formatWeight(binding.requestedWeight),
            requestedSpecialItemsText: formatSpecialItems(binding.requestedSpecialItems),
            createdAtText: formatDateTime(binding.createdAt),
            lockDeadlineText: formatDateTime(binding.lockDeadlineAt),
            lockedAtText: formatDateTime(binding.lockedAt),
            statusText: status.text,
          };
        });
        const bagOptions = buildBagOptions(bindings);
        const nextBagIndex = Math.max(
          0,
          bagOptions.findIndex((item) => item.value === this.data.searchFilters.bagNo)
        );
        this.setData({
          allBindings: bindings,
          bagOptions,
          bagIndex: nextBagIndex,
          "searchFilters.bagNo": bagOptions[nextBagIndex].value,
        });
        this.applySearchFilters(bindings);
        const stats = this.buildStats(bindings);
        countUp(this, { statOngoing: stats.ongoing, statDone: stats.done, statWeight: stats.weight });
        this.hasLoaded = true;
      } catch (error) {
        showToast({
          title: error.message || "加载失败",
          icon: "none",
        });
      } finally {
        this.setData({ loading: false });
      }
    },

    buildStats(bindings) {
      return bindings.reduce(
        (stats, binding) => {
          if (binding.isOngoing) {
            stats.ongoing += 1;
          }
          if (binding.status === "completed") {
            stats.done += 1;
          }
          if (binding.status !== "cancelled") {
            stats.weight += binding.isFullCase ? binding.metricValue * 23 : binding.metricValue;
          }
          return stats;
        },
        { ongoing: 0, done: 0, weight: 0 }
      );
    },

    selectSegment(event) {
      const { value, index } = event.currentTarget.dataset;
      if (value === this.data.segment) {
        return;
      }
      this.setData(
        { segment: value, segmentIndex: Number(index) || 0, listKey: this.data.listKey + 1 },
        () => this.applySearchFilters()
      );
    },

    getVisibleBindings(allBindings, filters) {
      const departureDate = `${filters.departureDate || ""}`.trim();
      const fromCity = `${filters.fromCity || ""}`.trim();
      const toCity = `${filters.toCity || ""}`.trim();
      const bagNo = `${filters.bagNo || ""}`.trim();

      return (allBindings || []).filter((binding) => {
        const matchesDate = !departureDate || binding.departureDate === departureDate;
        const matchesFromCity = includesText(binding.fromCity, fromCity);
        const matchesToCity = includesText(binding.toCity, toCity);
        const matchesBagNo = !bagNo || binding.bagNo === bagNo;
        return (
          matchesSegment(binding, this.data.segment) &&
          matchesDate &&
          matchesFromCity &&
          matchesToCity &&
          matchesBagNo
        );
      });
    },

    applySearchFilters(nextAllBindings) {
      const allBindings = nextAllBindings || this.data.allBindings;
      const visibleBindings = this.getVisibleBindings(allBindings, this.data.searchFilters);
      const hasSearchFilters = Boolean(
        this.data.searchFilters.departureDate ||
          this.data.searchFilters.fromCity ||
          this.data.searchFilters.toCity ||
          this.data.searchFilters.bagNo
      );

      this.setData({
        bindings: visibleBindings,
        hasSearchFilters,
        emptyMessage:
          allBindings.length && (hasSearchFilters || this.data.segment !== "all")
            ? noSearchResultMessage
            : defaultEmptyMessage,
      });
    },

    openSearchPanel() {
      clearTimeout(this.closeSearchTimer);
      this.setData({ searchPanelOpen: true, searchPanelClosing: false });
    },

    closeSearchPanel() {
      if (!this.data.searchPanelOpen || this.data.searchPanelClosing) {
        return;
      }
      this.setData({ searchPanelClosing: true });
      this.closeSearchTimer = setTimeout(() => {
        this.setData({ searchPanelOpen: false, searchPanelClosing: false });
      }, 240);
    },

    onSearchInput(event) {
      const { field } = event.currentTarget.dataset;
      this.setData(
        {
          [`searchFilters.${field}`]: event.detail.value,
        },
        () => this.applySearchFilters()
      );
    },

    onSearchDateChange(event) {
      this.setData(
        {
          "searchFilters.departureDate": event.detail.value,
        },
        () => this.applySearchFilters()
      );
    },

    onSearchBagChange(event) {
      const bagIndex = Number(event.detail.value || 0);
      const bagOption = this.data.bagOptions[bagIndex] || defaultBagOption;
      this.setData(
        {
          bagIndex,
          "searchFilters.bagNo": bagOption.value,
        },
        () => this.applySearchFilters()
      );
    },

    clearSearchFilters() {
      this.setData(
        {
          bagIndex: 0,
          searchFilters: {
            departureDate: "",
            fromCity: "",
            toCity: "",
            bagNo: "",
          },
        },
        () => this.applySearchFilters()
      );
    },

    openBindingDetail(event) {
      const { id } = event.currentTarget.dataset;
      wx.navigateTo({
        url: `/pages/find-bags/binding-detail/detail?id=${id}`,
      });
    },
  },
});
