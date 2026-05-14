const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../../../.env") });

const mongoose = require("mongoose");
const connectDatabase = require("../core/config/database");
const logger = require("../core/utils/logger");
const Role = require("../modules/auth/models/role.model");
require("../modules/community/models/tag.model");
const User = require("../modules/users/models/user.model");
const Question = require("../modules/community/models/question.model");
const Answer = require("../modules/community/models/answer.model");
const Vote = require("../modules/community/models/vote.model");
const Thread = require("../modules/community/models/thread.model");
const Problem = require("../modules/problems/models/problem.model");
const UserProblemProgress = require("../modules/problems/models/userProblemProgress.model");
const StudentAchievement = require("../modules/gamification/models/studentAchievement.model");
const UserContestParticipation = require("../modules/contests/models/userContestParticipation.model");
const Contest = require("../modules/contests/models/contest.model");
const activityEventService = require("../modules/gamification/services/activityEvent.service");

const getRoleName = (userMap, userId) => userMap.get(String(userId)) || "Student";
const normalizeRoleFallback = (rawRole) => {
  const value = String(rawRole || "").trim().toLowerCase();
  if (!value) return "Student";
  if (value === "ta") return "TA";
  return value
    .split(/\s+/)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ");
};

const main = async () => {
  await connectDatabase();

  const users = await User.find().select("role").lean();
  const roleIds = [
    ...new Set(
      users
        .map((user) => user.role)
        .filter((role) => mongoose.Types.ObjectId.isValid(String(role)))
        .map((role) => String(role))
    ),
  ];
  const roles = await Role.find({ _id: { $in: roleIds } }).select("name").lean();
  const roleNameById = new Map(roles.map((role) => [String(role._id), role.name]));
  const userRoleMap = new Map(
    users.map((user) => {
      const roleKey = String(user.role || "");
      const roleName = roleNameById.get(roleKey) || normalizeRoleFallback(user.role);
      return [String(user._id), roleName];
    })
  );

  const [questions, answers, threads, votes, progressRows, achievements, participations, contestsById] = await Promise.all([
    Question.find().populate("tags", "name").select("_id author course createdAt").lean(),
    Answer.find().populate({ path: "question", select: "course" }).select("_id author question createdAt isAccepted").lean(),
    Thread.find().select("_id author course createdAt").lean(),
    Vote.find({ value: 1 }).select("_id user targetId targetType createdAt").lean(),
    UserProblemProgress.find({ solved: true }).select("userId problemId solvedAt").lean(),
    StudentAchievement.find().select("studentId achievementId dateAwarded").lean(),
    UserContestParticipation.find().select("userId contestId joinedAt rank ratingChange createdAt").lean(),
    Contest.find().select("participantsCount").lean(),
  ]);

  const questionMap = new Map(questions.map((question) => [String(question._id), question]));
  const answerMap = new Map(answers.map((answer) => [String(answer._id), answer]));
  const contestMap = new Map(contestsById.map((contest) => [String(contest._id), contest]));

  const problemIds = progressRows.map((row) => row.problemId);
  const problems = await Problem.find({ _id: { $in: problemIds } }).select("_id difficulty").lean();
  const problemMap = new Map(problems.map((problem) => [String(problem._id), problem]));

  for (const question of questions) {
    await activityEventService.recordQuestionCreated({
      userId: question.author,
      questionId: question._id,
      courseId: question.course,
      occurredAt: question.createdAt,
      roleSnapshot: getRoleName(userRoleMap, question.author),
    });
  }

  for (const answer of answers) {
    await activityEventService.recordAnswerCreated({
      userId: answer.author,
      answerId: answer._id,
      questionId: answer.question?._id || answer.question,
      courseId: answer.question?.course || null,
      occurredAt: answer.createdAt,
      roleSnapshot: getRoleName(userRoleMap, answer.author),
    });
    if (answer.isAccepted) {
      await activityEventService.recordAcceptedAnswer({
        userId: answer.author,
        answerId: answer._id,
        questionId: answer.question?._id || answer.question,
        courseId: answer.question?.course || null,
        occurredAt: answer.createdAt,
        roleSnapshot: getRoleName(userRoleMap, answer.author),
      });
    }
  }

  for (const thread of threads) {
    await activityEventService.recordThreadCreated({
      userId: thread.author,
      threadId: thread._id,
      courseId: thread.course,
      occurredAt: thread.createdAt,
      roleSnapshot: getRoleName(userRoleMap, thread.author),
    });
  }

  for (const vote of votes) {
    if (vote.targetType === "question") {
      const question = questionMap.get(String(vote.targetId));
      if (question) {
        await activityEventService.recordVoteReward({
          userId: question.author,
          voteId: vote._id,
          voterId: vote.user,
          targetType: "question",
          targetId: vote.targetId,
          questionId: question._id,
          courseId: question.course,
          occurredAt: vote.createdAt,
          roleSnapshot: getRoleName(userRoleMap, question.author),
        });
      }
    } else if (vote.targetType === "answer") {
      const answer = answerMap.get(String(vote.targetId));
      if (answer) {
        await activityEventService.recordVoteReward({
          userId: answer.author,
          voteId: vote._id,
          voterId: vote.user,
          targetType: "answer",
          targetId: vote.targetId,
          questionId: answer.question?._id || answer.question,
          answerId: answer._id,
          courseId: answer.question?.course || null,
          occurredAt: vote.createdAt,
          roleSnapshot: getRoleName(userRoleMap, answer.author),
        });
      }
    }
  }

  for (const row of progressRows) {
    const problem = problemMap.get(String(row.problemId));
    if (!problem) continue;
    await activityEventService.recordProblemSolved({
      userId: row.userId,
      problem,
      occurredAt: row.solvedAt || row.createdAt || new Date(),
      roleSnapshot: getRoleName(userRoleMap, row.userId),
    });
  }

  for (const achievement of achievements) {
    await activityEventService.recordBadgeAwarded({
      userId: achievement.studentId,
      achievementId: achievement.achievementId,
      occurredAt: achievement.dateAwarded || new Date(),
      roleSnapshot: getRoleName(userRoleMap, achievement.studentId),
    });
  }

  for (const participation of participations) {
    await activityEventService.recordContestJoined({
      userId: participation.userId,
      contestId: participation.contestId,
      occurredAt: participation.joinedAt || participation.createdAt || new Date(),
      roleSnapshot: getRoleName(userRoleMap, participation.userId),
    });

    const contest = contestMap.get(String(participation.contestId));
    const participantsCount = Number(contest?.participantsCount || 0);
    const rank = Number(participation.rank || 0);
    if (participantsCount > 0 && rank > 0) {
      const percentile = rank / participantsCount;
      if (percentile <= 0.1) {
        await activityEventService.recordContestPlacement({
          userId: participation.userId,
          contestId: participation.contestId,
          bucket: "top_10",
          occurredAt: participation.createdAt || participation.joinedAt || new Date(),
          roleSnapshot: getRoleName(userRoleMap, participation.userId),
        });
      } else if (percentile <= 0.25) {
        await activityEventService.recordContestPlacement({
          userId: participation.userId,
          contestId: participation.contestId,
          bucket: "top_25",
          occurredAt: participation.createdAt || participation.joinedAt || new Date(),
          roleSnapshot: getRoleName(userRoleMap, participation.userId),
        });
      }
    }

    if (Number(participation.ratingChange || 0) > 0) {
      await activityEventService.recordContestRatingGain({
        userId: participation.userId,
        contestId: participation.contestId,
        ratingChange: participation.ratingChange,
        occurredAt: participation.createdAt || participation.joinedAt || new Date(),
        roleSnapshot: getRoleName(userRoleMap, participation.userId),
      });
    }
  }

  logger.info("Engagement event backfill completed");
  await mongoose.connection.close();
};

main().catch(async (error) => {
  logger.error("Engagement event backfill failed", { message: error.message });
  try {
    await mongoose.connection.close();
  } catch (_) {
    // ignore shutdown errors
  }
  process.exit(1);
});
