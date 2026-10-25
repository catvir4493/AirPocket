const { formatDateTime, formatWeight } = require("../../../utils/format");
const { formatSpecialItems } = require("../../../utils/specialItems");

const sortOptions = [
  { value: "departureAsc", label: "出发日期最近" },
  { value: "createdDesc", label: "最新发布优先" },
  { value: "createdAsc", label: "最早发布优先" },
];

const spaceTypeOptions = [
  { value: "all", label: "全部" },
  { value: "loose", label: "散件" },
  { value: "fullCase", label: "整箱" },
];

const toTimestamp = (value) => {
  if (!value) {
    return 0;
  }
  if (value instanceof Date) {
    return value.getTime();
  }
  if (value.$date) {
    return new Date(value.$date).getTime();
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 0 : date.getTime();
};

const includesText = (source, keyword) =>
  !keyword || `${source || ""}`.toLowerCase().includes(keyword.toLowerCase());

const getBagNoMark = (bagNo, isFullCase) => {
  const firstLetter = `${bagNo || ""}`.trim().charAt(0).toUpperCase();
  if (firstLetter === "A" || firstLetter === "B") {
    return firstLetter;
  }
  return isFullCase ? "B" : "A";
};

const formatListDate = (value) => `${value || "-"}`.replace(/-/g, ".");

const formatListWeight = (value) => {
  const number = Number(value);
  return Number.isFinite(number) ? `${number}KG` : "-";
};

Component({
  options: {
    styleIsolation: "apply-shared",
  },

  data: {
    loading: true,
    allBags: [],
    bags: [],
    filterPanelOpen: false,
    filterPanelClosing: false,
    scenePaused: false,
    hasActiveFilters: false,
    filters: {
      fromCity: "",
      toCity: "",
      departureDate: "",
      spaceType: "all",
    },
    sortIndex: 0,
    sortKey: sortOptions[0].value,
    sortOptions,
    spaceTypeOptions,
    currentSortLabel: sortOptions[0].label,
    emptyMessage: "暂无可用 bag。等带货者发布后，这里会展示 active 且剩余重量大于 0 的记录。",
  },

  lifetimes: {
    detached() {
      this.cleanup();
    },
  },

  methods: {
    onPanelShow() {
      if (this.data.scenePaused) {
        this.setData({ scenePaused: false });
      }
      this.fetchBags();
    },

    onPanelHide() {
      this.setData({ scenePaused: true });
    },

    refresh() {
      return this.fetchBags();
    },

    cleanup() {
      clearTimeout(this.closeFiltersTimer);
    },

    async fetchBags() {
      // After the first load, refresh silently so the list does not flash on return.
      if (!this.hasLoaded) {
        this.setData({ loading: true });
      }
      try {
        const resp = await wx.cloud.callFunction({
          name: "getBags",
        });
        const result = resp.result || {};
        if (!result.success) {
          throw new Error(result.errMsg || "加载失败");
        }
        const bags = (result.data || []).map((bag, index) => {
          const isFullCase = bag.spaceType === "fullCase";
          const remainingCases = Number.isFinite(Number(bag.remainingCases))
            ? Number(bag.remainingCases)
            : Math.floor(Number(bag.remainingWeight || 0) / 23);
          const caseCount = Number.isFinite(Number(bag.caseCount))
            ? Number(bag.caseCount)
            : remainingCases || 1;
          const listMark = getBagNoMark(bag.bagNo, isFullCase);
          const spaceTypeText = isFullCase ? "整箱" : "散件";
          const specialItemOptionsText = formatSpecialItems(bag.specialItemOptions);
          const listTagsText =
            specialItemOptionsText === "无"
              ? spaceTypeText
              : `${spaceTypeText} ${specialItemOptionsText.replace(/,\s*/g, " ")}`;
          return {
            ...bag,
            isFullCase,
            cardReverse: index % 2 === 1,
            listMark,
            markOnRight: listMark === "B",
            spaceTypeText,
            caseCountText: `${caseCount} 件`,
            remainingCasesText: `${remainingCases} 件`,
            compactSpaceText: isFullCase ? "整箱" : `剩余 ${formatWeight(bag.remainingWeight)}`,
            listDateText: formatListDate(bag.departureDate),
            listRouteText: `${bag.fromCity || "-"} — ${bag.toCity || "-"}`,
            listWeightText: `WT:${formatListWeight(isFullCase ? remainingCases * 23 : bag.remainingWeight)}`,
            listTagsText,
            weightSummary: isFullCase
              ? `${remainingCases} cases left · 23 kg each`
              : `${formatWeight(bag.remainingWeight)} left`,
            remainingWeightText: formatWeight(bag.remainingWeight),
            totalWeightText: formatWeight(bag.totalWeight),
            specialItemOptionsText,
            createdAtText: formatDateTime(bag.createdAt),
          };
        });
        this.setData({
          allBags: bags,
        });
        this.applyFiltersAndSort(bags);
        this.hasLoaded = true;
      } catch (error) {
        wx.showToast({
          title: error.message || "加载失败",
          icon: "none",
        });
      } finally {
        this.setData({ loading: false });
      }
    },

    getVisibleBags(allBags, filters, sortKey) {
      const fromCity = `${filters.fromCity || ""}`.trim();
      const toCity = `${filters.toCity || ""}`.trim();
      const departureDate = `${filters.departureDate || ""}`.trim();
      const spaceType = filters.spaceType || "all";

      const filtered = allBags.filter((bag) => {
        const matchesFromCity = includesText(bag.fromCity, fromCity);
        const matchesToCity = includesText(bag.toCity, toCity);
        const matchesDate = !departureDate || bag.departureDate === departureDate;
        const matchesType = spaceType === "all" || bag.spaceType === spaceType;
        return matchesFromCity && matchesToCity && matchesDate && matchesType;
      });

      return filtered.sort((a, b) => {
        const aCreatedAt = toTimestamp(a.createdAt);
        const bCreatedAt = toTimestamp(b.createdAt);
        if (sortKey === "createdDesc") {
          return bCreatedAt - aCreatedAt;
        }
        if (sortKey === "createdAsc") {
          return aCreatedAt - bCreatedAt;
        }
        if (a.departureDate === b.departureDate) {
          return bCreatedAt - aCreatedAt;
        }
        return `${a.departureDate || ""}`.localeCompare(`${b.departureDate || ""}`);
      });
    },

    applyFiltersAndSort(nextAllBags) {
      const allBags = nextAllBags || this.data.allBags;
      const currentSortOption =
        this.data.sortOptions[this.data.sortIndex] || this.data.sortOptions[0];
      const visibleBags = this.getVisibleBags(allBags, this.data.filters, this.data.sortKey);
      this.setData({
        bags: visibleBags,
        currentSortLabel: currentSortOption.label,
        hasActiveFilters: Boolean(
          this.data.filters.fromCity ||
            this.data.filters.toCity ||
            this.data.filters.departureDate ||
            this.data.filters.spaceType !== "all" ||
            this.data.sortKey !== sortOptions[0].value
        ),
        emptyMessage: allBags.length
          ? "没有符合筛选条件的 bag。"
          : "暂无可用 bag。等带货者发布后，这里会展示 active 且剩余重量大于 0 的记录。",
      });
    },

    openFilters() {
      clearTimeout(this.closeFiltersTimer);
      this.setData({ filterPanelOpen: true, filterPanelClosing: false });
    },

    closeFilters() {
      if (!this.data.filterPanelOpen || this.data.filterPanelClosing) {
        return;
      }
      this.setData({ filterPanelClosing: true });
      this.closeFiltersTimer = setTimeout(() => {
        this.setData({ filterPanelOpen: false, filterPanelClosing: false });
      }, 240);
    },

    onFilterInput(event) {
      const { field } = event.currentTarget.dataset;
      this.setData(
        {
          [`filters.${field}`]: event.detail.value,
        },
        () => this.applyFiltersAndSort()
      );
    },

    onFilterDateChange(event) {
      this.setData(
        {
          "filters.departureDate": event.detail.value,
        },
        () => this.applyFiltersAndSort()
      );
    },

    selectSpaceType(event) {
      const { type } = event.currentTarget.dataset;
      this.setData(
        {
          "filters.spaceType": type,
        },
        () => this.applyFiltersAndSort()
      );
    },

    onSortChange(event) {
      const sortIndex = Number(event.detail.value || 0);
      const sortOption = this.data.sortOptions[sortIndex] || this.data.sortOptions[0];
      this.setData(
        {
          sortIndex,
          sortKey: sortOption.value,
          currentSortLabel: sortOption.label,
        },
        () => this.applyFiltersAndSort()
      );
    },

    clearFilters() {
      this.setData(
        {
          filters: {
            fromCity: "",
            toCity: "",
            departureDate: "",
            spaceType: "all",
          },
          sortIndex: 0,
          sortKey: sortOptions[0].value,
          currentSortLabel: sortOptions[0].label,
        },
        () => this.applyFiltersAndSort()
      );
    },

    openDetail(event) {
      const { id } = event.currentTarget.dataset;
      wx.navigateTo({
        url: `/pages/find-bags/detail/detail?id=${id}`,
      });
    },
  },
});
