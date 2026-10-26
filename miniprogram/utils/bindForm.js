// Shared state and handlers for the binding form on the bind and edit-binding pages
// (pages/find-bags/detail/bind-form.wxml). Pages set `formInfo` once the bag is known:
// { isFullCase, fromCity, toCity, maxWeight, maxText, casesText, availableSpecialItems }.
const { buildSpecialItemOptions, toggleSpecialItem } = require("./specialItems");
const { formatWeight } = require("./format");
const { trimNumber } = require("./bagForm");
const { showToast } = require("./toast");

const FULL_CASE_WEIGHT = 23;

// Quick picks: small round amounts under the limit, then "all". Without a limit, just the round amounts.
const buildQuickWeights = (max) => {
  if (!(max > 0)) {
    return [1, 2, 5, 10].map((value) => ({ value, label: `${value}kg` }));
  }
  const picks = [1, 2, 5, 10].filter((value) => value < max).slice(-3);
  return picks
    .map((value) => ({ value, label: `${value}kg` }))
    .concat({ value: max, label: `全部 ${trimNumber(max)}kg` });
};

// Route line and missing-field count shown next to the action button.
const buildBindSummary = (info, form, readyText) => {
  if (!info) {
    return { route: "", detail: "", ready: false };
  }
  const weight = info.isFullCase ? FULL_CASE_WEIGHT : Number(form.requestedWeight) || 0;
  const missing = [
    weight > 0,
    form.itemDescription,
    form.senderWechat,
    form.pickupAddress,
    form.receiverName,
    form.receiverPhone,
    form.deliveryAddress,
  ].filter((value) => value === false || !`${value || ""}`.trim()).length;
  return {
    route: `${info.fromCity || "-"} → ${info.toCity || "-"}`,
    detail: [
      info.isFullCase ? "整箱 1 箱 · 23kg" : `占用 ${weight ? trimNumber(weight) : 0}kg`,
      missing ? `还差 ${missing} 项` : readyText,
    ].join(" · "),
    ready: missing === 0,
  };
};

const validateBindForm = (info, form) => {
  const requestedWeight = info && info.isFullCase ? FULL_CASE_WEIGHT : Number(form.requestedWeight);
  const required = [
    [Number.isFinite(requestedWeight) && requestedWeight > 0, "请输入大于 0 的重量"],
    [form.itemDescription.trim(), "请填写物品描述"],
    [form.senderWechat.trim(), "请填写微信号"],
    [form.pickupAddress.trim(), "请填写取货地址"],
    [form.receiverName.trim(), "请填写收件人姓名"],
    [form.receiverPhone.trim(), "请填写收件人电话"],
    [form.deliveryAddress.trim(), "请填写目的地快递地址"],
  ];
  const failed = required.find(([ok]) => !ok);
  return failed ? failed[1] : "";
};

const EMPTY_BIND_FORM = {
  requestedWeight: "",
  requestedSpecialItems: [],
  senderWechat: "",
  pickupAddress: "",
  receiverName: "",
  receiverPhone: "",
  deliveryAddress: "",
  itemDescription: "",
  senderNote: "",
};

const createBindFormData = () => ({
  formInfo: null,
  focusedField: "",
  specialItemOptions: [],
  quickWeights: [],
  roll: { key: 0, dir: "up" },
  summary: buildBindSummary(null),
  form: { ...EMPTY_BIND_FORM },
});

const bindFormMethods = {
  refreshSummary() {
    this.setData({ summary: buildBindSummary(this.data.formInfo, this.data.form, this.readyText) });
  },

  onFieldFocus(event) {
    this.setData({ focusedField: event.currentTarget.dataset.focus });
  },

  onFieldBlur(event) {
    if (this.data.focusedField === event.currentTarget.dataset.focus) {
      this.setData({ focusedField: "" });
    }
  },

  onFieldInput(event) {
    const { field } = event.currentTarget.dataset;
    this.setData({ [`form.${field}`]: event.detail.value });
    this.refreshSummary();
  },

  // Typed weight is capped at what is left on the bag.
  onRequestedWeightInput(event) {
    const rawValue = `${event.detail.value || ""}`;
    const max = Number((this.data.formInfo && this.data.formInfo.maxWeight) || 0);
    let value = rawValue;
    if (rawValue && !Number.isFinite(Number(rawValue))) {
      value = "";
    } else if (max > 0 && Number(rawValue) > max) {
      value = `${max}`;
      showToast({ title: `最多可绑定 ${formatWeight(max)}`, icon: "none" });
    }
    this.setData({ "form.requestedWeight": value });
    this.refreshSummary();
    return value;
  },

  setRequestedWeight(next) {
    const current = Number(this.data.form.requestedWeight) || 0;
    const roll = this.data.roll || { key: 0 };
    this.setData({
      "form.requestedWeight": next ? trimNumber(next) : "",
      roll: { key: roll.key + 1, dir: next < current ? "down" : "up" },
    });
    this.refreshSummary();
  },

  stepWeight(event) {
    const max = Number((this.data.formInfo && this.data.formInfo.maxWeight) || 0);
    const next = Math.max(0, (Number(this.data.form.requestedWeight) || 0) + Number(event.currentTarget.dataset.delta));
    this.setRequestedWeight(max > 0 ? Math.min(max, next) : next);
  },

  pickQuickWeight(event) {
    this.setRequestedWeight(Number(event.currentTarget.dataset.value));
  },

  toggleSpecialItem(event) {
    const available = (this.data.formInfo && this.data.formInfo.availableSpecialItems) || [];
    const requestedSpecialItems = toggleSpecialItem(
      this.data.form.requestedSpecialItems,
      event.currentTarget.dataset.value,
      available
    );
    this.setData({
      "form.requestedSpecialItems": requestedSpecialItems,
      specialItemOptions: buildSpecialItemOptions(requestedSpecialItems, available),
    });
  },
};

module.exports = {
  FULL_CASE_WEIGHT,
  bindFormMethods,
  buildQuickWeights,
  createBindFormData,
  validateBindForm,
};
