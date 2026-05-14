// نطلع خطوتين عشان نوصل للـ src وبعدين ندخل الـ models
const Course = require("../courses/models/course.model");
const Progress = require("../courses/models/progress.model");
const Submission = require("../courses/models/submission.model");

// لستة المواد اللي هنجربها من غير مسافات
const requiredCourses = [
  "CS107", "CS110", "CS161", "CS181", "CS181W", "ENGR40M", "ENGR76", 
  "MATH18", "MATH19", "MATH20", "MATH21", "MATH51", "MATH53", "MATH52", 
  "CS103", "CS109", "PHYS41", "PHYS43", "BIO", "CHEM", "MATH104", 
  "MATH107", "MATH108", "MATH109", "MATH110", "MATH113", "CS157", 
  "CS205L", "PHIL251", "CS106A", "CS106B", "CS106X"
];

const getGradesForAI = async (userId) => {
  // 1. هات كل التسليمات اللي اتقبلت (Approved) للطالب ده
  const submissions = await Submission.find({ 
    userId, 
    status: 'approved' 
  })
  .populate('courseId', 'courseCode') 
  .lean();

  // 2. تجهيز الـ Object بأصفار لكل المواد عشان الموديل ميضربش
  const gradesMap = {};
  requiredCourses.forEach(course => {
    gradesMap[course] = 0; 
  });

  // 3. نحط درجات المواد اللي الطالب خلصها فعلاً
  submissions.forEach(sub => {
    if (sub.courseId && sub.courseId.courseCode) {
      const code = sub.courseId.courseCode;
      
      // نتأكد إن المادة دي من ضمن المواد اللي الموديل طالبها
      if (requiredCourses.includes(code)) {
        // حط الدرجة (ولو الدرجة بتتسجل بكلمة تانية غير grade زي score عدلها هنا)
        gradesMap[code] = sub.grade; 
      }
    }
  });

  // 4. نرجعها جوه key اسمه grades عشان تطابق الـ JSON المطلوب بالظبط
  return {
    grades: gradesMap
  };
};

module.exports = { getGradesForAI };