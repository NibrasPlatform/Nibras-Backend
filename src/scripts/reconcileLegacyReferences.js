const mongoose = require("mongoose");
const logger = require("../core/utils/logger");

const collectionTargets = [
  { name: "questions", field: "author" },
  { name: "answers", field: "author" },
  { name: "posts", field: "author" },
  { name: "threads", field: "author" },
  { name: "votes", field: "user" },
  { name: "activities", field: "studentId" },
  { name: "studentachievements", field: "studentId" },
  { name: "projects", field: "studentId" },
  { name: "deadlines", field: "studentId" },
  { name: "usercontestbookmarks", field: "userId" },
  { name: "usercontestreminders", field: "userId" },
  { name: "usercontestparticipations", field: "userId" },
  { name: "usercompetitiveaccounts", field: "userId" },
  { name: "accountverifications", field: "userId" },
  { name: "competitiveprofilesnapshots", field: "userId" },
  { name: "userproblemprogresses", field: "userId" },
];

const reconcileLegacyReferences = async () => {
  const usersCollection = mongoose.connection.collection("users");
  const users = await usersCollection.find({}, { projection: { _id: 1 } }).toArray();
  const userIds = new Set(users.map((user) => String(user._id)));

  for (const target of collectionTargets) {
    if (!mongoose.connection.collections[target.name]) {
      logger.warn(`Reference audit skipped missing collection ${target.name}`);
      continue;
    }

    const collection = mongoose.connection.collection(target.name);
    const docs = await collection.find({ [target.field]: { $exists: true } }).toArray();
    let invalidRefs = 0;

    for (const doc of docs) {
      if (!userIds.has(String(doc[target.field]))) {
        invalidRefs += 1;
      }
    }

    logger.info(`Reference audit for ${target.name}`, { field: target.field, invalidRefs });
  }
};

module.exports = reconcileLegacyReferences;
