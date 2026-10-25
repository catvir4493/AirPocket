const cloud = require("wx-server-sdk");

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV,
});

const db = cloud.database();
const _ = db.command;

const LOCK_WINDOW_MS = 2 * 60 * 60 * 1000;

const fail = (errMsg) => ({
  success: false,
  errMsg,
});

const toMessage = (error) => `${error.message || error.errMsg || error}`;

const isCollectionMissing = (error) =>
  toMessage(error).toLowerCase().includes("not exist");

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

const getAdminRecord = async (openid) => {
  try {
    const result = await db
      .collection("admins")
      .where({
        openid,
      })
      .limit(1)
      .get();
    return result.data[0] || null;
  } catch (error) {
    if (isCollectionMissing(error)) {
      return null;
    }
    throw error;
  }
};

const getRecentAuditLogs = async () => {
  try {
    const result = await db
      .collection("auditLogs")
      .orderBy("createdAt", "desc")
      .limit(30)
      .get();
    return result.data || [];
  } catch (error) {
    if (isCollectionMissing(error)) {
      return [];
    }
    throw error;
  }
};

const assertAdmin = async () => {
  const { OPENID } = cloud.getWXContext();
  if (!OPENID) {
    throw new Error("Admin permission required");
  }

  const adminRecord = await getAdminRecord(OPENID);
  if (!adminRecord || adminRecord.status !== "active") {
    throw new Error("Admin permission required");
  }

  return OPENID;
};

exports.main = async () => {
  try {
    await assertAdmin();

    const bagResult = await db
      .collection("bags")
      .orderBy("departureDate", "asc")
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
          .limit(500)
          .get();
        const now = new Date();
        bindings = await Promise.all(
          (bindingResult.data || []).map((binding) => normalizeBindingLockState(binding, now))
        );
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
    const auditLogs = await getRecentAuditLogs();

    return {
      success: true,
      data,
      auditLogs,
      summary: {
        bagCount: bags.length,
        bindingCount: bindings.length,
        auditLogCount: auditLogs.length,
      },
    };
  } catch (error) {
    if (isCollectionMissing(error)) {
      return {
        success: true,
        data: [],
        auditLogs: [],
        summary: {
          bagCount: 0,
          bindingCount: 0,
          auditLogCount: 0,
        },
      };
    }
    return fail(error.message || "adminGetDashboard failed");
  }
};
