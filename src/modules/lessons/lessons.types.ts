export interface TopicSummaryDTO {
    id: string;
    title: string | null;
    description: string | null;
    image: string | null;
    order_no: number;
}

export interface LessonDetailDTO {
    id: string;
    course_id: string | null;
    title: string | null;
    description: string | null;
    topics: TopicSummaryDTO[];
}

export interface CreateLessonBody {
    course_id: string;
    title: string;
    description?: string;
    order_no?: number;
}

export interface UpdateLessonBody {
    course_id?: string;
    title?: string;
    description?: string;
    order_no?: number;
}
