const safeEmit = (room, eventName, payload) => {
  try {
    const { getIo } = require("./socket");
    const io = getIo();
    io.to(room).emit(eventName, payload);
  } catch (error) {
    // intentionally non-throwing for background notifications
  }
};

const safeBroadcast = (eventName, payload) => {
  try {
    const { getIo } = require("./socket");
    const io = getIo();
    io.emit(eventName, payload);
  } catch (error) {
    // intentionally non-throwing for background notifications
  }
};

const getQuestionRoomName = (questionId) => `question:${questionId}`;
const getThreadRoomName = (threadId) => `thread:${threadId}`;
const getCourseRoomName = (courseId) => `course:${courseId}`;

const registerRealtimeEvents = (io, socket) => {
  socket.on("question:join", (questionId) => {
    if (!questionId) return;
    socket.join(`question:${questionId}`);
  });

  socket.on("course:join", (courseId) => {
    if (!courseId) return;
    socket.join(`course:${courseId}`);
  });

  socket.on("thread:join", (threadId) => {
    if (!threadId) return;
    socket.join(`thread:${threadId}`);
  });
};

const emitQuestionCreated = (question) => {
  if (!question) return;
  safeBroadcast("question:created", question);
};

const emitAnswerCreated = (questionId, answer) => {
  if (!questionId || !answer) return;
  safeEmit(getQuestionRoomName(questionId), "answer:created", answer);
};

const emitVoteUpdated = (questionId, payload) => {
  if (!questionId || !payload) return;
  safeEmit(getQuestionRoomName(questionId), "vote:updated", payload);
};

const emitThreadCreated = (thread) => {
  if (!thread) return;
  safeBroadcast("thread:created", thread);
};

const emitPostCreated = (threadId, post) => {
  if (!threadId || !post) return;
  safeEmit(getThreadRoomName(threadId), "post:created", post);
};

const emitVoteUpdatedForThread = (threadId, payload) => {
  if (!threadId || !payload) return;
  safeEmit(getThreadRoomName(threadId), "vote:updated", payload);
};

module.exports = {
  registerRealtimeEvents,
  emitQuestionCreated,
  emitAnswerCreated,
  emitVoteUpdated,
  emitThreadCreated,
  emitPostCreated,
  emitVoteUpdatedForThread,
  getQuestionRoomName,
  getThreadRoomName,
  getCourseRoomName,
};
