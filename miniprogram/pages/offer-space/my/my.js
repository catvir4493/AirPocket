const { countUp } = require("../../../utils/countUp");

const defaultEmptyMessage = "暂无发布记录。回到 Offer Space 后点击 Release Bag 发布一个新的空余行李额。";
const noSearchResultMessage = "没有符合搜索条件的发布记录。";
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

Page({
  data: {
    loading: true,
    allBags: [],
    bags: [],
    searchPanelOpen: false,
    searchPanelClosing: false,
    statCount: 0,
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

  onShow() {
    this.fetchBags();
  },

  onPullDownRefresh() {
    this.fetchBags().finally(() => wx.stopPullDownRefresh());
  },

  onUnload() {
    clearTimeout(this.closeSearchTimer);
    clearTimeout(this._countUpTimer);
  },

  async fetchBags() {
    // After the first load, refresh silently so the list does not flash on return.
    if (!this.hasLoaded) {
      this.setData({ loading: true });
    }
    try {
      const resp = await wx.cloud.callFunction({
        name: "getMyCarrierBags",
      });
      const result = resp.result || {};
      if (!result.success) {
        throw new Error(result.errMsg || "加载失败");
      }

      const bags = (result.data || []).map((bag) => ({
        ...bag,
        listDateText: bag.departureDate || "-",
        listRouteText: `${bag.fromCity || "-"} - ${bag.toCity || "-"}`,
      }));

      const bagOptions = buildBagOptions(bags);
      const nextBagIndex = Math.max(
        0,
        bagOptions.findIndex((item) => item.value === this.data.searchFilters.bagNo)
      );
      this.setData({
        allBags: bags,
        bagOptions,
        bagIndex: nextBagIndex,
        "searchFilters.bagNo": bagOptions[nextBagIndex].value,
      });
      this.applySearchFilters(bags);
      if (!this.hasLoaded) {
        countUp(this, { statCount: this.data.bags.length });
      }
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

  getVisibleBags(allBags, filters) {
    const departureDate = `${filters.departureDate || ""}`.trim();
    const fromCity = `${filters.fromCity || ""}`.trim();
    const toCity = `${filters.toCity || ""}`.trim();
    const bagNo = `${filters.bagNo || ""}`.trim();

    return (allBags || []).filter((bag) => {
      const matchesDate = !departureDate || bag.departureDate === departureDate;
      const matchesFromCity = includesText(bag.fromCity, fromCity);
      const matchesToCity = includesText(bag.toCity, toCity);
      const matchesBagNo = !bagNo || bag.bagNo === bagNo;
      return matchesDate && matchesFromCity && matchesToCity && matchesBagNo;
    });
  },

  applySearchFilters(nextAllBags) {
    const allBags = nextAllBags || this.data.allBags;
    const visibleBags = this.getVisibleBags(allBags, this.data.searchFilters);
    const hasSearchFilters = Boolean(
      this.data.searchFilters.departureDate ||
        this.data.searchFilters.fromCity ||
        this.data.searchFilters.toCity ||
        this.data.searchFilters.bagNo
    );

    this.setData({
      bags: visibleBags,
      statCount: visibleBags.length,
      hasSearchFilters,
      emptyMessage: allBags.length
        ? hasSearchFilters
          ? noSearchResultMessage
          : defaultEmptyMessage
        : defaultEmptyMessage,
    });
  },

  openSearchPanel() {
    clearTimeout(this.closeSearchTimer);
    clearTimeout(this._countUpTimer);
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

  openBagDetail(event) {
    const { id } = event.currentTarget.dataset;
    if (!id) {
      return;
    }

    wx.navigateTo({
      url: `/pages/offer-space/bag-detail/detail?id=${id}`,
    });
  },
});
