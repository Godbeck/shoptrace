import User from '../models/User.js';
import generateToken from '../utils/generateToken.js';
import { sendError } from '../utils/apiError.js';

export const registerUser = async (req, res) => {
    try{
        const { name, email, phone, password, role} = req.body;

        if (!name || !email || !phone || !password) {
            return res.status(400).json({ message: 'Please fill in all required fields' });
        }

        const userExits = await User.findOne({ email });

        if (userExits) {
            return res.status(400).json({ message: 'User already exists' });
        }

        // Only these two roles may be self-assigned. Taking the role straight
        // from req.body let anyone register as an admin and hand themselves
        // the whole platform. Admins are promoted by an existing admin, or
        // seeded with `npm run seed:admin`.
        const SELF_SERVE_ROLES = ['customer', 'merchant'];
        const requestedRole = SELF_SERVE_ROLES.includes(role) ? role : 'customer';

        const user = await User.create({
            name,
            email,
            phone,
            password,
            role: requestedRole,
        })

        res.status(201).json({
            _id: user._id,
            name: user.name,
            email: user.email,
            phone: user.phone,
            role: user.role,
            token: generateToken(user._id),
        })
    }
    catch(error){
        return sendError(res, error, "registerUser error:");
    }
}

export const loginUser = async (req, res) => {
    try{
        const {email, password} = req.body;

        if (!email || !password) {
            return res.status(400).json({ message: 'Please fill in all required fields' });
        }

        const user = await User.findOne({ email });

        if (!user) {
            return res.status(401).json({ message: 'Invalid email or password' });
        }

        const isMatch = await user.matchPassword(password);

        if (!isMatch) {
            return res.status(401).json({message: 'Invalid email or password'});
        }

        res.status(200).json({
            _id: user._id,
            name: user.name,
            email: user.email,
            phone: user.phone,
            role: user.role,
            token: generateToken(user._id),
        })
    }
    catch(error){
        return sendError(res, error, "loginUser error:");
    }
}

export const getMe = async (req, res) => {
    res.status(200).json(req.user);
}