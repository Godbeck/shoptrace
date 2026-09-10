import Counter from "../models/Counter.js";

// ST-00001, ST-00002, ... Human-readable so a customer can read it down the
// phone to a merchant.
const generateOrderNumber = async () => {
  const seq = await Counter.next("orderNumber");
  return `ST-${String(seq).padStart(5, "0")}`;
};

export default generateOrderNumber;
