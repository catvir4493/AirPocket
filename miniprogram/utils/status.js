// One status vocabulary for the whole app. `tone` maps to the .tag-* classes in app.wxss.
const BINDING_STATUS = {
  pending: { text: "等待确认", tone: "wait" },
  locked: { text: "已锁单", tone: "progress" },
  contacted: { text: "已联系", tone: "progress" },
  picked_up: { text: "已取货", tone: "progress" },
  packed: { text: "已打包", tone: "progress" },
  delivered_to_carrier: { text: "已送至带货者", tone: "progress" },
  completed: { text: "已完成", tone: "done" },
  cancelled: { text: "已取消", tone: "off" },
};

const BAG_STATUS = {
  active: { text: "可绑定", tone: "ok" },
  locked: { text: "已锁定", tone: "progress" },
  closed: { text: "已关闭", tone: "off" },
  expired: { text: "已过期", tone: "off" },
};

const pick = (map, status) => map[status] || { text: status || "-", tone: "progress" };

const bindingStatus = (status) => pick(BINDING_STATUS, status);
const bagStatus = (status) => pick(BAG_STATUS, status);

// Ongoing = anything not finished or cancelled.
const isBindingOngoing = (status) => status !== "completed" && status !== "cancelled";

module.exports = {
  BINDING_STATUS,
  BAG_STATUS,
  bindingStatus,
  bagStatus,
  isBindingOngoing,
};
