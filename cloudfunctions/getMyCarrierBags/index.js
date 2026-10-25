const cloud = require("wx-server-sdk");

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV,
});

const db = cloud.database();
const _ = db.command;

const LOCK_WINDOW_MS = 2 * 60 * 60 * 1000;

const isCollectionMissing = (error) =>
  `${error.message || error.errMsg || error}`.toLowerCase().includes("not exist");

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

const normalizeBindingLockState = async (binding, now) => {
  const lockDeadlineAt = getLockDeadline(binding);
  const shouldLock =
    binding.status === "pending" && lockDeadlineAt && lockDeadlineAt.getTime() <= now.getTime();

  if (!shouldLock) {
    return {
      ...binding,
      lockDeadlineAt: binding.lockDeadlineAt || lockDeadlineAt,
    };
  }

  await db.collection("bindings").doc(binding._id).update({
    data: {
      status: "locked",
      lockDeadlineAt,
      lockedAt: now,
      updatedAt: now,
    },
  });

  return {
    ...binding,
    status: "locked",
    lockDeadlineAt,
    lockedAt: now,
    updatedAt: now,
  };
};

const sanitizeBindingForCarrier = (binding) => {
  const {
    senderWechat,
    pickupAddress,
    receiverName,
    receiverPhone,
    deliveryAddress,
    ...safeBinding
  } = binding;
  return safeBinding;
};

exports.main = async () => {
  const wxContext = cloud.getWXContext();
  const carrierId = wxContext.OPENID;

  if (!carrierId) {
    return {
      success: false,
      errMsg: "Unable to identify current user",
    };
  }

  try {
    const bagResult = await db
      .collection("bags")
      .where({ carrierId })
      .orderBy("createdAt", "desc")
      .limit(100)
      .get();

    const bags = bagResult.data || [];
    const bagIds = bags.map((bag) => bag._id).filter(Boolean);
    let bindings = [];

    if (bagIds.length) {
      try {
        const bindingResult = await db
          .collection("bindings")
          .where({
            bagId: _.in(bagIds),
          })
          .orderBy("createdAt", "desc")
          .limit(300)
          .get();
        const now = new Date();
        const normalizedBindings = await Promise.all(
          (bindingResult.data || []).map((binding) => normalizeBindingLockState(binding, now))
        );
        bindings = normalizedBindings.map(sanitizeBindingForCarrier);
      } catch (error) {
        if (!isCollectionMissing(error)) {
          throw error;
        }
      }
    }

    const bindingsByBag = bindings.reduce((map, binding) => {
      if (!map[binding.bagId]) {
        map[binding.bagId] = [];
      }
      map[binding.bagId].push(binding);
      return map;
    }, {});

    const data = bags.map((bag) => {
      const bagBindings = bindingsByBag[bag._id] || [];
      const boundWeight = bagBindings.reduce(
        (sum, binding) =>
          binding.status === "cancelled" ? sum : sum + Number(binding.requestedWeight || 0),
        0
      );
      return {
        ...bag,
        bindings: bagBindings,
        bindingCount: bagBindings.length,
        boundWeight: Math.round(boundWeight * 100) / 100,
      };
    });

    return {
      success: true,
      data,
    };
  } catch (error) {
    if (isCollectionMissing(error)) {
      return {
        success: true,
        data: [],
      };
    }
    return {
      success: false,
      errMsg: error.message || "getMyCarrierBags failed",
    };
  }
};
