const Message = require("../models/Message");
const User = require("../models/User");
const { emitNewMessage } = require("../socket/socket");

// @desc   Send a message
// @route  POST /api/messages/send/:receiverId
// @access Private
const sendMessage = async (req, res) => {
  try {
    const { content } = req.body;
    const { receiverId } = req.params;
    const senderId = req.user._id;

    if (!content || !content.trim()) {
      return res.status(400).json({ message: "Message content is required" });
    }

    // Check receiver exists
    const receiver = await User.findById(receiverId);
    if (!receiver) {
      return res.status(404).json({ message: "Receiver not found" });
    }

    const message = await Message.create({
      sender: senderId,
      receiver: receiverId,
      content: content.trim(),
    });

    // Populate sender info for real-time emit
    const populatedMessage = await Message.findById(message._id)
      .populate("sender", "username avatar")
      .populate("receiver", "username avatar");

    // Emit real-time event via Socket.io
    emitNewMessage(populatedMessage);

    res.status(201).json(populatedMessage);
  } catch (error) {
    console.error("Send message error:", error);
    res.status(500).json({ message: "Server error sending message" });
  }
};

// @desc   Get messages between two users
// @route  GET /api/messages/:userId
// @access Private
const getMessages = async (req, res) => {
  try {
    const { userId } = req.params;
    const myId = req.user._id;

    const messages = await Message.find({
      $or: [
        { sender: myId, receiver: userId },
        { sender: userId, receiver: myId },
      ],
    })
      .populate("sender", "username avatar")
      .populate("receiver", "username avatar")
      .sort({ createdAt: 1 });

    // Mark messages from the other user as read
    await Message.updateMany(
      { sender: userId, receiver: myId, isRead: false },
      { isRead: true, readAt: new Date() }
    );

    res.json(messages);
  } catch (error) {
    console.error("Get messages error:", error);
    res.status(500).json({ message: "Server error fetching messages" });
  }
};

// @desc   Get unread message counts per user
// @route  GET /api/messages/unread/counts
// @access Private
const getUnreadCounts = async (req, res) => {
  try {
    const myId = req.user._id;

    const unreadCounts = await Message.aggregate([
      { $match: { receiver: myId, isRead: false } },
      { $group: { _id: "$sender", count: { $sum: 1 } } },
    ]);

    const counts = {};
    unreadCounts.forEach((item) => {
      counts[item._id.toString()] = item.count;
    });

    res.json(counts);
  } catch (error) {
    console.error("Unread counts error:", error);
    res.status(500).json({ message: "Server error fetching unread counts" });
  }
};

module.exports = { sendMessage, getMessages, getUnreadCounts };
