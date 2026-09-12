import User from "../models/User.js";
import { sendError } from "../utils/apiError.js";

/**
 * Profile: the signed-in user's own details, saved addresses and saved ways
 * to pay.
 *
 * Every handler reads the user from req.user._id. There is no :id parameter
 * anywhere in this file on purpose - a user can only ever edit themselves.
 */

/** Only one address and one payment method can be the default at a time. */
const makeOnlyDefault = (list, id) => {
  list.forEach((entry) => {
    entry.isDefault = entry._id.toString() === id.toString();
  });
};

// PATCH /api/auth/me
export const updateMe = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Note what is absent: role, email and password. Changing a role here
    // would be self-promotion, and email and password need their own flows
    // with verification and a current-password check.
    const allowedFields = ["name", "phone"];

    allowedFields.forEach((field) => {
      if (req.body[field] !== undefined) {
        user[field] = req.body[field];
      }
    });

    await user.save();

    res.status(200).json({
      _id: user._id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: user.role,
    });
  } catch (error) {
    return sendError(res, error, "updateMe error:");
  }
};

/* ------------------------------------------------------------ addresses */

// GET /api/auth/me/addresses
export const getAddresses = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select("addresses");
    res.status(200).json({ addresses: user?.addresses ?? [] });
  } catch (error) {
    return sendError(res, error, "getAddresses error:");
  }
};

// POST /api/auth/me/addresses
export const addAddress = async (req, res) => {
  try {
    const { label, address, latitude, longitude, isDefault } = req.body;

    if (!address || latitude === undefined || longitude === undefined) {
      return res
        .status(400)
        .json({ message: "An address and its coordinates are required" });
    }

    const user = await User.findById(req.user._id);

    user.addresses.push({
      label: label || "Home",
      address,
      // Named fields in, GeoJSON [longitude, latitude] out - the same flip
      // the shop and order controllers do.
      location: { type: "Point", coordinates: [longitude, latitude] },
      // The very first address saved becomes the default automatically,
      // otherwise the customer would have none selected at checkout.
      isDefault: Boolean(isDefault) || user.addresses.length === 0,
    });

    const created = user.addresses[user.addresses.length - 1];
    if (created.isDefault) makeOnlyDefault(user.addresses, created._id);

    await user.save();

    res.status(201).json({ addresses: user.addresses });
  } catch (error) {
    return sendError(res, error, "addAddress error:");
  }
};

// PATCH /api/auth/me/addresses/:addressId
export const updateAddress = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    const address = user.addresses.id(req.params.addressId);

    if (!address) {
      return res.status(404).json({ message: "Address not found" });
    }

    if (req.body.label !== undefined) address.label = req.body.label;
    if (req.body.address !== undefined) address.address = req.body.address;
    if (req.body.latitude !== undefined && req.body.longitude !== undefined) {
      address.location = {
        type: "Point",
        coordinates: [req.body.longitude, req.body.latitude],
      };
    }
    if (req.body.isDefault) makeOnlyDefault(user.addresses, address._id);

    await user.save();

    res.status(200).json({ addresses: user.addresses });
  } catch (error) {
    return sendError(res, error, "updateAddress error:");
  }
};

// DELETE /api/auth/me/addresses/:addressId
export const deleteAddress = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    const address = user.addresses.id(req.params.addressId);

    if (!address) {
      return res.status(404).json({ message: "Address not found" });
    }

    const wasDefault = address.isDefault;
    address.deleteOne();

    // Removing the default would otherwise leave the customer with several
    // addresses and none selected.
    if (wasDefault && user.addresses.length > 0) {
      user.addresses[0].isDefault = true;
    }

    await user.save();

    res.status(200).json({ addresses: user.addresses });
  } catch (error) {
    return sendError(res, error, "deleteAddress error:");
  }
};

/* ------------------------------------------------------ payment methods */

// GET /api/auth/me/payment-methods
export const getPaymentMethods = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select("paymentMethods");
    res.status(200).json({ paymentMethods: user?.paymentMethods ?? [] });
  } catch (error) {
    return sendError(res, error, "getPaymentMethods error:");
  }
};

// POST /api/auth/me/payment-methods
export const addPaymentMethod = async (req, res) => {
  try {
    const { provider, phone, isDefault } = req.body;

    if (!provider || !phone) {
      return res
        .status(400)
        .json({ message: "A provider and mobile money number are required" });
    }

    const digits = String(phone).replace(/\D/g, "");
    if (digits.length !== 10) {
      return res
        .status(400)
        .json({ message: "Enter a 10-digit mobile money number" });
    }

    const user = await User.findById(req.user._id);

    const duplicate = user.paymentMethods.some((m) => m.phone === digits);
    if (duplicate) {
      return res
        .status(409)
        .json({ message: "That number is already saved" });
    }

    user.paymentMethods.push({
      type: "momo",
      provider,
      phone: digits,
      isDefault: Boolean(isDefault) || user.paymentMethods.length === 0,
    });

    const created = user.paymentMethods[user.paymentMethods.length - 1];
    if (created.isDefault) makeOnlyDefault(user.paymentMethods, created._id);

    await user.save();

    res.status(201).json({ paymentMethods: user.paymentMethods });
  } catch (error) {
    return sendError(res, error, "addPaymentMethod error:");
  }
};

// PATCH /api/auth/me/payment-methods/:methodId
export const updatePaymentMethod = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    const method = user.paymentMethods.id(req.params.methodId);

    if (!method) {
      return res.status(404).json({ message: "Payment method not found" });
    }

    if (req.body.provider !== undefined) method.provider = req.body.provider;
    if (req.body.isDefault) makeOnlyDefault(user.paymentMethods, method._id);

    await user.save();

    res.status(200).json({ paymentMethods: user.paymentMethods });
  } catch (error) {
    return sendError(res, error, "updatePaymentMethod error:");
  }
};

// DELETE /api/auth/me/payment-methods/:methodId
export const deletePaymentMethod = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    const method = user.paymentMethods.id(req.params.methodId);

    if (!method) {
      return res.status(404).json({ message: "Payment method not found" });
    }

    const wasDefault = method.isDefault;
    method.deleteOne();

    if (wasDefault && user.paymentMethods.length > 0) {
      user.paymentMethods[0].isDefault = true;
    }

    await user.save();

    res.status(200).json({ paymentMethods: user.paymentMethods });
  } catch (error) {
    return sendError(res, error, "deletePaymentMethod error:");
  }
};
