const SPECIAL_ITEM_OPTIONS = [
  { value: "laptop", label: "电脑" },
  { value: "phone", label: "手机" },
  { value: "camera", label: "相机" },
  { value: "cigarettes", label: "香烟" },
  { value: "cigar", label: "雪茄" },
  { value: "luxury", label: "奢侈品" },
  { value: "medicine", label: "药品" },
  { value: "documents", label: "文件" },
  { value: "other", label: "其他" },
];

const getValidValues = () => SPECIAL_ITEM_OPTIONS.map((item) => item.value);

const normalizeSpecialItems = (value, availableValues) => {
  const allowedValues = Array.isArray(availableValues) ? availableValues : getValidValues();
  const allowedMap = allowedValues.reduce((map, item) => {
    map[item] = true;
    return map;
  }, {});
  const source = Array.isArray(value) ? value : `${value || ""}`.split(/[,，\n]/);
  const seen = {};

  return source.reduce((list, item) => {
    const normalized = `${item}`.trim();
    if (normalized && allowedMap[normalized] && !seen[normalized]) {
      seen[normalized] = true;
      list.push(normalized);
    }
    return list;
  }, []);
};

const buildSpecialItemOptions = (selectedValues, availableValues) => {
  const selectedMap = normalizeSpecialItems(selectedValues).reduce((map, item) => {
    map[item] = true;
    return map;
  }, {});
  const availableMap = Array.isArray(availableValues)
    ? normalizeSpecialItems(availableValues).reduce((map, item) => {
        map[item] = true;
        return map;
      }, {})
    : null;

  return SPECIAL_ITEM_OPTIONS.filter((item) => !availableMap || availableMap[item.value]).map(
    (item) => ({
      ...item,
      selected: Boolean(selectedMap[item.value]),
    })
  );
};

const toggleSpecialItem = (selectedValues, value, availableValues) => {
  const selected = normalizeSpecialItems(selectedValues, availableValues);
  const option = `${value || ""}`.trim();
  const available = normalizeSpecialItems([option], availableValues);

  if (!available.length) {
    return selected;
  }

  if (selected.includes(option)) {
    return selected.filter((item) => item !== option);
  }

  return selected.concat(option);
};

const formatSpecialItems = (values) => {
  const labelMap = SPECIAL_ITEM_OPTIONS.reduce((map, item) => {
    map[item.value] = item.label;
    return map;
  }, {});
  const labels = normalizeSpecialItems(values).map((item) => labelMap[item] || item);
  return labels.length ? labels.join(", ") : "无";
};

module.exports = {
  SPECIAL_ITEM_OPTIONS,
  buildSpecialItemOptions,
  formatSpecialItems,
  normalizeSpecialItems,
  toggleSpecialItem,
};
