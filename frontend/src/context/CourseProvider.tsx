import { useState, useEffect, ReactNode } from "react";
import axiosInstance from "../api/axiosInstance";
import { getMyCourses } from "../api/course/courseApi";
import { CourseContext, CourseContextType, Course } from "./CourseContext";

export const CourseProvider = ({ children }: { children: ReactNode }) => {
  const [courses, setCourses] = useState<Course[]>([]);
  const [myCourses, setMyCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    axiosInstance.get<Course[]>("/course/all")
      .then(res => setCourses(res.data))
      .then(() => setLoading(false), () => setLoading(false));
    // Canonical lms_admin "My Courses" (paid ∪ enrolled ∪ delegated) — replaces
    // the legacy course-service /enroll/my-courses (different DB + id space).
    getMyCourses().then((rows) => setMyCourses(rows as unknown as Course[])).catch(() => setMyCourses([]));
  }, []);

  const addCourse = async (data: Partial<Course>) => axiosInstance.post("/course/add", data);
  const enrollCourse = async (data: { courseId: string }) => axiosInstance.post("/course/enroll/", data);

  const contextValue: CourseContextType = {
    courses,
    myCourses,
    loading,
    addCourse,
    enrollCourse
  };

  return (
    <CourseContext.Provider value={contextValue}>
      {children}
    </CourseContext.Provider>
  );
};