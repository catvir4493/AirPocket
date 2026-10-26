const { formatDateTime, formatWeight } = require("../../../utils/format");
const { formatSpecialItems } = require("../../../utils/specialItems");
const { showToast } = require("../../../utils/toast");
const { dayParts, departureGroup } = require("../../../utils/date");
const { getNavMetrics } = require("../../../utils/navMetrics");
const { countUp } = require("../../../utils/countUp");
const { liftAndOpen } = require("../../../utils/liftOpen");

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
    loadError: "",
    allBags: [],
    bags: [],
    filterPanelOpen: false,
    filterPanelClosing: false,
    overview: { hasRoute: false, from: "—", to: "—", count: 0, next: "--.--", max: 0 },
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
    liftId: "",
    navTotal: 64,
    // Bags that appeared on the last refresh; their cards flash once.
    fresh: {},
  },

  lifetimes: {
    attached() {
      // Group headers stick just under the custom navbar.
      this.setData({ navTotal: getNavMetrics().navTotal });
    },

    detached() {
      this.cleanup();
    },
  },

  methods: {
    onPanelShow() {
      this.fetchBags();
    },

    refresh() {
      return this.fetchBags();
    },

    // Sorted by departure, the first card of each week/month carries the section title.
    groupByDeparture(bags, sortKey) {
      let lastKey = "";
      return bags.map((bag) => {
        if (sortKey !== "departureAsc") {
          return bag.groupHead ? { ...bag, groupHead: "" } : bag;
        }
        const group = departureGroup(bag.departureDate);
        const groupHead = group.key === lastKey ? "" : group.label;
        lastKey = group.key;
        return { ...bag, groupHead };
      });
    },

    // After a refresh: flash the cards that were not there before and say how many arrived.
    markFresh(bags) {
      const known = {};
      this.data.allBags.forEach((bag) => {
        known[bag._id] = true;
      });
      const fresh = {};
      bags.forEach((bag) => {
        if (!known[bag._id]) {
          fresh[bag._id] = true;
        }
      });
      const count = Object.keys(fresh).length;
      if (!count) {
        return;
      }
      clearTimeout(this.freshTimer);
      this.setData({ fresh });
      this.freshTimer = setTimeout(() => this.setData({ fresh: {} }), 2400);
      showToast({ title: `新增 ${count} 个行李额`, icon: "none" });
    },

    cleanup() {
      clearTimeout(this.freshTimer);
      clearTimeout(this.closeFiltersTimer);
      clearTimeout(this._countUpTimer);
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
          const day = dayParts(bag.departureDate);
          const listWeight = Number(isFullCase ? remainingCases * 23 : bag.remainingWeight);
          return {
            ...bag,
            isFullCase,
            stubDay: day.day,
            stubMonth: day.month,
            listWeightValue: Number.isFinite(listWeight) ? listWeight : "-",
            listChips: [spaceTypeText].concat(
              specialItemOptionsText === "无" ? [] : specialItemOptionsText.split(/,\s*/).filter(Boolean)
            ),
            cardReverse: index % 2 === 1,
            listMark,
            markOnRight: listMark === "B",
            spaceTypeText,
            caseCountText: `${caseCount} 件`,
            remainingCases,
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
        if (this.hasLoaded) {
          this.markFresh(bags);
        }
        // Count and largest space roll from their previous values to the new ones.
        const overview = this.buildOverview(bags);
        this.setData({
          allBags: bags,
          overview: { ...overview, count: this.data.overview.count, max: this.data.overview.max },
        });
        countUp(this, { "overview.count": overview.count, "overview.max": overview.max });
        this.applyFiltersAndSort(bags);
        this.hasLoaded = true;
      } catch (error) {
        // Nothing on screen yet: show the retry state. Otherwise keep the list and just say so.
        if (!this.hasLoaded) {
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
      this.fetchBags();
    },

    // Route summary card above the list: busiest route, count, next departure, largest space.
    buildOverview(bags) {
      const routeCounts = {};
      let topRoute = null;
      bags.forEach((bag) => {
        const key = `${bag.fromCity || "-"}→${bag.toCity || "-"}`;
        routeCounts[key] = (routeCounts[key] || 0) + 1;
        if (!topRoute || routeCounts[key] > routeCounts[topRoute]) {
          topRoute = key;
        }
      });
      const dates = bags
        .map((bag) => `${bag.departureDate || ""}`)
        .filter(Boolean)
        .sort();
      const max = bags.reduce((largest, bag) => {
        const weight = bag.isFullCase
          ? Number(bag.remainingCases || 0) * 23
          : Number(bag.remainingWeight || 0);
        return Number.isFinite(weight) && weight > largest ? weight : largest;
      }, 0);
      const [from, to] = topRoute ? topRoute.split("→") : ["—", "—"];
      return {
        hasRoute: Boolean(topRoute),
        from,
        to,
        count: bags.length,
        next: dates.length ? formatListDate(dates[0]).slice(5) : "--.--",
        max,
      };
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
      const visibleBags = this.groupByDeparture(
        this.getVisibleBags(allBags, this.data.filters, this.data.sortKey),
        this.data.sortKey
      );
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
      liftAndOpen(this, id, `/pages/find-bags/detail/detail?id=${id}`);
    },
  },
});
