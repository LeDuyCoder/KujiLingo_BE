export interface LessonProgressInput {
    id: string;
    quiz_count: number;
}

export interface LessonProgressStatus extends LessonProgressInput {
    is_completed: boolean;
    is_unlocked: boolean;
}

export function buildLessonProgress(
    lessons: LessonProgressInput[],
    completedLessonIds: Set<string>
): LessonProgressStatus[] {
    let blockedByIncompleteQuiz = false;

    return lessons.map((lesson) => {
        const is_unlocked = !blockedByIncompleteQuiz;
        const is_completed = completedLessonIds.has(lesson.id);

        if (is_unlocked && lesson.quiz_count > 0 && !is_completed) {
            blockedByIncompleteQuiz = true;
        }

        return { ...lesson, is_completed, is_unlocked };
    });
}
