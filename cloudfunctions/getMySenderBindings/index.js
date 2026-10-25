const cloud = require("wx-server-sdk");

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV,
});

const db = cloud.database();

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

exports.main = async () => {
  const wxContext = cloud.getWXContext();
  const senderId = wxContext.OPENID;

  if (!senderId) {
    return {
      success: false,
      errMsg: "Unable to identify current user",
    };
  }

  try {
    const result = await db
      .collection("bindings")
      .where({ senderId })
      .orderBy("createdAt", "desc")
      .limit(100)
      .get();
    const now = new Date();
    const bindings = await Promise.all(
      (result.data || []).map((binding) => normalizeBindingLockState(binding, now))
    );

    return {
      success: true,
      data: bindings,
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
      errMsg: error.message || "getMySenderBindings failed",
    };
  }
};
