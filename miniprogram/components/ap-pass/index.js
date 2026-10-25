// Boarding-pass card used at the top of every bag / binding detail page.
const { dayParts } = require("../../utils/date");

const citySize = (from, to) => {
  const longest = Math.max(`${from || ""}`.length, `${to || ""}`.length);
  if (longest <= 7) {
    return "xl";
  }
  if (longest <= 10) {
    return "l";
  }
  return "m";
};

Component({
  properties: {
    code: { type: String, value: "" },
    statusText: { type: String, value: "" },
    statusTone: { type: String, value: "progress" },
    fromCity: { type: String, value: "" },
    toCity: { type: String, value: "" },
    date: { type: String, value: "" },
    flightNo: { type: String, value: "" },
    metricLabel: { type: String, value: "Left" },
    metricValue: { type: null, value: "" },
    metricUnit: { type: String, value: "" },
    chips: { type: Array, value: [] },
    note: { type: String, value: "" },
  },

  data: {
    day: dayParts(""),
    cityClass: "xl",
  },

  observers: {
    "date, fromCity, toCity"() {
      this.refresh();
    },
  },

  lifetimes: {
    attached() {
      this.refresh();
    },
  },

  methods: {
    refresh() {
      const { date, fromCity, toCity } = this.data;
      this.setData({
        day: dayParts(date),
        cityClass: citySize(fromCity, toCity),
      });
    },
  },
});
