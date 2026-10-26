// Shared state and handlers for the bag form on the release and edit pages
// (pages/offer-space/release/bag-form.wxml).
const { buildSpecialItemOptions, toggleSpecialItem, SPECIAL_ITEM_OPTIONS } = require("./specialItems");
const { dayParts } = require("./date");

const CASE_WEIGHT = 23;
const QUICK_WEIGHTS = [5, 10, 15, 20];

const splitTags = (text) =>
  `${text || ""}`
    .split(/[,，、\n]/)
    .map((item) => item.trim())
    .filter(Boolean);

const trimNumber = (value) => `${Math.round(value * 10) / 10}`;

// Everything on screen that is derived from the form: the ticket date, tag lists,
// the live preview card and the summary next to the publish button.
const deriveView = (form, readyText = "可以发布了") => {
  const isFullCase = form.spaceType === "fullCase";
  const day = dayParts(form.departureDate);
  const caseCount = Number(form.caseCount) || 0;
  const weight = isFullCase ? caseCount * CASE_WEIGHT : Number(form.totalWeight) || 0;
  const labelMap = SPECIAL_ITEM_OPTIONS.reduce((map, item) => {
    map[item.value] = item.label;
    return map;
  }, {});
  const missing = [
    form.fromCity,
    form.toCity,
    form.departureDate,
    isFullCase ? caseCount > 0 : weight > 0,
    form.carrierWechat,
    form.carrierReceiveAddress,
  ].filter((value) => !`${value || ""}`.trim() || value === false).length;
  const from = form.fromCity.trim();
  const to = form.toCity.trim();
  const spaceText = isFullCase ? `整箱 ${caseCount || 0} 箱` : `散件 ${weight ? trimNumber(weight) : 0}kg`;

  return {
    dateText: form.departureDate ? `${day.short} ${day.weekday}` : "",
    allowedTags: splitTags(form.allowedItemsText),
    restrictedTags: splitTags(form.restrictedItemsText),
    caseWeightText: `${caseCount || 0} × ${CASE_WEIGHT} = ${caseCount * CASE_WEIGHT}kg`,
    preview: {
      day: form.departureDate ? day.day : "--",
      month: form.departureDate ? day.month : "DATE",
      from: from || "出发",
      to: to || "到达",
      chips: [isFullCase ? "整箱" : "散件"].concat(
        (form.specialItemOptions || []).map((value) => labelMap[value] || value)
      ),
      weight: weight ? trimNumber(weight) : "--",
    },
    summary: {
      route: from || to ? `${from || "出发"} → ${to || "到达"}` : "填写航程",
      detail: [form.departureDate ? day.short : "", spaceText, missing ? `还差 ${missing} 项` : readyText]
        .filter(Boolean)
        .join(" · "),
      ready: missing === 0,
    },
  };
};

const today = () => {
  const date = new Date();
  const month = date.getMonth() + 1;
  const day = date.getDate();
  return `${date.getFullYear()}-${month < 10 ? `0${month}` : month}-${day < 10 ? `0${day}` : day}`;
};

const isPastDate = (value, minDate) => value && value < minDate;

const INITIAL_FORM = {
  spaceType: "loose",
  fromCity: "",
  toCity: "",
  departureDate: "",
  flightNo: "",
  carrierWechat: "",
  carrierReceiveAddress: "",
  totalWeight: "",
  caseCount: "1",
  availableVolume: "",
  specialItemOptions: [],
  allowedItemsText: "",
  restrictedItemsText: "",
  note: "",
};

// Direction for the stepper number roll; the key change re-renders the number.
const nextRoll = (roll, change) => ({
  roll: { key: ((roll && roll.key) || 0) + 1, dir: change < 0 ? "down" : "up" },
});

// Returns null when the form is valid, otherwise { field, message } for the first problem
// (field matches the "ff-<field>" ids in bag-form.wxml).
const validateBagForm = (form, minDate) => {
  // Checked in the order the fields appear on the page.
  const required = [
    ["fromCity", "请填写出发城市"],
    ["toCity", "请填写到达城市"],
    ["departureDate", "请选择出发日期"],
  ];
  for (let i = 0; i < required.length; i += 1) {
    const [field, message] = required[i];
    if (!`${form[field]}`.trim()) {
      return { field, message };
    }
  }

  if (isPastDate(form.departureDate, minDate)) {
    return { field: "departureDate", message: "出发日期不能早于今天" };
  }

  if (form.spaceType === "fullCase") {
    const caseCount = Number(form.caseCount);
    if (!Number.isInteger(caseCount) || caseCount <= 0) {
      return { field: "amount", message: "整箱数量必须是大于 0 的整数" };
    }
  } else {
    if (!`${form.totalWeight}`.trim()) {
      return { field: "amount", message: "请填写可用重量" };
    }
    const totalWeight = Number(form.totalWeight);
    if (!Number.isFinite(totalWeight) || totalWeight <= 0) {
      return { field: "amount", message: "可用重量必须大于 0" };
    }
  }

  if (!`${form.carrierWechat}`.trim()) {
    return { field: "carrierWechat", message: "请填写微信号" };
  }
  if (!`${form.carrierReceiveAddress}`.trim()) {
    return { field: "carrierReceiveAddress", message: "请填写收货地址" };
  }
  return null;
};

