const express = require("express");
const router = express.Router();
const { sendMessage, getMessages, getUnreadCounts } = require("../controllers/messageController");
const { protect } = require("../middleware/authMiddleware");

router.post("/send/:receiverId", protect, sendMessage);
router.get("/unread/counts", protect, getUnreadCounts);
router.get("/:userId", protect, getMessages);

module.exports = router;
