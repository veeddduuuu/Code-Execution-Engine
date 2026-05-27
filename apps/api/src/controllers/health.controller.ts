import {Request, Response} from 'express';

const getHealth = async (req : Request, res : Response) => {
    return res.status(200).json({ message: 'API is healthy' });
};