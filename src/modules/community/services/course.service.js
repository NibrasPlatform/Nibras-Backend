const Course = require("../../courses/models/course.model");
const User = require("../../users/models/user.model");
const AppError = require("../../../core/utils/errorHandler");
const status = require("../../../core/constants/httpStatus");

const ALLOWED_CREATE_FIELDS = ["title", "description", "instructor"];
const ALLOWED_UPDATE_FIELDS = ["title", "description", "isActive"];

const createCourse = async (data) => {
    const safeData = Object.fromEntries(
        Object.entries(data).filter(([key]) => ALLOWED_CREATE_FIELDS.includes(key))
    );

    const course = await Course.create(safeData);
    return await Course.findById(course._id).populate("instructor", "name avatar role");
};

const getCourses = async (filters = {}) => {
    const query = {};

    if (filters.search) {
        query.$text = { $search: filters.search };
    }

    if (filters.isActive !== undefined) {
        query.isActive = filters.isActive;
    }

    if (filters.instructorId) {
        query.instructor = filters.instructorId;
    }

    return await Course.find(query)
        .populate("instructor", "name avatar role")
        .sort({ createdAt: -1 });
};

const getCourseById = async (id) => {
    return await Course.findById(id).populate("instructor", "name avatar role");
};

const updateCourse = async (id, data) => {
    const safeData = Object.fromEntries(
        Object.entries(data).filter(([key]) => ALLOWED_UPDATE_FIELDS.includes(key))
    );

    const updated = await Course.findByIdAndUpdate(id, safeData, {
        returnDocument: "after",
    }).populate("instructor", "name avatar role");

    return updated;
};

const deleteCourse = async (id) => {
    const course = await Course.findByIdAndDelete(id);
    if (course) {
        console.warn(
            `[course.service] Course ${id} deleted. Threads referencing this course are now orphaned.`
        );
    }
    return course;
};

const enrollStudent = async (courseId, userId) => {
    const course = await Course.findById(courseId);
    if (!course) {
        throw AppError.create("Course not found", 404, status.Fail);
    }

    const alreadyEnrolled = course.enrolledStudents.some(
        (e) => String(e.student) === String(userId)
    );
    if (alreadyEnrolled) {
        throw AppError.create("You are already enrolled in this course", 400, status.Fail);
    }

    // Write User first, rollback if Course write fails
    await User.findByIdAndUpdate(userId, {
        $push: {
            enrolledCourses: { course: courseId, enrolledAt: new Date() },
        },
    });

    try {
        await Course.findByIdAndUpdate(courseId, {
            $push: {
                enrolledStudents: { student: userId, enrolledAt: new Date() },
            },
        });
    } catch (err) {
        // Rollback User write
        await User.findByIdAndUpdate(userId, {
            $pull: { enrolledCourses: { course: courseId } },
        });
        throw AppError.create("Enrollment failed. Please try again.", 500, status.Error);
    }

    return await Course.findById(courseId).populate("instructor", "name avatar role");
};

const unenrollStudent = async (courseId, userId) => {
    const course = await Course.findById(courseId);
    if (!course) {
        throw AppError.create("Course not found", 404, status.Fail);
    }

    await Promise.all([
        Course.findByIdAndUpdate(courseId, {
            $pull: { enrolledStudents: { student: userId } },
        }),
        User.findByIdAndUpdate(userId, {
            $pull: { enrolledCourses: { course: courseId } },
        }),
    ]);

    return await Course.findById(courseId).populate("instructor", "name avatar role");
};

/**
 * Checks enrollment using the already-loaded req.user object (zero extra DB queries).
 * Instructors and admins always pass.
 */
const isEnrolled = (user, courseId) => {
    if (!user) return false;
    const roleName = String(user?.role?.name || user?.role || "").toLowerCase();
    if (roleName === "admin" || roleName === "super admin" || roleName === "instructor") return true;

    return user.enrolledCourses.some(
        (e) => String(e.course) === String(courseId)
    );
};

module.exports = {
    createCourse,
    getCourses,
    getCourseById,
    updateCourse,
    deleteCourse,
    enrollStudent,
    unenrollStudent,
    isEnrolled,
};
