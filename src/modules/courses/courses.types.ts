export interface CourseDTO {
    id: string;
    title: string | null;
    description: string | null;
    image: string | null;
    order_no: number | null;
    lesson_count: number;
}

export interface LessonEmbeddedDTO {
    id: string;
    title: string | null;
    description: string | null;
    order_no: number | null;
}

export interface CourseDetailDTO {
    id: string;
    title: string | null;
    description: string | null;
    image: string | null;
    lessons: LessonEmbeddedDTO[];
}