const createBagFormData = (readyText) => ({
  ...deriveView(INITIAL_FORM, readyText),
  quickWeights: QUICK_WEIGHTS,
  tagDraft: { allowed: "", restricted: "" },
  roll: { key: 0, dir: "up" },
  focusedField: "",
  minDate: today(),
  errorField: "",
  errorTick: 0,
  specialItemOptions: buildSpecialItemOptions([]),
  form: { ...INITIAL_FORM },
});

const bagFormMethods = {
  // Sets form fields and refreshes everything derived from them in one setData.
  updateForm(changes, extra) {
    const form = { ...this.data.form, ...changes };
    const data = { ...deriveView(form, this.readyText), ...(extra || {}) };
    Object.keys(changes).forEach((key) => {
      data[`form.${key}`] = changes[key];
    });
    this.setData(data);
  },

  onFieldInput(event) {
    const { field } = event.currentTarget.dataset;
    this.updateForm({ [field]: event.detail.value });
  },

  selectSpaceType(event) {
    const { type } = event.currentTarget.dataset;
    if (type === this.data.form.spaceType) {
      return;
    }
    this.updateForm({
      spaceType: type,
      totalWeight: type === "fullCase" ? "" : this.data.form.totalWeight,
      caseCount: type === "fullCase" ? this.data.form.caseCount || "1" : "1",
    });
  },

  swapCities() {
    const { fromCity, toCity } = this.data.form;
    if (!fromCity && !toCity) {
      return;
    }
    this.updateForm({ fromCity: toCity, toCity: fromCity });
  },

  onDateChange(event) {
    this.updateForm({ departureDate: event.detail.value });
  },

  stepAmount(event) {
    const delta = Number(event.currentTarget.dataset.delta);
    if (this.data.form.spaceType === "fullCase") {
      const current = Number(this.data.form.caseCount) || 0;
      const caseCount = Math.max(1, current + delta);
      this.updateForm({ caseCount: `${caseCount}` }, nextRoll(this.data.roll, caseCount - current));
      return;
    }
    const current = Number(this.data.form.totalWeight) || 0;
    const weight = Math.max(0, current + delta);
    this.updateForm({ totalWeight: weight ? trimNumber(weight) : "" }, nextRoll(this.data.roll, weight - current));
  },

  pickQuickWeight(event) {
    const value = Number(event.currentTarget.dataset.value);
    const current = Number(this.data.form.totalWeight) || 0;
    this.updateForm({ totalWeight: `${value}` }, nextRoll(this.data.roll, value - current));
  },

  toggleSpecialItem(event) {
    const { value } = event.currentTarget.dataset;
    const specialItemOptions = toggleSpecialItem(this.data.form.specialItemOptions, value);
    this.updateForm({ specialItemOptions }, { specialItemOptions: buildSpecialItemOptions(specialItemOptions) });
  },

  onTagDraftInput(event) {
    this.setData({ [`tagDraft.${event.currentTarget.dataset.list}`]: event.detail.value });
  },

  // "allowed" and "restricted" tags are stored as the comma text the cloud function expects.
  addTag(event) {
    const { list } = event.currentTarget.dataset;
    const field = list === "allowed" ? "allowedItemsText" : "restrictedItemsText";
    const added = splitTags(this.data.tagDraft[list]);
    if (!added.length) {
      return;
    }
    const tags = splitTags(this.data.form[field]);
    added.forEach((tag) => {
      if (!tags.includes(tag)) {
        tags.push(tag);
      }
    });
    this.updateForm({ [field]: tags.join(", ") }, { [`tagDraft.${list}`]: "" });
  },

  removeTag(event) {
    const { list, index } = event.currentTarget.dataset;
    const field = list === "allowed" ? "allowedItemsText" : "restrictedItemsText";
    const tags = splitTags(this.data.form[field]);
    tags.splice(Number(index), 1);
    this.updateForm({ [field]: tags.join(", ") });
  },

  onFieldFocus(event) {
    this.setData({ focusedField: event.currentTarget.dataset.focus });
  },

  onFieldBlur(event) {
    if (this.data.focusedField === event.currentTarget.dataset.focus) {
      this.setData({ focusedField: "" });
    }
  },

  // Turns anything still typed in the tag inputs into tags before saving.
  commitTagDrafts() {
    ["allowed", "restricted"].forEach((list) => {
      if (this.data.tagDraft[list].trim()) {
        this.addTag({ currentTarget: { dataset: { list } } });
      }
    });
  },
};

module.exports = {
  CASE_WEIGHT,
  INITIAL_FORM,
  bagFormMethods,
  createBagFormData,
  deriveView,
  splitTags,
  trimNumber,
  validateBagForm,
};
