import Shop from '../models/Shop.js';

export const createShop = async (req, res) => {
    try {
        const {name, category, description, phone, address, latitude, longitude, openingHours, offersDelivery, deliveryFee } = req.body;

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
                coordinates: [longitude, latitude],
            },
            openingHours: openingHours || 'Mon - Sat, 8:00am - 6:00pm',
            offersDelivery: offersDelivery || false,
            deliveryFee: deliveryFee || 0,
        })
        res.status(201).json({ message: 'Shop created successfully', shop });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Internal server error' });
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
        console.error(error);
        res.status(500).json({ message: 'Internal server error' });
}}

export const getMyShop =async (req, res) =>{
    try {
        const shop = await Shop.findOne({ owner: req.user._id });
        if (!shop) {
            return res.status(404).json({ message: 'You do not own a shop' });
        }
        res.status(200).json({ shop });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Internal server error' });
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
        console.error(error);
        res.status(500).json({ message: 'Internal server error' });
    }
}