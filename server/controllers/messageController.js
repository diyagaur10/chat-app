//get all usrs except the logged in user
import User from "../models/User.js";
import Message from "../models/Message.js";
import cloudinary from "../lib/cloudinary.js";
import { io, userSocketMap } from "../server.js";


export const getUsersForSidebar = async (req,res)=>{
    try{
        const userId = req.user._id;
        const filteredUsers = await User.find({_id: {$ne: userId}}).select("-password");
        const unseenMessages ={}
        const promises = filteredUsers.map(async (user)=>{
            const messages = await Message.find({
                senderId: user._id,
                receiverId: userId,
                seen: false,
            });
           if(messages.length>0){
            unseenMessages[user._id] = messages.length;
           } 

        })
        await Promise.all(promises);
        res.json({success: true, filteredUsers, unseenMessages})
    }catch(error){
        console.log(error.message);
        res.json({success: false, message: error.message})      

    }
}
// geet all msgs for seelected user
export const getMessages = async (req,res)=>{
    try {
        const {id: selectedUserId} = req.params;
        const myId = req.user._id;
        const messages= await  Message.find({
            $or: [
                {senderId: myId, receiverId: selectedUserId},
                {senderId: selectedUserId, receiverId: myId},
            ]
        })
        await Message.updateMany({
            senderId: selectedUserId,
            receiverId: myId },
            {seen: true}
        );

        res.json({success: true, messages})
            
    } catch (error) {
        console.log(error.message);
        res.json({success: false, message: error.message})  
    }
}

//api to mark msg as seen using msg id
export const markMessageAsSeen = async (req,res)=>{
    try {
        const {id} = req.params;
        await Message.findByIdAndUpdate(id, {seen: true});
        res.json({success: true})
    } catch (error) {
        console.log(error.message);
        res.json({success: false, message: error.message}) 
    }
}

// send message to selected user
export const sendMessage = async (req,res)=>{
    try {
        const {text, image}= req.body;
        const receiverId = req.params.id;
        const senderId = req.user._id;

        let imageUrl;
        if(image){
            const upload = await cloudinary.uploader.upload(image)
            imageUrl = upload.secure_url;
        }

        const newMessage = await Message.create({
            senderId,
            receiverId,
            text,
            image: imageUrl,

        })
        //emit new msg to reciever socket
        const receiverSocketId = userSocketMap[receiverId];
        if(receiverSocketId){
            io.to(receiverSocketId).emit("newMessage", newMessage)
        }

        res.json({success: true, newMessage});

    } catch (error) {
        console.log(error.message);
        res.json({success: false, message: error.message}) 
    }
}