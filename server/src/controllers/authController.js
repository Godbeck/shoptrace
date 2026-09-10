import User from '../models/User.js';
import generateToken from '../utils/generateToken.js';

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

        const user = await User.create({
            name,
            email,
            phone,
            password,
            role: role || 'customer',
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
        console.error('registerUser error:', error);
        res.status(500).json({ message: 'Server error' });
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
        res.status(500).json({ message: 'Server error' });
    }
}

export const getMe = async (req, res) => {
    res.status(200).json(req.user);
}