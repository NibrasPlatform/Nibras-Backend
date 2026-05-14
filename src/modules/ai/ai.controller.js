const catchAsync = require("../../core/utils/catchAsync");
const aiService = require("./ai.service"); 

const getGrades = catchAsync(async (req, res) => {
  const userId = req.user.id || req.user._id;
  
  // بينادي السيرفيس اللي بيلم الدرجات من الـ Submissions
  const grades = await aiService.getGradesForAI(userId);

  const hasData = Object.keys(grades).length > 0;

  res.status(200).json({
    success: true,
    enoughData: hasData,
    data: {
      grades: grades 
    },
    message: hasData ? "Student grades retrieved successfully" : "No approved grades found for this student."
  });
});

module.exports = { getGrades };