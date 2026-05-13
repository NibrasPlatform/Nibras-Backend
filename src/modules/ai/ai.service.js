// نطلع خطوتين عشان نوصل للـ src وبعدين ندخل الـ models
const Course = require("../courses/models/course.model");
const Progress = require("../courses/models/progress.model");
const Submission = require("../courses/models/submission.model");

const getGradesForAI = async (userId) => {
  // 1. هات كل التسليمات اللي اتقبلت (Approved) للطالب ده
  const submissions = await Submission.find({ 
    userId, 
    status: 'approved' 
  })
  .populate('courseId', 'courseCode') // تأكد إن الـ ref في الموديل اسمه courseId
  .lean();

  // 2. تجميع الدرجات في الـ Object اللي صاحبه طالبه
  const gradesMap = {};
  submissions.forEach(sub => {
    // تشيك عشان لو فيه كورس ممسوح أو داتا مش كاملة ميعملش Error
    if (sub.courseId && sub.courseId.courseCode) {
      gradesMap[sub.courseId.courseCode] = sub.grade;
    }
  });

  return gradesMap;
};

module.exports = { getGradesForAI };