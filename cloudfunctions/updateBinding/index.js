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
    return fail("Selected special item is not accepted by this bag");
  }

  return null;
};

const toDate = (value) => {
  if (!value) {
    return null;
  }
  if (value instanceof Date) {
    return value;
  }
  if (value.$date) {
    return new Date(value.$date);
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const getLockDeadline = (binding) => {
  const explicitDeadline = toDate(binding.lockDeadlineAt);
  if (explicitDeadline) {
    return explicitDeadline;
  }

  const createdAt = toDate(binding.createdAt);
  return createdAt ? new Date(createdAt.getTime() + LOCK_WINDOW_MS) : null;
};

const isEditable = (binding, now) => {
  const lockDeadlineAt = getLockDeadline(binding);
  return (
    binding.status === "pending" &&
    lockDeadlineAt &&
    lockDeadlineAt.getTime() > now.getTime()
  );
};

exports.main = async (event = {}) => {
  const { OPENID } = cloud.getWXContext();
  const senderId = OPENID;
  const bindingId = `${event.bindingId || ""}`.trim();
  const requestedWeight = Number(event.requestedWeight);
  const requestedSpecialItems = normalizeSpecialItems(event.requestedSpecialItems);

  if (!senderId) {
    return fail("Unable to identify current user");
  }
  if (!bindingId) {
    return fail("bindingId is required");
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
    const result = await db.runTransaction(async (transaction) => {
      const bindingResult = await transaction.collection("bindings").doc(bindingId).get();
      const binding = bindingResult.data;
      const now = new Date();

      if (!binding) {
        return fail("Binding not found");
      }
      if (binding.senderId !== senderId) {
        return fail("No permission to update this binding");
      }

      const lockDeadlineAt = getLockDeadline(binding);
      if (!isEditable(binding, now)) {
        if (binding.status === "pending" && lockDeadlineAt) {
          await transaction.collection("bindings").doc(bindingId).update({
            data: {
              status: "locked",
              lockDeadlineAt,
              lockedAt: now,
              updatedAt: now,
            },
          });
        }
        return fail("This binding is locked and cannot be edited");
      }

      const bagResult = await transaction.collection("bags").doc(binding.bagId).get();
      const bag = bagResult.data;
      if (!bag) {
        return fail("Bag not found");
      }
      if (!["active", "locked"].includes(bag.status)) {
        return fail("This bag is not available for editing");
      }
      const allowedSpecialItems = normalizeSpecialItems(bag.specialItemOptions);
      const specialItemsError = assertRequestedSpecialItemsAllowed(
        requestedSpecialItems,
        allowedSpecialItems
      );
      if (specialItemsError) {
        return specialItemsError;
      }

      const isFullCase = binding.spaceType === "fullCase" || bag.spaceType === "fullCase";
      if (isFullCase && requestedWeight !== 23) {
        return fail("Full suitcase must stay as 23kg");
      }

      const oldWeight = Number(binding.requestedWeight || 0);
      const remainingWeight = Number(bag.remainingWeight || 0);
      const maxAvailableWeight = Math.round((remainingWeight + oldWeight) * 100) / 100;

      if (!Number.isFinite(maxAvailableWeight) || requestedWeight > maxAvailableWeight) {
        return fail(`Requested weight cannot exceed ${maxAvailableWeight}kg`);
      }

      const newRemainingWeight = Math.max(
        0,
        Math.round((maxAvailableWeight - requestedWeight) * 100) / 100
      );
      const nextBagStatus = newRemainingWeight <= 0 ? "locked" : "active";

      await transaction.collection("bindings").doc(bindingId).update({
        data: {
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
          lockDeadlineAt,
          updatedAt: now,
        },
      });

      await transaction.collection("bags").doc(binding.bagId).update({
        data: {
          remainingWeight: newRemainingWeight,
          status: nextBagStatus,
          updatedAt: now,
        },
      });

      return {
        success: true,
        data: {
          bindingId,
          requestedWeight,
          remainingWeight: newRemainingWeight,
          bagStatus: nextBagStatus,
        },
      };
    });

    return result;
  } catch (error) {
    return fail(error.message || "updateBinding failed");
  }
};
