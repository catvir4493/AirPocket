const cloud = require("wx-server-sdk");

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV,
});

const db = cloud.database();

const SPECIAL_ITEM_VALUES = [
  "laptop",
  "phone",
  "camera",
  "cigarettes",
  "cigar",
  "luxury",
  "medicine",
  "documents",
  "other",
];

const normalizeList = (value) => {
  if (Array.isArray(value)) {
    return value.map((item) => `${item}`.trim()).filter(Boolean);
  }
  return `${value || ""}`
    .split(/[,，\n]/)
    .map((item) => item.trim())
    .filter(Boolean);
};

const normalizeSpecialItems = (value) => {
  const source = Array.isArray(value) ? value : `${value || ""}`.split(/[,，\n]/);
  const valid = SPECIAL_ITEM_VALUES.reduce((map, item) => {
    map[item] = true;
    return map;
  }, {});
  const seen = {};

  return source.reduce((list, item) => {
    const normalized = `${item}`.trim();
    if (normalized && valid[normalized] && !seen[normalized]) {
      seen[normalized] = true;
      list.push(normalized);
    }
    return list;
  }, []);
};

const padBagNo = (seq, prefix) => `${prefix}${`${seq}`.padStart(4, "0")}`;

const getBagNoMeta = (spaceType) =>
  spaceType === "fullCase"
    ? {
        prefix: "B",
        counterId: "bags_full_case",
      }
    : {
        prefix: "A",
        counterId: "bags_loose",
      };

const getCaseCount = (event, spaceType) => {
  if (spaceType !== "fullCase") {
    return 0;
  }
  return Number(event.caseCount || 1);
};

const fail = (errMsg) => ({
  success: false,
  errMsg,
});

const todayYmd = () => new Date().toISOString().slice(0, 10);

const isValidDateText = (value) => /^\d{4}-\d{2}-\d{2}$/.test(value);

const ensureCollection = async (name) => {
  try {
    await db.createCollection(name);
  } catch (error) {
    // Existing collections throw here; that is fine for this MVP bootstrap.
  }
};

const getInitialCounterSeq = async (transaction, spaceType) => {
  if (spaceType !== "loose") {
    return 0;
  }

  try {
    const legacyCounter = await transaction.collection("counters").doc("bags").get();
    return Number(legacyCounter.data.seq || 0);
  } catch (error) {
    return 0;
  }
};

exports.main = async (event = {}) => {
  const wxContext = cloud.getWXContext();
  const carrierId = wxContext.OPENID;
  const spaceType = event.spaceType === "fullCase" ? "fullCase" : "loose";
  const caseCount = getCaseCount(event, spaceType);
  const totalWeight = spaceType === "fullCase" ? caseCount * 23 : Number(event.totalWeight);
  const departureDate = `${event.departureDate || ""}`.trim();

  if (!carrierId) {
    return fail("Unable to identify current user");
  }
  if (!`${event.fromCity || ""}`.trim()) {
    return fail("fromCity is required");
  }
  if (!`${event.toCity || ""}`.trim()) {
    return fail("toCity is required");
  }
  if (!`${event.carrierWechat || ""}`.trim()) {
    return fail("carrierWechat is required");
  }
  if (!`${event.carrierReceiveAddress || ""}`.trim()) {
    return fail("carrierReceiveAddress is required");
  }
  if (!departureDate) {
    return fail("departureDate is required");
  }
  if (!isValidDateText(departureDate) || departureDate < todayYmd()) {
    return fail("departureDate cannot be earlier than today");
  }
  if (!Number.isFinite(totalWeight) || totalWeight <= 0) {
    return fail("totalWeight must be greater than 0");
  }
  if (spaceType === "fullCase" && (!Number.isInteger(caseCount) || caseCount <= 0)) {
    return fail("caseCount must be a positive integer");
  }

  const now = new Date();

  try {
    await ensureCollection("bags");
    await ensureCollection("counters");

    const result = await db.runTransaction(async (transaction) => {
      let seq = 1;
      const bagNoMeta = getBagNoMeta(spaceType);
      const counterRef = transaction.collection("counters").doc(bagNoMeta.counterId);

      try {
        const counter = await counterRef.get();
        seq = Number(counter.data.seq || 0) + 1;
        await counterRef.update({
          data: {
            seq,
            updatedAt: now,
          },
        });
      } catch (error) {
        const initialSeq = await getInitialCounterSeq(transaction, spaceType);
        seq = initialSeq + 1;
        await counterRef.set({
          data: {
            seq,
            updatedAt: now,
          },
        });
      }

      const bagNo = padBagNo(seq, bagNoMeta.prefix);
      const bagData = {
        bagNo,
        carrierId,
        carrierNickname: `${event.carrierNickname || ""}`.trim(),
        fromCity: `${event.fromCity || ""}`.trim(),
        toCity: `${event.toCity || ""}`.trim(),
        departureDate,
        flightNo: `${event.flightNo || ""}`.trim(),
        carrierWechat: `${event.carrierWechat || ""}`.trim(),
        carrierReceiveAddress: `${event.carrierReceiveAddress || ""}`.trim(),
        spaceType,
        caseCount,
        remainingCases: caseCount,
        totalWeight,
        remainingWeight: totalWeight,
        availableVolume: `${event.availableVolume || ""}`.trim(),
        specialItemOptions: normalizeSpecialItems(event.specialItemOptions),
        allowedItems: normalizeList(event.allowedItems || event.allowedItemsText),
        restrictedItems: normalizeList(event.restrictedItems || event.restrictedItemsText),
        note: `${event.note || ""}`.trim(),
        status: "active",
        createdAt: now,
        updatedAt: now,
      };

      const addResult = await transaction.collection("bags").add({
        data: bagData,
      });

      return {
        success: true,
        data: {
          _id: addResult._id,
          ...bagData,
        },
      };
    });

    return result;
  } catch (error) {
    return fail(error.message || "createBag failed");
  }
};
