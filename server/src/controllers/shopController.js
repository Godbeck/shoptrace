import Shop from '../models/Shop.js';
import { enqueueQuietly, JOBS } from '../jobs/queue.js';
import { sendError } from '../utils/apiError.js';

export const createShop = async (req, res) => {
    try {
        const {name, category, description, phone, address, latitude, longitude, openingHours, deliveryRange } = req.body;

        if (!name || !category || !phone || !address || latitude === undefined || longitude === undefined) {
            return res.status(400).json({ message: 'Please fill in all required fields' });
        }

        const existingShop = await Shop.findOne({ owner: req.user._id });
        if (existingShop) {
            return res.status(400).json({ message: 'You already own a shop' });
        }

        const shop = await Shop.create({
            owner: req.user._id,
            name,
            category,
            description,
            phone,
            address,
            location: {
                type: 'Point',
                // GeoJSON is [longitude, latitude]. The client sends them by
                // name; the flip happens here and only here.
                coordinates: [longitude, latitude],
            },
            openingHours: openingHours || 'Mon - Sat, 8:00am - 6:00pm',
            // A word, never a fee or a distance.
            deliveryRange: deliveryRange || 'none',
        })
        res.status(201).json({ message: 'Shop created successfully', shop });
    } catch (error) {
        return sendError(res, error, "createShop error:");
    }
}

export const getNearbyShops = async (req, res) => {
    try {
        const { latitude, longitude, radius = 5000, category } = req.query;

        if (!latitude || !longitude) {
            return res.status(400).json({ message: 'Please provide latitude and longitude' });
        }

        const query = {
            status: 'verified',
            location: {
                $near: {
                    $geometry: {
                        type: 'Point',
                        coordinates: [parseFloat(longitude), parseFloat(latitude)],
                    },
                    $maxDistance: parseInt(radius),
                },
            },
        };

        if (category) {
            query.category = category;
        }

        const shops = await Shop.find(query).populate('owner', 'name email');

        res.status(200).json({
            count: shops.length,
            shops,
         });
    } catch (error) {
        return sendError(res, error, "getNearbyShops error:");
}}

export const getMyShop =async (req, res) =>{
    try {
        const shop = await Shop.findOne({ owner: req.user._id });
        if (!shop) {
            return res.status(404).json({ message: 'You do not own a shop' });
        }
        res.status(200).json({ shop });
    } catch (error) {
        return sendError(res, error, "getMyShop error:");
    }
}

/**
 * PATCH /api/shops/my-shop
 *
 * The merchant's shop settings screen. Note what is not on the allowlist:
 * status, isFeatured, subscriptionTier, averageRating, verifiedAt. A merchant
 * who could send status: 'verified' would never need an admin.
 */
export const updateMyShop = async (req, res) => {
    try {
        const shop = await Shop.findOne({ owner: req.user._id });

        if (!shop) {
            return res.status(404).json({ message: 'You do not own a shop' });
        }

        const allowedFields = [
            'name',
            'category',
            'description',
            'phone',
            'address',
            'openingHours',
            'deliveryRange',
            'logoUrl',
        ];

        const previousName = shop.name;

        allowedFields.forEach((field) => {
            if (req.body[field] !== undefined) {
                shop[field] = req.body[field];
            }
        });

        // Coordinates arrive named and are flipped here, same as on create.
        if (req.body.latitude !== undefined && req.body.longitude !== undefined) {
            shop.location = {
                type: 'Point',
                coordinates: [req.body.longitude, req.body.latitude],
            };
        }

        await shop.save();

        // Products carry a copy of the shop name so search needs no join.
        // A rename makes every one of those copies stale, so a job fixes them.
        if (shop.name !== previousName) {
            enqueueQuietly(JOBS.SYNC_SHOP_NAME, { shopId: shop._id.toString() });
        }

        res.status(200).json({ message: 'Shop updated', shop });
    } catch (error) {
        return sendError(res, error, "updateMyShop error:");
    }
}

export const getShopById = async (req, res) => {
    try {
        const shop = await Shop.findById(req.params.id).populate('owner', 'name');
        if (!shop) {
            return res.status(404).json({ message: 'Shop not found' });
        }
        res.status(200).json({ shop });
    } catch (error) {
        return sendError(res, error, "getShopById error:");
    }
}
