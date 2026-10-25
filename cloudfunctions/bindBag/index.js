const cloud = require("wx-server-sdk");

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV,
});

const db = cloud.database();

const LOCK_WINDOW_MS = 2 * 60 * 60 * 1000;

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

const fail = (errMsg) => ({
  success: false,
  errMsg,
});

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

const assertRequestedSpecialItemsAllowed = (requestedItems, allowedItems) => {
  if (!requestedItems.length) {
    return;
  }

  const allowedMap = allowedItems.reduce((map, item) => {
    map[item] = true;
    return map;
  }, {});
  const rejectedItem = requestedItems.find((item) => !allowedMap[item]);

  if (rejectedItem) {
    throw new Error("Selected special item is not accepted by this bag");
  }
};

const ensureCollection = async (name) => {
  try {
    await db.createCollection(name);
  } catch (error) {
    // Existing collections throw here; that is fine for this MVP bootstrap.
  }
};

const getRemainingCases = (bag) => {
  if (bag.spaceType !== "fullCase") {
    return 0;
  }

  const explicitRemainingCases = Number(bag.remainingCases);
  if (Number.isInteger(explicitRemainingCases) && explicitRemainingCases >= 0) {
    return explicitRemainingCases;
  }

  const remainingWeight = Number(bag.remainingWeight || 0);
  return Math.floor(remainingWeight / 23);
};

exports.main = async (event = {}) => {
  const wxContext = cloud.getWXContext();
  const senderId = wxContext.OPENID;
  const requestedWeight = Number(event.requestedWeight);
  const requestedSpecialItems = normalizeSpecialItems(event.requestedSpecialItems);

  if (!senderId) {
    return fail("Unable to identify current user");
  }
  if (!event.bagId) {
    return fail("bagId is required");
  }
  if (!Number.isFinite(requestedWeight) || requestedWeight <= 0) {
    return fail("Requested weight must be greater than 0");
  }
  if (!`${event.itemDescription || ""}`.trim()) {
    return fail("itemDescription is required");
  }
  if (!`${event.senderWechat || ""}`.trim()) {
    return fail("senderWechat is required");
  }
  if (!`${event.pickupAddress || ""}`.trim()) {
    return fail("pickupAddress is required");
  }
  if (!`${event.receiverName || ""}`.trim()) {
    return fail("receiverName is required");
  }
  if (!`${event.receiverPhone || ""}`.trim()) {
    return fail("receiverPhone is required");
  }
  if (!`${event.deliveryAddress || ""}`.trim()) {
    return fail("deliveryAddress is required");
  }

  try {
    await ensureCollection("bindings");

    const result = await db.runTransaction(async (transaction) => {
      const bagResult = await transaction.collection("bags").doc(event.bagId).get();
      const bag = bagResult.data;

      if (!bag) {
        throw new Error("Bag not found");
      }
      if (bag.status !== "active") {
        throw new Error("This bag is not available");
      }
      const allowedSpecialItems = normalizeSpecialItems(bag.specialItemOptions);
      assertRequestedSpecialItemsAllowed(requestedSpecialItems, allowedSpecialItems);

      const isFullCase = bag.spaceType === "fullCase";
      if (isFullCase && requestedWeight !== 23) {
        throw new Error("Full suitcase must be bound as 23kg");
      }

      const remainingWeight = Number(bag.remainingWeight);
      if (!Number.isFinite(remainingWeight) || remainingWeight <= 0) {
        throw new Error("This bag has no remaining weight");
      }

      const maxAvailableWeight = Math.round(remainingWeight * 100) / 100;
      if (requestedWeight > maxAvailableWeight) {
        throw new Error(`Requested weight cannot exceed ${maxAvailableWeight}kg`);
      }

      const remainingCases = getRemainingCases(bag);
      if (isFullCase && remainingCases <= 0) {
        throw new Error("This full suitcase bag has no remaining cases");
      }

      const now = new Date();
      const lockDeadlineAt = new Date(now.getTime() + LOCK_WINDOW_MS);
      const newRemainingCases = isFullCase ? Math.max(0, remainingCases - 1) : 0;
      const newRemainingWeight = Math.max(
        0,
        isFullCase
          ? newRemainingCases * 23
          : Math.round((maxAvailableWeight - requestedWeight) * 100) / 100
      );
      const nextStatus = isFullCase
        ? newRemainingCases <= 0
          ? "locked"
          : "active"
        : newRemainingWeight <= 0
          ? "locked"
          : "active";

      const bindingData = {
        bagId: bag._id,
        bagNo: bag.bagNo,
        spaceType: bag.spaceType || "loose",
        senderId,
        senderNickname: `${event.senderNickname || ""}`.trim(),
        carrierId: bag.carrierId,
        fromCity: bag.fromCity,
        toCity: bag.toCity,
        departureDate: bag.departureDate,
        requestedWeight,
        requestedCases: isFullCase ? 1 : 0,
        requestedSpecialItems,
        bagSpecialItemOptions: allowedSpecialItems,
        senderWechat: `${event.senderWechat || ""}`.trim(),
        pickupAddress: `${event.pickupAddress || ""}`.trim(),
        receiverName: `${event.receiverName || ""}`.trim(),
        receiverPhone: `${event.receiverPhone || ""}`.trim(),
        deliveryAddress: `${event.deliveryAddress || ""}`.trim(),
        itemDescription: `${event.itemDescription || ""}`.trim(),
        senderNote: `${event.senderNote || ""}`.trim(),
        status: "pending",
        lockDeadlineAt,
        lockedAt: null,
        createdAt: now,
        updatedAt: now,
      };

      const bindingResult = await transaction.collection("bindings").add({
        data: bindingData,
      });

      await transaction.collection("bags").doc(event.bagId).update({
        data: {
          remainingWeight: newRemainingWeight,
          remainingCases: newRemainingCases,
          status: nextStatus,
          updatedAt: now,
        },
      });

      return {
        success: true,
        data: {
          bindingId: bindingResult._id,
          remainingWeight: newRemainingWeight,
          remainingCases: newRemainingCases,
          status: nextStatus,
        },
      };
    });

    return result;
  } catch (error) {
    return fail(error.message || "bindBag failed");
  }
};
