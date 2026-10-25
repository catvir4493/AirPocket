const cloud = require("wx-server-sdk");

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV,
});

const db = cloud.database();

const BAG_STATUSES = ["active", "locked", "closed", "expired"];

const fail = (errMsg) => ({
  success: false,
  errMsg,
});

const toMessage = (error) => `${error.message || error.errMsg || error}`;

const isCollectionMissing = (error) =>
  toMessage(error).toLowerCase().includes("not exist");

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

const ensureAuditLogsCollection = async () => {
  try {
    await db.createCollection("auditLogs");
  } catch (error) {
    // Collection already exists in normal operation.
  }
};

const writeAuditLog = async ({ actorOpenid, bag, beforeStatus, afterStatus, note, now }) => {
  await ensureAuditLogsCollection();
  await db.collection("auditLogs").add({
    data: {
      actorOpenid,
      action: "updateBagStatus",
      targetType: "bag",
      targetId: bag._id,
      targetBagNo: bag.bagNo || "",
      before: {
        status: beforeStatus || "",
      },
      after: {
        status: afterStatus || "",
      },
      note: `${note || ""}`.trim(),
      createdAt: now,
    },
  });
};

exports.main = async (event = {}) => {
  try {
    const actorOpenid = await assertAdmin();

    if (!event.bagId) {
      return fail("bagId is required");
    }
    if (!BAG_STATUSES.includes(event.status)) {
      return fail("Invalid bag status");
    }

    const now = new Date();
    const bagResult = await db.collection("bags").doc(event.bagId).get();
    const bag = bagResult.data;
    if (!bag) {
      return fail("Bag not found");
    }

    await db.collection("bags").doc(event.bagId).update({
      data: {
        status: event.status,
        updatedAt: now,
      },
    });

    await writeAuditLog({
      actorOpenid,
      bag,
      beforeStatus: bag.status,
      afterStatus: event.status,
      note: event.note,
      now,
    });

    return {
      success: true,
      data: {
        bagId: event.bagId,
        status: event.status,
        updatedAt: now,
      },
    };
  } catch (error) {
    return fail(error.message || "adminUpdateBagStatus failed");
  }
};
