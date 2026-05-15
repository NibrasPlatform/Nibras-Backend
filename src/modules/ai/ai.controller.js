const axios = require("axios");
const catchAsync = require("../../core/utils/catchAsync");
const aiService = require("./ai.service"); 

const getGrades = catchAsync(async (req, res) => {
  const userId = req.user.id || req.user._id;
  
  // 1. هنجيب الداتا (الخدمة دي بترجع Object جواه { grades: { ... } })
  const payload = await aiService.getGradesForAI(userId);

  // 2. التأكد إن فيه درجات حقيقية (أكبر من صفر)
  const hasData = Object.values(payload.grades).some(grade => grade > 0);

  if (!hasData) {
    return res.status(400).json({
      success: false,
      message: "There are not enough grades for this student to generate a recommendation."
    });
  }

  const railwayUrl = process.env.Recommendation_SERVICE_URL;

  try {
    // 3. بنبعت الـ payload (اللي هو أصلاً جواه الـ Key اللي اسمه grades)
    // لو عايز تتأكد 100% ابعتها كدة: { grades: payload.grades }
    const response = await axios.post(railwayUrl, { grades: payload.grades , answer: payload.answer});
    
    res.status(200).json({
      success: true,
      message: "AI recommendation generated successfully",
      grades: payload.grades, // 👈 غيرناها هنا كمان لـ grades عشان تبقى زي اللي رايحة لعبدالله
      answer: payload.answer,
      data: response.data 
    });

  } catch (error) {
    console.error("Error from Railway AI:", error.message);
    res.status(500).json({
      success: false,
      message: "There was an error processing the AI recommendation. Please try again later.",
      error: error.response ? error.response.data : error.message
    });
  }
});

module.exports = { getGrades };